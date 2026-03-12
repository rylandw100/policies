"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { VariablePath } from "@/components/variable-picker";
import { VariableChipInput } from "@/components/variable-chip-input";
import { VariableDropdown } from "@/components/variable-dropdown";
import { StyledTextarea } from "@/components/styled-textarea";
import { ChipTextarea } from "@/components/chip-textarea";
import { getAvailableSteps, SelectedNode } from "@/lib/variables";
import {
  Edit,
  MoreHorizontal,
  ChevronDown,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HelpCircle,
  Code,
} from "lucide-react";
import { TriggerIcon, AIIcon, SMSIcon, CloseIcon, TrashIcon } from "@/components/icons";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedNode, setSelectedNode] = useState<SelectedNode>("aiPrompt");
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [pickerContext, setPickerContext] = useState<"aiPrompt" | "sms">("aiPrompt");
  const [summarizeVariables, setSummarizeVariables] = useState<VariablePath[]>([]);
  const [smsMessage, setSmsMessage] = useState("Example body");
  const [promptMessage, setPromptMessage] = useState(`Write a warm, professional welcome message for a newly hired employee.
 Use their name, role, team, and start date. Keep it friendly and concise.`);
  const [summarizeInputFocused, setSummarizeInputFocused] = useState(false);
  const [outputFormat, setOutputFormat] = useState<string>("Text");
  const [jsonSchemaMode, setJsonSchemaMode] = useState<"basic" | "advanced">("basic");
  const [workflowOption, setWorkflowOption] = useState<"opt1" | "opt2">("opt1");
  const [isNavigationDropdownOpen, setIsNavigationDropdownOpen] = useState(false);
  const [showChangeStates, setShowChangeStates] = useState(false);
  const currentPage = pathname === "/documents" ? "Documents" : "Workflows";
  
  // JSON Schema state
  type JsonProperty = {
    id: string;
    name: string;
    type: string;
    description: string;
  };
  const [jsonProperties, setJsonProperties] = useState<JsonProperty[]>([]);
  const [jsonSchemaText, setJsonSchemaText] = useState<string>(`{
  "type": "object",
  "properties": {}
}`);
  const [isUpdatingFromBasic, setIsUpdatingFromBasic] = useState(false);
  const [isUpdatingFromAdvanced, setIsUpdatingFromAdvanced] = useState(false);
  const [showGeneratePopover, setShowGeneratePopover] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, right: 0 });
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const promptAddVariableButtonRef = useRef<HTMLButtonElement>(null);
  const smsAddVariableButtonRef = useRef<HTMLButtonElement>(null);
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
        const textareaId = pickerContext === "sms" ? 'sms-message' : 'prompt-textarea';
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
        const buttonRef = pickerContext === "sms" ? smsAddVariableButtonRef : promptAddVariableButtonRef;
        
        if (buttonRef?.current) {
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
      const buttonRef = pickerContext === "sms" ? smsAddVariableButtonRef : promptAddVariableButtonRef;
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside the variable popover
      if (target.closest('.variable-popover')) {
        return;
      }
      
      // Don't close if clicking inside the textarea
      const textareaId = pickerContext === "sms" ? 'sms-message' : 'prompt-textarea';
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
      // Immediately try to position, then retry with requestAnimationFrame for delayed renders
      updateVariablePopoverPosition();
      
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
            <div className="relative navigation-dropdown-container">
              <Button
                variant="ghost"
                onClick={() => setIsNavigationDropdownOpen(!isNavigationDropdownOpen)}
                className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-2"
              >
                {currentPage}
                <ChevronDown className={`size-4 transition-transform ${isNavigationDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
              {isNavigationDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border border-[#e0dede] min-w-[160px] z-50">
                  <button
                    onClick={() => {
                      router.push("/");
                      setIsNavigationDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                      currentPage === "Workflows" ? "bg-gray-50 font-medium" : ""
                    }`}
                  >
                    Workflows
                  </button>
                  <button
                    onClick={() => {
                      router.push("/documents");
                      setIsNavigationDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${
                      currentPage === "Documents" ? "bg-gray-50 font-medium" : ""
                    }`}
                  >
                    Documents
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            {currentPage === "Workflows" && (
              <>
                <div className="flex items-center gap-2 text-white">
                  <span className="text-sm font-medium">Show change states</span>
                  <button
                    onClick={() => setShowChangeStates(!showChangeStates)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showChangeStates ? "bg-white" : "bg-white/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-[#4A0039] transition-transform ${
                        showChangeStates ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className="w-px h-6 bg-white/30" />
              </>
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

        {/* Navigation Bar - Workflows */}
        {currentPage === "Workflows" && (
          <div className="h-18 bg-white border-b border-[#e0dede] flex items-center justify-between px-[18px] py-3">
            <div className="flex items-center gap-3">
              <CloseIcon className="size-6 text-black cursor-pointer" />
              <div className="flex items-center gap-3">
                <h1 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "center" }}>Custom workflow 1</h1>
                <div className="flex items-center gap-2 bg-gray-100 rounded-md p-1">
                  <button
                    onClick={() => setWorkflowOption("opt1")}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      workflowOption === "opt1"
                        ? "bg-white text-black shadow-sm"
                        : "text-gray-600 hover:text-black"
                    }`}
                  >
                    Opt. 1
                  </button>
                  <button
                    onClick={() => setWorkflowOption("opt2")}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      workflowOption === "opt2"
                        ? "bg-white text-black shadow-sm"
                        : "text-gray-600 hover:text-black"
                    }`}
                  >
                    Opt. 2
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-[#bfbebe]" />
                <span className="text-sm text-[#595555]">Unpublished</span>
              </div>
              <div className="w-px h-6 bg-[#e0dede]" />
              <Button className="bg-[#7A005D] text-white hover:bg-[#7A005D]/90 h-10">
                Save
              </Button>
              <MoreHorizontal className="size-6 text-[#8c8888] cursor-pointer" />
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Workflows */}
      {currentPage === "Workflows" && (
        <>
        {workflowOption === "opt1" && (
      <div className="flex h-screen pt-32">
        {/* Left Panel - Form */}
        <div className="w-[600px] border-r border-[#e0dede] bg-white flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            {selectedNode === "trigger" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>Trigger details</h2>
                    <CloseIcon className="size-6 text-black cursor-pointer" onClick={() => setSelectedNode("aiPrompt")} />
                  </div>
                </div>
                <div className="bg-[#e0dede] h-px mb-6" />
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-black mb-2">Event</p>
                    <p className="text-sm text-black mb-4">This workflow will trigger based on the following event</p>
                    <div className="bg-white border border-[#e0dede] rounded-lg h-[72px] px-6 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TriggerIcon className="size-6 text-[#716f6c]" />
                        <p className="text-sm font-medium text-black">{showChangeStates ? "Profile change is effective" : "rwebb_object is created"}</p>
                      </div>
                      <Button variant="ghost" className="text-[#4a6ba6] hover:text-[#4a6ba6]">
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedNode === "aiPrompt" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>AI prompt</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-black">ID: 12</span>
                      <CloseIcon className="size-6 text-black cursor-pointer" />
                    </div>
                  </div>
                  <p className="text-black mb-6" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "16px", lineHeight: "24px", flex: "none", alignSelf: "stretch" }}>
                    A flexible, general-purpose chain action that allows users to define custom AI transformations
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                      Step name
                    </label>
                    <Input
                      defaultValue="Prompt 1"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        Prompt <span className="text-[#c3402c]">*</span>
                      </label>
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
                          setOpenedViaHotkey(false);
                          setCursorPosition({ top: 0, left: 0 });
                          // Use requestAnimationFrame to ensure button is rendered before positioning
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              setShowVariablePicker(true);
                            });
                          });
                        }}
                      >
                        + Add variable
                      </Button>
                    </div>
                    <ChipTextarea
                      id="prompt-textarea"
                      value={promptMessage}
                      availableSteps={getAvailableSteps(selectedNode, outputFormat, jsonProperties, showChangeStates)}
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
                      className="w-full min-h-[251px] resize-y border-[#CCCCCC]"
                    />
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
                </div>
              </div>
            )}

            {selectedNode === "sms" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>Send an SMS</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-black">ID: 12</span>
                      <CloseIcon className="size-6 text-black cursor-pointer" />
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
                      defaultValue="SMS 1"
                      className="w-full border-[#CCCCCC]"
                    />
                  </div>

                  <div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                          Recipients <span className="text-[#c3402c]">*</span>
                        </label>
                        <div className="bg-white border border-[#CCCCCC] rounded-md p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-[#595555]">To</span>
                              <div className="flex items-center gap-2 px-2 py-1 bg-[#fafafa] border border-[#e3e3e3] rounded text-sm">
                                <span>Sales department</span>
                                <div className="w-px h-4 bg-[#e3e3e3]" />
                                <span className="text-[10px] text-[#565659] opacity-80">AND</span>
                                <span>United States</span>
                                <CloseIcon className="size-4 cursor-pointer" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                            Message <span className="text-[#c3402c]">*</span>
                          </label>
                          <Button
                            ref={smsAddVariableButtonRef}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs bg-white border border-black/20 rounded-md px-2 gap-1 flex items-center justify-center"
                            onClick={() => {
                              // Save current cursor position
                              const textarea = document.getElementById("sms-message");
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
                                  start = smsMessage.length;
                                  end = smsMessage.length;
                                }
                                setSavedTextCursorPosition({ start, end });
                              }
                              setPickerContext("sms");
                              setOpenedViaHotkey(false);
                              setCursorPosition({ top: 0, left: 0 });
                              // Use requestAnimationFrame to ensure button is rendered before positioning
                              requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                  setShowVariablePicker(true);
                                });
                              });
                            }}
                          >
                            + Add variable
                          </Button>
                        </div>
                        <ChipTextarea
                          id="sms-message"
                          value={smsMessage}
                          availableSteps={getAvailableSteps(selectedNode, outputFormat, jsonProperties, showChangeStates)}
                          onChange={(text) => {
                            setSmsMessage(text);
                            const textarea = document.getElementById("sms-message");
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
                                
                                setPickerContext("sms");
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
                              } else if (showVariablePicker && pickerContext === "sms" && textBeforeCursor.includes("{{")) {
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
                                    
                                    // Reset the flag after a short delay to allow useEffect to run normally after
                                    setTimeout(() => {
                                      justCalculatedPositionRef.current = false;
                                    }, 100);
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
                            if (showVariablePicker && pickerContext === "sms") {
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
                              const textBeforeCursor = smsMessage.substring(0, cursorPos);
                              
                              if (textBeforeCursor.includes("{{")) {
                                const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");
                                const searchText = textBeforeCursor.substring(lastOpenBrace + 2);
                                setVariableSearchQuery(searchText);
                              }
                            }
                          }}
                          className="w-full h-[204px] border-[#CCCCCC] resize-none"
                          placeholder="Enter your message here..."
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                          Time zone <span className="text-[#c3402c]">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            defaultValue="UTC (UTC+0)"
                            className="w-full border-[#bfbebe] pr-10"
                          />
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-6 text-black" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                          Locale <span className="text-[#c3402c]">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            defaultValue="United States (English)"
                            className="w-full border-[#bfbebe] pr-10"
                          />
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-6 text-black" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="border-t border-[#e0dede] bg-white p-4 flex items-center justify-between h-16 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="destructive" className="bg-[#bb3d2a] text-white hover:bg-[#bb3d2a]/90 h-10">
                Remove
              </Button>
              <Button variant="outline" className="border-[#d3d3d3] h-10">
                Duplicate
              </Button>
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

        {/* Center Panel - Workflow Visualization */}
        <div className="flex-1 flex items-center justify-center relative">
          <div className="flex flex-col items-center">
            {/* Workflow Trigger */}
            <Card 
              className={`w-[250px] h-[62px] border flex items-center shadow-none rounded-md cursor-pointer transition-all ${
                selectedNode === "trigger" 
                  ? "border-2 border-[#5aa5e7] bg-white opacity-100" 
                  : "opacity-40 border-[#e0dede]"
              }`}
              onClick={() => setSelectedNode("trigger")}
            >
              <div className="px-3 flex items-center gap-3 w-full h-full">
                <TriggerIcon className={`size-6 shrink-0 ${selectedNode === "trigger" ? "text-black" : "text-[#8c8888]"}`} />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#6F6F72", flex: "none", alignSelf: "stretch" }}>Workflow trigger</p>
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "16px", lineHeight: "24px", color: "#252528", flex: "none", alignSelf: "stretch" }}>{showChangeStates ? "Profile change is effective" : "rwebb_object is created"}</p>
                </div>
              </div>
            </Card>

            {/* Arrow connecting to AI Prompt */}
            <div className="relative h-[50px] flex items-end justify-center">
              <div 
                className="h-[calc(100%-8px)] w-0 border-l border-[#8c8888] border-dashed"
                style={{ borderWidth: '1px' }}
              />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#8c8888]" />
            </div>

            {/* AI Prompt Step */}
            <Card 
              className={`w-[250px] h-[62px] border flex items-center shadow-none rounded-md cursor-pointer transition-all ${
                selectedNode === "aiPrompt" 
                  ? "border-2 border-[#5aa5e7] bg-white opacity-100" 
                  : "opacity-40 border-[#e0dede]"
              }`}
              onClick={() => setSelectedNode("aiPrompt")}
            >
              <div className="px-3 flex items-center gap-3 w-full h-full">
                <AIIcon className={`size-6 shrink-0 ${selectedNode === "aiPrompt" ? "" : "opacity-40"}`} />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#6F6F72", flex: "none", alignSelf: "stretch" }}>AI step</p>
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "16px", lineHeight: "24px", color: "#252528", flex: "none", alignSelf: "stretch" }}>AI prompt</p>
                </div>
              </div>
            </Card>

            {/* Arrow connecting to SMS */}
            <div className="relative h-[50px] flex items-end justify-center">
              <div 
                className="h-[calc(100%-8px)] w-0 border-l border-[#8c8888] border-dashed"
                style={{ borderWidth: '1px' }}
              />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#8c8888]" />
        </div>

            {/* SMS Step */}
            <Card 
              className={`w-[250px] h-[62px] border flex items-center shadow-none rounded-md cursor-pointer transition-all ${
                selectedNode === "sms" 
                  ? "border-2 border-[#5aa5e7] bg-white opacity-100" 
                  : "opacity-40 border-[#e0dede]"
              }`}
              onClick={() => setSelectedNode("sms")}
            >
              <div className="px-3 flex items-center gap-3 w-full h-full">
                <SMSIcon className={`size-6 shrink-0 ${selectedNode === "sms" ? "text-black" : "text-[#8c8888]"}`} />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#6F6F72", flex: "none", alignSelf: "stretch" }}>Send an SMS</p>
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "16px", lineHeight: "24px", color: "#252528", flex: "none", alignSelf: "stretch" }}>SMS 1</p>
                </div>
              </div>
            </Card>

            {/* Arrow connecting to End */}
            <div className="relative h-[50px] flex items-end justify-center">
              <div 
                className="h-[calc(100%-8px)] w-0 border-l border-[#8c8888] border-dashed"
                style={{ borderWidth: '1px' }}
              />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#8c8888]" />
            </div>

            <p className="text-sm text-[#8c8888] mt-2">End workflow</p>
          </div>

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
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
      )}
      
      {/* Opt. 2 - Clone of Opt. 1 */}
      {workflowOption === "opt2" && (
      <div className="flex h-screen pt-32">
        {/* Left Panel - Form */}
        <div className="w-[600px] border-r border-[#e0dede] bg-white flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            {selectedNode === "trigger" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>Trigger details</h2>
                    <CloseIcon className="size-6 text-black cursor-pointer" onClick={() => setSelectedNode("aiPrompt")} />
                  </div>
                </div>
                <div className="bg-[#e0dede] h-px mb-6" />
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-black mb-2">Event</p>
                    <p className="text-sm text-black mb-4">This workflow will trigger based on the following event</p>
                    <div className="bg-white border border-[#e0dede] rounded-lg h-[72px] px-6 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TriggerIcon className="size-6 text-[#716f6c]" />
                        <p className="text-sm font-medium text-black">{showChangeStates ? "Profile change is effective" : "rwebb_object is created"}</p>
                      </div>
                      <Button variant="ghost" className="text-[#4a6ba6] hover:text-[#4a6ba6]">
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedNode === "aiPrompt" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>AI prompt</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-black">ID: 12</span>
                      <CloseIcon className="size-6 text-black cursor-pointer" />
                    </div>
                  </div>
                  <p className="text-black mb-6" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "16px", lineHeight: "24px", flex: "none", alignSelf: "stretch" }}>
                    A flexible, general-purpose chain action that allows users to define custom AI transformations
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                      Step name
                    </label>
                    <Input
                      defaultValue="Prompt 1"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        Prompt <span className="text-[#c3402c]">*</span>
                      </label>
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
                          setOpenedViaHotkey(false);
                          setCursorPosition({ top: 0, left: 0 });
                          // Use requestAnimationFrame to ensure button is rendered before positioning
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              setShowVariablePicker(true);
                            });
                          });
                        }}
                      >
                        + Add variable
                      </Button>
                    </div>
                    <div className="relative">
                      <ChipTextarea
                        id="prompt-textarea"
                        value={promptMessage}
                        availableSteps={getAvailableSteps(selectedNode, outputFormat, jsonProperties, showChangeStates)}
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
                                
                                setTimeout(() => {
                                  justCalculatedPositionRef.current = false;
                                }, 100);
                              };
                              
                              justCalculatedPositionRef.current = true;
                              calculatePosition();
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
                                  
                                  setTimeout(() => {
                                    justCalculatedPositionRef.current = false;
                                  }, 100);
                                };
                                
                                justCalculatedPositionRef.current = true;
                                calculatePosition();
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
                        placeholder="Enter your prompt here..."
                        className="w-full min-h-[251px]"
                      />
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
                          <Button
                            type="button"
                            variant="outline"
                            className="w-[129px] h-8 px-3 gap-1.5 bg-white border border-black/20 rounded-md flex items-center justify-center"
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
                            + Add property
                          </Button>
                        </div>
                      )}

                      {jsonSchemaMode === "advanced" && (
                        <div className="border border-[#CCCCCC] rounded-lg bg-white overflow-hidden">
                          {isGeneratingSchema ? (
                            <div className="p-4 space-y-2">
                              <div className="h-4 bg-[#e1d8d2] rounded w-[76px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[421px]" />
                              <div className="h-4 bg-[#e1d8d2] rounded w-[357px]" />
                            </div>
                          ) : (
                            <>
                              <div className="flex border-b border-[#CCCCCC]">
                                <div className="w-12 border-r border-[#CCCCCC] bg-[#fafafa] p-2">
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
                </div>
              </div>
            )}

            {selectedNode === "sms" && (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "20px", lineHeight: "28px", display: "flex", alignItems: "flex-end" }}>Send an SMS</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-black">ID: 12</span>
                      <CloseIcon className="size-6 text-black cursor-pointer" />
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
                      defaultValue="SMS 1"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                      Recipients <span className="text-[#c3402c]">*</span>
                    </label>
                    <div className="bg-white border border-[#CCCCCC] rounded-md p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-[#595555]">To</span>
                          <div className="flex items-center gap-2 px-2 py-1 bg-[#fafafa] border border-[#e3e3e3] rounded text-sm">
                            <span>Sales department</span>
                            <div className="w-px h-4 bg-[#e3e3e3]" />
                            <span className="text-[10px] text-[#565659] opacity-80">AND</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        Message <span className="text-[#c3402c]">*</span>
                      </label>
                      <Button
                        ref={smsAddVariableButtonRef}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs bg-white border border-black/20 rounded-md px-2 gap-1 flex items-center justify-center"
                        onClick={() => {
                          // Save current cursor position
                          const textarea = document.getElementById("sms-message");
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
                              start = smsMessage.length;
                              end = smsMessage.length;
                            }
                            setSavedTextCursorPosition({ start, end });
                          }
                          setPickerContext("sms");
                          setShowVariablePicker(true);
                          setOpenedViaHotkey(false);
                          setCursorPosition({ top: 0, left: 0 });
                        }}
                      >
                        + Add variable
                      </Button>
                    </div>
                    <div className="relative">
                      <ChipTextarea
                        id="sms-message"
                        value={smsMessage}
                        availableSteps={getAvailableSteps(selectedNode, outputFormat, jsonProperties, showChangeStates)}
                        onChange={(text) => {
                          setSmsMessage(text);
                          const textarea = document.getElementById("sms-message");
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
                              
                              setPickerContext("sms");
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
                                
                                setTimeout(() => {
                                  justCalculatedPositionRef.current = false;
                                }, 100);
                              };
                              
                              justCalculatedPositionRef.current = true;
                              calculatePosition();
                              requestAnimationFrame(() => {
                                requestAnimationFrame(calculatePosition);
                              });
                            } else if (showVariablePicker && pickerContext === "sms" && textBeforeCursor.includes("{{")) {
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
                                  
                                  setTimeout(() => {
                                    justCalculatedPositionRef.current = false;
                                  }, 100);
                                };
                                
                                justCalculatedPositionRef.current = true;
                                calculatePosition();
                                requestAnimationFrame(() => {
                                  requestAnimationFrame(calculatePosition);
                                });
                              }
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (showVariablePicker && pickerContext === "sms") {
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
                            const textBeforeCursor = smsMessage.substring(0, cursorPos);
                            
                            if (textBeforeCursor.includes("{{")) {
                              const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");
                              const searchText = textBeforeCursor.substring(lastOpenBrace + 2);
                              setVariableSearchQuery(searchText);
                            }
                          }
                        }}
                        placeholder="Enter your message here..."
                        className="w-full min-h-[195px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        Time zone <span className="text-[#c3402c]">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          defaultValue="UTC (UTC+0)"
                          className="w-full border-[#bfbebe] pr-10"
                        />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-6 text-black" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-base leading-6 text-black mb-2" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}>
                        Locale <span className="text-[#c3402c]">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          defaultValue="United States (English)"
                          className="w-full border-[#bfbebe] pr-10"
                        />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-6 text-black" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="border-t border-[#e0dede] bg-white p-4 flex items-center justify-between h-16 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="destructive" className="bg-[#bb3d2a] text-white hover:bg-[#bb3d2a]/90 h-10">
                Remove
              </Button>
              <Button variant="outline" className="border-[#d3d3d3] h-10">
                Duplicate
              </Button>
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

        {/* Center Panel - Workflow Visualization */}
        <div className="flex-1 flex items-center justify-center relative">
          <div className="flex flex-col items-center">
            {/* Workflow Trigger */}
            <Card 
              className={`w-[250px] h-[62px] border flex items-center shadow-none rounded-md cursor-pointer transition-all ${
                selectedNode === "trigger" 
                  ? "border-2 border-[#5aa5e7] bg-white opacity-100" 
                  : "opacity-40 border-[#e0dede]"
              }`}
              onClick={() => setSelectedNode("trigger")}
            >
              <div className="px-3 flex items-center gap-3 w-full h-full">
                <TriggerIcon className={`size-6 shrink-0 ${selectedNode === "trigger" ? "text-black" : "text-[#8c8888]"}`} />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#6F6F72", flex: "none", alignSelf: "stretch" }}>Workflow trigger</p>
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "16px", lineHeight: "24px", color: "#252528", flex: "none", alignSelf: "stretch" }}>{showChangeStates ? "Profile change is effective" : "rwebb_object is created"}</p>
                </div>
              </div>
            </Card>

            {/* Arrow connecting to AI Prompt */}
            <div className="relative h-[50px] flex items-end justify-center">
              <div 
                className="h-[calc(100%-8px)] w-0 border-l border-[#8c8888] border-dashed"
                style={{ borderWidth: '1px' }}
              />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#8c8888]" />
            </div>

            {/* AI Prompt Step */}
            <Card 
              className={`w-[250px] h-[62px] border flex items-center shadow-none rounded-md cursor-pointer transition-all ${
                selectedNode === "aiPrompt" 
                  ? "border-2 border-[#5aa5e7] bg-white opacity-100" 
                  : "opacity-40 border-[#e0dede]"
              }`}
              onClick={() => setSelectedNode("aiPrompt")}
            >
              <div className="px-3 flex items-center gap-3 w-full h-full">
                <AIIcon className={`size-6 shrink-0 ${selectedNode === "aiPrompt" ? "" : "opacity-40"}`} />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#6F6F72", flex: "none", alignSelf: "stretch" }}>AI step</p>
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "16px", lineHeight: "24px", color: "#252528", flex: "none", alignSelf: "stretch" }}>AI prompt</p>
                </div>
              </div>
            </Card>

            {/* Arrow connecting to SMS */}
            <div className="relative h-[50px] flex items-end justify-center">
              <div 
                className="h-[calc(100%-8px)] w-0 border-l border-[#8c8888] border-dashed"
                style={{ borderWidth: '1px' }}
              />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#8c8888]" />
        </div>

            {/* SMS Step */}
            <Card 
              className={`w-[250px] h-[62px] border flex items-center shadow-none rounded-md cursor-pointer transition-all ${
                selectedNode === "sms" 
                  ? "border-2 border-[#5aa5e7] bg-white opacity-100" 
                  : "opacity-40 border-[#e0dede]"
              }`}
              onClick={() => setSelectedNode("sms")}
            >
              <div className="px-3 flex items-center gap-3 w-full h-full">
                <SMSIcon className={`size-6 shrink-0 ${selectedNode === "sms" ? "text-black" : "text-[#8c8888]"}`} />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#6F6F72", flex: "none", alignSelf: "stretch" }}>Send an SMS</p>
                  <p className="truncate" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, fontSize: "16px", lineHeight: "24px", color: "#252528", flex: "none", alignSelf: "stretch" }}>SMS 1</p>
                </div>
              </div>
            </Card>

            {/* Arrow connecting to End */}
            <div className="relative h-[50px] flex items-end justify-center">
              <div 
                className="h-[calc(100%-8px)] w-0 border-l border-[#8c8888] border-dashed"
                style={{ borderWidth: '1px' }}
              />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#8c8888]" />
            </div>

            <p className="text-sm text-[#8c8888] mt-2">End workflow</p>
          </div>

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
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
      )}
        </>
      )}

      {/* Variable Dropdown for SMS and Prompt - Popover version */}
      {showVariablePicker && (pickerContext === "sms" || pickerContext === "aiPrompt") && (
        <div 
          className="variable-popover fixed z-50 bg-white border-l border-r border-b border-t-0 border-[#e0dede] rounded-lg shadow-lg w-[400px] max-h-[400px] flex flex-col"
          style={{
            top: `${variablePopoverPosition.top}px`,
            left: `${variablePopoverPosition.left}px`,
          }}
          onMouseDown={(e) => {
            // Stop propagation to prevent textarea from receiving mousedown events
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          onClick={(e) => {
            // Stop propagation to prevent textarea from receiving click events
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          onMouseDownCapture={(e) => {
            // Prevent clicks inside the popover from closing it
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
        >
          <VariableDropdown
            availableSteps={getAvailableSteps(selectedNode, outputFormat, jsonProperties, showChangeStates)}
            selectedVariables={[]}
            initialSearchQuery={variableSearchQuery}
            hideSearchInput={openedViaHotkey}
            openedViaHotkey={openedViaHotkey}
            breadcrumbMode={workflowOption === "opt1"}
            showChangeStates={showChangeStates}
            onSelect={(variables) => {
              if (variables.length > 0) {
                const currentText = pickerContext === "sms" ? smsMessage : promptMessage;
                
                // Format variable as {{object.category.field}} or {{before:object.category.field}} or {{after:object.category.field}}
                const variable = variables[variables.length - 1];
                const changeStatePrefix = variable.changeState ? `${variable.changeState}:` : '';
                const variableText = `{{${changeStatePrefix}${variable.object}.${variable.category}.${variable.field}}}`;
                
                let finalText: string;
                let insertionPosition: number;
                
                if (openedViaHotkey) {
                  // When opened via hotkey, find the "{{" that opened the picker
                  const textareaId = pickerContext === "sms" ? 'sms-message' : 'prompt-textarea';
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
                  
                  if (pickerContext === "sms") {
                    setSmsMessage(finalText);
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
                    const textareaId = pickerContext === "sms" ? 'sms-message' : 'prompt-textarea';
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
    </div>
  );
}
