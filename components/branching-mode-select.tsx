"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const BRANCHING_MODE_OPTIONS: { value: "exclusive" | "additive"; label: string }[] = [
  { value: "exclusive", label: "Use the first rule that matches" },
  { value: "additive", label: "Use all rules that match" },
];

export function BranchingModeSelect({
  value,
  onChange,
  className,
  popoverAlign = "end",
}: {
  value: "exclusive" | "additive";
  onChange: (next: "exclusive" | "additive") => void;
  className?: string;
  popoverAlign?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const label =
    BRANCHING_MODE_OPTIONS.find((o) => o.value === value)?.label ?? BRANCHING_MODE_OPTIONS[0].label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-[min(280px,28vw)] shrink-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-[#e0dede] bg-white px-2.5 text-left text-[14px] text-[#252528] outline-none transition-colors hover:bg-[#faf9f8] focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/30",
            className
          )}
          style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
          aria-label="Branching mode"
          aria-haspopup="dialog"
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 text-[#8c8888]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={popoverAlign}
        className="w-[min(280px,calc(100vw-2rem))] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div role="listbox" aria-label="Branching mode">
          {BRANCHING_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              className={cn(
                "flex w-full rounded-md px-2.5 py-2 text-left text-[14px] outline-none transition-colors",
                value === opt.value
                  ? "bg-white font-medium text-[#252528] shadow-sm"
                  : "text-[#595555] hover:bg-white/90"
              )}
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
