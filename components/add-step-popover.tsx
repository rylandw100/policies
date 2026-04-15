"use client";

import { useMemo, useState } from "react";
import { Search, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ADD_STEP_CATALOG_GROUPS,
  isCatalogItemBasicTier,
  SHOW_WORKFLOW_TIER_CHIPS,
  WORKFLOW_TIER_CHIP_CLASS_ADVANCED,
  WORKFLOW_TIER_CHIP_CLASS_BASIC,
  WORKFLOW_TIER_CHIP_FONT_STYLE,
  type CatalogItemWithCategory,
} from "@/components/add-step-catalog";

type AddStepPopoverProps = {
  className?: string;
  onSelect: (item: CatalogItemWithCategory) => void;
};

/**
 * Searchable step list matching the “Add a step” pane + connector popover (Figma ~11:8956).
 */
export function AddStepPopover({ className, onSelect }: AddStepPopoverProps) {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADD_STEP_CATALOG_GROUPS;
    return ADD_STEP_CATALOG_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.label.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div
      className={cn(
        "flex w-[300px] flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.15)]",
        className
      )}
    >
      <div className="shrink-0 px-4 pb-2 pt-2">
        <div className="flex h-8 items-center gap-1 rounded-md border border-black/20 bg-white px-2">
          <Search className="size-4 shrink-0 text-[#6f6f72]" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-7 border-0 bg-transparent p-0 text-[15px] leading-[19px] text-black shadow-none placeholder:text-[#6f6f72] focus-visible:ring-0"
            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
          />
        </div>
        {SHOW_WORKFLOW_TIER_CHIPS ? (
          <p
            className="mt-2 text-[11px] leading-[14px] text-[#8c8888]"
            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
          >
            <span className="font-medium text-[#595555]">Basic</span> = only with other Basic steps;
            anything else is <span className="font-medium text-[#595555]">Advanced</span>.
          </p>
        ) : null}
      </div>
      <div
        className="max-h-[min(360px,calc(100vh-120px))] overflow-y-auto overscroll-contain px-0 pb-2"
        role="listbox"
        aria-label="Add a step"
      >
        {filteredGroups.map((group) => (
          <div key={group.category} className="mb-1">
            <div
              className="sticky top-0 z-[1] bg-white px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[1.5px] text-[#8c8888]"
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
            >
              {group.category}
            </div>
            <div className="flex flex-col gap-px px-2">
              {group.items.map((item) => {
                const full: CatalogItemWithCategory = {
                  ...item,
                  category: group.category,
                };
                const tierBasic = isCatalogItemBasicTier(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    title={
                      tierBasic
                        ? "Basic-tier step (Basic workflow only if all steps are Basic-tier)."
                        : "Advanced-tier step."
                    }
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#f9f7f6]"
                    onClick={() => onSelect(full)}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      {item.icon}
                    </span>
                    <span
                      className="min-w-0 flex-1 text-[15px] leading-[19px] text-[#252528]"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 400 }}
                    >
                      {item.label}
                    </span>
                    {SHOW_WORKFLOW_TIER_CHIPS ? (
                      <span
                        className={`shrink-0 ${
                          tierBasic
                            ? WORKFLOW_TIER_CHIP_CLASS_BASIC
                            : WORKFLOW_TIER_CHIP_CLASS_ADVANCED
                        }`}
                        style={WORKFLOW_TIER_CHIP_FONT_STYLE}
                      >
                        {tierBasic ? "Basic" : "Advanced"}
                      </span>
                    ) : null}
                    <GripVertical
                      className="size-4 shrink-0 text-[#bfbebe]"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filteredGroups.every((g) => g.items.length === 0) && (
          <p
            className="px-4 py-6 text-center text-sm text-[#8c8888]"
            style={{ fontFamily: "'Basel Grotesk', sans-serif" }}
          >
            No actions match “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}
