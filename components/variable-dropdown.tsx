"use client";

import { useState, useMemo, useRef, useEffect, type ReactElement } from "react";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Check,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  Box,
  List,
  ChevronLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VariablePath, VariableNode } from "./variable-picker";
import { TriggerIcon, AIIcon, SMSIcon } from "@/components/icons";

type VariableDropdownProps = {
  availableSteps: VariableNode[];
  selectedVariables: VariablePath[];
  onSelect: (variables: VariablePath[]) => void;
  onClose: () => void;
  multiple?: boolean;
  isOpen: boolean;
  inModal?: boolean;
  initialSearchQuery?: string;
  hideSearchInput?: boolean;
  openedViaHotkey?: boolean;
  breadcrumbMode?: boolean; // New prop for breadcrumb navigation mode
};

export function VariableDropdown({
  availableSteps,
  selectedVariables,
  onSelect,
  onClose,
  multiple = true,
  isOpen,
  inModal = false,
  initialSearchQuery = "",
  hideSearchInput = false,
  openedViaHotkey = false,
  breadcrumbMode = false,
}: VariableDropdownProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  // Auto-expand if only one step, otherwise collapse all
  const shouldAutoExpand = availableSteps.length === 1;
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    shouldAutoExpand && availableSteps[0] 
      ? new Set([`step-${availableSteps[0].id}`]) 
      : new Set()
  );
  const [currentStep, setCurrentStep] = useState<string | null>(
    shouldAutoExpand ? (availableSteps[0]?.id || null) : null
  );
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigableItemsRef = useRef<Array<{ 
    type: 'step' | 'object' | 'category' | 'field';
    nodeId: string;
    path?: VariablePath;
    stepId?: string;
  }>>([]);
  const prevBreadcrumbPathLengthRef = useRef(0);
  const prevNavigableItemsLengthRef = useRef(0);
  
  // Breadcrumb navigation state
  const [breadcrumbPath, setBreadcrumbPath] = useState<Array<{ id: string; name: string; type: string; node: VariableNode }>>([]);
  
  // Reset breadcrumb path when popover closes
  useEffect(() => {
    if (!isOpen && breadcrumbMode) {
      setBreadcrumbPath([]);
      prevBreadcrumbPathLengthRef.current = 0;
      prevNavigableItemsLengthRef.current = 0;
    } else if (isOpen && breadcrumbMode) {
      // Initialize refs when popover opens
      prevBreadcrumbPathLengthRef.current = breadcrumbPath.length;
    }
  }, [isOpen, breadcrumbMode, breadcrumbPath.length]);
  
  // Helper function to recursively search for a node in the tree
  const findNodeRecursive = (node: VariableNode, targetId: string, targetType: string): VariableNode | null => {
    if (node.id === targetId && node.type === targetType) {
      return node;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeRecursive(child, targetId, targetType);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper function to find a node by its path in the tree
  const findNodeByPath = (steps: VariableNode[], path: Array<{ id: string; name: string; type: string }>): VariableNode | null => {
    if (path.length === 0) return null;
    
    const first = path[0];
    
    // First, try to find it at the top level (for steps)
    let currentNode: VariableNode | undefined = steps.find(s => s.id === first.id && s.type === first.type);
    
    // If not found at top level, search recursively through all steps and their children
    if (!currentNode) {
      for (const step of steps) {
        const found = findNodeRecursive(step, first.id, first.type);
        if (found) {
          currentNode = found;
          break;
        }
      }
    }
    
    if (!currentNode) return null;
    
    // Continue with the rest of the path
    for (let i = 1; i < path.length; i++) {
      const pathItem = path[i];
      currentNode = currentNode.children?.find(c => c.id === pathItem.id && c.type === pathItem.type);
      if (!currentNode) return null;
    }
    
    return currentNode;
  };
  
  // Get current level nodes to display in breadcrumb mode
  const getCurrentLevelNodes = (): VariableNode[] => {
    if (!breadcrumbMode) return filteredSteps;
    
    if (breadcrumbPath.length === 0) {
      // Root level - show top-level steps/objects
      return filteredSteps;
    }
    
    // Find the current node based on breadcrumb path
    // Use filteredSteps to respect search, but fall back to availableSteps if not found
    let currentNode = findNodeByPath(filteredSteps, breadcrumbPath);
    if (!currentNode) {
      // If not found in filtered steps (e.g., due to search), try availableSteps
      currentNode = findNodeByPath(availableSteps, breadcrumbPath);
    }
    
    if (!currentNode || !currentNode.children) {
      return [];
    }
    
    // If search is active, filter children by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      return currentNode.children.filter(child => 
        child.name.toLowerCase().includes(searchLower) ||
        (child.children && child.children.some(c => 
          c.name.toLowerCase().includes(searchLower) ||
          (c.type === 'field' && c.path && c.path.field.toLowerCase().includes(searchLower))
        ))
      );
    }
    
    return currentNode.children;
  };
  
  // Handle drill-down navigation
  const handleDrillDown = (node: VariableNode) => {
    if (!breadcrumbMode) return;
    
    if (node.children && node.children.length > 0) {
      // For steps, use stepName if available, otherwise use name
      const displayName = node.type === 'step' && node.stepName ? node.stepName : node.name;
      // Push to breadcrumb path - this will trigger the effect to reset focus
      setBreadcrumbPath(prev => [...prev, { id: node.id, name: displayName, type: node.type, node }]);
    }
  };
  
  // Handle breadcrumb navigation (go back)
  const handleBreadcrumbClick = (index: number) => {
    if (!breadcrumbMode) return;
    
    // Navigate back to the clicked breadcrumb level
    setBreadcrumbPath(prev => prev.slice(0, index + 1));
    // Reset focused index
    if (openedViaHotkey) {
      setFocusedIndex(0);
    }
  };

  // Helper function to recursively collect all node IDs
  const collectAllNodeIds = (node: VariableNode, ids: Set<string> = new Set()): Set<string> => {
    const nodeId = `${node.type}-${node.id}`;
    ids.add(nodeId);
    
    if (node.children) {
      node.children.forEach((child) => {
        collectAllNodeIds(child, ids);
      });
    }
    
    return ids;
  };

  // Only initialize expandedNodes when the popover first opens, not on every render
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    if (isOpen && !hasInitializedRef.current) {
      if (inModal) {
        // Auto-expand everything when in modal/panel mode
        const allNodeIds = new Set<string>();
        availableSteps.forEach((step) => {
          collectAllNodeIds(step, allNodeIds);
        });
        setExpandedNodes(allNodeIds);
        if (availableSteps.length > 0) {
          setCurrentStep(availableSteps[0].id);
        }
      } else {
        // Original behavior for popover mode
        const shouldAutoExpand = availableSteps.length === 1;
        if (shouldAutoExpand && availableSteps[0]) {
          const firstStepId = `${availableSteps[0].type}-${availableSteps[0].id}`;
          // Check if it's a step or an object
          if (availableSteps[0].type === 'step') {
            setCurrentStep(availableSteps[0].id);
            setExpandedNodes(new Set([firstStepId]));
          } else if (availableSteps[0].type === 'object') {
            // For objects, don't set currentStep, but expand the object
            setCurrentStep(null);
            setExpandedNodes(new Set([firstStepId]));
          } else {
            setExpandedNodes(new Set());
            setCurrentStep(null);
          }
        } else {
          // Multiple items (like documents page with Employee + Document custom variables)
          // Don't auto-expand, but ensure objects are in the list
          setExpandedNodes(new Set());
          setCurrentStep(null);
        }
      }
      hasInitializedRef.current = true;
    } else if (!isOpen) {
      // Reset the flag when popover closes so it initializes again on next open
      hasInitializedRef.current = false;
      // Reset focused index when popover closes
      if (openedViaHotkey) {
        setFocusedIndex(-1);
      }
    }
  }, [isOpen, availableSteps, inModal, openedViaHotkey]);

  // Update search query when initialSearchQuery changes
  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // Reset focusedIndex when popover closes via hotkey
  useEffect(() => {
    if (!isOpen && openedViaHotkey) {
      // Reset when popover closes
      setFocusedIndex(-1);
    }
  }, [isOpen, openedViaHotkey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside the dropdown
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking inside a parent container with variable-popover class
      if (target.closest?.('.variable-popover')) {
        return;
      }
      
      // Don't close if clicking on a button (navigation buttons should not close)
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        // Double check it's not inside our dropdown
        if (dropdownRef.current && dropdownRef.current.contains(target)) {
          return;
        }
        // Also check if it's inside a variable-popover
        if (target.closest?.('.variable-popover')) {
          return;
        }
      }
      
      onClose();
    };

    if (isOpen) {
      // Use a longer delay to ensure button clicks are fully processed first
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside, true); // Use capture phase
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside, true);
      };
    }
  }, [isOpen, onClose]);

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Unified function to activate the currently focused item (used by Tab, Enter, and clicks)
  const activateActiveItem = () => {
    if (focusedIndex < 0 || focusedIndex >= navigableItemsRef.current.length) {
      return;
    }

    const focusedItem = navigableItemsRef.current[focusedIndex];
    if (!focusedItem) {
      return;
    }

    if (focusedItem.type === 'field' && focusedItem.path) {
      // Select field
      handleSelect(focusedItem.path);
    } else if (breadcrumbMode) {
      // In breadcrumb mode, drill down into the node
      const currentNode = getCurrentLevelNodes().find(n => `${n.type}-${n.id}` === focusedItem.nodeId);
      if (currentNode) {
        handleDrillDown(currentNode);
      }
    } else if (focusedItem.type === 'step') {
      // Toggle step expansion - match click behavior
      const isCurrentStep = currentStep === focusedItem.stepId;
      const newStep = isCurrentStep ? null : (focusedItem.stepId || null);
      setCurrentStep(newStep);
      if (newStep) {
        // Expand the step
        setExpandedNodes((prev) => {
          const newExpanded = new Set(prev);
          newExpanded.add(focusedItem.nodeId);
          return newExpanded;
        });
      } else {
        // Collapse the step
        setExpandedNodes((prev) => {
          const newExpanded = new Set(prev);
          newExpanded.delete(focusedItem.nodeId);
          return newExpanded;
        });
      }
      // Keep focus on the expanded step (don't move to first child)
    } else if (focusedItem.type === 'object' || focusedItem.type === 'category') {
      // Toggle object/category expansion
      const nodeId = focusedItem.nodeId;
      setExpandedNodes((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId);
        } else {
          newExpanded.add(nodeId);
        }
        return newExpanded;
      });
      // Keep focus on the expanded item (don't move to first child)
    }
  };

  const isSelected = (path: VariablePath) => {
    if (!path) return false;
    return selectedVariables.some(
      (v) =>
        v.step === path.step &&
        v.object === path.object &&
        v.category === path.category &&
        v.field === path.field
    );
  };

  const getSelectionState = (node: VariableNode, stepId: string): "none" | "partial" | "all" => {
    if (node.type === "field" && node.path) {
      return isSelected(node.path) ? "all" : "none";
    }
    
    if (node.children) {
      const childStates = node.children.map((child) => getSelectionState(child, stepId));
      const allSelected = childStates.every((state) => state === "all");
      const someSelected = childStates.some((state) => state === "all" || state === "partial");
      
      if (allSelected) {
        return "all";
      } else if (someSelected) {
        return "partial";
      }
    }
    
    return "none";
  };

  const handleSelect = (path: VariablePath) => {
    if (!path) return;

    if (multiple) {
      const isAlreadySelected = isSelected(path);
      if (isAlreadySelected) {
        onSelect(
          selectedVariables.filter(
            (v) =>
              !(
                v.step === path.step &&
                v.object === path.object &&
                v.category === path.category &&
                v.field === path.field
              )
          )
        );
      } else {
        onSelect([...selectedVariables, path]);
      }
    } else {
      onSelect([path]);
      onClose();
    }
  };

  const handleBulkSelect = (node: VariableNode, stepId: string) => {
    if (!node.children || node.type === "field") return;

    const collectPaths = (n: VariableNode): VariablePath[] => {
      if (n.type === "field" && n.path) {
        return [n.path];
      }
      if (n.children) {
        return n.children.flatMap(collectPaths);
      }
      return [];
    };

    const paths = collectPaths(node);
    const allSelected = paths.every((p) => isSelected(p));

    if (allSelected) {
      const pathStrings = paths.map(
        (p) => `${p.step}.${p.object}.${p.category}.${p.field}`
      );
      const newSelected = selectedVariables.filter(
        (v) =>
          !pathStrings.includes(`${v.step}.${v.object}.${v.category}.${v.field}`)
      );
      onSelect(newSelected);
    } else {
      const newPaths = paths.filter((p) => !isSelected(p));
      onSelect([...selectedVariables, ...newPaths]);
    }
  };

  const filteredSteps = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableSteps;
    }

    const searchLower = searchQuery.toLowerCase();
    
    const filterNode = (node: VariableNode): VariableNode | null => {
      const matchesSearch = node.name.toLowerCase().includes(searchLower);

      // In breadcrumb mode, only show fields when searching
      // In tree mode, show the full tree structure
      if (breadcrumbMode && node.type === "field") {
        return matchesSearch ? node : null;
      }

      if (node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter((n): n is VariableNode => n !== null);

        if (filteredChildren.length > 0 || matchesSearch) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
      }

      // In breadcrumb mode, only return fields; in tree mode, return any matching node
      if (breadcrumbMode && node.type !== "field") {
        return null;
      }

      return matchesSearch ? node : null;
    };

    return availableSteps
      .map((step) => filterNode(step))
      .filter((n): n is VariableNode => n !== null);
  }, [availableSteps, searchQuery, breadcrumbMode]);

  // Collect all navigable items (steps, objects, categories, fields) for keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const collectItems = (node: VariableNode, stepId?: string, level: number = 0): Array<{ 
      type: 'step' | 'object' | 'category' | 'field';
      nodeId: string;
      path?: VariablePath;
      stepId?: string;
    }> => {
      const items: Array<{ 
        type: 'step' | 'object' | 'category' | 'field';
        nodeId: string;
        path?: VariablePath;
        stepId?: string;
      }> = [];
      
      const nodeId = `${node.type}-${node.id}`;
      const currentStepId = node.type === 'step' ? node.id : stepId;
      
      // In breadcrumb mode, only show current level items
      if (breadcrumbMode) {
        // Add the node itself
        if (node.type === 'step') {
          items.push({ type: 'step', nodeId, stepId: node.id });
        } else if (node.type === 'object') {
          items.push({ type: 'object', nodeId, stepId: currentStepId });
        } else if (node.type === 'category') {
          items.push({ type: 'category', nodeId, stepId: currentStepId });
        } else if (node.type === 'field' && node.path) {
          items.push({ type: 'field', nodeId, path: node.path, stepId: currentStepId });
        }
        // Don't recurse in breadcrumb mode - we only show current level
        return items;
      }
      
      // Original tree mode logic
      // Add the node itself if it's visible
      if (node.type === 'step') {
        items.push({ type: 'step', nodeId, stepId: node.id });
      } else if (node.type === 'object') {
        items.push({ type: 'object', nodeId, stepId: currentStepId });
      } else if (node.type === 'category') {
        items.push({ type: 'category', nodeId, stepId: currentStepId });
      } else if (node.type === 'field' && node.path) {
        items.push({ type: 'field', nodeId, path: node.path, stepId: currentStepId });
      }
      
      // Add children only if the node is expanded
      // For steps, also include children if it's the current step
      const isExpanded = expandedNodes.has(nodeId);
      const isCurrentStep = node.type === 'step' && currentStep === node.id;
      
      // Include children if:
      // 1. Node is explicitly expanded, OR
      // 2. It's a step and it's the current step (legacy behavior for step expansion)
      if (node.children && (isExpanded || (node.type === 'step' && isCurrentStep))) {
        node.children.forEach((child) => {
          items.push(...collectItems(child, currentStepId, level + 1));
        });
      }
      
      return items;
    };
    
    const allItems: Array<{ 
      type: 'step' | 'object' | 'category' | 'field';
      nodeId: string;
      path?: VariablePath;
      stepId?: string;
    }> = [];
    
    // In breadcrumb mode, use current level nodes
    const nodesToProcess = breadcrumbMode ? getCurrentLevelNodes() : filteredSteps;
    
    nodesToProcess.forEach((step) => {
      allItems.push(...collectItems(step));
    });
    
    navigableItemsRef.current = allItems;
    
    // In breadcrumb mode, reset focus when items change (new level loaded)
    if (breadcrumbMode && isOpen && allItems.length > 0) {
      // Check if items changed (new level) or breadcrumb path changed
      const itemsChanged = allItems.length !== prevNavigableItemsLengthRef.current;
      const pathChanged = breadcrumbPath.length !== prevBreadcrumbPathLengthRef.current;
      
      if (itemsChanged || pathChanged) {
        // Reset focus to first item when drilling down or navigating back
        setFocusedIndex(0);
        prevNavigableItemsLengthRef.current = allItems.length;
        prevBreadcrumbPathLengthRef.current = breadcrumbPath.length;
      }
    }
    
    // Set initial focus to first item when popover opens
    // This effect should run whenever the list changes or when the popover opens
    if (allItems.length > 0 && isOpen) {
      if (focusedIndex === -1) {
        // Always set to 0 if we're at -1 (first time opening or after close)
        setFocusedIndex(0);
        prevNavigableItemsLengthRef.current = allItems.length;
      } else if (focusedIndex >= allItems.length) {
        // List got shorter (e.g., after filtering) - clamp to last item
        setFocusedIndex(Math.max(0, allItems.length - 1));
      }
    }
  }, [filteredSteps, openedViaHotkey, expandedNodes, currentStep, isOpen, focusedIndex, breadcrumbMode, breadcrumbPath]);



  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFocusedIndex((prev) => {
          const next = prev < navigableItemsRef.current.length - 1 ? prev + 1 : prev;
          // Scroll into view within the dropdown container
          const item = navigableItemsRef.current[next];
          if (item) {
            const element = document.querySelector(`[data-navigable-id="${item.nodeId}"]`) as HTMLElement;
            if (element) {
              // Find the scrollable container - look for the overflow-y-auto div inside the dropdown
              const scrollContainer = dropdownRef.current?.querySelector('.overflow-y-auto') as HTMLElement;
              if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();
                
                // Check if element is outside visible area
                if (elementRect.bottom > containerRect.bottom) {
                  // Scroll the container, not the page
                  const elementOffsetTop = element.offsetTop;
                  const containerHeight = scrollContainer.clientHeight;
                  scrollContainer.scrollTo({
                    top: elementOffsetTop - containerHeight + element.offsetHeight + 20,
                    behavior: "smooth"
                  });
                } else if (elementRect.top < containerRect.top) {
                  // Scroll the container, not the page
                  const elementOffsetTop = element.offsetTop;
                  scrollContainer.scrollTo({
                    top: elementOffsetTop - 20,
                    behavior: "smooth"
                  });
                }
              } else {
                // Fallback: use scrollIntoView but with preventDefault already called
                element.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }
            }
          }
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          // Scroll into view within the dropdown container
          const item = navigableItemsRef.current[next];
          if (item) {
            const element = document.querySelector(`[data-navigable-id="${item.nodeId}"]`) as HTMLElement;
            if (element) {
              // Find the scrollable container - look for the overflow-y-auto div inside the dropdown
              const scrollContainer = dropdownRef.current?.querySelector('.overflow-y-auto') as HTMLElement;
              if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();
                
                // Check if element is outside visible area
                if (elementRect.bottom > containerRect.bottom) {
                  // Scroll the container, not the page
                  const elementOffsetTop = element.offsetTop;
                  const containerHeight = scrollContainer.clientHeight;
                  scrollContainer.scrollTo({
                    top: elementOffsetTop - containerHeight + element.offsetHeight + 20,
                    behavior: "smooth"
                  });
                } else if (elementRect.top < containerRect.top) {
                  // Scroll the container, not the page
                  const elementOffsetTop = element.offsetTop;
                  scrollContainer.scrollTo({
                    top: elementOffsetTop - 20,
                    behavior: "smooth"
                  });
                }
              } else {
                // Fallback: use scrollIntoView but with preventDefault already called
                element.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }
            }
          }
          return next;
        });
      } else if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Use unified activation function
        activateActiveItem();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // Use capture phase to catch TAB before browser handles it
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [openedViaHotkey, isOpen, focusedIndex, multiple, selectedVariables, onSelect, onClose, expandedNodes, currentStep]);

  // Auto-expand nodes when searching
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const nodesToExpand = new Set<string>();
    
    const findMatchingNodes = (node: VariableNode, parentIds: string[] = []) => {
      const nodeId = `${node.type}-${node.id}`;
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (node.type === "field" && matchesSearch) {
        // Expand all parent nodes to show this field
        parentIds.forEach((parentId) => {
          nodesToExpand.add(parentId);
        });
        nodesToExpand.add(nodeId);
      }

      if (node.children) {
        const newParentIds = [...parentIds, nodeId];
        node.children.forEach((child) => {
          findMatchingNodes(child, newParentIds);
        });
        
        // If any children match, expand this node
        const hasMatchingChildren = node.children.some((child) => {
          const checkMatch = (n: VariableNode): boolean => {
            if (n.name.toLowerCase().includes(searchQuery.toLowerCase())) {
              return true;
            }
            if (n.children) {
              return n.children.some(checkMatch);
            }
            return false;
          };
          return checkMatch(child);
        });
        
        if (hasMatchingChildren) {
          nodesToExpand.add(nodeId);
        }
      }
    };

    availableSteps.forEach((step) => {
      findMatchingNodes(step);
      if (nodesToExpand.size > 0) {
        nodesToExpand.add(`step-${step.id}`);
        if (filteredSteps.length > 0 && filteredSteps[0].id === step.id) {
          setCurrentStep(step.id);
        }
      }
    });

    if (nodesToExpand.size > 0) {
      setExpandedNodes(nodesToExpand);
    }
  }, [searchQuery, availableSteps, filteredSteps]);

  const getFieldTypeIcon = (fieldType?: string) => {
    const iconClass = "size-4 text-gray-600 flex-shrink-0";
    switch (fieldType) {
      case "string":
        return <Type className={iconClass} />;
      case "number":
        return <Hash className={iconClass} />;
      case "date":
        return <Calendar className={iconClass} />;
      case "boolean":
        return <ToggleLeft className={iconClass} />;
      case "object":
        return <Box className={iconClass} />;
      case "array":
        return <List className={iconClass} />;
      default:
        return <Type className={iconClass} />;
    }
  };

  const getStepIcon = (stepIcon?: string) => {
    const iconClass = "size-5 text-gray-700";
    switch (stepIcon) {
      case "zap":
        return <TriggerIcon className={iconClass} />;
      case "sparkles":
        return <AIIcon className={iconClass} />;
      case "smartphone":
        return <SMSIcon className={iconClass} />;
      default:
        return null;
    }
  };

  const getSelectionPath = (node: VariableNode, pathParts: string[] = []): string => {
    if (node.type === "field" && node.path) {
      return `${node.path.object} > ${node.path.category} > ${node.path.field}`;
    }
    return pathParts.join(" > ");
  };

  // Get full breadcrumb path for a field (including step name)
  const getFieldBreadcrumbPath = (node: VariableNode): string[] => {
    if (!node.path) return [];
    
    const path: string[] = [];
    
    // Find the step name
    const step = availableSteps.find(s => s.id === node.path!.step);
    if (step) {
      path.push(step.stepName || step.name);
    }
    
    // Add object, category, and field
    path.push(node.path.object);
    path.push(node.path.category);
    path.push(node.path.field);
    
    return path;
  };

  // Get breadcrumb path for any node by traversing up the tree
  const getNodeBreadcrumbPath = (node: VariableNode, targetNode: VariableNode, currentPath: string[] = []): string[] | null => {
    const newPath = [...currentPath, node.stepName || node.name];
    
    if (node.id === targetNode.id && node.type === targetNode.type) {
      return newPath;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const result = getNodeBreadcrumbPath(child, targetNode, newPath);
        if (result) return result;
      }
    }
    
    return null;
  };

  // Get breadcrumb path for a node (object or category) in search results
  const getNodePathForSearch = (node: VariableNode): string[] => {
    // For fields, use the path property
    if (node.type === 'field' && node.path) {
      return getFieldBreadcrumbPath(node);
    }
    
    // For other nodes, search through the tree
    for (const step of availableSteps) {
      const path = getNodeBreadcrumbPath(step, node);
      if (path) return path;
    }
    
    return [node.name];
  };

  const renderNode = (node: VariableNode, level: number = 0, parentPath: string[] = []): ReactElement | null => {
    const nodeId = `${node.type}-${node.id}`;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(nodeId);
    const isField = node.type === "field";
    const currentPath = [...parentPath, node.name];

    if (node.type === "step") {
      const isCurrentStep = currentStep === node.id;
      const isFocused = focusedIndex >= 0 && navigableItemsRef.current[focusedIndex]?.nodeId === nodeId;
      return (
        <div key={nodeId} className="mb-0.5">
          <button
            type="button"
            data-navigable-id={nodeId}
            onClick={() => {
              const newStep = isCurrentStep ? null : node.id;
              setCurrentStep(newStep);
              if (newStep) {
                setExpandedNodes(new Set([nodeId]));
              } else {
                setExpandedNodes(new Set());
              }
            }}
            onMouseEnter={() => {
              if (openedViaHotkey) {
                const index = navigableItemsRef.current.findIndex(item => item.nodeId === nodeId);
                if (index >= 0) {
                  setFocusedIndex(index);
                }
              }
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-gray-50 text-left transition-colors group",
              isCurrentStep && "bg-gray-50",
              isFocused && "bg-blue-50"
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {getStepIcon(node.stepIcon)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {node.stepName || node.name}
                  </span>
                  {node.stepId && (
                    <span className="text-xs text-gray-500">{node.stepId}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{node.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "transition-opacity",
                isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                <span className="text-[10px] font-medium text-white bg-gray-600 px-1.5 py-0.5 rounded">
                  TAB
                </span>
              </div>
              {isCurrentStep ? (
                <ChevronDown className="size-4 text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronRight className="size-4 text-gray-500 flex-shrink-0" />
              )}
            </div>
          </button>
          {isCurrentStep && node.children && (
            <div className="mt-0.5">
              {node.children.map((child) => renderNode(child, 0, [node.name]))}
            </div>
          )}
        </div>
      );
    }

    // Filter by step only if we have a currentStep set (for step-based filtering)
    // For objects at the top level (like in documents page), currentStep is null, so don't filter
    // In breadcrumb mode, don't filter by step - show all children of the current breadcrumb level
    if (!breadcrumbMode && node.path && currentStep !== null && currentStep !== node.path.step) {
      return null;
    }

    const selectionState = getSelectionState(node, currentStep || "");
    const isFullySelected = selectionState === "all";
    const isPartiallySelected = selectionState === "partial";

    // Calculate indentation based on level
    const indentWidth = level * 24;
    const isFocused = focusedIndex >= 0 && navigableItemsRef.current[focusedIndex]?.nodeId === nodeId;
    
    return (
      <div key={nodeId} className="relative">
        {/* Vertical line for hierarchy */}
        {level > 0 && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-px bg-gray-200"
            style={{ left: `${indentWidth - 8}px` }}
          />
        )}
        
        <div className={cn("py-0", level > 0 && !breadcrumbMode && "pl-6")}>
          {breadcrumbMode && !isField ? (
            // In breadcrumb mode, make the entire row clickable for non-field items
            <button
              type="button"
              data-navigable-id={nodeId}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                  e.nativeEvent.stopImmediatePropagation();
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                  e.nativeEvent.stopImmediatePropagation();
                }
                if (hasChildren) {
                  handleDrillDown(node);
                }
              }}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md transition-colors group text-left",
                "hover:bg-gray-100",
                isFocused && "bg-blue-50"
              )}
              onMouseEnter={() => {
                const index = navigableItemsRef.current.findIndex(item => item.nodeId === nodeId);
                if (index >= 0) {
                  setFocusedIndex(index);
                }
              }}
            >
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm text-gray-900 font-medium truncate">
                  {node.name}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className={cn(
                  "transition-opacity",
                  isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <span className="text-[10px] font-medium text-white bg-gray-600 px-1.5 py-0.5 rounded">
                    TAB
                  </span>
                </div>
                <ChevronRight className="size-4 text-gray-400 flex-shrink-0" />
              </div>
            </button>
          ) : (
            <div
              data-navigable-id={nodeId}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-md transition-colors group",
                isField ? "hover:bg-blue-50" : "hover:bg-gray-50",
                isFocused && "bg-blue-50"
              )}
              onMouseEnter={() => {
                const index = navigableItemsRef.current.findIndex(item => item.nodeId === nodeId);
                if (index >= 0) {
                  setFocusedIndex(index);
                }
              }}
            >
              {breadcrumbMode && hasChildren ? (
                <ChevronRight className="size-4 text-gray-400 flex-shrink-0" />
              ) : !breadcrumbMode && hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(nodeId);
                  }}
                  className="p-0.5 hover:bg-gray-100 rounded flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="size-4 text-gray-500" />
                  )}
                </button>
              ) : breadcrumbMode && isField ? (
                null
              ) : (
                <div className="w-5 flex-shrink-0" />
              )}

            {isField && node.path ? (
              <div
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1 rounded-md flex-1 min-w-0 cursor-pointer transition-colors relative group",
                  isSelected(node.path)
                    ? "bg-[#512f3e]/10 border border-[#512f3e]/30"
                    : "bg-gray-50 border border-gray-200 hover:border-gray-300"
                )}
                onClick={() => {
                  if (node.path) {
                    handleSelect(node.path);
                  }
                }}
              >
                {getFieldTypeIcon(node.fieldType)}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-medium truncate",
                    isSelected(node.path) ? "text-[#512f3e]" : "text-gray-900"
                  )}>
                    {node.name}
                  </div>
                  {breadcrumbMode && searchQuery.trim() && (
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {getFieldBreadcrumbPath(node).join(" > ")}
                    </div>
                  )}
                </div>
                <div className={cn(
                  "transition-opacity",
                  isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <span className="text-[10px] font-medium text-white bg-gray-600 px-1.5 py-0.5 rounded">
                    TAB
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                    e.nativeEvent.stopImmediatePropagation();
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                    e.nativeEvent.stopImmediatePropagation();
                  }
                  if (breadcrumbMode && hasChildren) {
                    handleDrillDown(node);
                  } else if (!breadcrumbMode && hasChildren) {
                    toggleExpanded(nodeId);
                  }
                }}
                className={cn(
                  "flex-1 flex items-center justify-between gap-2 text-left min-w-0 cursor-pointer",
                  breadcrumbMode && hasChildren && "hover:bg-gray-100"
                )}
              >
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm text-gray-900 font-medium truncate">
                    {node.name}
                  </div>
                  {breadcrumbMode && searchQuery.trim() && !isField && (
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {getNodePathForSearch(node).join(" > ")}
                    </div>
                  )}
                </div>
                {breadcrumbMode && hasChildren && (
                  <ChevronRight className="size-4 text-gray-400 flex-shrink-0" />
                )}
                <div className={cn(
                  "transition-opacity flex-shrink-0",
                  isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  <span className="text-[10px] font-medium text-white bg-gray-600 px-1.5 py-0.5 rounded">
                    TAB
                  </span>
                </div>
              </button>
            )}
          </div>
          )}
        </div>

        {!breadcrumbMode && hasChildren && isExpanded && (
          <div className="mt-0 relative">
            {node.children?.map((child) => renderNode(child, level + 1, currentPath))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  // Flatten all matching nodes when searching to show a flat list of results
  // Only include fields (variables), not categories or objects
  const flattenSearchResults = (nodes: VariableNode[]): VariableNode[] => {
    const results: VariableNode[] = [];
    
    const traverse = (node: VariableNode) => {
      // Only add fields (variables) to search results, skip categories and objects
      if (node.type === 'field') {
        results.push(node);
      }
      
      // Recursively traverse children to find all fields
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    
    nodes.forEach(traverse);
    return results;
  };

  // Check if there are any actual matching variables (fields) in the results
  // This is important because in tree mode, parent nodes might match but have no matching fields
  const hasMatchingVariables = useMemo(() => {
    if (!searchQuery.trim()) return true;
    
    const checkForFields = (nodes: VariableNode[]): boolean => {
      for (const node of nodes) {
        if (node.type === 'field') {
          return true;
        }
        if (node.children && checkForFields(node.children)) {
          return true;
        }
      }
      return false;
    };
    
    return checkForFields(filteredSteps);
  }, [filteredSteps, searchQuery]);

  // In breadcrumb mode, use current level nodes unless searching
  // When searching in breadcrumb mode, show all matching results flattened (not just current level)
  // In tree mode, always show the filtered tree structure
  const currentLevelNodes = breadcrumbMode && !searchQuery.trim() 
    ? getCurrentLevelNodes() 
    : breadcrumbMode && searchQuery.trim()
      ? flattenSearchResults(filteredSteps)
      : filteredSteps;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "flex flex-col",
        inModal 
          ? "relative h-full" 
          : "bg-white rounded-lg shadow-lg border border-[#e0dede] z-50 max-h-[400px] absolute top-full left-0 right-0 mt-1"
      )}
    >
        {!hideSearchInput && (
          <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "h-9 text-sm border-gray-200 focus:border-[#512f3e] focus:ring-[#512f3e]/20",
                searchQuery.trim() ? "pl-9 pr-9" : "pl-9"
              )}
              autoFocus
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4 text-gray-400" />
              </button>
            )}
          </div>
          {breadcrumbMode && searchQuery.trim() && (
            <div className="mt-2 text-xs text-gray-500">
              {currentLevelNodes.length} {currentLevelNodes.length === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb trail */}
      {breadcrumbMode && breadcrumbPath.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setBreadcrumbPath([]);
              if (openedViaHotkey) {
                setFocusedIndex(0);
              }
            }}
            className="text-xs text-gray-600 hover:text-gray-900 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
          >
            All
          </button>
          {breadcrumbPath.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-gray-400" />
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(index)}
                className="text-xs text-gray-600 hover:text-gray-900 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {searchQuery.trim() && !hasMatchingVariables ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Search className="size-12 text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-900 mb-1">No results found</p>
            <p className="text-xs text-gray-500 text-center">
              No variables match "{searchQuery}". Try a different search term.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {currentLevelNodes.map((step) => {
              // Handle both steps and objects at the top level
              const nodeId = `${step.type}-${step.id}`;
              const isCurrentStep = step.type === 'step' && currentStep === step.id;
              const isExpanded = expandedNodes.has(nodeId);
              
              const getStepIcon = (stepIcon?: string) => {
                const iconClass = "size-5 text-gray-700";
                switch (stepIcon) {
                  case "zap":
                    return <TriggerIcon className={iconClass} />;
                  case "sparkles":
                    return <AIIcon className={iconClass} />;
                  case "smartphone":
                    return <SMSIcon className={iconClass} />;
                  default:
                    return null;
                }
              };

              const isFocused = focusedIndex >= 0 && navigableItemsRef.current[focusedIndex]?.nodeId === nodeId;
              
              // For steps, use the existing step rendering logic
              if (step.type === 'step') {
                return (
                  <div key={nodeId} className="mb-0.5">
                    <button
                      type="button"
                      data-navigable-id={nodeId}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                          e.nativeEvent.stopImmediatePropagation();
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                          e.nativeEvent.stopImmediatePropagation();
                        }
                        if (breadcrumbMode) {
                          // In breadcrumb mode, always drill down into steps that have children
                          if (step.children && step.children.length > 0) {
                            handleDrillDown(step);
                          }
                        } else {
                          // In tree mode, toggle step expansion
                          const newStep = isCurrentStep ? null : step.id;
                          setCurrentStep(newStep);
                          if (newStep) {
                            setExpandedNodes(new Set([nodeId]));
                          } else {
                            setExpandedNodes(new Set());
                          }
                        }
                      }}
                      onMouseEnter={() => {
                        if (openedViaHotkey) {
                          const index = navigableItemsRef.current.findIndex(item => item.nodeId === nodeId);
                          if (index >= 0) {
                            setFocusedIndex(index);
                          }
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-gray-50 text-left transition-colors group",
                        isCurrentStep && "bg-gray-50",
                        isFocused && "bg-blue-50"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getStepIcon(step.stepIcon)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {step.stepName || step.name}
                            </span>
                            {step.stepId && (
                              <span className="text-xs text-gray-500">{step.stepId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "transition-opacity",
                          isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                          <span className="text-[10px] font-medium text-white bg-gray-600 px-1.5 py-0.5 rounded">
                            TAB
                          </span>
                        </div>
                        {breadcrumbMode && step.children && step.children.length > 0 ? (
                          <ChevronRight className="size-4 text-gray-500 flex-shrink-0" />
                        ) : isCurrentStep ? (
                          <ChevronDown className="size-4 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 text-gray-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                    {!breadcrumbMode && isCurrentStep && step.children && (
                      <div className="mt-0.5">
                        {step.children.map((child) => renderNode(child, 0, [step.name]))}
                      </div>
                    )}
                  </div>
                );
              }
              
              // For objects at the top level (like in documents page), use renderNode
              return renderNode(step, 0, []);
            })}
          </div>
        )}
      </div>
    </div>
  );
}

