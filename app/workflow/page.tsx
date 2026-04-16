"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  Fragment,
  Suspense,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  ChevronDown,
  Maximize2,
  Code,
  Database,
  Globe,
  Terminal,
  ClipboardList,
  X,
  GripVertical,
  Sparkles,
  ArrowUp,
  Pencil,
  Plus,
} from "lucide-react";
import { PolicyApprovalsIcon } from "@/components/policy-approvals-icon";
import { WorkflowMultiSplitIcon } from "@/components/workflow-multi-split-icon";
import { WorkflowTrueFalseIcon } from "@/components/workflow-true-false-icon";
import { TriggerIcon, AIIcon, SMSIcon, WidgetIcon, CloseIcon, TrashIcon } from "@/components/icons";
import {
  WORKFLOW_CANVAS_SVG_DASHED_EDGE,
  WorkflowStepConnector,
  WorkflowVerticalRailSegment,
} from "@/components/workflow-step-connector";
import {
  findCatalogItem,
  getDefaultCustomStepAlias,
  isCatalogItemBasicTier,
  SHOW_WORKFLOW_TIER_CHIPS,
  WORKFLOW_BASIC_CATALOG_IDS,
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
  WORKFLOW_BASIC_NEW_HIRE_BROWSE_PATH,
  type WorkflowBasicStartDateBrowsePath,
} from "@/lib/workflow-basic-trigger";
import { cn } from "@/lib/utils";
import {
  PrototypeGlobalNav,
  type PrototypeExperience,
} from "@/components/prototype-global-nav";
import { BranchingModeSelect } from "@/components/branching-mode-select";
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
const WORKFLOW_MULTI_SPLIT_ID = "flow-multisplit";

/** OLD prototype: expandable trigger filter footer (WFchat `WorkflowCanvasStepCard` pattern). */
const OLD_PROTOTYPE_TRIGGER_FILTER_CAP_LABEL = "Some filters applied";
const OLD_PROTOTYPE_TRIGGER_FILTER_SCRIPT =
  "Match all of the following:\nDepartment is Engineering";

/** Steps on the main canvas after the trigger, or on a multi-split branch column. */
export type WorkflowBranchLineStep =
  | { id: string; role: "requestApproval"; detail: string }
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

/** One multi-split branch: path label + vertical step stack. */
export type WorkflowBranch = {
  id: string;
  conditionLabel: string;
  /** Uppercase chip on the branch line (Figma: DESIGN, ENGINEERS, ALL OTHERS). */
  pathLabel: string;
  /** Catch-all branch — typically labeled “Other”. */
  isOther: boolean;
  steps: WorkflowBranchLineStep[];
  /** Additive true/false: steps when the condition is false (optional; defaults to empty). */
  falseSteps?: WorkflowBranchLineStep[];
};

type WorkflowFlowStep =
  | { id: string; role: "trigger" }
  | {
      id: string;
      role: "multiSplit";
      branches: WorkflowBranch[];
      /** Secondary line under Multi-split branch title */
      splitLabel?: string;
      /**
       * Exclusive: first matching branch wins (if/else). Additive: every branch whose condition
       * matches runs; shown as a vertical rules list on the canvas.
       */
      branchingMode?: "exclusive" | "additive";
    }
  | WorkflowBranchLineStep;

const DEFAULT_MULTISPLIT_BRANCHES: WorkflowBranch[] = [
  {
    id: "branch-eng",
    pathLabel: "Engineers",
    conditionLabel: "Department is Engineering",
    isOther: false,
    steps: [
      {
        id: "branch-eng-ra",
        role: "requestApproval",
        detail: "Employee > Manager",
      },
    ],
  },
  {
    id: "branch-sales",
    pathLabel: "Managers",
    conditionLabel: "All managers",
    isOther: false,
    steps: [
      {
        id: "branch-sales-ra",
        role: "requestApproval",
        detail: "John Shin",
      },
    ],
  },
  {
    id: "branch-other",
    pathLabel: "SF Office",
    conditionLabel: "San Francisco Office",
    isOther: true,
    steps: [
      {
        id: "branch-other-ra",
        role: "requestApproval",
        detail: "Employee > Office manager",
      },
    ],
  },
];

/** Full multi-split canvas (NEW experience). Branching mode from `?branching=additive` (default exclusive). */
function createWorkflowNewSteps(branchingMode: "exclusive" | "additive"): WorkflowFlowStep[] {
  return [
    { id: WORKFLOW_TRIGGER_ID, role: "trigger" },
    {
      id: WORKFLOW_MULTI_SPLIT_ID,
      role: "multiSplit",
      splitLabel: "Route to the correct policy",
      branchingMode,
      branches: DEFAULT_MULTISPLIT_BRANCHES,
    },
  ];
}

/** OLD toggle: trigger → one request-approval card (first branch only; no multi-split node). */
const WORKFLOW_OLD_PROTOTYPE_STEPS: WorkflowFlowStep[] = [
  { id: WORKFLOW_TRIGGER_ID, role: "trigger" },
  {
    id: "branch-eng-ra",
    role: "requestApproval",
    detail: "Employee > Manager",
  },
];

type CanvasSelection =
  | { kind: "linear"; step: WorkflowFlowStep }
  | { kind: "multiSplit"; step: Extract<WorkflowFlowStep, { role: "multiSplit" }> }
  | {
      kind: "branchStep";
      branch: WorkflowBranch;
      parentSplitId: string;
      step: WorkflowBranchLineStep;
      /** Which arm of an additive true/false rule (default: main branch line). */
      branchPath?: "true" | "false";
    };

type CatalogInsertTarget =
  | { kind: "main"; insertIndex: number }
  | { kind: "branch"; splitId: string; branchId: string; insertIndex: number }
  | { kind: "branchFalse"; splitId: string; branchId: string; insertIndex: number };

/** Same as multi-split `grid` + `gap-x-[48px]`: horizontal center of each 280px track in width `w`. */
const WORKFLOW_MULTISPLIT_GRID_GAP_PX = 48;
/** Matches `workflowCanvasNodeClass` card width (`w-[280px]`). */
const WORKFLOW_MULTISPLIT_BRANCH_TRACK_PX = 280;

function multisplitDecisionTreeWidthPx(branchCount: number): number {
  if (branchCount <= 1) return WORKFLOW_MULTISPLIT_BRANCH_TRACK_PX;
  return (
    branchCount * WORKFLOW_MULTISPLIT_BRANCH_TRACK_PX +
    (branchCount - 1) * WORKFLOW_MULTISPLIT_GRID_GAP_PX
  );
}

function decisionTreeBranchXs(
  branchCount: number,
  w: number,
  gapPx = WORKFLOW_MULTISPLIT_GRID_GAP_PX
): number[] {
  if (branchCount <= 1) return [w / 2];
  const cell = (w - (branchCount - 1) * gapPx) / branchCount;
  return Array.from(
    { length: branchCount },
    (_, i) => cell / 2 + i * (cell + gapPx)
  );
}

/** Trunk splits into N paths — dashed edges + arrowheads (stroke matches {@link WORKFLOW_CANVAS_SVG_DASHED_EDGE}). */
function DecisionTreeForkSvg({ branchCount }: { branchCount: number }) {
  const w = multisplitDecisionTreeWidthPx(branchCount);
  const h = 44;
  const cx = w / 2;
  const barY = 12;
  const xs = decisionTreeBranchXs(branchCount, w, WORKFLOW_MULTISPLIT_GRID_GAP_PX);
  const { strokeWidth: stroke, strokeDasharray: dash } = WORKFLOW_CANVAS_SVG_DASHED_EDGE;
  const arrow = (x: number, tipY: number) => (
    <polygon
      key={`a-${x}-${tipY}`}
      points={`${x - 3.5},${tipY - 5.5} ${x + 3.5},${tipY - 5.5} ${x},${tipY}`}
      fill="currentColor"
    />
  );
  if (branchCount <= 1) {
    return (
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full shrink-0 text-[#8c8888]"
        aria-hidden
      >
        <path
          d={`M ${cx} 0 L ${cx} ${h - 6}`}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={dash}
        />
        {arrow(cx, h)}
      </svg>
    );
  }
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="w-full shrink-0 text-[#8c8888]"
      aria-hidden
    >
      <path
        d={`M ${cx} 0 L ${cx} ${barY}`}
        stroke="currentColor"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="butt"
        strokeDasharray={dash}
      />
      <path
        d={`M ${xs[0]} ${barY} L ${xs[xs.length - 1]} ${barY}`}
        stroke="currentColor"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="butt"
        strokeDasharray={dash}
      />
      {xs.map((x) => (
        <path
          key={`d-${x}`}
          d={`M ${x} ${barY} L ${x} ${h - 6}`}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={dash}
        />
      ))}
      {xs.map((x) => arrow(x, h))}
    </svg>
  );
}

/** Paths rejoin to one trunk before “Add step”. */
function DecisionTreeMergeSvg({ branchCount }: { branchCount: number }) {
  const w = multisplitDecisionTreeWidthPx(branchCount);
  const h = 48;
  const cx = w / 2;
  const joinY = 30;
  const xs = decisionTreeBranchXs(branchCount, w, WORKFLOW_MULTISPLIT_GRID_GAP_PX);
  const { strokeWidth: stroke, strokeDasharray: dash } = WORKFLOW_CANVAS_SVG_DASHED_EDGE;
  if (branchCount <= 1) {
    return (
      <svg
        width="100%"
        height={32}
        viewBox={`0 0 ${w} 32`}
        className="w-full shrink-0 text-[#8c8888]"
        aria-hidden
      >
        <path
          d={`M ${cx} 0 L ${cx} 26`}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={dash}
        />
        <polygon
          points={`${cx - 3.5},${32 - 5.5} ${cx + 3.5},${32 - 5.5} ${cx},32`}
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="w-full shrink-0 text-[#8c8888]"
      aria-hidden
    >
      {xs.map((x) => (
        <path
          key={`u-${x}`}
          d={`M ${x} 0 L ${x} 8 L ${cx} ${joinY}`}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeDasharray={dash}
        />
      ))}
      <path
        d={`M ${cx} ${joinY} L ${cx} ${h - 6}`}
        stroke="currentColor"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="butt"
        strokeDasharray={dash}
      />
      <polygon
        points={`${cx - 3.5},${h - 5.5} ${cx + 3.5},${h - 5.5} ${cx},${h}`}
        fill="currentColor"
      />
    </svg>
  );
}

/** Inner body for a step card on a multi-split branch (matches main-line middle steps). */
function BranchLineStepCanvasInner({
  step,
  selectedCanvasStepId,
  catalogStepTierLabelsActive,
}: {
  step: WorkflowBranchLineStep;
  selectedCanvasStepId: string | null;
  catalogStepTierLabelsActive: boolean;
}) {
  const dim = selectedCanvasStepId !== null && selectedCanvasStepId !== step.id;
  switch (step.role) {
    case "aiPrompt":
      return (
        <>
          <AIIcon
            className={cn("size-6 shrink-0", dim && "opacity-40")}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 600 }}
              >
                AI agent
              </p>
              {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
                <span
                  className={cn("pointer-events-none shrink-0", WORKFLOW_TIER_CHIP_CLASS_ADVANCED)}
                  style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                >
                  Advanced
                </span>
              ) : null}
            </div>
            <p
              className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
            >
              {step.title}
            </p>
          </div>
        </>
      );
    case "widget":
      return (
        <>
          <WidgetIcon
            className={cn(
              "size-6 shrink-0",
              dim ? "text-[#8c8888]" : "text-black"
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 600 }}
              >
                Update widget
              </p>
              {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
                <span
                  className={cn("pointer-events-none shrink-0", WORKFLOW_TIER_CHIP_CLASS_ADVANCED)}
                  style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                >
                  Advanced
                </span>
              ) : null}
            </div>
            <p
              className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
            >
              {step.title}
            </p>
          </div>
        </>
      );
    case "runFunction":
      return (
        <>
          <Terminal
            className={cn("size-6 shrink-0", dim ? "text-[#8c8888]" : "text-[#252528]")}
            strokeWidth={2}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 600 }}
              >
                {step.runLabel}
              </p>
              {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
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
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
            >
              {step.functionTitle}
            </p>
          </div>
        </>
      );
    case "requestApproval":
      return (
        <>
          <PolicyApprovalsIcon
            className={cn("size-6 shrink-0", dim ? "text-[#8c8888]" : "text-[#252528]")}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate text-[14px] leading-[18px] text-[#252528]"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 600 }}
              >
                All must approve
              </p>
              {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
                <span className={`${WORKFLOW_TIER_CHIP_CLASS_BASIC} shrink-0`} style={WORKFLOW_TIER_CHIP_FONT_STYLE}>
                  Basic
                </span>
              ) : null}
            </div>
            <p
              className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
            >
              {step.detail}
            </p>
          </div>
        </>
      );
    case "custom": {
      const cat = findCatalogItem(step.catalogItemId);
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
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 600 }}
              >
                {cat?.label ?? step.title}
              </p>
              {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
                <span
                  className={cn(
                    "pointer-events-none shrink-0",
                    catalogBasic ? WORKFLOW_TIER_CHIP_CLASS_BASIC : WORKFLOW_TIER_CHIP_CLASS_ADVANCED
                  )}
                  style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                >
                  {catalogBasic ? "Basic" : "Advanced"}
                </span>
              ) : null}
            </div>
            <p
              className="mt-0.5 line-clamp-2 break-words text-[14px] leading-[20px] text-[#252528]"
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
            >
              {step.title}
            </p>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}

/** Rail + add-step connectors + branch line steps (shared by exclusive columns and additive rule stacks). */
function MultisplitBranchStepsPipeline({
  splitStep,
  branch,
  branchSide = "true",
  stretchEmptyColumn = false,
  selectedCanvasStepId,
  catalogStepTierLabelsActive,
  catalogDragActive,
  onCatalogDragStateEnd,
  onInsertCatalogStep,
  onSelectBranchStepId,
}: {
  splitStep: Extract<WorkflowFlowStep, { role: "multiSplit" }>;
  branch: WorkflowBranch;
  /** `"true"` uses `branch.steps`; `"false"` uses `branch.falseSteps` (additive). */
  branchSide?: "true" | "false";
  /**
   * When the branch line has no steps yet, let the first drop zone grow so the column matches a
   * taller sibling (additive true/false grid).
   */
  stretchEmptyColumn?: boolean;
  selectedCanvasStepId: string | null;
  catalogStepTierLabelsActive: boolean;
  catalogDragActive: boolean;
  onCatalogDragStateEnd: () => void;
  onInsertCatalogStep: (item: CatalogItemWithCategory, target: CatalogInsertTarget) => void;
  onSelectBranchStepId: (id: string) => void;
}) {
  const lineSteps = branchSide === "true" ? branch.steps : (branch.falseSteps ?? []);
  const insertKind: "branch" | "branchFalse" = branchSide === "true" ? "branch" : "branchFalse";
  const insertTarget = (insertIndex: number): CatalogInsertTarget =>
    insertKind === "branch"
      ? { kind: "branch", splitId: splitStep.id, branchId: branch.id, insertIndex }
      : { kind: "branchFalse", splitId: splitStep.id, branchId: branch.id, insertIndex };
  const stretchFirstConnector = stretchEmptyColumn && lineSteps.length === 0;

  return (
    <div
      className={cn(
        "flex w-full flex-col items-stretch",
        stretchFirstConnector && "min-h-0 flex-1"
      )}
    >
      <WorkflowVerticalRailSegment
        className={stretchFirstConnector ? "shrink-0" : undefined}
        layout="fillColumn"
      />
      <WorkflowStepConnector
        layout="fillColumn"
        fillColumnStretch={stretchFirstConnector}
        insertIndex={0}
        onInsertStep={(item, insertIndex) => onInsertCatalogStep(item, insertTarget(insertIndex))}
        catalogDragActive={catalogDragActive}
        onCatalogDragStateEnd={onCatalogDragStateEnd}
      />
      {lineSteps.map((bs, si) => (
        <Fragment key={bs.id}>
          <div
            className={cn(
              workflowCanvasNodeClass(
                selectedCanvasStepId === bs.id,
                selectedCanvasStepId !== null
              ),
              "shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBranchStepId(bs.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onSelectBranchStepId(bs.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="box-border flex w-full flex-row items-start gap-3 p-3">
              <BranchLineStepCanvasInner
                step={bs}
                selectedCanvasStepId={selectedCanvasStepId}
                catalogStepTierLabelsActive={catalogStepTierLabelsActive}
              />
            </div>
          </div>
          <WorkflowStepConnector
            layout="fillColumn"
            insertIndex={si + 1}
            onInsertStep={(item, insertIndex) => onInsertCatalogStep(item, insertTarget(insertIndex))}
            catalogDragActive={catalogDragActive}
            onCatalogDragStateEnd={onCatalogDragStateEnd}
          />
        </Fragment>
      ))}
    </div>
  );
}

/** Split condition label for chip (e.g. “Department” + “ is Engineering”) — matches Workflows 2.0 chip pattern. */
function MultisplitConditionChipText({ conditionLabel }: { conditionLabel: string }) {
  const m = /\s+is\s+/i.exec(conditionLabel);
  if (!m || m.index === undefined) {
    return (
      <span className="text-[15px] leading-[19px] text-[#252528]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}>
        {conditionLabel}
      </span>
    );
  }
  const head = conditionLabel.slice(0, m.index);
  const tail = conditionLabel.slice(m.index);
  return (
    <>
      <span className="text-[15px] leading-[19px] text-[#252528]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
        {head}
      </span>
      <span className="text-[15px] leading-[19px] text-[#252528]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}>
        {tail}
      </span>
    </>
  );
}

/** All catalog-backed / middle steps for default alias counting (main line + every branch). */
function getAllStepLikesForAlias(steps: WorkflowFlowStep[]) {
  const out: { role: string; catalogItemId?: string }[] = [];
  for (const s of steps) {
    if (s.role === "trigger") continue;
    if (s.role === "multiSplit") {
      for (const b of s.branches) {
        for (const st of b.steps) {
          out.push(st);
        }
        for (const st of b.falseSteps ?? []) {
          out.push(st);
        }
      }
    } else {
      out.push(s);
    }
  }
  return out;
}

function resolveCanvasSelection(
  steps: WorkflowFlowStep[],
  selectedId: string | null
): CanvasSelection | null {
  if (!selectedId) return null;
  const top = steps.find((s) => s.id === selectedId);
  if (top) {
    if (top.role === "multiSplit") return { kind: "multiSplit", step: top };
    return { kind: "linear", step: top };
  }
  for (const s of steps) {
    if (s.role === "multiSplit") {
      for (const b of s.branches) {
        const st = b.steps.find((x) => x.id === selectedId);
        if (st) {
          return {
            kind: "branchStep",
            branch: b,
            parentSplitId: s.id,
            step: st,
            branchPath: "true",
          };
        }
        const fst = (b.falseSteps ?? []).find((x) => x.id === selectedId);
        if (fst) {
          return {
            kind: "branchStep",
            branch: b,
            parentSplitId: s.id,
            step: fst,
            branchPath: "false",
          };
        }
      }
    }
  }
  return null;
}

function getWorkflowTier(
  steps: WorkflowFlowStep[],
  triggerOptionId: string | null
): "Basic" | "Advanced" {
  if (triggerOptionId !== null && !isWorkflowBasicTriggerOption(triggerOptionId)) {
    return "Advanced";
  }
  for (const step of steps) {
    if (step.role === "trigger") continue;
    if (step.role === "multiSplit") {
      for (const b of step.branches) {
        for (const st of b.steps) {
          if (st.role === "requestApproval") continue;
          if (st.role === "aiPrompt" || st.role === "widget") return "Advanced";
          if (st.role === "runFunction" && st.functionTier === "advanced") return "Advanced";
          if (
            st.role === "custom" &&
            !WORKFLOW_BASIC_CATALOG_IDS.has(st.catalogItemId)
          ) {
            return "Advanced";
          }
        }
        for (const st of b.falseSteps ?? []) {
          if (st.role === "requestApproval") continue;
          if (st.role === "aiPrompt" || st.role === "widget") return "Advanced";
          if (st.role === "runFunction" && st.functionTier === "advanced") return "Advanced";
          if (
            st.role === "custom" &&
            !WORKFLOW_BASIC_CATALOG_IDS.has(st.catalogItemId)
          ) {
            return "Advanced";
          }
        }
      }
      continue;
    }
    if (step.role === "requestApproval") continue;
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
  if (step.role === "multiSplit") return false;
  if (step.role === "aiPrompt" || step.role === "widget") return true;
  if (step.role === "runFunction") return step.functionTier === "advanced";
  if (step.role === "custom") return !WORKFLOW_BASIC_CATALOG_IDS.has(step.catalogItemId);
  return false;
}

function WorkflowCanvas() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prototypeExperience: PrototypeExperience =
    searchParams.get("experience") === "new" ? "new" : "old";
  const branchingFromUrl: "exclusive" | "additive" =
    searchParams.get("branching") === "additive" ? "additive" : "exclusive";

  const [workflowFlowSteps, setWorkflowFlowSteps] = useState<WorkflowFlowStep[]>(() =>
    searchParams.get("experience") === "new"
      ? createWorkflowNewSteps(searchParams.get("branching") === "additive" ? "additive" : "exclusive")
      : WORKFLOW_OLD_PROTOTYPE_STEPS
  );
  const [selectedCanvasStepId, setSelectedCanvasStepId] = useState<string | null>(null);

  useEffect(() => {
    setWorkflowFlowSteps(
      prototypeExperience === "new"
        ? createWorkflowNewSteps(branchingFromUrl)
        : WORKFLOW_OLD_PROTOTYPE_STEPS
    );
    setSelectedCanvasStepId(null);
  }, [prototypeExperience, branchingFromUrl]);

  const [oldPrototypeTriggerFiltersExpanded, setOldPrototypeTriggerFiltersExpanded] = useState(false);
  useEffect(() => {
    if (prototypeExperience !== "old") {
      setOldPrototypeTriggerFiltersExpanded(false);
    }
  }, [prototypeExperience]);

  const handlePrototypeExperienceChange = useCallback(
    (next: PrototypeExperience) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "old") {
        params.delete("experience");
      } else {
        params.set("experience", "new");
      }
      const q = params.toString();
      router.push(q ? `/workflow?${q}` : "/workflow", { scroll: false });
    },
    [router, searchParams]
  );

  const handleBranchingModeChange = useCallback(
    (next: "exclusive" | "additive") => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "additive") {
        params.set("branching", "additive");
      } else {
        params.delete("branching");
      }
      const q = params.toString();
      router.push(q ? `/workflow?${q}` : "/workflow", { scroll: false });
    },
    [router, searchParams]
  );

  const [workflowTitle, setWorkflowTitle] = useState("Policy details");
  const [workflowTitleEditing, setWorkflowTitleEditing] = useState(false);
  const [workflowTitleDraft, setWorkflowTitleDraft] = useState(workflowTitle);
  const workflowTitleInputRef = useRef<HTMLInputElement>(null);
  /** Canvas + trigger drawer — updated when AI chat builds a workflow from a prompt. */
  const [workflowTriggerLabel, setWorkflowTriggerLabel] = useState("Employment change is submitted");
  /** From trigger modal / AI; Basic-eligible ids include `new-hire-status`, `start-date`, etc. */
  const [workflowTriggerOptionId, setWorkflowTriggerOptionId] = useState<string | null>(
    "new-hire-status"
  );

  const workflowTier = useMemo(
    () => getWorkflowTier(workflowFlowSteps, workflowTriggerOptionId),
    [workflowFlowSteps, workflowTriggerOptionId]
  );

  /** Basic vs Advanced on catalog rows when the trigger is Basic-eligible (e.g. new hire, start date). */
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
  const [workflowAssistantOpen, setWorkflowAssistantOpen] = useState(false);
  /** Multi-split details drawer: Basic vs RQL condition editor (UI parity with Workflows 2.0). */
  const [multiSplitDrawerPathTab, setMultiSplitDrawerPathTab] = useState<"basic" | "rql">("basic");
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

  const canvasSelection = useMemo(
    () => resolveCanvasSelection(workflowFlowSteps, selectedCanvasStepId),
    [workflowFlowSteps, selectedCanvasStepId]
  );
  const selectedFlowStep =
    canvasSelection?.kind === "linear" ? canvasSelection.step : null;
  const selectedNode: SelectedNode =
    selectedFlowStep?.role === "trigger"
      ? "trigger"
      : selectedFlowStep?.role === "aiPrompt"
        ? "aiPrompt"
        : selectedFlowStep?.role === "widget"
          ? "widget"
          : null;

  function handleInsertCatalogStep(item: CatalogItemWithCategory, target: CatalogInsertTarget) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setWorkflowFlowSteps((prev) => {
      const tr = prev[0];
      if (!tr || tr.role !== "trigger") return prev;
      const existingForAlias = getAllStepLikesForAlias(prev);
      const title = getDefaultCustomStepAlias(item.id, existingForAlias);
      const newStep: WorkflowBranchLineStep = {
        id,
        role: "custom",
        catalogItemId: item.id,
        title,
        categoryLabel: item.category,
      };

      if (target.kind === "main") {
        const mid = prev.slice(1);
        const next = [...mid];
        const idx = Math.min(Math.max(0, target.insertIndex), next.length);
        next.splice(idx, 0, newStep);
        return [tr, ...next];
      }

      return prev.map((s) => {
        if (s.id !== target.splitId || s.role !== "multiSplit") return s;
        return {
          ...s,
          branches: s.branches.map((b) => {
            if (b.id !== target.branchId) return b;
            if (target.kind === "branch") {
              const brSteps = [...b.steps];
              const idx = Math.min(Math.max(0, target.insertIndex), brSteps.length);
              brSteps.splice(idx, 0, newStep);
              return { ...b, steps: brSteps };
            }
            const falseSteps = [...(b.falseSteps ?? [])];
            const idx = Math.min(Math.max(0, target.insertIndex), falseSteps.length);
            falseSteps.splice(idx, 0, newStep);
            return { ...b, falseSteps };
          }),
        };
      });
    });
  }

  function handleRemoveSelectedStep() {
    const id = selectedCanvasStepId;
    if (!id || id === WORKFLOW_TRIGGER_ID) return;
    const sel = resolveCanvasSelection(workflowFlowSteps, id);
    if (sel?.kind === "branchStep") {
      const path = sel.branchPath ?? "true";
      setWorkflowFlowSteps((prev) =>
        prev.map((s) => {
          if (s.id !== sel.parentSplitId || s.role !== "multiSplit") return s;
          return {
            ...s,
            branches: s.branches.flatMap((b) => {
              if (b.id !== sel.branch.id) return [b];
              if (path === "false") {
                const nextFalse = (b.falseSteps ?? []).filter((st) => st.id !== sel.step.id);
                return [{ ...b, falseSteps: nextFalse }];
              }
              const nextSteps = b.steps.filter((st) => st.id !== sel.step.id);
              if (nextSteps.length === 0 && s.branches.length > 2) {
                return [];
              }
              return [{ ...b, steps: nextSteps }];
            }),
          };
        })
      );
      setSelectedCanvasStepId(null);
      return;
    }
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
      {/* Header — shared with policy landing (`PrototypeGlobalNav`) */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <PrototypeGlobalNav
          experience={prototypeExperience}
          onExperienceChange={handlePrototypeExperienceChange}
        />
      </div>

      {/* Main Content - Workflows (nav + workspace share the left column; assistant aligns to the right of both) */}
      {currentPage === "Workflows" && (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f9f7f6] pt-11">
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
                  {SHOW_WORKFLOW_TIER_CHIPS ? (
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
                                <span className="font-medium text-[#252528]">New hire request</span> or{" "}
                                <span className="font-medium text-[#252528]">Start date</span> (Popular ›
                                Onboarding, or Relative to a date for Start date). Then a workflow stays{" "}
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
                                        ...WORKFLOW_BASIC_NEW_HIRE_BROWSE_PATH,
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
                  ) : null}
                </div>
              </div>
            </div>
            {prototypeExperience === "new" ? (
              <BranchingModeSelect
                className="w-[min(280px,28vw)] shrink-0"
                value={branchingFromUrl}
                onChange={handleBranchingModeChange}
                popoverAlign="end"
              />
            ) : null}
          </div>

        <div className="flex min-h-0 flex-1 min-w-0">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Step Details Drawer — slides over the canvas from the left */}
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
                        {SHOW_WORKFLOW_TIER_CHIPS && isWorkflowBasicTriggerOption(workflowTriggerOptionId) ? (
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

                  {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
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

            {canvasSelection?.kind === "multiSplit" && (
              <div className="flex min-h-0 flex-col">
                <div className="flex-1 space-y-4 px-6 pb-4 pt-6">
                  <div className="flex items-start gap-2">
                    <h2
                      className="min-w-0 flex-1 text-[20px] font-medium leading-7 text-black"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                    >
                      Multi-split branch
                    </h2>
                    <div className="flex shrink-0 items-center gap-8">
                      <span
                        className="text-right text-[13px] leading-4 tracking-[0.25px] text-black"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
                      >
                        ID: {canvasSelection.step.id.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        className="rounded p-0 text-black hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/40"
                        aria-label="Close panel"
                        onClick={() => setSelectedCanvasStepId(null)}
                      >
                        <CloseIcon className="size-6" />
                      </button>
                    </div>
                  </div>
                  <p
                    className="text-[17px] leading-6 tracking-[0.5px] text-black"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
                  >
                    {(canvasSelection.step.branchingMode ?? "exclusive") === "exclusive" ? (
                      <>
                        Create a different condition for each path. This rule will check these
                        condition from left to right and will follow the first path that&apos;s true.
                      </>
                    ) : (
                      <>
                        Create a different condition for each path. In additive mode, every path whose
                        condition matches runs before the workflow continues.
                      </>
                    )}
                  </p>
                  <p
                    className="text-[13px] leading-snug text-[#8c8888]"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                  >
                    Use the workflow header to switch between Exclusive and Additive branching.
                  </p>
                  <div className="bg-[#e0dede] h-px w-full" />
                  <div>
                    <label
                      className="mb-2 block text-[15px] leading-[22px] text-black"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                      htmlFor="multisplit-step-name"
                    >
                      Step name<span className="text-[#bb3d2a]">*</span>
                    </label>
                    <Input
                      id="multisplit-step-name"
                      defaultValue={canvasSelection.step.splitLabel ?? "Route to the correct policy"}
                      className="w-full border-[#CCCCCC]"
                      readOnly
                      aria-readonly
                    />
                  </div>
                  <div className="flex flex-col gap-4">
                    {canvasSelection.step.branches.map((b) => (
                      <div
                        key={b.id}
                        className={cn(
                          "rounded-2xl border border-black/10 bg-white pb-6 pl-2 pr-[18px] pt-3",
                          b.isOther && "border-[#d4c4f0]/80 bg-[#faf7fc]"
                        )}
                      >
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="mt-1 shrink-0 cursor-grab rounded p-0.5 text-[#a8a4a4] hover:bg-black/[0.04]"
                            aria-label="Reorder path"
                          >
                            <GripVertical className="size-6" strokeWidth={2} aria-hidden />
                          </button>
                          <div className="min-w-0 flex-1 space-y-6">
                            <div className="flex gap-3">
                              <Input
                                defaultValue={b.pathLabel}
                                className="min-w-0 flex-1 border-[#CCCCCC]"
                                readOnly
                                aria-label="Path name"
                              />
                              <button
                                type="button"
                                className="mt-1 shrink-0 rounded p-1 text-[#595555] hover:bg-black/[0.04]"
                                aria-label="Delete path"
                              >
                                <TrashIcon className="size-6" />
                              </button>
                            </div>
                            <div className="space-y-1">
                              <p
                                className="text-[15px] leading-[22px] tracking-[0.25px] text-[#595555]"
                                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                              >
                                Only send down this path if the following is true...
                              </p>
                              <div className="flex h-10 gap-6 border-b border-[#e0dede]">
                                <button
                                  type="button"
                                  className={cn(
                                    "flex flex-col items-center gap-2.5 pb-0 text-[15px] leading-[22px] tracking-[0.25px]",
                                    multiSplitDrawerPathTab === "basic"
                                      ? "font-medium text-[#7A005D]"
                                      : "pt-1.5 font-normal text-[#7A005D] tracking-[0.5px]"
                                  )}
                                  style={{ fontFamily: "'Basel Grotesk', sans-serif" }}
                                  onClick={() => setMultiSplitDrawerPathTab("basic")}
                                >
                                  Basic
                                  {multiSplitDrawerPathTab === "basic" ? (
                                    <span className="h-0.5 w-full bg-[#7A005D]" aria-hidden />
                                  ) : null}
                                </button>
                                <button
                                  type="button"
                                  className={cn(
                                    "flex flex-col items-center gap-2.5 pb-0 text-[15px] leading-[22px]",
                                    multiSplitDrawerPathTab === "rql"
                                      ? "font-medium tracking-[0.25px] text-[#7A005D]"
                                      : "pt-1.5 font-normal tracking-[0.5px] text-[#7A005D]"
                                  )}
                                  style={{ fontFamily: "'Basel Grotesk', sans-serif" }}
                                  onClick={() => setMultiSplitDrawerPathTab("rql")}
                                >
                                  RQL
                                  {multiSplitDrawerPathTab === "rql" ? (
                                    <span className="h-0.5 w-full bg-[#7A005D]" aria-hidden />
                                  ) : null}
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-[18px]">
                              <div className="flex flex-wrap items-center gap-1 text-[15px] leading-[22px] tracking-[0.5px] text-black">
                                <span style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}>
                                  Match{" "}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 font-medium text-[#7A005D]"
                                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                                >
                                  all of the following filters
                                  <ChevronDown className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
                                </button>
                              </div>
                              <div className="flex h-7 w-full items-center overflow-hidden rounded-md border border-black/10 bg-[#fafafa] p-px">
                                <div className="flex min-w-0 flex-1 items-center gap-1 px-2">
                                  <MultisplitConditionChipText conditionLabel={b.conditionLabel} />
                                </div>
                                <div
                                  className="flex h-full shrink-0 items-center border-l border-black/10 px-1"
                                  aria-hidden
                                >
                                  <X className="size-5 text-[#595555] opacity-40" strokeWidth={2} />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-sm text-[15px] font-medium leading-[22px] tracking-[0.25px] text-[#7A005D]"
                                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                              >
                                <Plus className="size-6 shrink-0" strokeWidth={2} aria-hidden />
                                Add a filter
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full border-[#d3d3d3] bg-white text-[15px] text-[#252528] hover:bg-[#fafafa]"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                  >
                    Add a path
                  </Button>
                </div>
                <div className="sticky bottom-0 z-[1] flex flex-wrap items-center justify-between gap-3 border-t border-[#e0dede] bg-white px-6 py-3 shadow-[inset_0_1px_0_0_#e0dede]">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="h-10 bg-[#bb3d2a] px-4 text-[15px] text-white hover:bg-[#bb3d2a]/90"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                      onClick={() => handleRemoveSelectedStep()}
                    >
                      Remove
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 border-[#d3d3d3] px-4 text-[15px] text-[#252528]"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                    >
                      Duplicate
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 border-[#d3d3d3] px-4 text-[15px] text-[#252528]"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                      onClick={() => setSelectedCanvasStepId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="h-10 bg-[#512f3e] px-4 text-[15px] text-white hover:bg-[#512f3e]/90"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                      onClick={() => setSelectedCanvasStepId(null)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {((canvasSelection?.kind === "linear" &&
              canvasSelection.step.role === "requestApproval") ||
              (canvasSelection?.kind === "branchStep" &&
                canvasSelection.step.role === "requestApproval")) ? (
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
                      All must approve
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
                    Action
                  </p>
                  {canvasSelection?.kind === "branchStep" ? (
                    <p
                      className="mb-3 rounded-md border border-[#e0dede] bg-[#f9f7f6] px-3 py-2 text-[14px] text-[#252528]"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#8c8888]">
                        {canvasSelection.branch.pathLabel}
                        {canvasSelection.branchPath === "false" ? (
                          <span className="ml-2 rounded border border-[#e8e0e0] bg-white px-1.5 py-0.5 text-[9px] text-[#595555]">
                            False path
                          </span>
                        ) : null}
                      </span>
                      <br />
                      <span className="text-[#8c8888]">When </span>
                      <span className="font-medium">{canvasSelection.branch.conditionLabel}</span>
                    </p>
                  ) : null}
                  <p
                    className="text-black"
                    style={{
                      fontFamily: "'Basel Grotesk', sans-serif",
                      fontWeight: 430,
                      fontSize: "15px",
                      lineHeight: "22px",
                    }}
                  >
                    Approvers for this branch receive a request and must approve or deny before this
                    path continues.
                  </p>
                </div>
                <div className="bg-[#e0dede] h-px mb-6" />
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-base leading-6 text-black mb-2"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                    >
                      Summary
                    </label>
                    <Input
                      defaultValue={
                        canvasSelection?.kind === "branchStep" &&
                        canvasSelection.step.role === "requestApproval"
                          ? canvasSelection.step.detail
                          : canvasSelection?.kind === "linear" &&
                              canvasSelection.step.role === "requestApproval"
                            ? canvasSelection.step.detail
                            : ""
                      }
                      className="w-full border-[#CCCCCC]"
                    />
                  </div>
                </div>
              </div>
            ) : null}

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
                {canvasSelection != null &&
                  !(
                    canvasSelection.kind === "linear" &&
                    canvasSelection.step.role === "trigger"
                  ) && (
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

        {/* Center Panel — full canvas scrolls horizontally + vertically (single scrollport on this column) */}
        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-auto pt-8 [-webkit-overflow-scrolling:touch]">
            <div className="mx-auto box-border flex w-max min-w-full flex-col items-center px-2 pb-24">
              <div className="mb-0 flex w-full flex-col items-center gap-0 pt-4 pb-0">
                <div
                  className={cn(
                    workflowCanvasNodeClass(
                      selectedCanvasStepId === WORKFLOW_TRIGGER_ID,
                      selectedCanvasStepId !== null
                    ),
                    prototypeExperience === "old" && "flex flex-col p-0"
                  )}
                >
                  {/* StepCardHeader — WFchat workflow-canvas */}
                  <div
                    className="box-border flex w-full flex-row items-start gap-3 p-3 cursor-pointer"
                    onClick={() => setSelectedCanvasStepId(WORKFLOW_TRIGGER_ID)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCanvasStepId(WORKFLOW_TRIGGER_ID);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Policy trigger: ${workflowTriggerLabel}. Select step.`}
                  >
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
                          Policy trigger
                        </p>
                        {SHOW_WORKFLOW_TIER_CHIPS && isWorkflowBasicTriggerOption(workflowTriggerOptionId) ? (
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
                  {prototypeExperience === "old" ? (
                    <>
                      <div className="h-px w-full shrink-0 bg-[#e0dede]" aria-hidden />
                      <button
                        type="button"
                        id="old-prototype-trigger-filters-cap"
                        className="flex w-full shrink-0 items-center justify-between gap-2 px-3 py-2 text-left outline-none transition-colors hover:bg-[#faf9f8] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5aa5e7]/40"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOldPrototypeTriggerFiltersExpanded((o) => !o);
                        }}
                        aria-expanded={oldPrototypeTriggerFiltersExpanded}
                        aria-controls="old-prototype-trigger-filters-panel"
                      >
                        <span
                          className="text-[13px] leading-[18px] text-[#595555]"
                          style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                        >
                          {OLD_PROTOTYPE_TRIGGER_FILTER_CAP_LABEL}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-[#8c8888] transition-transform duration-150",
                            oldPrototypeTriggerFiltersExpanded && "rotate-180"
                          )}
                          aria-hidden
                        />
                      </button>
                      {oldPrototypeTriggerFiltersExpanded ? (
                        <div
                          id="old-prototype-trigger-filters-panel"
                          role="region"
                          aria-labelledby="old-prototype-trigger-filters-cap"
                          className="border-t border-[#e0dede] bg-[#f9f7f6] px-3 py-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p
                            className="whitespace-pre-line text-[13px] leading-[20px] text-[#252528]"
                            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                          >
                            {OLD_PROTOTYPE_TRIGGER_FILTER_SCRIPT}
                          </p>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <WorkflowStepConnector
                  insertIndex={0}
                  onInsertStep={(item, insertIndex) =>
                    handleInsertCatalogStep(item, { kind: "main", insertIndex })
                  }
                  catalogDragActive={catalogDragActive}
                  onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                />
              </div>

            {workflowFlowSteps.slice(1).map((step, idx) => (
              <Fragment key={step.id}>
                {step.role === "multiSplit" ? (
                  <>
                      <div className="mx-auto flex w-max flex-col items-center">
                      {(step.branchingMode ?? "exclusive") !== "additive" ? (
                      <div
                        className={cn(
                          workflowCanvasNodeClass(
                            selectedCanvasStepId === step.id,
                            selectedCanvasStepId !== null
                          ),
                          "shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
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
                          <WorkflowMultiSplitIcon
                            className={cn(
                              "size-6 shrink-0",
                              selectedCanvasStepId !== null && selectedCanvasStepId !== step.id
                                ? "text-[#8c8888]"
                                : "text-[#252528]"
                            )}
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <p
                              className="min-w-0 text-[14px] font-semibold leading-[18px] text-[#252528]"
                              style={{ fontFamily: "'Basel Grotesk', sans-serif" }}
                            >
                              Multi-split branch
                            </p>
                            <p
                              className="mt-0.5 text-[14px] leading-[20px] text-[#252528]"
                              style={{
                                fontFamily: "'Basel Grotesk', sans-serif",
                                fontWeight: 400,
                              }}
                            >
                              {step.splitLabel ?? "Route to the correct policy"}
                            </p>
                          </div>
                        </div>
                      </div>
                      ) : null}
                      <WorkflowVerticalRailSegment className="mt-1" />
                      <div className="flex w-max min-w-0 flex-col items-stretch">
                      {(step.branchingMode ?? "exclusive") === "additive" ? (
                        <div className="flex w-max max-w-[min(100%,calc(100vw-2rem))] flex-col items-center gap-0 px-1">
                          {step.branches.map((branch) => {
                            const tfWidth = multisplitDecisionTreeWidthPx(2);
                            return (
                              <div
                                key={branch.id}
                                className="flex w-max flex-col items-center"
                                style={{ width: tfWidth }}
                              >
                                <div
                                  className={cn(
                                    workflowCanvasNodeClass(
                                      false,
                                      selectedCanvasStepId !== null
                                    ),
                                    "mx-auto cursor-default shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                                  )}
                                >
                                  <div className="box-border flex w-full flex-row items-start gap-3 p-3">
                                    <WorkflowTrueFalseIcon
                                      className={cn(
                                        "size-6 shrink-0",
                                        selectedCanvasStepId !== null
                                          ? "text-[#8c8888]"
                                          : "text-[#252528]"
                                      )}
                                    />
                                    <div className="flex min-w-0 flex-1 flex-col">
                                      <p
                                        className="min-w-0 text-[14px] font-semibold leading-[18px] text-[#252528]"
                                        style={{ fontFamily: "'Basel Grotesk', sans-serif" }}
                                      >
                                        True/false
                                      </p>
                                      <p
                                        className="mt-0.5 text-[14px] leading-[20px] text-[#252528]"
                                        style={{
                                          fontFamily: "'Basel Grotesk', sans-serif",
                                          fontWeight: 400,
                                        }}
                                      >
                                        {branch.conditionLabel}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <WorkflowVerticalRailSegment className="mt-1" />
                                <div className="w-full min-w-0">
                                  <DecisionTreeForkSvg branchCount={2} />
                                </div>
                                <div
                                  className="grid w-full items-stretch gap-x-[48px] gap-y-0 px-1"
                                  style={{
                                    gridTemplateColumns: `repeat(2, ${WORKFLOW_MULTISPLIT_BRANCH_TRACK_PX}px)`,
                                  }}
                                >
                                  <div className="flex min-w-0 w-full flex-col items-center self-start">
                                    <span
                                      className="rounded border border-[#cfe8d5] bg-[#f3faf5] px-2.5 py-1 text-center text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-[#2d6a45]"
                                      style={{
                                        fontFamily: "'Basel Grotesk', sans-serif",
                                        fontWeight: 535,
                                      }}
                                    >
                                      True
                                    </span>
                                    <MultisplitBranchStepsPipeline
                                      splitStep={step}
                                      branch={branch}
                                      selectedCanvasStepId={selectedCanvasStepId}
                                      catalogStepTierLabelsActive={catalogStepTierLabelsActive}
                                      catalogDragActive={catalogDragActive}
                                      onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                                      onInsertCatalogStep={handleInsertCatalogStep}
                                      onSelectBranchStepId={setSelectedCanvasStepId}
                                    />
                                  </div>
                                  <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch self-stretch">
                                    <span
                                      className="mx-auto shrink-0 rounded border border-[#e8e0e0] bg-[#faf8f8] px-2.5 py-1 text-center text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-[#8c8888]"
                                      style={{
                                        fontFamily: "'Basel Grotesk', sans-serif",
                                        fontWeight: 535,
                                      }}
                                    >
                                      False
                                    </span>
                                    <MultisplitBranchStepsPipeline
                                      branchSide="false"
                                      stretchEmptyColumn={(branch.falseSteps ?? []).length === 0}
                                      splitStep={step}
                                      branch={branch}
                                      selectedCanvasStepId={selectedCanvasStepId}
                                      catalogStepTierLabelsActive={catalogStepTierLabelsActive}
                                      catalogDragActive={catalogDragActive}
                                      onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                                      onInsertCatalogStep={handleInsertCatalogStep}
                                      onSelectBranchStepId={setSelectedCanvasStepId}
                                    />
                                  </div>
                                  <div className="col-span-full mt-0 min-w-0 w-full">
                                    <DecisionTreeMergeSvg branchCount={2} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <WorkflowVerticalRailSegment className="mt-0" heightClass="h-5" />
                        </div>
                      ) : (
                      <div
                        className="grid w-full gap-x-[48px] gap-y-0 px-1"
                        style={{
                          gridTemplateColumns: `repeat(${step.branches.length}, ${WORKFLOW_MULTISPLIT_BRANCH_TRACK_PX}px)`,
                        }}
                      >
                        <div className="col-span-full min-w-0 w-full">
                          <DecisionTreeForkSvg branchCount={step.branches.length} />
                        </div>
                        {step.branches.map((branch) => (
                          <div
                            key={branch.id}
                            className="flex min-w-0 w-full flex-col items-center self-start"
                          >
                            <span
                              className="rounded border border-[#e0dede] bg-[#f5f3f0] px-2.5 py-1 text-center text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-[#8c8888]"
                              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                            >
                              {branch.pathLabel}
                            </span>
                            <MultisplitBranchStepsPipeline
                              splitStep={step}
                              branch={branch}
                              selectedCanvasStepId={selectedCanvasStepId}
                              catalogStepTierLabelsActive={catalogStepTierLabelsActive}
                              catalogDragActive={catalogDragActive}
                              onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                              onInsertCatalogStep={handleInsertCatalogStep}
                              onSelectBranchStepId={setSelectedCanvasStepId}
                            />
                          </div>
                        ))}
                        <div className="col-span-full mt-0 min-w-0 w-full">
                          <DecisionTreeMergeSvg branchCount={step.branches.length} />
                        </div>
                      </div>
                      )}
                      </div>
                      </div>
                    <WorkflowStepConnector
                      insertIndex={idx + 1}
                      onInsertStep={(item, insertIndex) =>
                        handleInsertCatalogStep(item, { kind: "main", insertIndex })
                      }
                      catalogDragActive={catalogDragActive}
                      onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                    />
                  </>
                ) : (
                  <>
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
                            {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
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
                            {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
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
                            {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
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
                    {step.role === "requestApproval" && (
                      <>
                        <PolicyApprovalsIcon
                          className={cn(
                            "size-6 shrink-0",
                            selectedCanvasStepId !== null && selectedCanvasStepId !== step.id
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
                              All must approve
                            </p>
                            {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
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
                            {step.detail}
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
                                {SHOW_WORKFLOW_TIER_CHIPS && catalogStepTierLabelsActive ? (
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
                      onInsertStep={(item, insertIndex) =>
                        handleInsertCatalogStep(item, { kind: "main", insertIndex })
                      }
                      catalogDragActive={catalogDragActive}
                      onCatalogDragStateEnd={() => setCatalogDragActive(false)}
                    />
                  </>
                )}
              </Fragment>
            ))}

            <p className="mt-2 text-sm text-[#8c8888]">Request approved</p>
            </div>
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

export default function WorkflowPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#f9f7f6] text-sm text-[#595555]">
          Loading…
        </div>
      }
    >
      <WorkflowCanvas />
    </Suspense>
  );
}
