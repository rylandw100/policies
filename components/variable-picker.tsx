"use client";

import { useState, useMemo, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type VariablePath = {
  step: string;
  object: string;
  category: string;
  field: string;
};

export type VariableNode = {
  id: string;
  name: string;
  type: "step" | "object" | "category" | "field";
  children?: VariableNode[];
  path?: VariablePath;
  fieldType?: "string" | "number" | "boolean" | "date" | "object" | "array";
  stepName?: string; // Display name for the step (e.g., "Summarize 1")
  stepId?: string; // Step ID (e.g., "ID: 12")
  stepIcon?: "zap" | "sparkles" | "smartphone"; // Icon type for the step
};

type VariablePickerProps = {
  availableSteps: VariableNode[];
  selectedVariables: VariablePath[];
  onSelect: (variables: VariablePath[]) => void;
  onClose: () => void;
  multiple?: boolean;
};

export function VariablePicker({
  availableSteps,
  selectedVariables,
  onSelect,
  onClose,
  multiple = true,
}: VariablePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    availableSteps[0] ? new Set([`step-${availableSteps[0].id}`]) : new Set()
  );
  const [currentStep, setCurrentStep] = useState<string | null>(
    availableSteps[0]?.id || null
  );

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
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

  const isPartiallySelected = (node: VariableNode, stepId: string): boolean => {
    if (node.type === "field" && node.path) {
      return isSelected(node.path);
    }
    if (node.children) {
      return node.children.some((child) => isPartiallySelected(child, stepId));
    }
    return false;
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
      // Deselect all
      const pathStrings = paths.map(
        (p) => `${p.step}.${p.object}.${p.category}.${p.field}`
      );
      const newSelected = selectedVariables.filter(
        (v) =>
          !pathStrings.includes(`${v.step}.${v.object}.${v.category}.${v.field}`)
      );
      onSelect(newSelected);
    } else {
      // Select all
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

      if (node.type === "field") {
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

      return matchesSearch ? node : null;
    };

    return availableSteps.map(filterNode).filter((n): n is VariableNode => n !== null);
  }, [availableSteps, searchQuery]);

  const currentStepData = filteredSteps.find((s) => s.id === currentStep);

  const renderNode = (node: VariableNode, level: number = 0): ReactElement | null => {
    const nodeId = `${node.type}-${node.id}`;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(nodeId);
    const isField = node.type === "field";
    const isPartially = isPartiallySelected(node, currentStep || "");

    if (node.type === "step") {
      const isCurrentStep = currentStep === node.id;
      return (
        <div key={nodeId} className="mb-2">
          <button
            onClick={() => {
              const newStep = isCurrentStep ? null : node.id;
              setCurrentStep(newStep);
              if (newStep) {
                setExpandedNodes(new Set([nodeId]));
              } else {
                setExpandedNodes(new Set());
              }
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100 text-left",
              isCurrentStep && "bg-gray-100"
            )}
          >
            <span className="font-medium text-sm">{node.name}</span>
            {isCurrentStep ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
          {isCurrentStep && node.children && (
            <div className="mt-2 ml-4">
              {node.children.map((child) => renderNode(child, 0))}
            </div>
          )}
        </div>
      );
    }

    // Only render nodes that belong to the current step
    if (node.path && currentStep !== node.path.step) {
      return null;
    }

    return (
      <div key={nodeId} className={cn(level > 0 && "ml-4")}>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer group",
            isField && "hover:bg-gray-100"
          )}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(nodeId)}
              className="p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="size-4 text-gray-500" />
              ) : (
                <ChevronRight className="size-4 text-gray-500" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}

          <button
            onClick={() => {
              if (isField && node.path) {
                handleSelect(node.path);
              } else if (hasChildren) {
                handleBulkSelect(node, currentStep || "");
              }
            }}
            className="flex-1 flex items-center gap-2 text-left"
          >
            {isField && node.path && (
              <div
                className={cn(
                  "size-4 rounded border flex items-center justify-center",
                  isSelected(node.path)
                    ? "bg-[#512f3e] border-[#512f3e]"
                    : "border-gray-300"
                )}
              >
                {isSelected(node.path) && (
                  <Check className="size-3 text-white" />
                )}
              </div>
            )}
            {!isField && (
              <div
                className={cn(
                  "size-4 rounded border flex items-center justify-center",
                  isPartially
                    ? "bg-[#512f3e] border-[#512f3e]"
                    : "border-gray-300"
                )}
              >
                {isPartially && <Check className="size-3 text-white" />}
              </div>
            )}
            <span className="text-sm text-gray-700">{node.name}</span>
            {!isField && (
              <span className="text-xs text-gray-400 ml-auto">
                {node.children?.length || 0}
              </span>
            )}
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.children?.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-[600px] max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-[#e0dede] flex items-center justify-between">
          <h3 className="text-lg font-medium">Select Variables</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 border-b border-[#e0dede]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search steps, objects, categories, fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredSteps.map((step) => renderNode(step))}
          </div>
        </div>

        <div className="p-4 border-t border-[#e0dede] flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedVariables.length} variable{selectedVariables.length !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-[#512f3e] text-white hover:bg-[#512f3e]/90"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

