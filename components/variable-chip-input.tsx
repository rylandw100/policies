"use client";

import { useRef, ReactNode } from "react";
import { X, ChevronDown, Type, Hash, Calendar, ToggleLeft, Box, List } from "lucide-react";
import { VariablePath } from "./variable-picker";
import { cn } from "@/lib/utils";

type VariableChipInputProps = {
  selectedVariables: VariablePath[];
  onRemove: (path: VariablePath) => void;
  onFocus: () => void;
  isFocused: boolean;
  placeholder?: string;
  className?: string;
  children?: ReactNode;
};

export function VariableChipInput({
  selectedVariables,
  onRemove,
  onFocus,
  isFocused,
  placeholder = "Select variables...",
  className,
  children,
}: VariableChipInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const formatVariablePath = (path: VariablePath): string => {
    return `${path.object} > ${path.category} > ${path.field}`;
  };

  const getFieldTypeIcon = (fieldType?: string) => {
    const iconClass = "size-3 text-[#512f3e]";
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

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          "min-h-[40px] w-full border rounded-lg bg-white p-2 flex flex-wrap gap-2 items-center cursor-text transition-colors",
          isFocused
            ? "border-[#1e4aa9] border-2 ring-2 ring-[#1e4aa9]/20"
            : "border-black/20",
          className
        )}
        onClick={onFocus}
        onFocus={onFocus}
        tabIndex={0}
      >
        {selectedVariables.length === 0 ? (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        ) : (
          selectedVariables.map((path, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#512f3e]/10 border border-[#512f3e]/20 rounded-md text-sm group hover:bg-[#512f3e]/15 transition-colors"
            >
              <span className="text-[#512f3e] font-medium">{formatVariablePath(path)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(path);
                }}
                className="hover:bg-[#512f3e]/20 rounded p-0.5 transition-colors"
              >
                <X className="size-3.5 text-[#512f3e]" />
              </button>
            </div>
          ))
        )}
      </div>
      <ChevronDown
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 size-5 pointer-events-none transition-transform",
          isFocused && "rotate-180"
        )}
      />
      {children}
    </div>
  );
}

