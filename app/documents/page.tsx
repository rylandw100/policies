"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown, Code, X } from "lucide-react";
import { VariableDropdown } from "@/components/variable-dropdown";
import { getAvailableSteps, SelectedNode, generateDocumentVariables } from "@/lib/variables";
import { VariablePath, VariableNode } from "@/components/variable-picker";

interface VariableChip {
  id: string;
  fullText: string;
  object: string;
  category: string;
  field: string;
  displayName: string;
  breadcrumbs: string;
  startIndex: number;
  endIndex: number;
}

export default function DocumentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigationDropdownOpen, setIsNavigationDropdownOpen] = useState(false);
  const [showVariablePanel, setShowVariablePanel] = useState(false);
  const documentEditorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const isUserTypingRef = useRef(false);
  const lastContentRef = useRef<string>("");
  const savedCursorRangeRef = useRef<Range | null>(null);
  const [openedViaHotkey, setOpenedViaHotkey] = useState(false);
  const [showVariablePopover, setShowVariablePopover] = useState(false);
  const [variablePopoverPosition, setVariablePopoverPosition] = useState({ top: 0, left: 0 });
  const [variableSearchQuery, setVariableSearchQuery] = useState("");
  const currentPage = pathname === "/documents" ? "Documents" : "Workflows";

  /**
   * Gets the caret's current line position in a contentEditable element.
   * Uses Range/Selection API to get the exact visual position of the caret,
   * accounting for soft-wrapping and actual rendered line positions.
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
      
      if (caretRect && (caretRect.width > 0 || caretRect.height > 0)) {
        const elementRect = element.getBoundingClientRect();
        return {
          lineBottom: caretRect.bottom - elementRect.top + element.scrollTop,
          lineLeft: caretRect.left - elementRect.left + element.scrollLeft,
        };
      }
    } catch (e) {
      // If anything fails, return null
      return null;
    }
    
    return null;
  }
  const [documentContent, setDocumentContent] = useState(`<div style="text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 1em; font-size: 16px;">CONSULTING AGREEMENT</div>

<p>Effective Start date / Effective date, Contractor Name ("Consultant") and Business legal name ("Company") agree as follows:</p>

<p><strong>1. Services; Payment; No Violation of Rights or Obligations.</strong></p>

<p>The Consultant agrees to perform the services described in <u>Exhibit A</u> attached hereto (the "Services") in accordance with the terms and conditions of this Agreement. The Company agrees to pay the Consultant the fees set forth in Exhibit A for the Services. The Consultant represents and warrants that the performance of the Services will not violate any rights of any third party or any obligations the Consultant may have to any third party, including without limitation obligations of confidentiality. The Consultant agrees to indemnify and hold harmless the Company from and against any and all claims, damages, losses, costs and expenses (including reasonable attorneys' fees) arising out of or relating to any breach of the foregoing representation and warranty.</p>

<p><strong>2. Ownership Rights; Proprietary Information; Publicity.</strong></p>

<p>a. The Consultant agrees that all inventions, discoveries, improvements, works of authorship, and other developments or creations (collectively, "Inventions") made, conceived, or reduced to practice by the Consultant, either alone or jointly with others, during the term of this Agreement and in the course of performing the Services, shall be the sole and exclusive property of the Company. The Consultant hereby assigns to the Company all right, title, and interest in and to such Inventions, including all intellectual property rights therein.</p>`);
  
  const availableSteps = generateDocumentVariables();

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

  // Find breadcrumbs
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
    return `${object} > ${category} > ${field}`;
  };

  // Parse variables from HTML/text content
  const parseVariables = (html: string): VariableChip[] => {
    // Extract text content from HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const textContent = tempDiv.textContent || '';
    
    const chips: VariableChip[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let match;
    let chipId = 0;

    while ((match = regex.exec(textContent)) !== null) {
      const fullText = match[0];
      const innerText = match[1];
      const parts = innerText.split(".");
      
      if (parts.length >= 3) {
        const object = parts[0];
        const category = parts.slice(1, -1).join(".");
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

  // Render chips in the document editor
  const renderChips = () => {
    if (!documentEditorRef.current || isUpdatingRef.current) return;
    
    isUpdatingRef.current = true;
    const editor = documentEditorRef.current;
    
    // Get current HTML
    const currentHTML = editor.innerHTML;
    
    // Extract text to find variables
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentHTML;
    const textContent = tempDiv.textContent || '';
    
    const chips = parseVariables(textContent);
    
    if (chips.length === 0) {
      isUpdatingRef.current = false;
      return;
    }

    // Save selection
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    let cursorOffset = 0;
    if (range && editor.contains(range.commonAncestorContainer)) {
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editor);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorOffset = preCaretRange.toString().length;
    }

    // Rebuild content with chips
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();

    chips.forEach((chip) => {
      // Add text before chip
      if (chip.startIndex > lastIndex) {
        const textBefore = textContent.substring(lastIndex, chip.startIndex);
        if (textBefore) {
          fragment.appendChild(document.createTextNode(textBefore));
        }
      }

      // Create chip element
      const chipContainer = document.createElement("span");
      chipContainer.className = "variable-chip";
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
        margin: 0 2px;
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
      closeBtn.className = "flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1";
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
        // Remove variable from content
        const before = textContent.substring(0, chip.startIndex);
        const after = textContent.substring(chip.endIndex);
        const newText = before + after;
        // Update HTML by replacing the variable text
        const newHTML = currentHTML.replace(chip.fullText, '');
        setDocumentContent(newHTML);
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

      chipContainer.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
      });
      chipContainer.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });

      fragment.appendChild(chipContainer);
      lastIndex = chip.endIndex;
    });

    // Add remaining text
    if (lastIndex < textContent.length) {
      const textAfter = textContent.substring(lastIndex);
      if (textAfter) {
        fragment.appendChild(document.createTextNode(textAfter));
      }
    }

    // This is complex - we need to replace variables in the HTML while preserving formatting
    // For now, let's use a simpler approach: replace variable text with chip HTML
    let newHTML = currentHTML;
    chips.forEach((chip) => {
      const chipHTML = `<span class="variable-chip" data-chip-id="${chip.id}" data-chip-full-text="${chip.fullText}" contenteditable="false" style="background-color: #F9F7F6; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 6px; height: 24px; max-width: 320px; box-sizing: border-box; display: inline-flex; flex-direction: row; align-items: center; padding: 0px 4px 0px 6px; position: relative; margin: 0 2px;"><span style="font-family: 'Basel Grotesk', sans-serif; font-weight: 430; font-size: 14px; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${chip.displayName}</span><button type="button" class="chip-close" style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border: none; background: none; cursor: pointer; padding: 0; margin-left: 4px; opacity: 0.6;" data-chip-id="${chip.id}"><svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button><div class="chip-tooltip" style="position: absolute; bottom: 100%; left: 0; margin-bottom: 8px; padding: 4px 8px; background-color: #000; color: #fff; font-size: 12px; border-radius: 4px; white-space: nowrap; z-index: 50; font-family: 'Basel Grotesk', sans-serif; display: none; pointer-events: none;">${chip.breadcrumbs}<div style="position: absolute; top: 100%; left: 16px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 4px solid #000;"></div></div></span>`;
      newHTML = newHTML.replace(chip.fullText, chipHTML);
    });

    editor.innerHTML = newHTML;

    // Reattach event listeners
    editor.querySelectorAll('.chip-close').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chipId = (btn as HTMLElement).getAttribute('data-chip-id');
        const chip = chips.find(c => c.id === chipId);
        if (chip) {
          const before = textContent.substring(0, chip.startIndex);
          const after = textContent.substring(chip.endIndex);
          const newText = before + after;
          const newHTML = editor.innerHTML.replace(
            new RegExp(`<span[^>]*data-chip-id="${chipId}"[^>]*>.*?</span>`, 'g'),
            ''
          );
          setDocumentContent(newHTML);
        }
      });
    });

    editor.querySelectorAll('.variable-chip').forEach((chip) => {
      chip.addEventListener('mouseenter', (e) => {
        const tooltip = (e.currentTarget as HTMLElement).querySelector('.chip-tooltip') as HTMLElement;
        if (tooltip) tooltip.style.display = 'block';
      });
      chip.addEventListener('mouseleave', (e) => {
        const tooltip = (e.currentTarget as HTMLElement).querySelector('.chip-tooltip') as HTMLElement;
        if (tooltip) tooltip.style.display = 'none';
      });
    });

    isUpdatingRef.current = false;
  };

  // Only update innerHTML when content changes externally (not from user typing)
  useEffect(() => {
    if (documentEditorRef.current && !isUserTypingRef.current && !isUpdatingRef.current) {
      if (documentEditorRef.current.innerHTML !== documentContent) {
        isUpdatingRef.current = true;
        documentEditorRef.current.innerHTML = documentContent;
        lastContentRef.current = documentContent;
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 0);
      }
    }
  }, [documentContent]);

  // Ensure document editor has focus when page loads
  useEffect(() => {
    if (documentEditorRef.current) {
      // Focus the editor
      documentEditorRef.current.focus();
      
      // Set cursor at the end if there's no selection
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        const range = document.createRange();
        range.selectNodeContents(documentEditorRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex flex-col">
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

      {/* Document Header Bar */}
      <div className="h-10 bg-white border-b border-[#e0dede] flex items-center justify-between px-4 shrink-0 mt-14">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Create Document</span>
          <ChevronDown className="size-4 rotate-[-90deg]" />
          <span>Offer Letter | Create</span>
        </div>
        <Button 
          variant="ghost" 
          className="text-sm h-8"
          onClick={() => router.push("/")}
        >
          Exit
        </Button>
      </div>

      {/* Document Navigation Bar */}
      <div className="h-14 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="text-black font-medium">
          Consulting/1099 Agreement & NDA
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-black hover:bg-gray-100 h-9">
            Add fields
          </Button>
          <Button 
            variant="ghost" 
            className="text-black hover:bg-gray-100 h-9"
            onClick={() => {
              // Save cursor position before opening panel
              if (documentEditorRef.current) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  savedCursorRangeRef.current = selection.getRangeAt(0).cloneRange();
                } else {
                  // If no selection, create range at end of document
                  const range = document.createRange();
                  range.selectNodeContents(documentEditorRef.current);
                  range.collapse(false);
                  savedCursorRangeRef.current = range;
                }
                // Ensure editor has focus
                documentEditorRef.current.focus();
              }
              setShowVariablePanel(!showVariablePanel);
            }}
          >
            Insert variable
          </Button>
          <Button variant="ghost" className="text-black hover:bg-gray-100 h-9">
            Preview
          </Button>
          <Button variant="ghost" className="text-black hover:bg-gray-100 h-9">
            Import
          </Button>
          <Button className="bg-[#7A005D] text-white hover:bg-[#7A005D]/90 h-9">
            Publish
          </Button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="h-12 bg-white border-b border-[#e0dede] flex items-center gap-2 px-4 shrink-0">
        {/* Undo/Redo */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('undo', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('redo', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        {/* Text Style & Font */}
        <select className="h-8 px-2 text-sm border border-gray-300 rounded bg-white">
          <option>Normal text</option>
        </select>
        <select className="h-8 px-2 text-sm border border-gray-300 rounded bg-white">
          <option>Times New Roman</option>
        </select>
        <div className="flex items-center border border-gray-300 rounded">
          <Button variant="ghost" size="icon" className="h-8 w-6 rounded-none">
            <span className="text-xs">-</span>
          </Button>
          <input type="number" defaultValue="13.5" className="w-12 h-8 text-center text-sm border-x border-gray-300" />
          <Button variant="ghost" size="icon" className="h-8 w-6 rounded-none">
            <span className="text-xs">+</span>
          </Button>
        </div>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        {/* Text Formatting */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('bold', false);
            documentEditorRef.current?.focus();
          }}
        >
          <span className="font-bold text-sm">B</span>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('italic', false);
            documentEditorRef.current?.focus();
          }}
        >
          <span className="italic text-sm">I</span>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('underline', false);
            documentEditorRef.current?.focus();
          }}
        >
          <span className="underline text-sm">U</span>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('strikeThrough', false);
            documentEditorRef.current?.focus();
          }}
        >
          <span className="line-through text-sm">S</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Code className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        {/* Lists & Alignment */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('insertUnorderedList', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('insertOrderedList', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('justifyLeft', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('justifyCenter', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('justifyRight', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('justifyFull', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('outdent', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            document.execCommand('indent', false);
            documentEditorRef.current?.focus();
          }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        {/* Text Color & Paragraph */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </div>

      {/* Document Editor Area */}
      <div className="flex-1 flex bg-gray-100 min-h-0 overflow-hidden">
        {/* Document Editor Container - Shifts left when panel is open */}
        <div 
          className="flex-1 overflow-y-auto bg-gray-100 min-h-0 transition-all duration-300"
        >
          <div className="w-[720px] mx-auto py-12">
            <div
              ref={documentEditorRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              className="h-[816px] outline-none bg-white px-16 py-12"
              style={{ 
                fontFamily: "'Times New Roman', serif", 
                fontSize: "13.5px", 
                lineHeight: "1.6",
                color: "#000"
              }}
              onKeyDown={(e) => {
                // When popover is open via hotkey, prevent arrow keys and tab from being handled by contentEditable
                // Note: We only prevent default here as a fallback. The window-level handler in VariableDropdown
                // uses capture phase and will handle these keys first.
                if (showVariablePopover && openedViaHotkey) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab" || e.key === "Enter" || e.key === "Escape") {
                    // Only prevent default, don't stop propagation so window handler can receive it
                    e.preventDefault();
                  }
                }
              }}
              onInput={(e) => {
                if (isUpdatingRef.current) return;
                isUserTypingRef.current = true;
                const target = e.currentTarget;
                const newContent = target.innerHTML || "";
                lastContentRef.current = newContent;
                setDocumentContent(newContent);
                
                // Check if user typed "{{"
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  
                  // Get text content before cursor
                  const preCaretRange = range.cloneRange();
                  preCaretRange.selectNodeContents(target);
                  preCaretRange.setEnd(range.endContainer, range.endOffset);
                  const textBeforeCursor = preCaretRange.toString();
                  
                  // Check if user typed "{{" or is typing after "{{"
                  const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");
                  if (lastOpenBrace >= 0) {
                    // Extract text after "{{"
                    const searchText = textBeforeCursor.substring(lastOpenBrace + 2);
                    
                    if (textBeforeCursor.endsWith("{{")) {
                      // Just typed "{{" - open popover
                      const braceRange = range.cloneRange();
                      // Move range back 2 characters to include "{{"
                      try {
                        braceRange.setStart(range.startContainer, Math.max(0, range.startOffset - 2));
                        braceRange.setEnd(range.startContainer, range.startOffset);
                        // Save this range so we can replace "{{" later
                        savedCursorRangeRef.current = braceRange;
                      } catch (e) {
                        // If we can't create the range, save the current range
                        savedCursorRangeRef.current = range.cloneRange();
                      }
                      setOpenedViaHotkey(true);
                      setVariableSearchQuery("");
                      
                      // Calculate position for popover (8px below the caret line)
                      const calculatePosition = () => {
                        const caretPos = getCaretLinePosition(target);
                        
                        if (caretPos) {
                          // Get the actual viewport position of the caret
                          const elementRect = target.getBoundingClientRect();
                          const caretViewportTop = elementRect.top + caretPos.lineBottom;
                          const caretViewportLeft = elementRect.left + caretPos.lineLeft;
                          
                          // Position popover exactly 8px below the caret's line (in viewport coordinates)
                          const popoverTop = caretViewportTop + 8;
                          const popoverWidth = 400;
                          const popoverLeft = Math.max(8, Math.min(caretViewportLeft, window.innerWidth - popoverWidth - 8));
                          
                          setVariablePopoverPosition({ top: popoverTop, left: popoverLeft });
                        } else {
                          // Fallback: use element position
                          const elementRect = target.getBoundingClientRect();
                          const computedStyle = window.getComputedStyle(target);
                          const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
                          const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
                          const lineBottom = elementRect.top + paddingTop + lineHeight;
                          const popoverWidth = 400;
                          const popoverLeft = Math.max(8, Math.min(elementRect.left, window.innerWidth - popoverWidth - 8));
                          
                          setVariablePopoverPosition({ top: lineBottom + 8, left: popoverLeft });
                        }
                      };
                      
                      // Calculate position and show popover
                      calculatePosition();
                      setShowVariablePopover(true);
                    } else if (showVariablePopover && openedViaHotkey) {
                      // User is typing after "{{" - update search query
                      setVariableSearchQuery(searchText);
                    }
                  }
                }
                
                // Reset flag after a short delay
                setTimeout(() => {
                  isUserTypingRef.current = false;
                }, 0);
              }}
            />
          </div>
        </div>

        {/* Variable Panel - Below formatting toolbar, on the right */}
        {showVariablePanel && (
          <div className="w-[400px] bg-white border-l border-[#e0dede] shrink-0 flex flex-col overflow-hidden relative">
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-[#e0dede] flex items-center justify-between shrink-0">
              <h3 className="text-sm font-medium text-gray-900">Insert variable</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowVariablePanel(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <VariableDropdown
              availableSteps={generateDocumentVariables()}
              selectedVariables={[]}
              initialSearchQuery=""
              hideSearchInput={false}
              openedViaHotkey={false}
              onSelect={(variables) => {
                if (variables.length > 0 && documentEditorRef.current) {
                  const variable = variables[variables.length - 1];
                  const variableText = `{{${variable.object}.${variable.category}.${variable.field}}}`;
                  
                  // Get display name and breadcrumbs
                  const variableNode = findVariableNode(availableSteps, variable.object, variable.category, variable.field);
                  const displayName = variableNode?.name || variable.field;
                  const breadcrumbs = findBreadcrumbs(availableSteps, variable.object, variable.category, variable.field);
                  
                  // Create chip element
                  const chipContainer = document.createElement("span");
                  chipContainer.className = "variable-chip";
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
                    margin: 0 2px;
                  `;
                  chipContainer.setAttribute("data-chip-full-text", variableText);
                  chipContainer.contentEditable = "false";

                  // Chip text
                  const chipText = document.createElement("span");
                  chipText.style.cssText = `
                    font-family: 'Basel Grotesk', sans-serif;
                    font-weight: 430;
                    font-size: 14px;
                    line-height: 20px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  `;
                  chipText.textContent = displayName;
                  chipContainer.appendChild(chipText);

                  // Close button
                  const closeBtn = document.createElement("button");
                  closeBtn.type = "button";
                  closeBtn.className = "chip-close";
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
                    margin-left: 4px;
                    opacity: 0.6;
                  `;
                  closeBtn.innerHTML = `
                    <svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  `;
                  closeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    chipContainer.remove();
                    setDocumentContent(documentEditorRef.current?.innerHTML || "");
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
                  tooltip.textContent = breadcrumbs;
                  
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

                  chipContainer.addEventListener("mouseenter", () => {
                    tooltip.style.display = "block";
                  });
                  chipContainer.addEventListener("mouseleave", () => {
                    tooltip.style.display = "none";
                  });
                  
                  // Use saved cursor position or current selection
                  const selection = window.getSelection();
                  let range: Range;
                  
                  if (savedCursorRangeRef.current) {
                    // Use saved cursor position
                    range = savedCursorRangeRef.current;
                    // Ensure the range is still valid (content might have changed)
                    try {
                      // Check if range is still valid
                      range.startContainer;
                    } catch (e) {
                      // Range is invalid, create new one at end
                      range = document.createRange();
                      range.selectNodeContents(documentEditorRef.current);
                      range.collapse(false);
                    }
                  } else if (selection && selection.rangeCount > 0) {
                    // Use current selection if available
                    range = selection.getRangeAt(0);
                  } else {
                    // Fallback: insert at end
                    range = document.createRange();
                    range.selectNodeContents(documentEditorRef.current);
                    range.collapse(false);
                  }
                  
                  // Ensure range is within the editor
                  if (!documentEditorRef.current.contains(range.commonAncestorContainer)) {
                    range = document.createRange();
                    range.selectNodeContents(documentEditorRef.current);
                    range.collapse(false);
                  }
                  
                  // Delete any selected content
                  range.deleteContents();
                  
                  // Insert the chip
                  range.insertNode(chipContainer);
                  
                  // Move cursor after inserted chip
                  const textNode = document.createTextNode('\u200B'); // Zero-width space
                  range.setStartAfter(chipContainer);
                  range.setEndAfter(chipContainer);
                  range.insertNode(textNode);
                  range.setStartAfter(textNode);
                  range.collapse(false);
                  
                  // Update selection
                  if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                  
                  // Update content state
                  setDocumentContent(documentEditorRef.current.innerHTML || "");
                  
                  // Focus the editor and restore cursor
                  documentEditorRef.current.focus();
                  setTimeout(() => {
                    if (selection) {
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                  }, 0);
                  
                  // Clear saved cursor
                  savedCursorRangeRef.current = null;
                  setOpenedViaHotkey(false);
                }
                // Close popover after selection
                setShowVariablePopover(false);
                // Don't close panel - user must click X to close
              }}
              onClose={() => {
                setShowVariablePopover(false);
                setOpenedViaHotkey(false);
                // Don't close panel - user must click X to close
              }}
              multiple={false}
              isOpen={true}
              inModal={true}
            />
          </div>
        )}

        {/* Variable Popover - Appears when {{ is typed */}
        {showVariablePopover && (
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
              availableSteps={generateDocumentVariables()}
              selectedVariables={[]}
              initialSearchQuery={variableSearchQuery}
              hideSearchInput={openedViaHotkey}
              openedViaHotkey={openedViaHotkey}
              onSelect={(variables) => {
                if (variables.length > 0 && documentEditorRef.current) {
                  const variable = variables[variables.length - 1];
                  const variableText = `{{${variable.object}.${variable.category}.${variable.field}}}`;
                  
                  // Get display name and breadcrumbs
                  const variableNode = findVariableNode(availableSteps, variable.object, variable.category, variable.field);
                  const displayName = variableNode?.name || variable.field;
                  const breadcrumbs = findBreadcrumbs(availableSteps, variable.object, variable.category, variable.field);
                  
                  // Create chip element
                  const chipContainer = document.createElement("span");
                  chipContainer.className = "variable-chip";
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
                    margin: 0 2px;
                  `;
                  chipContainer.setAttribute("data-chip-full-text", variableText);
                  chipContainer.contentEditable = "false";

                  // Chip text
                  const chipText = document.createElement("span");
                  chipText.style.cssText = `
                    font-family: 'Basel Grotesk', sans-serif;
                    font-weight: 430;
                    font-size: 14px;
                    line-height: 20px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  `;
                  chipText.textContent = displayName;
                  chipContainer.appendChild(chipText);

                  // Close button
                  const closeBtn = document.createElement("button");
                  closeBtn.type = "button";
                  closeBtn.className = "chip-close";
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
                    margin-left: 4px;
                    opacity: 0.6;
                  `;
                  closeBtn.innerHTML = `
                    <svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  `;
                  closeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    chipContainer.remove();
                    setDocumentContent(documentEditorRef.current?.innerHTML || "");
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
                  tooltip.textContent = breadcrumbs;
                  
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

                  chipContainer.addEventListener("mouseenter", () => {
                    tooltip.style.display = "block";
                  });
                  chipContainer.addEventListener("mouseleave", () => {
                    tooltip.style.display = "none";
                  });
                  
                  // Use saved cursor position to replace "{{" and any search text
                  if (savedCursorRangeRef.current && documentEditorRef.current) {
                    // Get current selection to find where to replace (includes any text typed after "{{")
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const currentRange = selection.getRangeAt(0);
                      
                      // Create a range from the saved "{{" position to current cursor
                      const replaceRange = document.createRange();
                      try {
                        replaceRange.setStart(savedCursorRangeRef.current.startContainer, savedCursorRangeRef.current.startOffset);
                        replaceRange.setEnd(currentRange.endContainer, currentRange.endOffset);
                        
                        // Verify the range is valid
                        if (documentEditorRef.current.contains(replaceRange.commonAncestorContainer)) {
                          // Replace everything from "{{" to current cursor with the chip
                          replaceRange.deleteContents();
                          replaceRange.insertNode(chipContainer);
                          
                          // Move cursor after chip
                          const textNodeAfter = document.createTextNode('\u200B');
                          replaceRange.setStartAfter(chipContainer);
                          replaceRange.insertNode(textNodeAfter);
                          replaceRange.setStartAfter(textNodeAfter);
                          replaceRange.collapse(false);
                          
                          selection.removeAllRanges();
                          selection.addRange(replaceRange);
                          
                          // Update content state
                          setDocumentContent(documentEditorRef.current.innerHTML || "");
                          
                          // Focus the editor
                          documentEditorRef.current.focus();
                        } else {
                          throw new Error("Range outside editor");
                        }
                      } catch (e) {
                        // Fallback: try to use saved range only
                        let replaceRange = savedCursorRangeRef.current;
                        
                        try {
                          replaceRange.startContainer;
                          if (!documentEditorRef.current.contains(replaceRange.commonAncestorContainer)) {
                            throw new Error("Range outside editor");
                          }
                          
                          // Replace just "{{"
                          replaceRange.deleteContents();
                          replaceRange.insertNode(chipContainer);
                          
                          const textNodeAfter = document.createTextNode('\u200B');
                          replaceRange.setStartAfter(chipContainer);
                          replaceRange.insertNode(textNodeAfter);
                          replaceRange.setStartAfter(textNodeAfter);
                          replaceRange.collapse(false);
                          
                          if (selection) {
                            selection.removeAllRanges();
                            selection.addRange(replaceRange);
                          }
                          
                          setDocumentContent(documentEditorRef.current.innerHTML || "");
                          documentEditorRef.current.focus();
                        } catch (e2) {
                          // Last resort: find "{{" in text
                          throw e2;
                        }
                      }
                    } else {
                      // No current selection, try to use saved range
                      let replaceRange = savedCursorRangeRef.current;
                      
                      try {
                        replaceRange.startContainer;
                        if (!documentEditorRef.current.contains(replaceRange.commonAncestorContainer)) {
                          throw new Error("Range outside editor");
                        }
                        
                        const rangeText = replaceRange.toString();
                        if (rangeText === "{{" || rangeText.endsWith("{{")) {
                          replaceRange.deleteContents();
                          replaceRange.insertNode(chipContainer);
                          
                          const textNodeAfter = document.createTextNode('\u200B');
                          replaceRange.setStartAfter(chipContainer);
                          replaceRange.insertNode(textNodeAfter);
                          replaceRange.setStartAfter(textNodeAfter);
                          replaceRange.collapse(false);
                          
                          const selection = window.getSelection();
                          if (selection) {
                            selection.removeAllRanges();
                            selection.addRange(replaceRange);
                          }
                          
                          setDocumentContent(documentEditorRef.current.innerHTML || "");
                          documentEditorRef.current.focus();
                        } else {
                          throw new Error("Range doesn't contain {{");
                        }
                      } catch (e) {
                        // Range is invalid or doesn't contain "{{", try to find "{{" in current content
                        const textContent = documentEditorRef.current.textContent || "";
                        const lastOpenBrace = textContent.lastIndexOf("{{");
                        
                        if (lastOpenBrace >= 0) {
                          // Find the DOM position of "{{"
                          const walker = document.createTreeWalker(
                            documentEditorRef.current,
                            NodeFilter.SHOW_TEXT,
                            null
                          );
                          
                          let currentPos = 0;
                          let targetNode: Node | null = null;
                          let targetOffset = 0;
                          
                          while (walker.nextNode()) {
                            const node = walker.currentNode;
                            const nodeLength = node.textContent?.length || 0;
                            
                            if (currentPos + nodeLength >= lastOpenBrace) {
                              targetNode = node;
                              targetOffset = lastOpenBrace - currentPos;
                              break;
                            }
                            
                            currentPos += nodeLength;
                          }
                          
                          if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
                            const textNode = targetNode as Text;
                            const newReplaceRange = document.createRange();
                            newReplaceRange.setStart(textNode, targetOffset);
                            newReplaceRange.setEnd(textNode, Math.min(targetOffset + 2, textNode.length));
                            newReplaceRange.deleteContents();
                            newReplaceRange.insertNode(chipContainer);
                            
                            // Move cursor after chip
                            const textNodeAfter = document.createTextNode('\u200B');
                            newReplaceRange.setStartAfter(chipContainer);
                            newReplaceRange.insertNode(textNodeAfter);
                            newReplaceRange.setStartAfter(textNodeAfter);
                            newReplaceRange.collapse(false);
                            
                            const selection = window.getSelection();
                            if (selection) {
                              selection.removeAllRanges();
                              selection.addRange(newReplaceRange);
                            }
                            
                            setDocumentContent(documentEditorRef.current.innerHTML || "");
                            documentEditorRef.current.focus();
                          }
                        } else {
                          // No "{{" found, just insert at current selection
                          const selection = window.getSelection();
                          if (selection && selection.rangeCount > 0) {
                            const currentRange = selection.getRangeAt(0);
                            currentRange.deleteContents();
                            currentRange.insertNode(chipContainer);
                            
                            const textNodeAfter = document.createTextNode('\u200B');
                            currentRange.setStartAfter(chipContainer);
                            currentRange.insertNode(textNodeAfter);
                            currentRange.setStartAfter(textNodeAfter);
                            currentRange.collapse(false);
                            
                            selection.removeAllRanges();
                            selection.addRange(currentRange);
                            
                            setDocumentContent(documentEditorRef.current.innerHTML || "");
                            documentEditorRef.current.focus();
                          }
                        }
                      }
                    }
                    
                    // Clear saved cursor and search query
                    savedCursorRangeRef.current = null;
                    setOpenedViaHotkey(false);
                    setVariableSearchQuery("");
                  }
                }
                setShowVariablePopover(false);
              }}
              onClose={() => {
                setShowVariablePopover(false);
                setOpenedViaHotkey(false);
                setVariableSearchQuery("");
              }}
              multiple={false}
              isOpen={true}
              inModal={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
