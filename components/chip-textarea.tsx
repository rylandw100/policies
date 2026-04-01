"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { VariableNode } from "@/components/variable-picker";

interface ChipTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onSelectionChange?: (start: number, end: number) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  availableSteps: VariableNode[];
}

interface VariableChip {
  id: string;
  fullText: string; // e.g., "{{Employee.Employee information.lastName}}"
  object: string;
  category: string;
  field: string;
  displayName: string; // e.g., "lastName"
  breadcrumbs: string; // e.g., "Employee > Employee information > Last name"
  startIndex: number;
  endIndex: number;
}

export function ChipTextarea({
  id,
  value,
  onChange,
  className,
  placeholder,
  onKeyDown,
  onSelectionChange,
  onMouseDown,
  availableSteps,
}: ChipTextareaProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const [hoveredChipId, setHoveredChipId] = useState<string | null>(null);

  // Find variable node by path to get display name
  const findVariableNode = (
    steps: VariableNode[],
    object: string,
    category: string,
    field: string
  ): VariableNode | null => {
    for (const step of steps) {
      if (step.children) {
        for (const obj of step.children) {
          if (obj.name === object && obj.children) {
            for (const cat of obj.children) {
              if (cat.name === category && cat.children) {
                for (const fld of cat.children) {
                  if (fld.name === field || fld.path?.field === field) {
                    return fld;
                  }
                }
              }
            }
          }
        }
      }
    }
    return null;
  };

  // Find object and category names for breadcrumbs
  const findBreadcrumbs = (
    steps: VariableNode[],
    object: string,
    category: string,
    field: string
  ): string => {
    for (const step of steps) {
      if (step.children) {
        for (const obj of step.children) {
          if (obj.name === object && obj.children) {
            for (const cat of obj.children) {
              if (cat.name === category && cat.children) {
                for (const fld of cat.children) {
                  if (fld.name === field || fld.path?.field === field) {
                    return `${obj.name} > ${cat.name} > ${fld.name}`;
                  }
                }
              }
            }
          }
        }
      }
    }
    // Fallback if not found
    return `${object} > ${category} > ${field}`;
  };

  // Parse variables from text
  const parseVariables = (text: string): VariableChip[] => {
    const chips: VariableChip[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let match;
    let chipId = 0;

    while ((match = regex.exec(text)) !== null) {
      const fullText = match[0]; // e.g., "{{Employee.Employee information.lastName}}"
      const innerText = match[1]; // e.g., "Employee.Employee information.lastName"
      const parts = innerText.split(".");
      
      if (parts.length >= 3) {
        const object = parts[0];
        const category = parts.slice(1, -1).join("."); // Handle categories with dots
        const field = parts[parts.length - 1];
        
        const variableNode = findVariableNode(availableSteps, object, category, field);
        const displayName = variableNode?.name || field;
        const breadcrumbs = findBreadcrumbs(availableSteps, object, category, field);

        chips.push({
          id: `chip-${chipId++}`,
          fullText,
          object,
          category,
          field,
          displayName,
          breadcrumbs,
          startIndex: match.index,
          endIndex: match.index + fullText.length,
        });
      }
    }

    return chips;
  };

  // Remove variable from text
  const removeVariable = (chip: VariableChip) => {
    const before = value.substring(0, chip.startIndex);
    const after = value.substring(chip.endIndex);
    const newValue = before + after;
    onChange(newValue);
  };

  // Update content when value changes externally
  useEffect(() => {
    if (contentRef.current && !isUpdatingRef.current) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

      // Save cursor position
      let cursorOffset = 0;
      if (range && contentRef.current.contains(range.commonAncestorContainer)) {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(contentRef.current);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorOffset = preCaretRange.toString().length;
      }

      // Parse variables and build DOM
      isUpdatingRef.current = true;
      const chips = parseVariables(value);
      
      // Clear content
      contentRef.current.innerHTML = "";

      if (value) {
        let lastIndex = 0;

        chips.forEach((chip) => {
          // Add text before the chip
          if (chip.startIndex > lastIndex) {
            const textBefore = value.substring(lastIndex, chip.startIndex);
            if (textBefore) {
              contentRef.current?.appendChild(document.createTextNode(textBefore));
            }
          }

          // Create chip element
          const chipContainer = document.createElement("span");
          chipContainer.className = "inline-flex items-center gap-1 py-0.5 rounded-md mr-1 relative group";
          chipContainer.style.cssText = `
            background-color: #F9F7F6;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 6px;
            height: 24px;
            max-width: 320px;
            box-sizing: border-box;
            display: inline-flex;
            flex-direction: row;
            align-items: center;
            padding: 0px 4px 0px 6px;
            position: relative;
          `;
          chipContainer.setAttribute("data-chip-id", chip.id);
          chipContainer.setAttribute("data-chip-full-text", chip.fullText);
          chipContainer.contentEditable = "false";

          // Chip text
          const chipText = document.createElement("span");
          chipText.className = "text-sm truncate";
          chipText.style.cssText = `
            font-family: 'Basel Grotesk', sans-serif;
            font-weight: 430;
            font-size: 14px;
            line-height: 20px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `;
          chipText.textContent = chip.displayName;
          chipContainer.appendChild(chipText);

          // Close button
          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.className = "flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity";
          closeBtn.style.cssText = `
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: none;
            cursor: pointer;
            padding: 0;
          `;
          closeBtn.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          `;
          closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeVariable(chip);
          };
          chipContainer.appendChild(closeBtn);

          // Tooltip
          const tooltip = document.createElement("div");
          tooltip.className = "chip-tooltip";
          tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 0;
            margin-bottom: 8px;
            padding: 4px 8px;
            background-color: #000;
            color: #fff;
            font-size: 12px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 50;
            font-family: 'Basel Grotesk', sans-serif;
            display: none;
            pointer-events: none;
          `;
          tooltip.textContent = chip.breadcrumbs;
          
          // Tooltip arrow
          const tooltipArrow = document.createElement("div");
          tooltipArrow.style.cssText = `
            position: absolute;
            top: 100%;
            left: 16px;
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 4px solid #000;
          `;
          tooltip.appendChild(tooltipArrow);
          chipContainer.appendChild(tooltip);

          // Show/hide tooltip on hover
          chipContainer.addEventListener("mouseenter", () => {
            setHoveredChipId(chip.id);
            tooltip.style.display = "block";
          });
          chipContainer.addEventListener("mouseleave", () => {
            setHoveredChipId(null);
            tooltip.style.display = "none";
          });

          contentRef.current?.appendChild(chipContainer);
          lastIndex = chip.endIndex;
        });

        // Add remaining text
        if (lastIndex < value.length) {
          const textAfter = value.substring(lastIndex);
          if (textAfter) {
            contentRef.current?.appendChild(document.createTextNode(textAfter));
          }
        }
      }

      // Restore cursor position
      if (cursorOffset > 0 && contentRef.current.textContent) {
        const textLength = contentRef.current.textContent.length;
        const newPos = Math.min(cursorOffset, textLength);

        try {
          const walker = document.createTreeWalker(
            contentRef.current,
            NodeFilter.SHOW_TEXT,
            null
          );

          let currentPos = 0;
          let targetNode: Node | null = null;
          let targetOffset = 0;

          while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent?.length || 0;

            if (currentPos + nodeLength >= newPos) {
              targetNode = node;
              targetOffset = Math.min(newPos - currentPos, nodeLength);
              break;
            }

            currentPos += nodeLength;
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
        } catch (e) {
          // Silently fail if we can't restore cursor
        }
      }

      isUpdatingRef.current = false;
    }
  }, [value, availableSteps]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isUpdatingRef.current) return;

    // Reconstruct text by walking the DOM tree
    // Replace chip elements with their full variable syntax
    let reconstructedText = "";
    const container = e.currentTarget;
    
    const walkNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        reconstructedText += node.textContent || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const chipFullText = element.getAttribute("data-chip-full-text");
        if (chipFullText) {
          // This is a chip - use the full variable syntax instead of traversing children
          reconstructedText += chipFullText;
        } else {
          // Not a chip - walk through children
          for (let i = 0; i < element.childNodes.length; i++) {
            walkNode(element.childNodes[i]);
          }
        }
      }
    };

    // Walk through all top-level nodes
    for (let i = 0; i < container.childNodes.length; i++) {
      walkNode(container.childNodes[i]);
    }

    onChange(reconstructedText);

    if (onSelectionChange) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(e.currentTarget);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        const start = preCaretRange.toString().length;
        onSelectionChange(start, start);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const newText = contentRef.current?.textContent || "";
    onChange(newText);
  };

  return (
    <div className="relative">
      <div
        ref={contentRef}
        id={id}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        className={cn(
          "w-full min-h-[251px] resize-y border border-[#CCCCCC] rounded-md bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#5aa5e7] focus:border-[#5aa5e7]",
          "text-base leading-6 text-black",
          "overflow-y-auto",
          className
        )}
        style={{
          fontFamily: "'Basel Grotesk', sans-serif",
          fontWeight: 430,
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
        }}
        suppressContentEditableWarning
        data-placeholder={placeholder}
      />
      {value === "" && placeholder && (
        <div
          className="absolute left-3 top-2 text-gray-400 pointer-events-none"
          style={{ fontSize: "inherit" }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}
