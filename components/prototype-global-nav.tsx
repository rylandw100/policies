"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PrototypeExperience = "old" | "new";

export function ExperienceToggle({
  value,
  onChange,
}: {
  value: PrototypeExperience;
  onChange: (next: PrototypeExperience) => void;
}) {
  return (
    <div
      className="inline-flex rounded-md border border-[#e0dede] bg-white p-px"
      role="group"
      aria-label="Prototype experience"
    >
      {(["old", "new"] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "rounded-[5px] px-2 py-0.5 text-[12px] font-medium leading-tight transition-colors",
            value === key
              ? "bg-[#7A005D]/10 text-[#7A005D]"
              : "text-[#595555] hover:bg-[#ececec]"
          )}
        >
          {key === "old" ? "OLD" : "NEW"}
        </button>
      ))}
    </div>
  );
}

/**
 * Shared global nav — white bar with bottom border.
 */
export function PrototypeGlobalNav({
  experience,
  onExperienceChange,
  /** Before OLD/NEW toggle (e.g. workflow assistant). */
  leadingActions,
}: {
  experience: PrototypeExperience;
  onExperienceChange: (next: PrototypeExperience) => void;
  leadingActions?: ReactNode;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-end gap-2 border-b border-[#e0dede] bg-white px-2.5 text-[#252528] sm:gap-3 sm:px-3">
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5">
        {leadingActions}
        <ExperienceToggle value={experience} onChange={onExperienceChange} />
      </div>
    </header>
  );
}
