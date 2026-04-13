"use client";

import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VariablePath } from "@/components/variable-picker";
import { VariableChipInput } from "@/components/variable-chip-input";
import { VariableDropdown } from "@/components/variable-dropdown";
import { StyledTextarea } from "@/components/styled-textarea";
import { ChipTextarea } from "@/components/chip-textarea";
import { getAvailableSteps, SelectedNode } from "@/lib/variables";
import {
  MoreHorizontal,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code,
  Database,
  Globe,
  Terminal,
  ClipboardList,
  X,
  GripVertical,
  AlertTriangle,
  Sparkles,
  ArrowUp,
  Pencil,
} from "lucide-react";
import { TriggerIcon, AIIcon, SMSIcon, WidgetIcon, CloseIcon, TrashIcon } from "@/components/icons";
import { WorkflowStepConnector } from "@/components/workflow-step-connector";
import {
  ADD_STEP_CATALOG_GROUPS,
  findCatalogItem,
  getDefaultCustomStepAlias,
  isCatalogItemBasicTier,
  WORKFLOW_BASIC_CATALOG_IDS,
  WORKFLOW_CATALOG_DRAG_MIME,
  WORKFLOW_TIER_CHIP_CLASS_ADVANCED,
  WORKFLOW_TIER_CHIP_CLASS_BASIC,
  WORKFLOW_TIER_CHIP_FONT_STYLE,
  type CatalogItemWithCategory,
} from "@/components/add-step-catalog";
import {
  parseAiWorkflowFromPrompt,
  refineRunFunctionFromPrompt,
  isAiRunFunctionBasicTier,
} from "@/lib/ai-workflow-from-prompt";
import {
  isWorkflowBasicTriggerOption,
  WORKFLOW_BASIC_START_DATE_BROWSE_PATH,
  type WorkflowBasicStartDateBrowsePath,
} from "@/lib/workflow-basic-trigger";
import { cn } from "@/lib/utils";
import TriggerSelector from "@/components/trigger-selector/TriggerSelector";

/** Matches WFchat `WorkflowStepCard` — width, radius, selected shadow, dimmed opacity. */
function workflowCanvasNodeClass(isSelected: boolean, hasCanvasSelection: boolean) {
  return cn(
    "flex w-[280px] min-h-[62px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg border bg-white outline-none transition-[box-shadow,opacity,border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/40",
    isSelected
      ? "border-2 border-[#5aa5e7] shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
      : hasCanvasSelection
        ? "border border-[#e0dede] opacity-40 hover:opacity-100"
        : "border border-[#e0dede]"
  );
}

const RIPPLING_CATEGORIES = [
  "Employee",
  "Time and Attendance",
  "Compliance",
  "Learning Management",
  "Payroll",
  "Benefits",
  "Recruiting",
  "Performance",
  "Documents",
  "Departments",
  "Compensation",
  "Leave Management",
  "Work Locations",
  "App Management",
  "Device Management",
  "Expense Management",
];

const WORKFLOW_TRIGGER_ID = "flow-trigger";

type WorkflowFlowStep =
  | { id: string; role: "trigger" }
  | { id: string; role: "aiPrompt"; title: string }
  | { id: string; role: "widget"; title: string }
  | {
      id: string;
      role: "runFunction";
      runLabel: string;
      functionTitle: string;
      summary: string;
      functionTier: "basic" | "advanced";
      /** AI chat prototype: generated source for the function drawer. */
      generatedCode: string;
    }
  | {
      id: string;
      role: "custom";
      catalogItemId: string;
      title: string;
      categoryLabel: string;
    };

function getWorkflowTier(
  steps: WorkflowFlowStep[],
  triggerOptionId: string | null
): "Basic" | "Advanced" {
  if (triggerOptionId !== null && !isWorkflowBasicTriggerOption(triggerOptionId)) {
    return "Advanced";
  }
  for (const step of steps) {
    if (step.role === "trigger") continue;
    if (step.role === "aiPrompt" || step.role === "widget") return "Advanced";
    if (step.role === "runFunction") {
      if (step.functionTier === "advanced") return "Advanced";
      continue;
    }
    if (
      step.role === "custom" &&
      !WORKFLOW_BASIC_CATALOG_IDS.has(step.catalogItemId)
    ) {
      return "Advanced";
    }
  }
  return "Basic";
}

/** Whether a step forces Advanced tier (same rules as {@link getWorkflowTier}, excluding trigger). */
function isWorkflowStepAdvancedTier(step: WorkflowFlowStep): boolean {
  if (step.role === "trigger") return false;
  if (step.role === "aiPrompt" || step.role === "widget") return true;
  if (step.role === "runFunction") return step.functionTier === "advanced";
  if (step.role === "custom") return !WORKFLOW_BASIC_CATALOG_IDS.has(step.catalogItemId);
  return false;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [workflowFlowSteps, setWorkflowFlowSteps] = useState<WorkflowFlowStep[]>([
    { id: WORKFLOW_TRIGGER_ID, role: "trigger" },
  ]);
  const [selectedCanvasStepId, setSelectedCanvasStepId] = useState<string | null>(null);

  const [workflowTitle, setWorkflowTitle] = useState("Scheduled health check");
  const [workflowTitleEditing, setWorkflowTitleEditing] = useState(false);
  const [workflowTitleDraft, setWorkflowTitleDraft] = useState(workflowTitle);
  const workflowTitleInputRef = useRef<HTMLInputElement>(null);
  /** Canvas + trigger drawer — updated when AI chat builds a workflow from a prompt. */
  const [workflowTriggerLabel, setWorkflowTriggerLabel] = useState(
    "Start date at 9:00 AM PST"
  );
  /** From trigger modal / AI; only `start-date` keeps Basic tier eligible with Basic steps. */
  const [workflowTriggerOptionId, setWorkflowTriggerOptionId] = useState<string | null>(
    "start-date"
  );

  const workflowTier = useMemo(
    () => getWorkflowTier(workflowFlowSteps, workflowTriggerOptionId),
    [workflowFlowSteps, workflowTriggerOptionId]
  );

  /** Basic vs Advanced on catalog rows only applies when the trigger can yield a Basic workflow (`start-date`). */
  const catalogStepTierLabelsActive = isWorkflowBasicTriggerOption(workflowTriggerOptionId);

  type WorkflowChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
  };
  const [workflowChatMessages, setWorkflowChatMessages] = useState<WorkflowChatMessage[]>(
    []
  );
  const [workflowChatInput, setWorkflowChatInput] = useState("");
  const [workflowChatBusy, setWorkflowChatBusy] = useState(false);
  const workflowChatEndRef = useRef<HTMLDivElement>(null);
  /** Right “Workflow assistant” column — toggled from purple top bar or Close in pane. */
  const [workflowAssistantOpen, setWorkflowAssistantOpen] = useState(true);
  /** Trigger selection modal (shared with triggerselection prototype). */
  const [workflowTriggerSelectorOpen, setWorkflowTriggerSelectorOpen] = useState(false);
  /** When set, opening the trigger selector jumps to this browse path (e.g. Start date detail). */
  const [triggerSelectorInitialBrowse, setTriggerSelectorInitialBrowse] =
    useState<WorkflowBasicStartDateBrowsePath | null>(null);
  useEffect(() => {
    if (workflowTitleEditing) {
      workflowTitleInputRef.current?.focus();
      workflowTitleInputRef.current?.select();
    }
  }, [workflowTitleEditing]);

  function commitWorkflowTitle() {
    const next = workflowTitleDraft.trim();
    if (!next) {
      setWorkflowTitleDraft(workflowTitle);
      setWorkflowTitleEditing(false);
      return;
    }
    if (next !== workflowTitle) {
      setWorkflowTitle(next);
    }
    setWorkflowTitleEditing(false);
  }
  /** Sidebar catalog chip is being dragged — canvas connectors show expanded drop targets. */
  const [catalogDragActive, setCatalogDragActive] = useState(false);

  const selectedFlowStep =
    workflowFlowSteps.find((s) => s.id === selectedCanvasStepId) ?? null;
  const selectedNode: SelectedNode =
    selectedFlowStep?.role === "trigger"
      ? "trigger"
      : selectedFlowStep?.role === "aiPrompt"
        ? "aiPrompt"
        : selectedFlowStep?.role === "widget"
          ? "widget"
          : null;

  function handleInsertCatalogStep(
    item: CatalogItemWithCategory,
    insertIndex: number
  ) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setWorkflowFlowSteps((prev) => {
      const tr = prev[0];
      if (!tr || tr.role !== "trigger") return prev;
      const mid = prev.slice(1);
      const title = getDefaultCustomStepAlias(item.id, mid);
      const newStep: WorkflowFlowStep = {
        id,
        role: "custom",
        catalogItemId: item.id,
        title,
        categoryLabel: item.category,
      };
      const next = [...mid];
      const idx = Math.min(Math.max(0, insertIndex), next.length);
      next.splice(idx, 0, newStep);
      return [tr, ...next];
    });
  }

  function handleRemoveSelectedStep() {
    const id = selectedCanvasStepId;
    if (!id || id === WORKFLOW_TRIGGER_ID) return;
    setWorkflowFlowSteps((prev) => prev.filter((s) => s.id !== id));
    setSelectedCanvasStepId(null);
  }

  function handleRemoveAdvancedSteps() {
    setWorkflowFlowSteps((prev) => {
      const next = prev.filter((s) => !isWorkflowStepAdvancedTier(s));
      setSelectedCanvasStepId((cur) =>
        cur && next.some((s) => s.id === cur) ? cur : null
      );
      return next;
    });
  }

  function handleWorkflowChatSubmit() {
    const raw = workflowChatInput.trim();
    if (!raw || workflowChatBusy) return;

    const mid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const existingRunStep = workflowFlowSteps.find(
      (s): s is Extract<WorkflowFlowStep, { role: "runFunction" }> =>
        s.role === "runFunction"
    );

    setWorkflowChatMessages((prev) => [
      ...prev,
      { id: `u-${mid}`, role: "user", content: raw },
    ]);
    setWorkflowChatInput("");
    setWorkflowChatBusy(true);

    window.setTimeout(() => {
      const aid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `a-${Date.now()}`;

      if (existingRunStep) {
        const refined = refineRunFunctionFromPrompt(raw, {
          triggerLabel: workflowTriggerLabel,
        });

        setWorkflowFlowSteps((prev) =>
          prev.map((s) =>
            s.id === existingRunStep.id && s.role === "runFunction"
              ? {
                  ...s,
                  runLabel: refined.runLabel,
                  functionTitle: refined.functionTitle,
                  summary: refined.summary,
                  functionTier: refined.functionTier,
                  generatedCode: refined.generatedCode,
                }
              : s
          )
        );

        const detailLines = [
          `Trigger unchanged: ${workflowTriggerLabel}`,
          `What it does: ${refined.summary}`,
          `Function tier: ${
            refined.functionTier === "basic"
              ? "Basic (single email or task action)"
              : "Advanced (more than email/task-only)"
          }`,
        ];
        if (refined.assumptions.length) {
          detailLines.push(`Note: ${refined.assumptions.join(" ")}`);
        }
        const assistantContent = `Updated the Run function (trigger left as-is).\n\n${detailLines.join(
          "\n"
        )}`;

        setWorkflowChatMessages((prev) => [
          ...prev,
          { id: `a-${aid}`, role: "assistant", content: assistantContent },
        ]);
        setWorkflowChatBusy(false);
        return;
      }

      const parsed = parseAiWorkflowFromPrompt(raw);
      const stepId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const runStep: WorkflowFlowStep = {
        id: stepId,
        role: "runFunction",
        runLabel: parsed.runLabel,
        functionTitle: parsed.functionTitle,
        summary: parsed.summary,
        functionTier: parsed.functionTier,
        generatedCode: parsed.generatedCode,
      };

      setWorkflowTriggerLabel(parsed.triggerLabel);
      setWorkflowTriggerOptionId(parsed.triggerOptionId);
      setWorkflowTitle(parsed.workflowName);
      setWorkflowTitleDraft(parsed.workflowName);
      setWorkflowFlowSteps([
        { id: WORKFLOW_TRIGGER_ID, role: "trigger" },
        runStep,
      ]);
      setSelectedCanvasStepId(runStep.id);

      const detailLines = [
        `When it runs: ${parsed.triggerLabel}`,
        `What it does: ${parsed.summary}`,
        `Function tier: ${
          parsed.functionTier === "basic"
            ? "Basic (single email or task action)"
            : "Advanced (more than email/task-only)"
        }`,
      ];
      if (parsed.assumptions.length) {
        detailLines.push(`Note: ${parsed.assumptions.join(" ")}`);
      }
      const assistantContent = `Created “${parsed.workflowName}”.\n\n${detailLines.join(
        "\n"
      )}`;

      setWorkflowChatMessages((prev) => [
        ...prev,
        { id: `a-${aid}`, role: "assistant", content: assistantContent },
      ]);
      setWorkflowChatBusy(false);
    }, 720);
  }

  useEffect(() => {
    workflowChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [workflowChatMessages, workflowChatBusy]);

  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [pickerContext, setPickerContext] = useState<"aiPrompt" | "widget">("aiPrompt");
  const [summarizeVariables, setSummarizeVariables] = useState<VariablePath[]>([]);
  const [widgetConfig, setWidgetConfig] = useState("Homepage Compliance Widget");
  const [autoMapEnabled, setAutoMapEnabled] = useState(true);
  const [showMappingDetails, setShowMappingDetails] = useState(false);
  const autoMappedFields = [
    { field: "trainingCompliance.status", source: "Health check" },
    { field: "trainingCompliance.details", source: "Health check" },
    { field: "documentationCompliance.status", source: "Health check" },
    { field: "documentationCompliance.details", source: "Health check" },
    { field: "attendanceCompliance.status", source: "Health check" },
    { field: "attendanceCompliance.details", source: "Health check" },
    { field: "overallCompliance", source: "Health check" },
    { field: "lastChecked", source: "Health check" },
  ];
  const [promptMessage, setPromptMessage] = useState(`You are an internal HR compliance agent responsible for checking employee training, documentation, and attendance data.

Your goals are to:
1. Review training completion status and required trainings
2. Verify documentation is on file and up to date
3. Check attendance rates and compliance thresholds
4. Determine compliance status for each category (Training, Documentation, Attendance)
5. Provide an overall compliance status

For each category, determine if the employee is compliant or non-compliant based on company policies. Be accurate, policy-aligned, and never guess when information is missing.`);
  const [summarizeInputFocused, setSummarizeInputFocused] = useState(false);
  const [outputFormat, setOutputFormat] = useState<string>("JSON");
  const [jsonSchemaMode, setJsonSchemaMode] = useState<"basic" | "advanced">("basic");
  const [workflowOption, setWorkflowOption] = useState<"opt1" | "opt2">("opt1");
  const [isNavigationDropdownOpen, setIsNavigationDropdownOpen] = useState(false);
  const currentPage = pathname === "/documents" ? "Documents" : "Workflows";
  
  // JSON Schema state
  type JsonProperty = {
    id: string;
    name: string;
    type: string;
    description: string;
  };
  const [jsonProperties, setJsonProperties] = useState<JsonProperty[]>([
    { id: "prop-training-status", name: "trainingCompliance.status", type: "STR", description: "Compliant or Non-compliant" },
    { id: "prop-training-details", name: "trainingCompliance.details", type: "STR", description: "Summary of training completion findings" },
    { id: "prop-documentation-status", name: "documentationCompliance.status", type: "STR", description: "Compliant or Non-compliant" },
    { id: "prop-documentation-details", name: "documentationCompliance.details", type: "STR", description: "Summary of documentation review findings" },
    { id: "prop-attendance-status", name: "attendanceCompliance.status", type: "STR", description: "Compliant or Non-compliant" },
    { id: "prop-attendance-details", name: "attendanceCompliance.details", type: "STR", description: "Summary of attendance record findings" },
    { id: "prop-overall-status", name: "overallCompliance", type: "STR", description: "Compliant only if all three areas are compliant" },
    { id: "prop-last-checked", name: "lastChecked", type: "STR", description: "ISO 8601 timestamp of when the check was performed" },
  ]);
  const [jsonSchemaText, setJsonSchemaText] = useState<string>(`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EmployeeComplianceHealthCheck",
  "type": "object",
  "properties": {
    "trainingCompliance": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "description": "Compliant or Non-compliant" },
        "details": { "type": "string", "description": "Summary of training completion findings" }
      }
    },
    "documentationCompliance": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "description": "Compliant or Non-compliant" },
        "details": { "type": "string", "description": "Summary of documentation review findings" }
      }
    },
    "attendanceCompliance": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "description": "Compliant or Non-compliant" },
        "details": { "type": "string", "description": "Summary of attendance record findings" }
      }
    },
    "overallCompliance": { "type": "string", "description": "Compliant only if all three areas are compliant" },
    "lastChecked": { "type": "string", "description": "ISO 8601 timestamp of when the check was performed" }
  }
}`);
  const [isUpdatingFromBasic, setIsUpdatingFromBasic] = useState(false);
  const [isUpdatingFromAdvanced, setIsUpdatingFromAdvanced] = useState(false);
  const [showGeneratePopover, setShowGeneratePopover] = useState(false);
  const [showToolPopover, setShowToolPopover] = useState(false);
  const toolButtonRef = useRef<HTMLButtonElement>(null);
  const [toolPopoverPosition, setToolPopoverPosition] = useState({ top: 0, left: 0 });
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryToolAdded, setQueryToolAdded] = useState(true);
  const [queryChipHover, setQueryChipHover] = useState(false);
  const queryChipRef = useRef<HTMLDivElement>(null);
  const [queryScope, setQueryScope] = useState<"all" | "specific">("specific");
  const [selectedObjects, setSelectedObjects] = useState<string[]>(["Employee", "Time and Attendance", "Compliance", "Learning Management"]);
  const [objectDropdownOpen, setObjectDropdownOpen] = useState(false);
  const [objectSearchQuery, setObjectSearchQuery] = useState("");
  const objectDropdownRef = useRef<HTMLDivElement>(null);
  const objectTriggerRef = useRef<HTMLDivElement>(null);
  const [objectDropdownPosition, setObjectDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [generatePrompt, setGeneratePrompt] = useState("");
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, right: 0 });
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const promptAddVariableButtonRef = useRef<HTMLButtonElement>(null);
  const widgetAddVariableButtonRef = useRef<HTMLButtonElement>(null);
  const [variablePopoverPosition, setVariablePopoverPosition] = useState({ top: 0, left: 0 });
  const [variableSearchQuery, setVariableSearchQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
  const [savedTextCursorPosition, setSavedTextCursorPosition] = useState({ start: 0, end: 0 });
  const [openedViaHotkey, setOpenedViaHotkey] = useState(false);
  const justCalculatedPositionRef = useRef(false);

  /**
   * Gets the caret's current line position in a contentEditable element.
   * Uses Range/Selection API to get the exact visual position of the caret,
   * accounting for soft-wrapping and actual rendered line positions.
   * 
   * @param element - The contentEditable element (textarea/div)
   * @returns Object with `lineBottom` (bottom of caret line in viewport coordinates) and `lineLeft` (left edge of line)
   */
  function getCaretLinePosition(element: HTMLElement): { lineBottom: number; lineLeft: number } | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    
    // Ensure the range is within our element
    if (!element.contains(range.commonAncestorContainer)) {
      return null;
    }

    // Clone the range to avoid modifying the selection
    const clonedRange = range.cloneRange();
    
    // For collapsed ranges (just a caret), getBoundingClientRect might return zero dimensions
    // We need to get a valid rect by extending the range slightly or using a marker
    let caretRect: DOMRect;
    
    try {
      // Try to get the rect directly
      caretRect = clonedRange.getBoundingClientRect();
      
      // If rect has zero dimensions, try extending the range by one character
      if (caretRect.width === 0 && caretRect.height === 0) {
        const startContainer = clonedRange.startContainer;
        if (startContainer.nodeType === Node.TEXT_NODE) {
          const textNode = startContainer as Text;
          const offset = Math.min(clonedRange.startOffset, textNode.length);
          
          // Create a temporary range that includes at least one character
          const tempRange = document.createRange();
          if (offset < textNode.length) {
            // Extend by one character forward
            tempRange.setStart(textNode, offset);
            tempRange.setEnd(textNode, Math.min(offset + 1, textNode.length));
          } else if (offset > 0) {
            // Extend by one character backward
            tempRange.setStart(textNode, Math.max(0, offset - 1));
            tempRange.setEnd(textNode, offset);
          } else {
            // At start, can't extend backward, try forward
            tempRange.setStart(textNode, 0);
            tempRange.setEnd(textNode, Math.min(1, textNode.length));
          }
          
          const tempRect = tempRange.getBoundingClientRect();
          if (tempRect.width > 0 || tempRect.height > 0) {
            caretRect = tempRect;
            // Adjust to get the caret position (use the start of the range)
            caretRect = new DOMRect(
              tempRect.left,
              tempRect.top,
              0,
              tempRect.height
            );
          }
        }
      }
      
      // If still no valid rect, try inserting a temporary marker
      if (caretRect.width === 0 && caretRect.height === 0) {
        const marker = document.createElement('span');
        marker.style.position = 'absolute';
        marker.style.visibility = 'hidden';
        marker.style.width = '1px';
        marker.style.height = '1px';
        marker.style.whiteSpace = 'pre';
        marker.textContent = '\u200B'; // Zero-width space
        
        try {
          clonedRange.insertNode(marker);
          caretRect = marker.getBoundingClientRect();
          marker.parentNode?.removeChild(marker);
        } catch (e) {
          // If insertion fails, fall back to element position
          const elementRect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
          const paddingTop = parseFloat(computedStyle.paddingTop) || 8;
          return {
            lineBottom: elementRect.top + paddingTop + lineHeight,
            lineLeft: elementRect.left + parseFloat(computedStyle.paddingLeft) || 12
          };
        }
      }
    } catch (e) {
      // Fallback to element-based calculation
      const elementRect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
      const paddingTop = parseFloat(computedStyle.paddingTop) || 8;
      return {
        lineBottom: elementRect.top + paddingTop + lineHeight,
        lineLeft: elementRect.left + parseFloat(computedStyle.paddingLeft) || 12
      };
    }

    // The bottom of the line is the bottom of the caret rect
    // For multi-line text, this gives us the visual line the caret is on
    const lineBottom = caretRect.bottom;
    const lineLeft = caretRect.left;

    return {
      lineBottom,
      lineLeft
    };
  }

  // Add default blank property when switching to JSON
  useEffect(() => {
    if (outputFormat === "JSON" && jsonProperties.length === 0) {
      setJsonProperties([
        {
          id: `prop-${Date.now()}`,
          name: "",
          type: "STR",
          description: "",
        },
      ]);
    }
  }, [outputFormat]);

  // Sync Basic mode to Advanced mode
  useEffect(() => {
    if (isUpdatingFromAdvanced || jsonSchemaMode !== "basic") return;
    
    try {
      const properties: Record<string, any> = {};
      jsonProperties.forEach((prop) => {
        if (prop.name) {
          const typeMap: Record<string, string> = {
            STR: "string",
            NUM: "number",
            BOOL: "boolean",
            OBJ: "object",
            ARR: "array",
          };
          properties[prop.name] = {
            type: typeMap[prop.type] || "string",
            ...(prop.description && { description: prop.description }),
          };
        }
      });

      const schema = {
        type: "object",
        properties,
      };

      setIsUpdatingFromBasic(true);
      setJsonSchemaText(JSON.stringify(schema, null, 2));
      setTimeout(() => setIsUpdatingFromBasic(false), 100);
    } catch (error) {
      console.error("Error generating JSON schema:", error);
    }
  }, [jsonProperties, jsonSchemaMode]);

  // Sync Advanced mode to Basic mode
  useEffect(() => {
    if (isUpdatingFromBasic || jsonSchemaMode !== "advanced") return;

    try {
      const schema = JSON.parse(jsonSchemaText);
      if (schema.type === "object" && schema.properties) {
        const properties: JsonProperty[] = Object.entries(schema.properties).map(
          ([name, prop]: [string, any]) => {
            const typeMap: Record<string, string> = {
              string: "STR",
              number: "NUM",
              boolean: "BOOL",
              object: "OBJ",
              array: "ARR",
            };
            return {
              id: `prop-${name}-${Date.now()}`,
              name,
              type: typeMap[prop.type] || "STR",
              description: prop.description || "",
            };
          }
        );

        setIsUpdatingFromAdvanced(true);
        setJsonProperties(properties);
        setTimeout(() => setIsUpdatingFromAdvanced(false), 100);
      }
    } catch (error) {
      // Invalid JSON, don't update properties
      console.error("Error parsing JSON schema:", error);
    }
  }, [jsonSchemaText, jsonSchemaMode]);

  // Close navigation dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (isNavigationDropdownOpen && !target.closest('.navigation-dropdown-container')) {
        setIsNavigationDropdownOpen(false);
      }
    }

    if (isNavigationDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isNavigationDropdownOpen]);


  // Calculate popover position and handle click outside
  useEffect(() => {
    function updatePopoverPosition() {
      if (generateButtonRef.current && showGeneratePopover) {
        const rect = generateButtonRef.current.getBoundingClientRect();
        const popoverHeight = 200; // Approximate height of popover (80px textarea + padding + button)
        const popoverWidth = 452;
        const spacing = 8;
        
        // Check if there's enough space below
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Check if there's enough space on the right
        const spaceRight = window.innerWidth - rect.right;
        const spaceLeft = rect.left;
        
        let top: number;
        let right: number;
        
        // Position vertically: prefer below, but use above if not enough space
        if (spaceBelow >= popoverHeight + spacing) {
          // Position below
          top = rect.bottom + window.scrollY + spacing;
        } else if (spaceAbove >= popoverHeight + spacing) {
          // Position above
          top = rect.top + window.scrollY - popoverHeight - spacing;
        } else {
          // Not enough space either way, position below but adjust to fit
          top = Math.max(spacing, window.innerHeight - popoverHeight - spacing) + window.scrollY;
        }
        
        // Position horizontally: prefer right-aligned, but adjust if needed
        if (spaceRight >= popoverWidth) {
          // Position right-aligned
          right = window.innerWidth - rect.right;
        } else if (spaceLeft >= popoverWidth) {
          // Position left-aligned
          right = window.innerWidth - rect.left - popoverWidth;
        } else {
          // Not enough space on either side, center it
          right = (window.innerWidth - popoverWidth) / 2;
        }
        
        setPopoverPosition({ top, right });
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        generateButtonRef.current &&
        !generateButtonRef.current.contains(event.target as Node) &&
        showGeneratePopover
      ) {
        const target = event.target as HTMLElement;
        if (!target.closest('.generate-popover')) {
          setShowGeneratePopover(false);
        }
      }
    }

    if (showGeneratePopover) {
      updatePopoverPosition();
      window.addEventListener('scroll', updatePopoverPosition, true);
      window.addEventListener('resize', updatePopoverPosition);
      document.addEventListener('mousedown', handleClickOutside);
      
      return () => {
        window.removeEventListener('scroll', updatePopoverPosition, true);
        window.removeEventListener('resize', updatePopoverPosition);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showGeneratePopover]);

  // Handle click outside for tool popover
  useEffect(() => {
    function handleToolClickOutside(event: MouseEvent) {
      if (
        toolButtonRef.current &&
        !toolButtonRef.current.contains(event.target as Node) &&
        showToolPopover
      ) {
        const target = event.target as HTMLElement;
        if (!target.closest('.tool-popover')) {
          setShowToolPopover(false);
        }
      }
    }

    function updateToolPopoverPosition() {
      if (toolButtonRef.current) {
        const rect = toolButtonRef.current.getBoundingClientRect();
        setToolPopoverPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
    }

    if (showToolPopover) {
      updateToolPopoverPosition();
      window.addEventListener('scroll', updateToolPopoverPosition, true);
      window.addEventListener('resize', updateToolPopoverPosition);
      document.addEventListener('mousedown', handleToolClickOutside);

      return () => {
        window.removeEventListener('scroll', updateToolPopoverPosition, true);
        window.removeEventListener('resize', updateToolPopoverPosition);
        document.removeEventListener('mousedown', handleToolClickOutside);
      };
    }
  }, [showToolPopover]);

  // Handle click outside for object dropdown
  useEffect(() => {
    function handleObjectDropdownClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inTrigger = objectDropdownRef.current?.contains(target);
      const inList = (event.target as HTMLElement).closest?.('.object-dropdown-list');
      if (!inTrigger && !inList) {
        setObjectDropdownOpen(false);
      }
    }

    function updateObjectDropdownPosition() {
      if (objectTriggerRef.current) {
        const rect = objectTriggerRef.current.getBoundingClientRect();
        setObjectDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    }

    if (objectDropdownOpen) {
      updateObjectDropdownPosition();
      document.addEventListener('mousedown', handleObjectDropdownClickOutside);
      window.addEventListener('scroll', updateObjectDropdownPosition, true);
      window.addEventListener('resize', updateObjectDropdownPosition);
      return () => {
        document.removeEventListener('mousedown', handleObjectDropdownClickOutside);
        window.removeEventListener('scroll', updateObjectDropdownPosition, true);
        window.removeEventListener('resize', updateObjectDropdownPosition);
      };
    }
  }, [objectDropdownOpen]);

  // Calculate variable popover position and handle click outside
  useEffect(() => {
    function updateVariablePopoverPosition() {
      if (!showVariablePicker) return;
      
      const popoverHeight = 400; // Approximate height of variable dropdown
      const popoverWidth = 400;
      const spacing = 8;
      
      // If opened from cursor position (typing "{{"), ALWAYS use caret position
      // Don't fall through to button positioning when opened via hotkey
      if (openedViaHotkey) {
        const textareaId = pickerContext === "widget" ? 'widget-config' : 'prompt-textarea';
        const textarea = document.getElementById(textareaId);
        
        if (textarea) {
          // Use caret-based measurement to get exact line position
          const caretPos = getCaretLinePosition(textarea as HTMLElement);
          
          if (caretPos) {
            // Position popover exactly 8px below the caret's line
            const top = caretPos.lineBottom + 8;
            const textareaRect = textarea.getBoundingClientRect();
            const left = Math.max(spacing, Math.min(textareaRect.left, window.innerWidth - popoverWidth - spacing));
            
            // Update both cursor position and popover position
            setCursorPosition({ top: caretPos.lineBottom, left: caretPos.lineLeft });
            setVariablePopoverPosition({ top, left });
            return; // Exit early to prevent falling through to button positioning
          } else if (cursorPosition.top > 0 && cursorPosition.left > 0) {
            // Fallback: use stored cursor position
            const textareaRect = textarea.getBoundingClientRect();
            const top = cursorPosition.top + 8;
            const left = Math.max(spacing, Math.min(textareaRect.left, window.innerWidth - popoverWidth - spacing));
            setVariablePopoverPosition({ top, left });
            return; // Exit early to prevent falling through to button positioning
          }
        }
        // If we can't get caret position but opened via hotkey, don't use button positioning
        // Just return and keep the existing position
        return;
      } else {
        // Otherwise, position relative to button
        const buttonRef = pickerContext === "widget" ? widgetAddVariableButtonRef : promptAddVariableButtonRef;
        
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          
          // Verify the rect is valid (not all zeros, which would indicate element not rendered)
          if (rect.width > 0 || rect.height > 0) {
            // Check if there's enough space below
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            // Check if there's enough space on the right
            const spaceRight = window.innerWidth - rect.right;
            const spaceLeft = rect.left;
            
            let top: number;
            
            // Position vertically: prefer below, but use above if not enough space
            // Use getBoundingClientRect() which gives viewport-relative coordinates for fixed positioning
            if (spaceBelow >= popoverHeight + spacing) {
              // Position below
              top = rect.bottom + spacing;
            } else if (spaceAbove >= popoverHeight + spacing) {
              // Position above
              top = rect.top - popoverHeight - spacing;
            } else {
              // Not enough space either way, position below but adjust to fit
              top = Math.max(spacing, window.innerHeight - popoverHeight - spacing);
            }
            
            // Position horizontally: prefer right-aligned, but adjust if needed
            let left: number;
            if (spaceRight >= popoverWidth) {
              // Position right-aligned (align left edge with button's left edge)
              left = rect.left;
            } else if (spaceLeft >= popoverWidth) {
              // Position left-aligned
              left = rect.left - popoverWidth + rect.width;
            } else {
              // Not enough space on either side, center it
              left = (window.innerWidth - popoverWidth) / 2;
            }
            
            // Ensure popover doesn't go off-screen
            left = Math.max(spacing, Math.min(left, window.innerWidth - popoverWidth - spacing));
            
            setVariablePopoverPosition({ top, left });
          } else {
            // If rect is invalid, retry with requestAnimationFrame
            requestAnimationFrame(() => {
              if (buttonRef.current) {
                const retryRect = buttonRef.current.getBoundingClientRect();
                if (retryRect.width > 0 || retryRect.height > 0) {
                  const spaceBelow = window.innerHeight - retryRect.bottom;
                  const spaceAbove = retryRect.top;
                  const spaceRight = window.innerWidth - retryRect.right;
                  const spaceLeft = retryRect.left;
                  
                  let top: number;
                  if (spaceBelow >= popoverHeight + spacing) {
                    top = retryRect.bottom + spacing;
                  } else if (spaceAbove >= popoverHeight + spacing) {
                    top = retryRect.top - popoverHeight - spacing;
                  } else {
                    top = Math.max(spacing, window.innerHeight - popoverHeight - spacing);
                  }
                  
                  let left: number;
                  if (spaceRight >= popoverWidth) {
                    left = retryRect.left;
                  } else if (spaceLeft >= popoverWidth) {
                    left = retryRect.left - popoverWidth + retryRect.width;
                  } else {
                    left = (window.innerWidth - popoverWidth) / 2;
                  }
                  
                  left = Math.max(spacing, Math.min(left, window.innerWidth - popoverWidth - spacing));
                  
                  setVariablePopoverPosition({ top, left });
                }
              }
            });
          }
        } else {
          // If button ref not ready, use requestAnimationFrame to retry
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                
                // Verify the rect is valid (not all zeros)
                if (rect.width > 0 || rect.height > 0) {
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const spaceAbove = rect.top;
                  const spaceRight = window.innerWidth - rect.right;
                  const spaceLeft = rect.left;
                  
                  let top: number;
                  if (spaceBelow >= popoverHeight + spacing) {
                    top = rect.bottom + spacing;
                  } else if (spaceAbove >= popoverHeight + spacing) {
                    top = rect.top - popoverHeight - spacing;
                  } else {
                    top = Math.max(spacing, window.innerHeight - popoverHeight - spacing);
                  }
                  
                  let left: number;
                  if (spaceRight >= popoverWidth) {
                    left = rect.left;
                  } else if (spaceLeft >= popoverWidth) {
                    left = rect.left - popoverWidth + rect.width;
                  } else {
                    left = (window.innerWidth - popoverWidth) / 2;
                  }
                  
                  left = Math.max(spacing, Math.min(left, window.innerWidth - popoverWidth - spacing));
                  
                  setVariablePopoverPosition({ top, left });
                }
              }
            });
          });
        }
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const buttonRef = pickerContext === "widget" ? widgetAddVariableButtonRef : promptAddVariableButtonRef;
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside the variable popover
      if (target.closest('.variable-popover')) {
        return;
      }
      
      // Don't close if clicking inside the textarea
      const textareaId = pickerContext === "widget" ? 'widget-message' : 'prompt-textarea';
      const textarea = document.getElementById(textareaId);
      if (textarea && textarea.contains(target)) {
        return;
      }
      
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        showVariablePicker
      ) {
        setShowVariablePicker(false);
        setOpenedViaHotkey(false);
        setCursorPosition({ top: 0, left: 0 });
      }
    }

    if (showVariablePicker) {
      // Use double requestAnimationFrame to ensure DOM is fully ready and rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateVariablePopoverPosition();
        });
      });
      
      // Also update on next tick to catch any delayed renders
      const timeoutId = setTimeout(() => {
        updateVariablePopoverPosition();
      }, 10);
      
      window.addEventListener('scroll', updateVariablePopoverPosition, true);
      window.addEventListener('resize', updateVariablePopoverPosition);
      // Use click without capture phase to allow button clicks to process first
      // The handler checks early to prevent closing when clicking inside
      document.addEventListener('click', handleClickOutside);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', updateVariablePopoverPosition, true);
        window.removeEventListener('resize', updateVariablePopoverPosition);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showVariablePicker, pickerContext, cursorPosition, openedViaHotkey]);

  // Helper function to generate schema from prompt
  function generateSchemaFromPrompt(prompt: string): Record<string, any> {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check for welcome message pattern
    const isWelcomeMessage = lowerPrompt.includes("welcome") && 
                             (lowerPrompt.includes("employee") || lowerPrompt.includes("newly hired")) &&
                             lowerPrompt.includes("message");
    
    if (isWelcomeMessage) {
      // Extract employee fields from prompt
      const employeeFields: Record<string, any> = {};
      
      // Check if prompt explicitly lists the fields (name, role, team, start date)
      const hasExplicitFieldList = lowerPrompt.includes("name") && 
                                    lowerPrompt.includes("role") && 
                                    lowerPrompt.includes("team") && 
                                    (lowerPrompt.includes("start date") || lowerPrompt.includes("start_date"));
      
      // Always include name if mentioned or if it's a welcome message with employee context
      if (lowerPrompt.includes("name") || lowerPrompt.includes("employee's name") || hasExplicitFieldList) {
        employeeFields.name = {
          type: "string",
          description: "Employee's first name."
        };
      }
      
      // Always include role if mentioned or in explicit list
      if (lowerPrompt.includes("role") || lowerPrompt.includes("job title") || hasExplicitFieldList) {
        employeeFields.role = {
          type: "string",
          description: "Employee's job title."
        };
      }
      
      // Always include team if mentioned or in explicit list
      if (lowerPrompt.includes("team") || hasExplicitFieldList) {
        employeeFields.team = {
          type: "string",
          description: "Team the employee is joining."
        };
      }
      
      // Always include start_date if mentioned or in explicit list
      // Handle both "start date" (with space) and "start_date" (with underscore)
      if (lowerPrompt.includes("start date") || lowerPrompt.includes("start_date") || hasExplicitFieldList) {
        employeeFields.start_date = {
          type: "string",
          format: "date",
          description: "Employee start date."
        };
      }
      
      return {
        message: {
          type: "string",
          description: "The complete welcome message, ready to send."
        },
        employee: {
          type: "object",
          properties: employeeFields
        }
      };
    }
    
    // Fallback: Simple heuristic-based generation for other prompts
    const properties: Record<string, any> = {};
    
    // Common fields that might be mentioned
    if (lowerPrompt.includes("name") || lowerPrompt.includes("subject")) {
      properties.subject = { type: "string", description: "Subject or title" };
    }
    if (lowerPrompt.includes("message") || lowerPrompt.includes("body") || lowerPrompt.includes("content")) {
      properties.message = { type: "string", description: "Message content" };
    }
    if (lowerPrompt.includes("email") || lowerPrompt.includes("address")) {
      properties.email = { type: "string", description: "Email address" };
    }
    if (lowerPrompt.includes("date") || lowerPrompt.includes("time")) {
      properties.date = { type: "string", description: "Date or timestamp" };
    }
    if (lowerPrompt.includes("number") || lowerPrompt.includes("count") || lowerPrompt.includes("amount")) {
      properties.count = { type: "number", description: "Numeric value" };
    }
    if (lowerPrompt.includes("list") || lowerPrompt.includes("array") || lowerPrompt.includes("items")) {
      properties.items = { type: "array", description: "List of items" };
    }
    
    // If no properties were found, create a default one
    if (Object.keys(properties).length === 0) {
      properties.output = { type: "string", description: "Generated output" };
    }
    
    return properties;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f9f7f6] relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {/* Top Bar */}
        <div className="h-14 bg-[#4A0039] flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <svg width="113" height="16" viewBox="0 0 113 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.07176 4.43636C3.07176 2.67636 2.17123 1.22182 0.488281 0H4.40041C5.77334 1.04727 6.61482 2.64727 6.61482 4.43636C6.61482 6.22545 5.77334 7.82545 4.40041 8.87273C5.67 9.39636 6.39338 10.6764 6.39338 12.5091V16H2.85032V12.5091C2.85032 10.7636 2.00884 9.54182 0.488281 8.87273C2.17123 7.65091 3.07176 6.19636 3.07176 4.43636ZM10.7484 4.43636C10.7484 2.67636 9.84786 1.22182 8.16491 0H12.077C13.45 1.04727 14.2914 2.64727 14.2914 4.43636C14.2914 6.22545 13.45 7.82545 12.077 8.87273C13.3466 9.39636 14.07 10.6764 14.07 12.5091V16H10.5269V12.5091C10.5269 10.7636 9.68547 9.54182 8.16491 8.87273C9.84786 7.65091 10.7484 6.19636 10.7484 4.43636ZM18.425 4.43636C18.425 2.67636 17.5245 1.22182 15.8415 0H19.7537C21.1266 1.04727 21.9681 2.64727 21.9681 4.43636C21.9681 6.22545 21.1266 7.82545 19.7537 8.87273C21.0233 9.39636 21.7466 10.6764 21.7466 12.5091V16H18.2036V12.5091C18.2036 10.7636 17.3621 9.54182 15.8415 8.87273C17.5245 7.65091 18.425 6.19636 18.425 4.43636Z" fill="white"/>
              <path d="M32.2866 13.0925H29.6406V2.90918H36.1392C39.2649 2.90918 40.8059 4.07282 40.8059 5.97827C40.8059 7.27282 40.0499 8.24736 38.6397 8.74191C40.0935 8.96009 40.7477 9.731 40.7477 11.1128V13.091H38.0727V11.2292C38.0727 10.0655 37.4912 9.60009 35.9647 9.60009H32.2866V13.091V13.0925ZM35.9938 4.39282H32.2866V8.11645H35.9647C37.3022 8.11645 38.1309 7.37463 38.1309 6.211C38.1309 5.04736 37.3604 4.39282 35.9938 4.39282" fill="white"/>
              <path d="M45.3998 2.90918H42.7539V13.0925H45.3998V2.90918Z" fill="white"/>
              <path d="M53.5121 9.77463H50.2846V13.091H47.6387V2.90918H53.5702C56.6959 2.90918 58.3387 4.21827 58.3387 6.31282C58.3387 8.40736 56.6668 9.77463 53.5121 9.77463V9.77463ZM53.4539 4.39282H50.2846V8.291H53.4248C54.7914 8.291 55.6346 7.59282 55.6346 6.32736C55.6346 5.06191 54.7914 4.39282 53.4539 4.39282" fill="white"/>
              <path d="M65.7816 9.77463H62.5541V13.091H59.9082V2.90918H65.8398C68.9654 2.90918 70.6083 4.21827 70.6083 6.31282C70.6083 8.40736 68.9364 9.77463 65.7816 9.77463V9.77463ZM65.7235 4.39282H62.5541V8.291H65.6944C67.061 8.291 67.9042 7.59282 67.9042 6.32736C67.9042 5.06191 67.061 4.39282 65.7235 4.39282" fill="white"/>
              <path d="M74.8256 2.90918V11.5783H81.4259V13.0925H72.1797V2.90918H74.8256Z" fill="white"/>
              <path d="M85.728 2.90918H83.082V13.0925H85.728V2.90918Z" fill="white"/>
              <path d="M89.7114 6.31282V13.0925H87.9668V2.90918H89.9454L97.1563 9.68736V2.90918H98.9009V13.0925H96.9237L89.7114 6.31282Z" fill="white"/>
              <path d="M107.535 4.10201C105.02 4.10201 103.377 5.70201 103.377 8.08746C103.377 10.4729 104.948 11.8984 107.39 11.8984H107.564C108.393 11.8984 109.324 11.7238 110.181 11.4475V8.69837H105.907V7.24382H112.769V12.0293C111.344 12.7711 109.193 13.3529 107.448 13.3529H107.216C103.203 13.3529 100.615 11.2293 100.615 8.14564C100.615 5.06201 103.276 2.64746 107.361 2.64746H107.594C109.294 2.64746 111.243 3.18564 112.682 4.02928L111.926 5.26564C110.632 4.55292 109.091 4.10201 107.71 4.10201H107.535V4.10201Z" fill="white"/>
            </svg>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            {currentPage === "Workflows" && (
              <button
                type="button"
                onClick={() => setWorkflowAssistantOpen((open) => !open)}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-white/95 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                aria-expanded={workflowAssistantOpen}
                aria-controls="workflow-assistant-panel"
                aria-label={
                  workflowAssistantOpen
                    ? "Collapse workflow assistant"
                    : "Expand workflow assistant"
                }
                title={
                  workflowAssistantOpen
                    ? "Hide workflow assistant"
                    : "Show workflow assistant"
                }
              >
                <Sparkles className="size-5" aria-hidden />
              </button>
            )}
            <div className="flex items-center gap-2 text-white">
              <span className="text-sm font-medium">Support</span>
              <div className="w-px h-6 bg-white/30" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-gray-300" />
              <div className="text-white">
                <div className="text-sm font-medium">Anne Montgomery</div>
                <div className="text-xs text-[#e0dede]">Admin • Neuralink</div>
              </div>
              <ChevronDown className="size-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Workflows (nav + workspace share the left column; assistant aligns to the right of both) */}
      {currentPage === "Workflows" && (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f9f7f6] pt-14">
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Navigation Bar - Workflows (Figma 1170:22109) — only spans main column, not assistant */}
          <div className="flex h-[72px] min-h-[72px] shrink-0 items-center justify-between border-b border-[#e0dede] bg-white px-[18px] py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-black hover:bg-[#f5f5f5]"
                aria-label="Close workflow"
              >
                <CloseIcon className="size-6" />
              </Button>
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {workflowTitleEditing ? (
                    <input
                      ref={workflowTitleInputRef}
                      value={workflowTitleDraft}
                      onChange={(e) => setWorkflowTitleDraft(e.target.value)}
                      onBlur={commitWorkflowTitle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitWorkflowTitle();
                        }
                        if (e.key === "Escape") {
                          setWorkflowTitleDraft(workflowTitle);
                          setWorkflowTitleEditing(false);
                        }
                      }}
                      className="min-w-[10rem] max-w-[min(20rem,40vw)] rounded border border-[#e0dede] bg-white px-2 py-1 text-[20px] leading-7 text-black outline-none focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/40"
                      style={{
                        fontFamily: "'Basel Grotesk', sans-serif",
                        fontWeight: 535,
                      }}
                      aria-label="Workflow name"
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 max-w-[min(20rem,40vw)] cursor-text truncate rounded border-0 bg-transparent px-0.5 text-left text-[20px] leading-7 text-black hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/40"
                      style={{
                        fontFamily: "'Basel Grotesk', sans-serif",
                        fontWeight: 535,
                      }}
                      aria-label={`Workflow name: ${workflowTitle}. Click to edit.`}
                      onClick={() => {
                        setWorkflowTitleDraft(workflowTitle);
                        setWorkflowTitleEditing(true);
                      }}
                    >
                      {workflowTitle}
                    </button>
                  )}
                  <div className="flex min-w-0 items-center gap-2">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip
                        disableHoverableContent={workflowTier !== "Advanced"}
                      >
                        <TooltipTrigger asChild>
                          <span
                            className={
                              workflowTier === "Advanced"
                                ? `${WORKFLOW_TIER_CHIP_CLASS_ADVANCED} cursor-help`
                                : `${WORKFLOW_TIER_CHIP_CLASS_BASIC} cursor-help`
                            }
                            style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                            tabIndex={0}
                            aria-label={
                              workflowTier === "Advanced"
                                ? isWorkflowBasicTriggerOption(workflowTriggerOptionId)
                                  ? "Workflow tier Advanced. Hover for details; you can remove advanced steps or review tier rules."
                                  : "Workflow tier Advanced. Hover for details and optional action to use a Basic trigger."
                                : "Workflow tier. Hover or focus for how Basic vs Advanced is determined."
                            }
                          >
                            {workflowTier}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          className="max-w-[min(320px,calc(100vw-2rem))] p-0 pointer-events-auto"
                        >
                          <div className="px-3 py-2.5">
                            <p
                              className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#8c8888]"
                              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                            >
                              Basic vs advanced
                            </p>
                            <p
                              className="text-[12px] leading-[17px] text-[#595555]"
                              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                            >
                              The trigger must be{" "}
                              <span className="font-medium text-[#252528]">Start date</span> (Popular or
                              Relative to a date). Then a workflow stays{" "}
                              <span className="font-medium text-[#252528]">Basic</span> only if every step
                              (besides the trigger) is{" "}
                              <span className="font-medium text-[#252528]">Send an email</span> or{" "}
                              <span className="font-medium text-[#252528]">Assign a task</span>, or an
                              AI-generated <span className="font-medium text-[#252528]">Run function</span>{" "}
                              whose logic is email-only or task-only. Anything else—including other
                              notifications, Rippling actions, logic, AI/widget steps, or a function that
                              does more than that—makes it{" "}
                              <span className="font-medium text-[#252528]">Advanced</span>.
                            </p>
                            {workflowTier === "Advanced" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="mt-3 h-9 w-full rounded-md border border-[#e0dede] bg-white px-3 text-[13px] text-[#252528] shadow-none hover:bg-[#f5f5f5]"
                                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isWorkflowBasicTriggerOption(workflowTriggerOptionId)) {
                                    handleRemoveAdvancedSteps();
                                  } else {
                                    setTriggerSelectorInitialBrowse({
                                      ...WORKFLOW_BASIC_START_DATE_BROWSE_PATH,
                                    });
                                    setWorkflowTriggerSelectorOpen(true);
                                  }
                                }}
                              >
                                {isWorkflowBasicTriggerOption(workflowTriggerOptionId)
                                  ? "Remove advanced steps"
                                  : "Use Basic trigger"}
                              </Button>
                            ) : null}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-4 pl-4 sm:gap-6">
              <p
                className="hidden text-center text-[11px] leading-[13px] tracking-[0.25px] text-[#716f6c] sm:block whitespace-nowrap"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
              >
                Last published 3 months ago
              </p>
              <Button
                type="button"
                variant="ghost"
                className="h-9 gap-2 rounded-md border-0 bg-transparent px-2 text-[13px] text-[#252528] shadow-none hover:bg-[#f5f5f5] focus-visible:border-transparent focus-visible:ring-0"
                aria-label="Workflow warnings, 0 issues"
              >
                <AlertTriangle className="size-4 text-[#716f6c]" strokeWidth={2} />
                <span style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>0</span>
              </Button>
              <div className="hidden h-6 w-px bg-[#e0dede] sm:block" aria-hidden />
              <Button
                type="button"
                className="h-10 gap-2 bg-[#7A005D] px-4 text-[15px] leading-[19px] tracking-[0.25px] text-white hover:bg-[#7A005D]/90"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
              >
                Save
                <ChevronDown className="size-4 opacity-90" strokeWidth={2} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-[#8c8888] hover:bg-[#f5f5f5]"
                aria-label="More options"
              >
                <MoreHorizontal className="size-6" />
              </Button>
            </div>
          </div>

        <div className="flex min-h-0 flex-1 min-w-0">
        {/* Left Panel - Always shows "Add a step" at 300px */}
        <div
          className={`w-[300px] shrink-0 border-r border-[#e0dede] bg-white flex flex-col h-full relative overflow-visible ${
            selectedCanvasStepId !== null ? "z-20" : "z-0"
          }`}
        >
          <div className="flex-1 overflow-y-auto">
            {/* "Add a step" panel - always rendered */}
              <div className="px-5 py-6">
                <h2 className="text-black mb-4" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px" }}>Add a step</h2>

                <div className="bg-[#e0dede] h-px mb-5" />

                {ADD_STEP_CATALOG_GROUPS.filter((g) => g.category !== "Logic").map((group) => (
                  <div key={group.category} className="mb-5">
                    <p
                      className="text-[11px] font-medium text-[#8c8888] tracking-wide uppercase mb-2"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                    >
                      {group.category}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const tierBasic = isCatalogItemBasicTier(item.id);
                        return (
                        <div
                          key={item.id}
                          draggable
                          title={
                            catalogStepTierLabelsActive
                              ? tierBasic
                                ? "Basic-tier: OK for a Basic workflow if you only add Send an email and Assign a task steps."
                                : "Advanced-tier: adds or keeps this workflow as Advanced."
                              : "With your current trigger, the workflow stays Advanced. Basic vs Advanced on steps only applies when the trigger is Start date."
                          }
                          onDragStart={(e) => {
                            e.dataTransfer.setData(WORKFLOW_CATALOG_DRAG_MIME, item.id);
                            e.dataTransfer.setData("text/plain", item.id);
                            e.dataTransfer.effectAllowed = "copy";
                            setCatalogDragActive(true);
                          }}
                          onDragEnd={() => setCatalogDragActive(false)}
                          className="flex items-center gap-2 rounded-lg border border-[#e0dede] bg-white px-2 py-2 cursor-grab select-none transition-colors hover:border-[#c8c6c6] hover:bg-[#f9f7f6] active:cursor-grabbing"
                        >
                          <GripVertical
                            className="size-4 shrink-0 text-[#a8a4a4] pointer-events-none"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <div className="flex size-6 shrink-0 items-center justify-center pointer-events-none">
                            {item.icon}
                          </div>
                          <span
                            className="min-w-0 flex-1 text-sm text-[#252528] pointer-events-none"
                            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                          >
                            {item.label}
                          </span>
                          {catalogStepTierLabelsActive ? (
                            <span
                              className={`pointer-events-none shrink-0 ${
                                tierBasic
                                  ? WORKFLOW_TIER_CHIP_CLASS_BASIC
                                  : WORKFLOW_TIER_CHIP_CLASS_ADVANCED
                              }`}
                              style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                            >
                              {tierBasic ? "Basic" : "Advanced"}
                            </span>
                          ) : null}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
          </div>

          {/* Step Details Drawer - slides over the "Add a step" panel */}
          <div
            className={`absolute top-0 left-0 bottom-0 z-10 bg-white border-r border-[#e0dede] shadow-lg flex flex-col transition-transform duration-200 ease-in-out w-[600px] ${
              selectedCanvasStepId !== null ? "translate-x-0" : "-translate-x-full pointer-events-none"
            }`}
          >
            <div className="flex-1 overflow-y-auto">

            {selectedFlowStep?.role === "trigger" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>Trigger details</h2>
                    <CloseIcon className="size-6 text-black cursor-pointer" onClick={() => setSelectedCanvasStepId(null)} />
                  </div>
                </div>
                <div className="bg-[#e0dede] h-px mb-6" />
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-black mb-2">Event</p>
                    <p className="text-sm text-black mb-4">This workflow will trigger based on the following event</p>
                    <div className="bg-white border border-[#e0dede] rounded-lg h-[72px] px-6 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <TriggerIcon className="size-6 shrink-0 text-[#716f6c]" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-black">
                          {workflowTriggerLabel}
                        </p>
                        {isWorkflowBasicTriggerOption(workflowTriggerOptionId) ? (
                          <span
                            className={`${WORKFLOW_TIER_CHIP_CLASS_BASIC} shrink-0`}
                            style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                          >
                            Basic
                          </span>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-[#4a6ba6] hover:text-[#4a6ba6]"
                        onClick={() => setWorkflowTriggerSelectorOpen(true)}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedFlowStep?.role === "aiPrompt" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>Health check</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-black">ID: 12</span>
                      <CloseIcon className="size-6 text-black cursor-pointer" onClick={() => setSelectedCanvasStepId(null)} />
                    </div>
                  </div>
                  <p className="text-black mb-6" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "15px", lineHeight: "22px", flex: "none", alignSelf: "stretch" }}>
                    Call this agent with instructions and tools
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                      Step name <span className="text-[#c3402c]">*</span>
                    </label>
                    <Input
                      defaultValue="Health check"
                      className="w-full border-[#CCCCCC]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        Instruction <span className="text-[#c3402c]">*</span>
                      </label>
                    </div>
                    <div className="bg-white border border-[rgba(0,0,0,0.2)] rounded-lg overflow-hidden">
                      <div className="border-b border-[#e0dede] flex items-center justify-end p-2">
                        <Button
                          ref={promptAddVariableButtonRef}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs bg-white border border-black/20 rounded-md px-2 gap-1 flex items-center justify-center"
                        onClick={() => {
                          // Save current cursor position
                          const textarea = document.getElementById("prompt-textarea");
                          if (textarea) {
                            const selection = window.getSelection();
                            const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                            let start = 0;
                            let end = 0;
                            if (range && textarea.contains(range.commonAncestorContainer)) {
                              const preCaretRange = range.cloneRange();
                              preCaretRange.selectNodeContents(textarea);
                              preCaretRange.setEnd(range.startContainer, range.startOffset);
                              start = preCaretRange.toString().length;
                              preCaretRange.setEnd(range.endContainer, range.endOffset);
                              end = preCaretRange.toString().length;
                            } else {
                              // If no selection, use text length (cursor at end)
                              start = promptMessage.length;
                              end = promptMessage.length;
                            }
                            setSavedTextCursorPosition({ start, end });
                          }
                          setPickerContext("aiPrompt");
                          setShowVariablePicker(true);
                          setOpenedViaHotkey(false);
                          setCursorPosition({ top: 0, left: 0 });
                        }}
                      >
                        Insert variable
                      </Button>
                    </div>
                    <div className="p-2">
                      <StyledTextarea
                        id="prompt-textarea"
                        value={promptMessage}
                        onChange={(text) => {
                        setPromptMessage(text);
                        const textarea = document.getElementById("prompt-textarea");
                        if (textarea) {
                          const selection = window.getSelection();
                          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                          let cursorPos = 0;
                          if (range && textarea.contains(range.commonAncestorContainer)) {
                            const preCaretRange = range.cloneRange();
                            preCaretRange.selectNodeContents(textarea);
                            preCaretRange.setEnd(range.endContainer, range.endOffset);
                            cursorPos = preCaretRange.toString().length;
                          }
                          const textBeforeCursor = text.substring(0, cursorPos);
                          
                          // Check if user typed "{{"
                          if (textBeforeCursor.endsWith("{{")) {
                            // Save cursor position
                            setSavedTextCursorPosition({ start: cursorPos, end: cursorPos });
                            
                            setPickerContext("aiPrompt");
                            setShowVariablePicker(true);
                            setVariableSearchQuery("");
                            setOpenedViaHotkey(true);
                            
                            // Calculate position using caret-based measurement
                            const calculatePosition = () => {
                              const caretPos = getCaretLinePosition(textarea as HTMLElement);
                              
                              if (caretPos) {
                                // Position popover exactly 8px below the caret's line
                                const popoverTop = caretPos.lineBottom + 8;
                                const popoverWidth = 400;
                                const textareaRect = textarea.getBoundingClientRect();
                                const popoverLeft = Math.max(8, Math.min(textareaRect.left, window.innerWidth - popoverWidth - 8));
                                
                                setCursorPosition({ top: caretPos.lineBottom, left: caretPos.lineLeft });
                                setVariablePopoverPosition({ top: popoverTop, left: popoverLeft });
                              } else {
                                // Fallback: use textarea position
                                const textareaRect = textarea.getBoundingClientRect();
                                const computedStyle = window.getComputedStyle(textarea);
                                const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
                                const paddingTop = parseFloat(computedStyle.paddingTop) || 8;
                                const lineBottom = textareaRect.top + paddingTop + lineHeight;
                                const popoverTop = lineBottom + 8;
                                const popoverWidth = 400;
                                const popoverLeft = Math.max(8, Math.min(textareaRect.left, window.innerWidth - popoverWidth - 8));
                                
                                setCursorPosition({ top: lineBottom, left: textareaRect.left + 12 });
                                setVariablePopoverPosition({ top: popoverTop, left: popoverLeft });
                              }
                              
                              // Reset the flag after a short delay to allow useEffect to run normally after
                              setTimeout(() => {
                                justCalculatedPositionRef.current = false;
                              }, 100);
                            };
                            
                            // Set flag to prevent useEffect from overriding
                            justCalculatedPositionRef.current = true;
                            
                            // Calculate immediately
                            calculatePosition();
                            
                            // Also recalculate in next frame to ensure accuracy after DOM updates
                            requestAnimationFrame(() => {
                              requestAnimationFrame(calculatePosition);
                            });
                          } else if (showVariablePicker && pickerContext === "aiPrompt" && textBeforeCursor.includes("{{")) {
                            // Extract search query after "{{"
                            const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");
                            const searchText = textBeforeCursor.substring(lastOpenBrace + 2);
                            setVariableSearchQuery(searchText);
                            
                            // If user typed "{{" again, recalculate position
                            if (textBeforeCursor.endsWith("{{")) {
                              setOpenedViaHotkey(true);
                              const calculatePosition = () => {
                                const caretPos = getCaretLinePosition(textarea as HTMLElement);
                                
                                if (caretPos) {
                                  // Position popover exactly 8px below the caret's line
                                  const popoverTop = caretPos.lineBottom + 8;
                                  const popoverWidth = 400;
                                  const textareaRect = textarea.getBoundingClientRect();
                                  const popoverLeft = Math.max(8, Math.min(textareaRect.left, window.innerWidth - popoverWidth - 8));
                                  
                                  setCursorPosition({ top: caretPos.lineBottom, left: caretPos.lineLeft });
                                  setVariablePopoverPosition({ top: popoverTop, left: popoverLeft });
                                } else {
                                  // Fallback: use textarea position
                                  const textareaRect = textarea.getBoundingClientRect();
                                  const computedStyle = window.getComputedStyle(textarea);
                                  const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
                                  const paddingTop = parseFloat(computedStyle.paddingTop) || 8;
                                  const lineBottom = textareaRect.top + paddingTop + lineHeight;
                                  const popoverTop = lineBottom + 8;
                                  const popoverWidth = 400;
                                  const popoverLeft = Math.max(8, Math.min(textareaRect.left, window.innerWidth - popoverWidth - 8));
                                  
                                  setCursorPosition({ top: lineBottom, left: textareaRect.left + 12 });
                                  setVariablePopoverPosition({ top: popoverTop, left: popoverLeft });
                                }
                              };
                              
                              // Set flag to prevent useEffect from overriding
                              justCalculatedPositionRef.current = true;
                              
                              // Calculate immediately
                              calculatePosition();
                              
                              // Also recalculate in next frame
                              requestAnimationFrame(() => {
                                requestAnimationFrame(calculatePosition);
                              });
                            }
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (showVariablePicker && pickerContext === "aiPrompt") {
                          const textarea = e.currentTarget;
                          const selection = window.getSelection();
                          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                          let cursorPos = 0;
                          if (range && textarea.contains(range.commonAncestorContainer)) {
                            const preCaretRange = range.cloneRange();
                            preCaretRange.selectNodeContents(textarea);
                            preCaretRange.setEnd(range.endContainer, range.endOffset);
                            cursorPos = preCaretRange.toString().length;
                          }
                          const textBeforeCursor = promptMessage.substring(0, cursorPos);
                          
                          if (textBeforeCursor.includes("{{")) {
                            const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");
                            const searchText = textBeforeCursor.substring(lastOpenBrace + 2);
                            setVariableSearchQuery(searchText);
                          }
                        }
                      }}
                        className="w-full min-h-[235px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "15px", lineHeight: "22px" }}>
                      Tools
                    </p>
                    <p className="text-xs text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "12px", lineHeight: "16px" }}>
                      Connect APIs the agent can use to take action or retrieve information.
                    </p>

                    {/* Added tool chips */}
                    {queryToolAdded && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <div
                          ref={queryChipRef}
                          className="relative inline-flex items-center gap-1.5 h-8 pl-2 pr-1 rounded-full border border-[#e0dede] bg-[#f5f5f5] cursor-pointer hover:bg-[#eaeaea] transition-colors"
                          onClick={() => setShowQueryModal(true)}
                          onMouseEnter={() => setQueryChipHover(true)}
                          onMouseLeave={() => setQueryChipHover(false)}
                        >
                          <Database className="size-3.5 text-[#595555] shrink-0" />
                          <span className="text-sm text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 485, fontSize: "13px" }}>
                            Query Rippling Data
                          </span>
                          <button
                            type="button"
                            className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQueryToolAdded(false);
                            }}
                          >
                            <X className="size-3.5 text-[#595555]" />
                          </button>

                          {/* Tooltip on hover */}
                          {queryChipHover && (
                            <div className="absolute left-0 bottom-full mb-2 z-50 bg-[#252528] text-white rounded-lg px-3 py-2.5 shadow-lg w-[260px] pointer-events-none">
                              <p className="text-xs font-medium mb-1" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                                Query Rippling Data
                              </p>
                              <p className="text-[11px] text-white/70 mb-1.5" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                                {queryScope === "all" ? "Scope: All Rippling data" : "Scope: Specific categories"}
                              </p>
                              {queryScope === "specific" && selectedObjects.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {selectedObjects.map((obj) => (
                                    <span key={obj} className="text-[10px] bg-white/15 rounded px-1.5 py-0.5">
                                      {obj}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="relative mt-2">
                      <Button
                        ref={toolButtonRef}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-[129px] h-8 text-sm bg-white border border-black/20 rounded-md px-3 gap-1.5 flex items-center justify-center"
                        onClick={() => setShowToolPopover(!showToolPopover)}
                      >
                        Add tool
                      </Button>
                      {showToolPopover && (
                        <div
                          className="tool-popover fixed z-50 bg-white border border-[#e0dede] rounded-lg shadow-lg w-[280px] py-1"
                          style={{
                            top: `${toolPopoverPosition.top}px`,
                            left: `${toolPopoverPosition.left}px`,
                          }}
                        >
                          <button
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                              queryToolAdded ? "opacity-50 cursor-not-allowed" : "hover:bg-[#f5f5f5]"
                            }`}
                            disabled={queryToolAdded}
                            onClick={() => {
                              if (!queryToolAdded) {
                                setShowToolPopover(false);
                                setShowQueryModal(true);
                              }
                            }}
                          >
                            <Database className="size-4 text-[#595555] shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>Query Rippling Data</span>
                              <span className="text-xs text-[#8c8888]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                                {queryToolAdded ? "Already added" : "Search and retrieve internal data"}
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f5f5f5] transition-colors text-left"
                            onClick={() => setShowToolPopover(false)}
                          >
                            <Globe className="size-4 text-[#595555] shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>Call public API</span>
                              <span className="text-xs text-[#8c8888]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>Connect to an external API endpoint</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f5f5f5] transition-colors text-left"
                            onClick={() => setShowToolPopover(false)}
                          >
                            <Terminal className="size-4 text-[#595555] shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>Run a function</span>
                              <span className="text-xs text-[#8c8888]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>Execute a custom code function</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                      Output format
                    </label>
                    <div className="relative">
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="w-full h-10 px-3 py-2 text-base leading-6 border border-[#CCCCCC] rounded-md bg-white appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[#5aa5e7] focus:border-[#5aa5e7]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, color: "#000000" }}
                      >
                        <option value="Text">Text</option>
                        <option value="JSON">JSON</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-black pointer-events-none" />
                    </div>
                  </div>

                  {outputFormat === "JSON" && (
                    <div className="space-y-2.5">
                      <div>
                        <h3 className="text-sm font-medium text-black mb-1">JSON Schema</h3>
                        <p className="text-xs text-black mb-4">
                          The model will generate a JSON object that matches this schema.
                        </p>
                      </div>
                      
                      {/* Tab switcher */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-row items-center gap-px h-6 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setJsonSchemaMode("basic")}
                            className={`flex flex-row justify-center items-center h-6 min-h-6 text-xs font-medium rounded border-0 outline-none transition-colors ${
                              jsonSchemaMode === "basic"
                                ? "bg-[#E0DEDB] text-black px-2"
                                : "bg-transparent text-black w-[70px]"
                            }`}
                          >
                            Basic
                          </button>
                          <button
                            type="button"
                            onClick={() => setJsonSchemaMode("advanced")}
                            className={`flex flex-row justify-center items-center h-6 min-h-6 text-xs font-medium rounded border-0 outline-none transition-colors ${
                              jsonSchemaMode === "advanced"
                                ? "bg-[#E0DEDB] text-black px-2"
                                : "bg-transparent text-black w-[70px]"
                            }`}
                          >
                            Advanced
                          </button>
                        </div>
                        <div className="relative">
                          <Button
                            ref={generateButtonRef}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs bg-white border border-black/20 rounded-md px-2 gap-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isGeneratingSchema}
                            onClick={() => setShowGeneratePopover(!showGeneratePopover)}
                          >
                            Generate
                          </Button>
                          
                          {showGeneratePopover && (
                            <div 
                              className="generate-popover fixed z-50 bg-white border border-[#e0dede] rounded-lg shadow-md w-[452px] p-3 flex flex-col gap-4"
                              style={{
                                top: `${popoverPosition.top}px`,
                                right: `${popoverPosition.right}px`,
                              }}
                            >
                              <Textarea
                                placeholder="Describe how you want the model to respond, and we'll generate a JSON schema"
                                value={generatePrompt}
                                onChange={(e) => setGeneratePrompt(e.target.value)}
                                className="w-full min-h-[80px] max-h-[200px] resize-none border-[#CCCCCC] text-sm overflow-y-auto"
                              />
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  className="bg-[#7A005D] text-white hover:bg-[#7A005D]/90 h-9 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={isGeneratingSchema}
                                  onClick={async () => {
                                    if (generatePrompt.trim() && !isGeneratingSchema) {
                                      setIsGeneratingSchema(true);
                                      setShowGeneratePopover(false);
                                      
                                      // Simulate API call delay
                                      await new Promise(resolve => setTimeout(resolve, 1500));
                                      
                                      // Generate JSON schema based on prompt
                                      const properties = generateSchemaFromPrompt(generatePrompt);
                                      const lowerPrompt = generatePrompt.toLowerCase();
                                      
                                      // Determine title from prompt
                                      let title = "GeneratedSchema";
                                      if (lowerPrompt.includes("welcome") && lowerPrompt.includes("message")) {
                                        title = "WelcomeMessage";
                                      } else if (lowerPrompt.includes("schema for")) {
                                        // Try to extract a title from the prompt
                                        const match = generatePrompt.match(/schema for (?:a |an )?([^,\.]+)/i);
                                        if (match && match[1]) {
                                          title = match[1].trim()
                                            .split(/\s+/)
                                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                            .join("");
                                        }
                                      }
                                      
                                      const generatedSchema = {
                                        "$schema": "http://json-schema.org/draft-07/schema#",
                                        title: title,
                                        type: "object",
                                        properties: properties,
                                      };
                                      
                                      // Update based on current mode
                                      if (jsonSchemaMode === "advanced") {
                                        setJsonSchemaText(JSON.stringify(generatedSchema, null, 2));
                                      } else {
                                        // Convert to properties array for basic mode
                                        // Note: Basic mode doesn't support nested objects, so we flatten them
                                        const propertiesArray: JsonProperty[] = [];
                                        Object.entries(generatedSchema.properties).forEach(([name, prop]: [string, any]) => {
                                          if (prop.type === "object" && prop.properties) {
                                            // For nested objects, add each nested property with a prefix
                                            Object.entries(prop.properties).forEach(([nestedName, nestedProp]: [string, any]) => {
                                              propertiesArray.push({
                                                id: `prop-${name}-${nestedName}-${Date.now()}`,
                                                name: `${name}.${nestedName}`,
                                                type: nestedProp.type === "string" ? "STR" : nestedProp.type === "number" ? "NUM" : nestedProp.type === "boolean" ? "BOOL" : "STR",
                                                description: nestedProp.description || "",
                                              });
                                            });
                                          } else {
                                            propertiesArray.push({
                                              id: `prop-${name}-${Date.now()}`,
                                              name,
                                              type: prop.type === "string" ? "STR" : prop.type === "number" ? "NUM" : prop.type === "boolean" ? "BOOL" : "STR",
                                              description: prop.description || "",
                                            });
                                          }
                                        });
                                        setJsonProperties(propertiesArray);
                                      }
                                      
                                      setGeneratePrompt("");
                                      setIsGeneratingSchema(false);
                                    }
                                  }}
                                >
                                  Create
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Basic Mode */}
                      {jsonSchemaMode === "basic" && (
                        <div className="space-y-4">
                          {isGeneratingSchema ? (
                            <div className="space-y-4">
                              <div className="h-4 bg-[#e1d8d2] rounded w-[76px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[421px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[357px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[330px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[168px]" />
                            </div>
                          ) : (
                            jsonProperties.map((property) => (
                            <div key={property.id} className="flex gap-4 items-start">
                              <Input
                                placeholder="Name"
                                value={property.name}
                                onChange={(e) => {
                                  setJsonProperties(
                                    jsonProperties.map((p) =>
                                      p.id === property.id
                                        ? { ...p, name: e.target.value }
                                        : p
                                    )
                                  );
                                }}
                                className="flex-1 h-10"
                              />
                              <div className="relative w-[100px]">
                                <select
                                  value={property.type}
                                  onChange={(e) => {
                                    setJsonProperties(
                                      jsonProperties.map((p) =>
                                        p.id === property.id
                                          ? { ...p, type: e.target.value }
                                          : p
                                      )
                                    );
                                  }}
                                  className="w-full h-10 px-3 py-2 text-base leading-6 border border-[#CCCCCC] rounded-md bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-[#5aa5e7] focus:border-[#5aa5e7]"
                                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, color: "#000000" }}
                                >
                                  <option value="STR">STR</option>
                                  <option value="NUM">NUM</option>
                                  <option value="BOOL">BOOL</option>
                                  <option value="OBJ">OBJ</option>
                                  <option value="ARR">ARR</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-black pointer-events-none" />
                              </div>
                              <Input
                                placeholder="Description"
                                value={property.description}
                                onChange={(e) => {
                                  setJsonProperties(
                                    jsonProperties.map((p) =>
                                      p.id === property.id
                                        ? { ...p, description: e.target.value }
                                        : p
                                    )
                                  );
                                }}
                                className="flex-1 h-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-[#8c8888] hover:text-red-600"
                                onClick={() => {
                                  setJsonProperties(
                                    jsonProperties.filter((p) => p.id !== property.id)
                                  );
                                }}
                              >
                                <TrashIcon className="size-4" />
                              </Button>
                            </div>
                          ))
                          )}
                          {!isGeneratingSchema && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-[129px] h-8 text-sm bg-white border border-black/20 rounded-md px-3 gap-1.5 flex items-center justify-center"
                            onClick={() => {
                              setJsonProperties([
                                ...jsonProperties,
                                {
                                  id: `prop-${Date.now()}`,
                                  name: "",
                                  type: "STR",
                                  description: "",
                                },
                              ]);
                            }}
                          >
                            Add property
                          </Button>
                          )}
                        </div>
                      )}

                      {/* Advanced Mode */}
                      {jsonSchemaMode === "advanced" && (
                        <div className="border border-[#CCCCCC] rounded-lg bg-white overflow-hidden">
                          {isGeneratingSchema ? (
                            <div className="p-4 space-y-2">
                              <div className="h-4 bg-[#e1d8d2] rounded w-[76px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[421px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[357px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[330px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[168px]" />
                            </div>
                          ) : (
                            <>
                              <div className="border-b border-[#e0dede] flex items-center justify-between px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <Code className="size-4 text-[#595555]" />
                                  <span className="text-sm font-medium text-[#595555]">JSON</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="size-2 rounded-full bg-[#20968f]" />
                                  <span className="text-sm text-black">Valid</span>
                                </div>
                              </div>
                              <div className="flex">
                                <div className="bg-[#f9f7f6] border-r border-[#e0dede] px-2 py-2 text-right">
                                  {jsonSchemaText.split("\n").map((_, i) => (
                                    <div key={i} className="text-xs text-[#8c8888] leading-6 font-mono">
                                      {i + 1}
                                    </div>
                                  ))}
                                </div>
                                <Textarea
                                  value={jsonSchemaText}
                                  onChange={(e) => setJsonSchemaText(e.target.value)}
                                  className="flex-1 border-0 rounded-none font-mono text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                  style={{ minHeight: "195px" }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="block text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "16px", lineHeight: "24px" }}>
                      Max tokens
                    </label>
                    <div className="relative w-full">
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="1"
                        defaultValue="25"
                        className="w-full h-1 bg-[#e1d8d2] rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #7A005D 0%, #7A005D 50%, #e1d8d2 50%, #e1d8d2 100%)`
                        }}
                      />
                      <div className="flex justify-between mt-2 text-xs text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "11px", lineHeight: "14px" }}>
                        <span>0</span>
                        <span>50</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedFlowStep?.role === "widget" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>Update widget</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-black">ID: 13</span>
                      <CloseIcon className="size-6 text-black cursor-pointer" onClick={() => setSelectedCanvasStepId(null)} />
                    </div>
                  </div>
                </div>
                <div className="bg-[#e0dede] h-px mb-6" />
                <div className="space-y-4">
                  <div>
                    <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                      Step name <span className="text-[#c3402c]">*</span>
                    </label>
                    <Input
                      defaultValue="Widget Update 1"
                      className="w-full border-[#CCCCCC]"
                    />
                  </div>

                  <div>
                    <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                      Widget name <span className="text-[#c3402c]">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={widgetConfig}
                        onChange={(e) => setWidgetConfig(e.target.value)}
                        className="w-full h-10 px-3 py-2 text-base leading-6 border border-[#CCCCCC] rounded-md bg-white appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-[#5aa5e7] focus:border-[#5aa5e7]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, color: "#000000" }}
                      >
                        <option value="Homepage Compliance Widget">Homepage Compliance Widget</option>
                        <option value="Team Dashboard Widget">Team Dashboard Widget</option>
                        <option value="Manager Overview Widget">Manager Overview Widget</option>
                        <option value="HR Summary Widget">HR Summary Widget</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-black pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium text-black mb-1">
                        Update data <span className="text-[#c3402c]">*</span>
                      </h3>
                      <p className="text-xs text-black mb-3">
                        Map Health check output fields to the widget.
                      </p>
                    </div>

                    {/* Auto-map toggle */}
                    <div className="flex items-center justify-between bg-[#f9f7f6] border border-[#e0dede] rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors ${autoMapEnabled ? "bg-[#7A005D]" : "bg-[#d3d3d3]"}`} onClick={() => setAutoMapEnabled(!autoMapEnabled)}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoMapEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-black">Auto-map from Health check</p>
                          <p className="text-xs text-[#8c8888]">Automatically pass all output fields to the widget</p>
                        </div>
                      </div>
                    </div>

                    {/* Summary when auto-map is on */}
                    {autoMapEnabled && (
                      <div className="border border-[#e0dede] rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-[#22c55e]" />
                            <span className="text-sm text-black">{autoMappedFields.length} fields mapped from <span className="font-medium">Health check</span> output</span>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-[#4a6ba6] hover:underline"
                            onClick={() => setShowMappingDetails(!showMappingDetails)}
                          >
                            {showMappingDetails ? "Hide details" : "View mappings"}
                          </button>
                        </div>

                        {/* Expandable mapping details */}
                        {showMappingDetails && (
                          <div className="border-t border-[#e0dede]">
                            <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2 bg-[#f9f7f6] text-xs font-medium text-[#8c8888] uppercase tracking-wide">
                              <span>Field</span>
                              <span>Source</span>
                            </div>
                            {autoMappedFields.map((mapping, i) => (
                              <div key={i} className={`grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2 text-sm ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}>
                                <span className="text-[#252528] font-mono text-xs">{mapping.field}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#512f3e]/10 border border-[#512f3e]/20 rounded-md text-xs font-medium text-[#512f3e]">
                                  {mapping.source}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manual message when auto-map is off */}
                    {!autoMapEnabled && (
                      <div className="border border-[#e0dede] rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="size-2 rounded-full bg-[#f59e0b]" />
                          <span className="text-sm text-black">Manual mapping required</span>
                        </div>
                        <p className="text-xs text-[#8c8888]">
                          Configure the widget data mapping in your widget settings or re-enable auto-map to use Health check output directly.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedFlowStep?.role === "runFunction" && (
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Matches WFchat StepDetailsDrawer + editor function branch */}
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        className="text-black"
                        style={{
                          fontFamily: "'Basel Grotesk', sans-serif",
                          fontWeight: 535,
                          fontSize: "20px",
                          lineHeight: "28px",
                        }}
                      >
                        Run function
                      </h2>
                      <p
                        className="mt-1 text-[13px] leading-4 tracking-[0.25px] text-[#595555]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                      >
                        ID: {selectedFlowStep.id.replace(/^[^-]+-/, "").slice(0, 12) || selectedFlowStep.id}
                      </p>
                    </div>
                    <CloseIcon
                      className="size-6 shrink-0 cursor-pointer text-black"
                      onClick={() => setSelectedCanvasStepId(null)}
                    />
                  </div>
                  <div className="mb-6 h-px bg-[#e0dede]" />

                  {/* FunctionAiDescriptionNotice — WFchat workflow-canvas */}
                  <div
                    className="mb-6 flex flex-col gap-3 rounded-xl border border-[#e8d5e0] bg-white p-5"
                    role="region"
                    aria-label="AI-generated function summary"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <AIIcon className="size-6 shrink-0" />
                      <span
                        className="text-sm font-semibold leading-5 text-[#252528]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 600 }}
                        id="fn-ai-summary-heading"
                      >
                        AI Summary
                      </span>
                      <span
                        className="inline-flex max-w-[200px] min-w-0 shrink items-center overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-medium leading-4 text-[#595555]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif" }}
                      >
                        Function
                      </span>
                    </div>
                    <div className="h-px w-full shrink-0 bg-[#e0dede]" aria-hidden />
                    <div className="-mx-5 flex flex-col px-5">
                      <div
                        role="textbox"
                        aria-readonly="true"
                        aria-multiline="true"
                        aria-labelledby="fn-ai-summary-heading"
                        className="w-full whitespace-pre-wrap border-0 bg-transparent px-0 py-1 text-[15px] leading-[1.35] text-[#252528]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                      >
                        {selectedFlowStep.summary}
                      </div>
                    </div>
                  </div>

                  <div
                    className="space-y-5"
                    role="region"
                    id="fn-drawer-setup-fields"
                    aria-label="Function step fields"
                  >
                    <div>
                      <label
                        className="mb-1 block text-[15px] leading-[19px] tracking-[0.25px] text-black"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                      >
                        Step name <span className="text-[#c3402c]">*</span>
                      </label>
                      <Input
                        readOnly
                        value={selectedFlowStep.functionTitle}
                        className="h-10 w-full border-[#CCCCCC]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-[15px] leading-[19px] tracking-[0.25px] text-black"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                        id="fn-catalog-label"
                      >
                        Function name
                      </label>
                      <button
                        type="button"
                        aria-labelledby="fn-catalog-label"
                        className="flex h-10 w-full cursor-default items-center justify-between gap-2 rounded-lg border border-[#CCCCCC] bg-white px-4 text-left text-[15px] text-[#252528]"
                        style={{
                          fontFamily: "'Basel Grotesk', sans-serif",
                          fontWeight: 430,
                          letterSpacing: "0.25px",
                        }}
                      >
                        <span className="min-w-0 truncate">{selectedFlowStep.functionTitle}</span>
                        <ChevronDown className="size-5 shrink-0 text-[#252528]" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {catalogStepTierLabelsActive ? (
                    isAiRunFunctionBasicTier(selectedFlowStep) ? (
                      <div className="mb-0 mt-6 flex items-start gap-1.5 rounded-md bg-[#f0fdf4] px-2.5 py-2 text-[13px] leading-[1.35] text-[#166534]">
                        <span className="font-semibold" aria-hidden>
                          ↑
                        </span>
                        <span style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                          Basic-tier path: single email or task automation. Use{" "}
                          <code className="rounded bg-white/80 px-1 font-mono text-[12px] text-[#14532d]">
                            isAiRunFunctionBasicTier(step)
                          </code>{" "}
                          to branch in code.
                        </span>
                      </div>
                    ) : (
                      <div className="mb-0 mt-6 flex items-start gap-1.5 rounded-md border border-[#e8d5e0] bg-[#fafafa] px-2.5 py-2 text-[13px] leading-[1.35] text-[#595555]">
                        <span style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                          Advanced-tier: this function is no longer email-or-task–only (e.g. other
                          channels, queries, or branching). Use{" "}
                          <code className="rounded bg-white px-1 font-mono text-[12px] text-[#3f3f46]">
                            isAiRunFunctionBasicTier(step)
                          </code>{" "}
                          in code to branch at runtime.
                        </span>
                      </div>
                    )
                  ) : null}

                  <div
                    className="mt-6 overflow-hidden rounded-lg border border-[#e0dede] bg-[#252528]"
                    role="region"
                    id="fn-drawer-code-panel"
                    aria-label="Generated code"
                  >
                      <div className="flex items-center justify-between border-b border-[#3f3f46] bg-[#2d2d33] px-3 py-2">
                        <span
                          className="font-mono text-[13px] text-[#a1a1aa]"
                        >{`/workflow/${selectedFlowStep.id.slice(0, 8) || "function"}`}</span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded text-[#e4e4e7] hover:bg-white/10"
                            aria-label="Expand code view"
                          >
                            <Maximize2 className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded text-[#e4e4e7] hover:bg-white/10"
                            aria-label="Edit code"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex min-h-[200px] font-mono text-xs leading-[1.45] text-[#e8e6e3]">
                        <div
                          className="shrink-0 select-none border-r border-[#3f3f46] bg-[#27272a] py-3 pr-3 pl-2 text-right text-[#71717a]"
                          aria-hidden
                        >
                          {(selectedFlowStep.generatedCode ?? "")
                            .split("\n")
                            .map((_, i) => (
                              <div key={i}>{i + 1}</div>
                            ))}
                        </div>
                        <pre className="m-0 flex-1 overflow-x-auto whitespace-pre p-3 tab-size-2">
                          {selectedFlowStep.generatedCode ??
                            `import RipplingSDK from "@rippling/rippling-sdk";

export async function onRipplingEvent(event, context) {
  const sdk = new RipplingSDK({ bearerToken: context.token });
  // …
}`}
                        </pre>
                      </div>
                    </div>
                </div>
              </div>
            )}

            {selectedFlowStep?.role === "custom" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2
                      className="text-black"
                      style={{
                        fontFamily: "'Basel Grotesk', sans-serif",
                        fontWeight: 535,
                        fontSize: "20px",
                        lineHeight: "28px",
                        display: "flex",
                        alignItems: "flex-end",
                      }}
                    >
                      {selectedFlowStep.title}
                    </h2>
                    <CloseIcon
                      className="size-6 text-black cursor-pointer"
                      onClick={() => setSelectedCanvasStepId(null)}
                    />
                  </div>
                  <p
                    className="text-[#595555] text-sm mb-2 uppercase tracking-wide"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                  >
                    {selectedFlowStep.categoryLabel}
                  </p>
                  <p
                    className="text-black"
                    style={{
                      fontFamily: "'Basel Grotesk', sans-serif",
                      fontWeight: 430,
                      fontSize: "15px",
                      lineHeight: "22px",
                    }}
                  >
                    This action was added from the canvas. Configure fields and connections in the full
                    workflow editor.
                  </p>
                </div>
                <div className="bg-[#e0dede] h-px mb-6" />
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-base leading-6 text-black mb-2"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                    >
                      Step name
                    </label>
                    <Input defaultValue={selectedFlowStep.title} className="w-full border-[#CCCCCC]" />
                  </div>
                </div>
              </div>
            )}

            </div>

            {/* Footer - Fixed at bottom of drawer */}
            <div className="border-t border-[#e0dede] bg-white p-4 flex items-center justify-between h-16 shrink-0">
              <div className="flex items-center gap-3">
                {selectedFlowStep?.role !== "trigger" && (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      className="bg-[#bb3d2a] text-white hover:bg-[#bb3d2a]/90 h-10"
                      onClick={handleRemoveSelectedStep}
                    >
                      Remove
                    </Button>
                    <Button variant="outline" className="border-[#d3d3d3] h-10">
                      Duplicate
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="border-[#d3d3d3] h-10">
                  Cancel
                </Button>
                <Button className="bg-[#7A005D] text-white hover:bg-[#7A005D]/90 h-10">
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Workflow Visualization (scrollable tree; trigger stays pinned) */}
        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col pt-8">
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="flex flex-col items-center pb-24">
              <div className="sticky top-0 z-10 mb-0 flex w-full flex-col items-center gap-0 bg-[#f9f7f6] pt-4 pb-0">
                <div
                  className={workflowCanvasNodeClass(
                    selectedCanvasStepId === WORKFLOW_TRIGGER_ID,
                    selectedCanvasStepId !== null
                  )}
                  onClick={() => setSelectedCanvasStepId(WORKFLOW_TRIGGER_ID)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedCanvasStepId(WORKFLOW_TRIGGER_ID);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {/* StepCardHeader — WFchat workflow-canvas */}
                  <div className="box-border flex w-full flex-row items-start gap-3 p-3">
                    <TriggerIcon
                      className={cn(
                        "size-6 shrink-0",
                        selectedCanvasStepId !== null &&
                          selectedCanvasStepId !== WORKFLOW_TRIGGER_ID
                          ? "text-[#8c8888]"
                          : "text-[#252528]"
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex min-w-0 items-center gap-2">
                        <p
                          className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                          style={{
                            fontFamily: "'Basel Grotesk', sans-serif",
                            fontWeight: 600,
                          }}
                        >
                          Workflow trigger
                        </p>
                        {isWorkflowBasicTriggerOption(workflowTriggerOptionId) ? (
                          <span
                            className={`${WORKFLOW_TIER_CHIP_CLASS_BASIC} shrink-0`}
                            style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                          >
                            Basic
                          </span>
                        ) : null}
                      </div>
                      <p
                        className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
                        style={{
                          fontFamily: "'Basel Grotesk', sans-serif",
                          fontWeight: 400,
                        }}
                      >
                        {workflowTriggerLabel}
                      </p>
                    </div>
                  </div>
                </div>
                <WorkflowStepConnector
                  insertIndex={0}
                  onInsertStep={handleInsertCatalogStep}
                  catalogDragActive={catalogDragActive}
                  onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                />
              </div>

            {workflowFlowSteps.slice(1).map((step, idx) => (
              <Fragment key={step.id}>
                <div
                  className={workflowCanvasNodeClass(
                    selectedCanvasStepId === step.id,
                    selectedCanvasStepId !== null
                  )}
                  onClick={() => setSelectedCanvasStepId(step.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedCanvasStepId(step.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="box-border flex w-full flex-row items-start gap-3 p-3">
                    {step.role === "aiPrompt" && (
                      <>
                        <AIIcon
                          className={cn(
                            "size-6 shrink-0",
                            selectedCanvasStepId !== null && selectedCanvasStepId !== step.id && "opacity-40"
                          )}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex min-w-0 items-center gap-2">
                            <p
                              className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                              style={{
                                fontFamily: "'Basel Grotesk', sans-serif",
                                fontWeight: 600,
                              }}
                            >
                              AI agent
                            </p>
                            {catalogStepTierLabelsActive ? (
                              <span
                                className={cn(
                                  "pointer-events-none shrink-0",
                                  WORKFLOW_TIER_CHIP_CLASS_ADVANCED
                                )}
                                style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                              >
                                Advanced
                              </span>
                            ) : null}
                          </div>
                          <p
                            className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
                            style={{
                              fontFamily: "'Basel Grotesk', sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            {step.title}
                          </p>
                        </div>
                      </>
                    )}
                    {step.role === "widget" && (
                      <>
                        <WidgetIcon
                          className={cn(
                            "size-6 shrink-0",
                            selectedCanvasStepId !== null && selectedCanvasStepId !== step.id
                              ? "text-[#8c8888]"
                              : "text-black"
                          )}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex min-w-0 items-center gap-2">
                            <p
                              className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                              style={{
                                fontFamily: "'Basel Grotesk', sans-serif",
                                fontWeight: 600,
                              }}
                            >
                              Update widget
                            </p>
                            {catalogStepTierLabelsActive ? (
                              <span
                                className={cn(
                                  "pointer-events-none shrink-0",
                                  WORKFLOW_TIER_CHIP_CLASS_ADVANCED
                                )}
                                style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                              >
                                Advanced
                              </span>
                            ) : null}
                          </div>
                          <p
                            className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
                            style={{
                              fontFamily: "'Basel Grotesk', sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            {step.title}
                          </p>
                        </div>
                      </>
                    )}
                    {step.role === "runFunction" && (
                      <>
                        <Terminal
                          className={cn(
                            "size-6 shrink-0",
                            selectedCanvasStepId !== null && selectedCanvasStepId !== step.id
                              ? "text-[#8c8888]"
                              : "text-[#252528]"
                          )}
                          strokeWidth={2}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex min-w-0 items-center gap-2">
                            <p
                              className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                              style={{
                                fontFamily: "'Basel Grotesk', sans-serif",
                                fontWeight: 600,
                              }}
                            >
                              {step.runLabel}
                            </p>
                            {catalogStepTierLabelsActive ? (
                              <span
                                className={cn(
                                  "pointer-events-none shrink-0",
                                  step.functionTier === "basic"
                                    ? WORKFLOW_TIER_CHIP_CLASS_BASIC
                                    : WORKFLOW_TIER_CHIP_CLASS_ADVANCED
                                )}
                                style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                              >
                                {step.functionTier === "basic" ? "Basic" : "Advanced"}
                              </span>
                            ) : null}
                          </div>
                          <p
                            className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
                            style={{
                              fontFamily: "'Basel Grotesk', sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            {step.functionTitle}
                          </p>
                        </div>
                      </>
                    )}
                    {step.role === "custom" &&
                      (() => {
                        const cat = findCatalogItem(step.catalogItemId);
                        const dim =
                          selectedCanvasStepId !== null && selectedCanvasStepId !== step.id;
                        const catalogBasic = isCatalogItemBasicTier(step.catalogItemId);
                        return (
                          <>
                            <div
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center text-[#595555]",
                                dim && "opacity-40"
                              )}
                            >
                              {cat?.icon ?? <ClipboardList className="size-4" />}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <div className="flex min-w-0 items-center gap-2">
                                <p
                                  className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                                  style={{
                                    fontFamily: "'Basel Grotesk', sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
                                  {cat?.label ?? step.title}
                                </p>
                                {catalogStepTierLabelsActive ? (
                                  <span
                                    className={cn(
                                      "pointer-events-none shrink-0",
                                      catalogBasic
                                        ? WORKFLOW_TIER_CHIP_CLASS_BASIC
                                        : WORKFLOW_TIER_CHIP_CLASS_ADVANCED
                                    )}
                                    style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                                  >
                                    {catalogBasic ? "Basic" : "Advanced"}
                                  </span>
                                ) : null}
                              </div>
                              <p
                                className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
                                style={{
                                  fontFamily: "'Basel Grotesk', sans-serif",
                                  fontWeight: 400,
                                }}
                              >
                                {step.title}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                  </div>
                </div>

                <WorkflowStepConnector
                  insertIndex={idx + 1}
                  onInsertStep={handleInsertCatalogStep}
                  catalogDragActive={catalogDragActive}
                  onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                />
              </Fragment>
            ))}

            <p className="mt-2 text-sm text-[#8c8888]">End workflow</p>
            </div>
          </div>

          {/* Zoom Controls — above sticky trigger (z-10) and connector drop layer (z-20) */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center border border-[#e0dede] bg-white rounded">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r border-[#e0dede]">
                <ZoomOut className="size-4" />
              </Button>
              <div className="px-3 py-2 text-xs font-bold text-[#502d3c]">100%</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-l border-[#e0dede]">
                <ZoomIn className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 border-[#e0dede]">
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </div>
        </div>
      </div>

        {/* AI workflow chat (WFchat-style: prompt → trigger + Run function on canvas) */}
        {workflowAssistantOpen && (
        <div
          id="workflow-assistant-panel"
          className="relative z-10 flex h-full min-h-0 w-[380px] shrink-0 flex-col border-l border-[#e0dede] bg-white"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e0dede] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="size-5 shrink-0 text-[#7A005D]" aria-hidden />
              <div className="min-w-0">
                <p
                  className="truncate text-[15px] leading-5 text-[#252528]"
                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                >
                  Workflow assistant
                </p>
                <p
                  className="text-[11px] leading-4 text-[#8c8888]"
                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                >
                  Describe what to automate
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWorkflowAssistantOpen(false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#595555] transition-colors hover:bg-[#f5f5f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/40"
              aria-label="Close workflow assistant"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {workflowChatMessages.length === 0 && !workflowChatBusy && (
              <p
                className="text-sm text-[#8c8888]"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
              >
                Try: &ldquo;Send an email on an employee&apos;s start date&rdquo; — the canvas will
                show your trigger and a <span className="font-medium text-[#252528]">Run function</span>{" "}
                step (Basic if it&apos;s only email or task logic; Advanced otherwise).
              </p>
            )}
            <div className="flex flex-col gap-3">
              {workflowChatMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[min(100%,20rem)] rounded-lg px-3 py-2 text-sm leading-5 ${
                      m.role === "user"
                        ? "bg-[#7A005D] text-white"
                        : "border border-[#e0dede] bg-[#f9f7f6] text-[#252528]"
                    }`}
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                  >
                    {m.content.split("\n").map((line, i) => (
                      <p key={i} className={i > 0 ? "mt-1" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {workflowChatBusy && (
                <div className="flex justify-start">
                  <div
                    className="rounded-lg border border-[#e0dede] bg-[#f9f7f6] px-3 py-2 text-sm text-[#595555]"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                  >
                    Translating your request into trigger + function…
                  </div>
                </div>
              )}
              <div ref={workflowChatEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-[#e0dede] p-3">
            <div className="flex gap-2 rounded-lg border border-[#e0dede] bg-[#f9f7f6] p-2">
              <textarea
                className="min-h-[44px] max-h-[160px] flex-1 resize-y bg-transparent px-2 py-1.5 text-sm text-[#252528] outline-none placeholder:text-[#a8a4a4]"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                placeholder="Ask, search, or create a workflow…"
                rows={2}
                value={workflowChatInput}
                onChange={(e) => setWorkflowChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleWorkflowChatSubmit();
                  }
                }}
              />
              <Button
                type="button"
                className="h-10 w-10 shrink-0 self-end rounded-md bg-[#7A005D] p-0 text-white hover:bg-[#7A005D]/90 disabled:opacity-40"
                aria-label="Send"
                disabled={!workflowChatInput.trim() || workflowChatBusy}
                onClick={handleWorkflowChatSubmit}
              >
                <ArrowUp className="mx-auto size-5" strokeWidth={2} />
              </Button>
            </div>
          </div>
        </div>
        )}

        <TriggerSelector
          open={workflowTriggerSelectorOpen}
          onOpenChange={(nextOpen) => {
            setWorkflowTriggerSelectorOpen(nextOpen);
            if (!nextOpen) {
              setTriggerSelectorInitialBrowse(null);
            }
          }}
          initialBrowseSelection={triggerSelectorInitialBrowse}
          onTriggerConfirm={({ displayLabel, optionId }) => {
            setWorkflowTriggerLabel(displayLabel);
            setWorkflowTriggerOptionId(optionId);
          }}
        />
      </div>
      </div>
      )}

      {/* Variable Dropdown for Widget and Prompt - Popover version */}
      {showVariablePicker && (pickerContext === "widget" || pickerContext === "aiPrompt") && (
        <div 
          className="variable-popover fixed z-50 bg-white border-l border-r border-b border-t-0 border-[#e0dede] rounded-lg shadow-lg w-[400px] max-h-[400px] flex flex-col"
          style={{
            top: `${variablePopoverPosition.top}px`,
            left: `${variablePopoverPosition.left}px`,
          }}
          onMouseDown={(e) => {
            // Stop propagation to prevent textarea from receiving mousedown events
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Stop propagation to prevent textarea from receiving click events
            e.stopPropagation();
          }}
        >
          <VariableDropdown
            availableSteps={getAvailableSteps(selectedNode, outputFormat, jsonProperties)}
            selectedVariables={[]}
            initialSearchQuery={variableSearchQuery}
            hideSearchInput={openedViaHotkey}
            openedViaHotkey={openedViaHotkey}
            onSelect={(variables) => {
              if (variables.length > 0) {
                const currentText = pickerContext === "widget" ? widgetConfig : promptMessage;
                
                // Format variable as {{object.category.field}}
                const variable = variables[variables.length - 1];
                const variableText = `{{${variable.object}.${variable.category}.${variable.field}}}`;
                
                let finalText: string;
                let insertionPosition: number;
                
                if (openedViaHotkey) {
                  // When opened via hotkey, find the "{{" that opened the picker
                  const textareaId = pickerContext === "widget" ? 'widget-config' : 'prompt-textarea';
                  const textarea = document.getElementById(textareaId);
                  let currentCursorPos = currentText.length; // Default to end
                  
                  if (textarea) {
                    const selection = window.getSelection();
                    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                    if (range && textarea.contains(range.commonAncestorContainer)) {
                      const preCaretRange = range.cloneRange();
                      preCaretRange.selectNodeContents(textarea);
                      preCaretRange.setEnd(range.endContainer, range.endOffset);
                      currentCursorPos = preCaretRange.toString().length;
                    }
                  }
                  
                  // Find the "{{" that opened the picker (should be the last "{{" before cursor)
                  const textBeforeCursor = currentText.substring(0, currentCursorPos);
                  const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");
                  
                  if (lastOpenBrace >= 0) {
                    // Replace everything from "{{" to current cursor position
                    const before = currentText.substring(0, lastOpenBrace);
                    const after = currentText.substring(currentCursorPos);
                    finalText = before + variableText + after;
                    insertionPosition = lastOpenBrace + variableText.length;
                  } else {
                    // Fallback: use saved position if we can't find "{{"
                    const { start, end } = savedTextCursorPosition;
                    const before = currentText.substring(0, start);
                    const after = currentText.substring(end);
                    finalText = before + variableText + after;
                    insertionPosition = start + variableText.length;
                  }
                } else {
                  // When opened via "Add variable" button, use saved cursor position
                  const { start, end } = savedTextCursorPosition;
                  const before = currentText.substring(0, start);
                  const after = currentText.substring(end);
                  finalText = before + variableText + after;
                  insertionPosition = start + variableText.length;
                }
                  
                  if (pickerContext === "widget") {
                    setWidgetConfig(finalText);
                  } else {
                    setPromptMessage(finalText);
                  }
                  
                  // Reset cursor position, search query, and hotkey flag
                  // Reset cursor position and hotkey state
                  setCursorPosition({ top: 0, left: 0 });
                  setVariableSearchQuery("");
                  setOpenedViaHotkey(false);
                  // Reset popover position to prevent it from sticking
                  setVariablePopoverPosition({ top: 0, left: 0 });
                  
                  // Set cursor position after inserted variable
                  setTimeout(() => {
                    const textareaId = pickerContext === "widget" ? 'widget-config' : 'prompt-textarea';
                    const textarea = document.getElementById(textareaId);
                    if (textarea) {
                      textarea.focus();
                      // Use the insertion position we calculated earlier
                      const newPosition = insertionPosition;
                      
                      // Set cursor in contentEditable
                      const selection = window.getSelection();
                      const walker = document.createTreeWalker(
                        textarea,
                        NodeFilter.SHOW_TEXT,
                        null
                      );
                      
                      let currentPos = 0;
                      let targetNode: Node | null = null;
                      let targetOffset = 0;
                      
                      while (walker.nextNode()) {
                        const node = walker.currentNode;
                        const nodeLength = node.textContent?.length || 0;
                        
                        if (currentPos + nodeLength >= newPosition) {
                          targetNode = node;
                          targetOffset = Math.min(newPosition - currentPos, nodeLength);
                          break;
                        }
                        
                        currentPos += nodeLength;
                      }
                      
                      // If we didn't find a node, use the last text node
                      if (!targetNode) {
                        const allTextNodes: Node[] = [];
                        const textWalker = document.createTreeWalker(
                          textarea,
                          NodeFilter.SHOW_TEXT,
                          null
                        );
                        while (textWalker.nextNode()) {
                          allTextNodes.push(textWalker.currentNode);
                        }
                        if (allTextNodes.length > 0) {
                          targetNode = allTextNodes[allTextNodes.length - 1];
                          targetOffset = targetNode.textContent?.length || 0;
                        }
                      }
                      
                      if (targetNode && targetNode.textContent !== null) {
                        const maxOffset = targetNode.textContent.length;
                        targetOffset = Math.min(targetOffset, maxOffset);
                        
                        const newRange = document.createRange();
                        newRange.setStart(targetNode, targetOffset);
                        newRange.setEnd(targetNode, targetOffset);
                        selection?.removeAllRanges();
                        selection?.addRange(newRange);
                      }
                    }
                  }, 0);
              }
              setShowVariablePicker(false);
            }}
            onClose={() => {
              setShowVariablePicker(false);
              setOpenedViaHotkey(false);
              setCursorPosition({ top: 0, left: 0 });
            }}
            multiple={false}
            isOpen={true}
            inModal={false}
          />
        </div>
      )}

      {/* Query Rippling Data Modal */}
      {showQueryModal && (
        <>
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setShowQueryModal(false);
              setObjectDropdownOpen(false);
              setObjectSearchQuery("");
            }}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#f3f0ee]">
                  <Database className="size-4 text-[#595555]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                    Query Rippling Data
                  </h2>
                  <p className="text-xs text-[#8c8888]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                    Configure which data the agent can access
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-[#8c8888] hover:text-black transition-colors"
                onClick={() => {
                  setShowQueryModal(false);
                  setObjectDropdownOpen(false);
                  setObjectSearchQuery("");
                }}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="bg-[#e0dede] h-px" />

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-black mb-3" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                  Data scope
                </label>
                <div className="flex flex-col gap-2">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      queryScope === "all"
                        ? "border-[#7A005D] bg-[#7A005D]/5"
                        : "border-[#e0dede] hover:border-[#ccc]"
                    }`}
                    onClick={() => {
                      setQueryScope("all");
                      setObjectDropdownOpen(false);
                    }}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        queryScope === "all"
                          ? "border-[#7A005D]"
                          : "border-[#ccc]"
                      }`}
                    >
                      {queryScope === "all" && (
                        <div className="w-2 h-2 rounded-full bg-[#7A005D]" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        All Rippling data
                      </span>
                      <p className="text-xs text-[#8c8888] mt-0.5" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                        The agent can query any category in Rippling
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      queryScope === "specific"
                        ? "border-[#7A005D] bg-[#7A005D]/5"
                        : "border-[#e0dede] hover:border-[#ccc]"
                    }`}
                    onClick={() => setQueryScope("specific")}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        queryScope === "specific"
                          ? "border-[#7A005D]"
                          : "border-[#ccc]"
                      }`}
                    >
                      {queryScope === "specific" && (
                        <div className="w-2 h-2 rounded-full bg-[#7A005D]" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        Specific categories only
                      </span>
                      <p className="text-xs text-[#8c8888] mt-0.5" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                        Restrict access to selected Rippling categories
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Specific categories multiselect */}
              {queryScope === "specific" && (
                <div>
                  <label className="block text-sm font-medium text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                    Select categories
                  </label>

                  {/* Dropdown trigger */}
                  <div ref={objectDropdownRef}>
                    <div
                      ref={objectTriggerRef}
                      className={`flex flex-wrap items-center gap-1.5 border rounded-md bg-white cursor-pointer transition-colors min-h-[40px] px-2 py-1.5 ${
                        objectDropdownOpen ? "border-[#7A005D] ring-2 ring-[#7A005D]/20" : "border-[#CCCCCC]"
                      }`}
                      onClick={() => setObjectDropdownOpen(!objectDropdownOpen)}
                    >
                      {/* Selected chips inside input */}
                      {selectedObjects.map((obj) => (
                        <span
                          key={obj}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-[#f3f0ee] text-black border border-[#e0dede]"
                          style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                        >
                          {obj}
                          <button
                            type="button"
                            className="text-[#8c8888] hover:text-black transition-colors ml-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedObjects(selectedObjects.filter((o) => o !== obj));
                            }}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                      <div className="flex-1 min-w-[100px]">
                        {objectDropdownOpen ? (
                          <input
                            type="text"
                            className="w-full text-sm outline-none bg-transparent"
                            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                            placeholder={selectedObjects.length === 0 ? "Search categories..." : "Search..."}
                            value={objectSearchQuery}
                            onChange={(e) => setObjectSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          selectedObjects.length === 0 && (
                            <span className="text-sm text-[#8c8888] px-1" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                              Select categories...
                            </span>
                          )
                        )}
                      </div>
                      <div className="shrink-0 px-1">
                        <ChevronDown
                          className={`size-4 text-[#8c8888] transition-transform ${
                            objectDropdownOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#e0dede] h-px" />
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="border-[#d3d3d3] h-9 px-4"
                onClick={() => {
                  setShowQueryModal(false);
                  setObjectDropdownOpen(false);
                  setObjectSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#7A005D] text-white hover:bg-[#7A005D]/90 h-9 px-4"
                onClick={() => {
                  setQueryToolAdded(true);
                  setShowQueryModal(false);
                  setObjectDropdownOpen(false);
                  setObjectSearchQuery("");
                }}
              >
                {queryToolAdded ? "Save" : "Add tool"}
              </Button>
            </div>
          </div>
        </div>

        {/* Fixed dropdown list rendered outside modal to avoid clipping */}
        {objectDropdownOpen && queryScope === "specific" && (
          <div
            className="object-dropdown-list fixed z-[200] bg-white border border-[#e0dede] rounded-md shadow-lg max-h-[200px] overflow-y-auto"
            style={{
              top: `${objectDropdownPosition.top}px`,
              left: `${objectDropdownPosition.left}px`,
              width: `${objectDropdownPosition.width}px`,
            }}
          >
            {RIPPLING_CATEGORIES.filter(
              (obj) =>
                obj.toLowerCase().includes(objectSearchQuery.toLowerCase())
            ).map((obj) => {
              const isSelected = selectedObjects.includes(obj);
              return (
                <button
                  key={obj}
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-[#7A005D]/5 text-black"
                      : "hover:bg-[#f5f5f5] text-black"
                  }`}
                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      setSelectedObjects(selectedObjects.filter((o) => o !== obj));
                    } else {
                      setSelectedObjects([...selectedObjects, obj]);
                    }
                  }}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-[#7A005D] border-[#7A005D]"
                        : "border-[#ccc]"
                    }`}
                  >
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {obj}
                </button>
              );
            })}
            {RIPPLING_CATEGORIES.filter((obj) =>
              obj.toLowerCase().includes(objectSearchQuery.toLowerCase())
            ).length === 0 && (
              <div className="px-3 py-4 text-sm text-[#8c8888] text-center" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                No categories match &ldquo;{objectSearchQuery}&rdquo;
              </div>
            )}
          </div>
        )}
        </>
      )}
    </div>
  );
}
