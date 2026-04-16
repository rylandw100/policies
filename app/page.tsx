"use client";

import {
  createElement,
  Fragment,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BranchingModeSelect } from "@/components/branching-mode-select";
import {
  PrototypeGlobalNav,
  type PrototypeExperience,
} from "@/components/prototype-global-nav";
import { PolicyApprovalsIcon } from "@/components/policy-approvals-icon";
import { cn } from "@/lib/utils";

/** Filled “body text” lines for the policy description row (replaces hamburger menu icon). */
function PolicyCardDescriptionLinesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M13 19.25V20.75H3V19.25H13Z" fill="currentColor" />
      <path d="M21 16.75H3V15.25H21V16.75Z" fill="currentColor" />
      <path d="M21 12.75H3V11.25H21V12.75Z" fill="currentColor" />
      <path d="M21 8.75H3V7.25H21V8.75Z" fill="currentColor" />
      <path d="M21 4.75H3V3.25H21V4.75Z" fill="currentColor" />
    </svg>
  );
}

/** Filled audience / “policy applies to” mark (replaces Lucide Users). */
function PolicyCardAudienceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 4.625C6.255 4.625 4.812 6.076 4.812 7.901C4.812 9.726 6.255 11.177 8 11.177C9.745 11.177 11.188 9.726 11.188 7.901C11.188 6.076 9.745 4.625 8 4.625ZM3.312 7.901C3.312 5.279 5.395 3.125 7.999 3.125C10.603 3.125 12.686 5.279 12.686 7.901C12.686 10.523 10.603 12.677 7.999 12.677C5.395 12.677 3.312 10.523 3.312 7.901ZM0.25 19.98C0.25 16.617 2.921 13.862 6.25 13.862H9.75C11.556 13.862 13.168 14.673 14.266 15.952C14.804 15.741 15.389 15.625 16 15.625H19C21.623 15.625 23.75 17.752 23.75 20.375V20.875H22.25V20.375C22.25 18.58 20.795 17.125 19 17.125H16C15.694 17.125 15.399 17.167 15.119 17.246C15.524 18.07 15.751 18.999 15.751 19.981V20.876H14.251V19.981C14.251 17.414 12.221 15.363 9.751 15.363H6.251C3.781 15.363 1.751 17.415 1.751 19.981V20.876H0.251V19.981L0.25 19.98ZM15.25 10.875C15.25 9.632 16.257 8.625 17.5 8.625C18.743 8.625 19.75 9.632 19.75 10.875C19.75 12.118 18.743 13.125 17.5 13.125C16.257 13.125 15.25 12.118 15.25 10.875ZM17.5 7.125C15.429 7.125 13.75 8.804 13.75 10.875C13.75 12.946 15.429 14.625 17.5 14.625C19.571 14.625 21.25 12.946 21.25 10.875C21.25 8.804 19.571 7.125 17.5 7.125Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Filled trigger / “when this happens” mark (replaces Lucide Split). */
function PolicyCardWhenHappensIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M14.3722 0.320312L13.1542 9.24931H20.7772L9.62717 23.6783L10.8452 14.7493H3.22217L14.3722 0.320312ZM6.27717 13.2493H12.5632L11.8712 18.3203L17.7212 10.7493H11.4352L12.1262 5.67831L6.27717 13.2493Z"
        fill="currentColor"
      />
    </svg>
  );
}

type PolicyCardSectionRowIcon =
  | LucideIcon
  | "description-lines"
  | "policy-audience"
  | "when-happens"
  | "step-approvals";

/** Matches Figma `Policy.Card / And.Or` — icon + vertical rule + content per row ([node](https://www.figma.com/design/QpcKUPO8RpJ14eUEYgY97M/%E2%9C%85-Approval?node-id=14793-121753)). */
function PolicyCardSectionRow({
  icon,
  children,
}: {
  icon: PolicyCardSectionRowIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-4">
      <div className="flex w-6 shrink-0 justify-center pt-0.5">
        {icon === "description-lines" ? (
          <PolicyCardDescriptionLinesIcon className="size-6 shrink-0 text-[#a8a4a4]" />
        ) : icon === "policy-audience" ? (
          <PolicyCardAudienceIcon className="size-6 shrink-0 text-[#a8a4a4]" />
        ) : icon === "when-happens" ? (
          <PolicyCardWhenHappensIcon className="size-6 shrink-0 text-[#a8a4a4]" />
        ) : icon === "step-approvals" ? (
          <PolicyApprovalsIcon className="size-6 shrink-0 text-[#a8a4a4]" />
        ) : (
          createElement(icon, {
            className: "size-6 shrink-0 text-[#a8a4a4]",
            strokeWidth: 2,
            "aria-hidden": true,
          })
        )}
      </div>
      <div className="w-px shrink-0 bg-[#c4c4c4]" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const POLICY_AUDIENCE_CHIPS = [
  "Engineering department",
  "All managers",
  "San Francisco Office",
] as const;

/** Figma [Policy.Card / And.Or](https://www.figma.com/design/QpcKUPO8RpJ14eUEYgY97M/%E2%9C%85-Approval?node-id=14793-121753) — policy scope row. */
type OldCardPolicyApplyRow =
  | { primary: string }
  | { primary: string; excludeLabel: string; secondary: string };

const OLD_CARD_POLICY_APPLY: Record<0 | 1 | 2, OldCardPolicyApplyRow> = {
  0: { primary: "Engineering Department" },
  1: { primary: "All managers" },
  2: { primary: "San Francisco Office" },
};

/** Trigger condition chips + OR row (matches Figma structure). */
type OldCardWhenRow = { a: string; b?: string };

const OLD_CARD_WHEN: Record<0 | 1 | 2, OldCardWhenRow> = {
  0: {
    a: "Employment change is submitted",
  },
  1: {
    a: "Employment change is submitted",
  },
  2: {
    a: "Employment change is submitted",
  },
};

/** Step 1 approval row (policy card). */
type OldCardStepsRow =
  | { step1Title: string; step1Primary: string }
  | {
      step1Title: string;
      step1Primary: string;
      step1ExcludeLabel: string;
      step1Secondary: string;
    };

const OLD_CARD_STEPS: Record<0 | 1 | 2, OldCardStepsRow> = {
  0: {
    step1Title: "Step 1 — Require approvals from all…",
    step1Primary: "Employee’s > manager",
  },
  1: {
    step1Title: "Step 1 — Require approvals from all…",
    step1Primary: "John Shin",
  },
  2: {
    step1Title: "Step 1 — Require approvals from all…",
    step1Primary: "Employee > Office manager",
  },
};

function PolicyCardChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded-md bg-[#ececec] px-2.5 py-1 text-[12px] text-[#252528]"
      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
    >
      {children}
    </span>
  );
}

function PolicyCardInstance({
  cardIndex,
  condensed,
  policyDetailsExpanded,
  setPolicyDetailsExpanded,
  canvasHref,
  /** OLD prototype: always show “When this happens” + “Steps”; detail toggle only applies to NEW condensed card. */
  policySurfaceOld = false,
}: {
  cardIndex: 0 | 1 | 2;
  condensed: boolean;
  policyDetailsExpanded: boolean;
  setPolicyDetailsExpanded: (value: SetStateAction<boolean>) => void;
  canvasHref: string;
  policySurfaceOld?: boolean;
}) {
  const audienceLabels = condensed
    ? POLICY_AUDIENCE_CHIPS
    : [POLICY_AUDIENCE_CHIPS[cardIndex]];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e0dede] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md">
      <div className="relative z-[1] flex flex-col gap-6 px-6 pb-6 pt-6 pr-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex max-w-[280px] shrink-0 gap-3 lg:w-[255px]">
            {policySurfaceOld ? (
              <GripVertical className="mt-0.5 size-6 shrink-0 text-[#a8a4a4]" strokeWidth={2} aria-hidden />
            ) : null}
            <div className="min-w-0 flex flex-col gap-1">
              <p
                className="text-[17px] leading-6 text-black"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, letterSpacing: "0.25px" }}
              >
                {policySurfaceOld
                  ? cardIndex === 0
                    ? "Engineering policy"
                    : cardIndex === 1
                      ? "Managers"
                      : cardIndex === 2
                        ? "SF policy"
                        : "Employment change policies"
                  : "Employment change policies"}
              </p>
              <p className="text-[12px] leading-4 text-[#595555] tracking-wide" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                Last modified by: <span className="text-[#4a6ba6]">John Doe</span>
              </p>
              <p className="text-[12px] leading-4 text-[#595555] tracking-wide" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                Last modified: 06/20/2022
              </p>
              <p className="text-[12px] leading-4 text-[#595555] tracking-wide" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                Created by: <span className="text-[#4a6ba6]">John Doe</span>
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-[#20968F]" aria-hidden />
                <span
                  className="text-[15px] leading-[22px] text-[#2c2b2b]"
                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, letterSpacing: "0.5px" }}
                >
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            {policySurfaceOld ? (
              <>
                {/* Figma row 1: description only (hamburger) — always visible */}
                <PolicyCardSectionRow icon="description-lines">
                  <p
                    className="text-[15px] leading-[22px] text-[#595555]"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, letterSpacing: "0.5px" }}
                  >
                    Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequat
                    duis enim velit Velit officia consequat duis
                  </p>
                </PolicyCardSectionRow>
                {policyDetailsExpanded ? (
                  <>
                    {/* Row 2: Policy should only apply for… */}
                    <PolicyCardSectionRow icon="policy-audience">
                      <p
                        className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#595555]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 700, letterSpacing: "0.5px" }}
                      >
                        Policy should only apply for…
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <PolicyCardChip>{OLD_CARD_POLICY_APPLY[cardIndex].primary}</PolicyCardChip>
                        {"excludeLabel" in OLD_CARD_POLICY_APPLY[cardIndex] ? (
                          <>
                            <span
                              className="text-[12px] text-black"
                              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, letterSpacing: "0.5px" }}
                            >
                              {OLD_CARD_POLICY_APPLY[cardIndex].excludeLabel}
                            </span>
                            <PolicyCardChip>{OLD_CARD_POLICY_APPLY[cardIndex].secondary}</PolicyCardChip>
                          </>
                        ) : null}
                      </div>
                    </PolicyCardSectionRow>
                    {/* Row 3: When this happens… */}
                    <PolicyCardSectionRow icon="when-happens">
                      <p
                        className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#595555]"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 700, letterSpacing: "0.5px" }}
                      >
                        When this happens…
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <PolicyCardChip>{OLD_CARD_WHEN[cardIndex].a}</PolicyCardChip>
                        {OLD_CARD_WHEN[cardIndex].b != null ? (
                          <PolicyCardChip>{OLD_CARD_WHEN[cardIndex].b}</PolicyCardChip>
                        ) : null}
                      </div>
                      {OLD_CARD_WHEN[cardIndex].b != null ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="text-[11px] font-medium uppercase tracking-[1.5px] text-[#202022]"
                            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                          >
                            OR
                          </span>
                          <PolicyCardChip>{OLD_CARD_WHEN[cardIndex].a}</PolicyCardChip>
                          <PolicyCardChip>{OLD_CARD_WHEN[cardIndex].b}</PolicyCardChip>
                        </div>
                      ) : null}
                    </PolicyCardSectionRow>
                    {/* Row 4: Step 1 (approval) */}
                    <PolicyCardSectionRow icon="step-approvals">
                      <div>
                        <p
                          className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#595555]"
                          style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 700, letterSpacing: "0.5px" }}
                        >
                          {OLD_CARD_STEPS[cardIndex].step1Title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <PolicyCardChip>{OLD_CARD_STEPS[cardIndex].step1Primary}</PolicyCardChip>
                          {"step1ExcludeLabel" in OLD_CARD_STEPS[cardIndex] ? (
                            <>
                              <span
                                className="text-[12px] text-black"
                                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, letterSpacing: "0.5px" }}
                              >
                                {OLD_CARD_STEPS[cardIndex].step1ExcludeLabel}
                              </span>
                              <PolicyCardChip>{OLD_CARD_STEPS[cardIndex].step1Secondary}</PolicyCardChip>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </PolicyCardSectionRow>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <PolicyCardSectionRow icon="description-lines">
                  <p
                    className="text-[15px] leading-[22px] text-[#595555]"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, letterSpacing: "0.5px" }}
                  >
                    Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequat duis
                    enim velit. Velit officia consequat duis enim velit mollit.
                  </p>
                </PolicyCardSectionRow>

                {policyDetailsExpanded ? (
                  <PolicyCardSectionRow icon="policy-audience">
                    <p
                      className="text-[11px] font-bold uppercase tracking-wide text-[#595555]"
                      style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 700, letterSpacing: "0.5px" }}
                    >
                      Policy should only apply for…
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {audienceLabels.map((label, index) => (
                        <Fragment key={label}>
                          {index > 0 ? (
                            <span
                              className="text-[11px] font-medium uppercase tracking-[1.5px] text-[#202022]"
                              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                            >
                              OR
                            </span>
                          ) : null}
                          <span
                            className="rounded-md bg-[#ececec] px-2.5 py-1 text-[12px] text-[#252528]"
                            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                          >
                            {label}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </PolicyCardSectionRow>
                ) : null}
              </>
            )}
          </div>
        </div>

        {policySurfaceOld ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#e0dede] pt-4">
            <button
              type="button"
              onClick={() => setPolicyDetailsExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[14px] text-[#7A005D] hover:underline"
              style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
              aria-expanded={policyDetailsExpanded}
            >
              {policyDetailsExpanded ? "Hide detail" : "Show detail"}
              <ChevronDown
                className={cn("size-4 transition-transform", policyDetailsExpanded && "rotate-180")}
                strokeWidth={2}
                aria-hidden
              />
            </button>
          </div>
        ) : null}
      </div>

      <div className="absolute right-3 top-3 z-[2] flex items-center gap-0.5">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-[#595555] hover:bg-[#f5f5f5]"
          aria-label="More actions"
        >
          <MoreVertical className="size-5" strokeWidth={2} />
        </button>
        <Link
          href={canvasHref}
          className="flex size-8 items-center justify-center rounded-md text-[#595555] hover:bg-[#f5f5f5] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/50"
          aria-label="Open workflow canvas"
        >
          <ChevronRight className="size-5" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function OldPolicyLanding({
  canvasHref,
  experience,
  onExperienceChange,
  condensedSingleCard,
  branchingMode,
  onBranchingModeChange,
}: {
  canvasHref: string;
  experience: PrototypeExperience;
  onExperienceChange: (next: PrototypeExperience) => void;
  /** NEW experience: same Approvals shell, one merged policy card (three audiences in one row). */
  condensedSingleCard?: boolean;
  branchingMode: "exclusive" | "additive";
  onBranchingModeChange: (next: "exclusive" | "additive") => void;
}) {
  const [policyDetailsExpanded, setPolicyDetailsExpanded] = useState(true);
  const isCondensed = condensedSingleCard ?? false;

  const tabs: { label: string; active?: boolean }[] = [
    { label: "Needs my review (550)" },
    { label: "My requests" },
    { label: "Reviewed" },
    { label: "All requests" },
    { label: "Approval policies", active: true },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f9f7f6]">
      <PrototypeGlobalNav experience={experience} onExperienceChange={onExperienceChange} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          {/* Page title + tabs */}
          <div className="border-b border-[#e0dede] bg-white px-5 pt-5 sm:px-6">
            <div className="mb-4">
              <h1
                className="text-2xl text-black"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, lineHeight: "29px" }}
              >
                Approvals
              </h1>
            </div>
            <div className="-mb-px flex gap-5 overflow-x-auto sm:gap-8">
              {tabs.map(({ label, active }) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "shrink-0 border-b-[3px] pb-3 text-[15px] transition-colors",
                    active
                      ? "border-black text-black"
                      : "border-transparent font-normal text-[#8c8888] hover:text-[#252528]"
                  )}
                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: active ? 535 : 430 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Category tree */}
            <aside className="w-[238px] shrink-0 overflow-y-auto border-r border-[#e0dede] bg-white px-0 py-3">
              <ul className="space-y-0.5 text-[14px]" style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>
                {[
                  "Apps",
                  "Benefits",
                  "Contractor Management",
                  "Devices",
                  "Global Payroll",
                  "Headcount",
                ].map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between py-2 pl-4 pr-3 text-left text-[#252528] hover:bg-[#f9f7f6]"
                    >
                      <span className="truncate">{label}</span>
                      <ChevronRight className="size-4 shrink-0 text-[#a8a4a4]" />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between py-2 pl-4 pr-3 text-left font-medium text-[#252528] hover:bg-[#f9f7f6]"
                  >
                    HR Management
                    <ChevronDown className="size-4 shrink-0" />
                  </button>
                  <ul className="border-l border-transparent pb-1">
                    <li>
                      <button
                        type="button"
                        className={cn(
                          "relative w-full border-l-[3px] py-2 pl-5 pr-3 text-left text-[14px]",
                          "border-black text-black"
                        )}
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                      >
                        Employment change
                      </button>
                    </li>
                    {["Transition", "Termination"].map((label) => (
                      <li key={label}>
                        <button
                          type="button"
                          className="w-full border-l-[3px] border-transparent py-2 pl-5 pr-3 text-left text-[#595555] hover:bg-[#f9f7f6]"
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
                {["Payroll", "Recruiting"].map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between py-2 pl-4 pr-3 text-left text-[#252528] hover:bg-[#f9f7f6]"
                    >
                      {label}
                      <ChevronRight className="size-4 shrink-0 text-[#a8a4a4]" />
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Policy workspace */}
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#f9f7f6] p-5 sm:p-6">
              <div className="mx-auto max-w-[960px]">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h2
                    className="text-[20px] text-[#252528]"
                    style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
                  >
                    Employment change policies
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="relative min-w-[160px] flex-1 sm:max-w-[220px] sm:flex-initial">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#8c8888]" />
                      <input
                        type="search"
                        placeholder="Search"
                        className="h-9 w-full rounded-md border border-[#e0dede] bg-white pl-8 pr-2 text-[14px] text-[#252528] outline-none placeholder:text-[#8c8888] focus:ring-2 focus:ring-[#5aa5e7]/30"
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}
                      />
                    </div>
                    <Button variant="outline" className="h-9 border-[#d3d3d3] bg-white px-3 text-[14px]">
                      Adjust priority
                    </Button>
                    <Button className="h-9 bg-[#7A005D] px-4 text-[14px] text-white hover:bg-[#7A005D]/90">
                      + New
                    </Button>
                  </div>
                </div>
                {experience === "old" ? (
                  <div className="mb-5 flex flex-wrap items-center gap-3 justify-between">
                    <BranchingModeSelect
                      value={branchingMode}
                      onChange={onBranchingModeChange}
                      popoverAlign="start"
                    />
                    <button
                      type="button"
                      onClick={() => setPolicyDetailsExpanded((v) => !v)}
                      className="flex cursor-pointer items-center gap-2 text-[14px] text-[#595555]"
                      aria-pressed={policyDetailsExpanded}
                      aria-label={policyDetailsExpanded ? "Hide policy details" : "Show policy details"}
                    >
                      <span style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430 }}>Show details</span>
                      <span
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          policyDetailsExpanded ? "bg-[#7A005D]" : "bg-[#e0dede]"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left,transform]",
                            policyDetailsExpanded ? "right-1" : "left-1"
                          )}
                        />
                      </span>
                    </button>
                  </div>
                ) : null}

                {isCondensed ? (
                  <PolicyCardInstance
                    cardIndex={0}
                    condensed
                    policyDetailsExpanded={policyDetailsExpanded}
                    setPolicyDetailsExpanded={setPolicyDetailsExpanded}
                    canvasHref={canvasHref}
                    policySurfaceOld={false}
                  />
                ) : (
                  <div className="flex flex-col gap-[24px]">
                    {([0, 1, 2] as const).map((cardIndex) => (
                      <PolicyCardInstance
                        key={cardIndex}
                        cardIndex={cardIndex}
                        condensed={false}
                        policyDetailsExpanded={policyDetailsExpanded}
                        setPolicyDetailsExpanded={setPolicyDetailsExpanded}
                        canvasHref={canvasHref}
                        policySurfaceOld={experience === "old"}
                      />
                    ))}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
    </div>
  );
}

function LandingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const experience: PrototypeExperience =
    searchParams.get("experience") === "new" ? "new" : "old";
  const branchingMode: "exclusive" | "additive" =
    searchParams.get("branching") === "additive" ? "additive" : "exclusive";

  const setExperience = useCallback(
    (next: PrototypeExperience) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "old") {
        params.delete("experience");
      } else {
        params.set("experience", "new");
      }
      const q = params.toString();
      router.push(q ? `/?${q}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const setBranchingMode = useCallback(
    (next: "exclusive" | "additive") => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "additive") {
        params.set("branching", "additive");
      } else {
        params.delete("branching");
      }
      const q = params.toString();
      router.push(q ? `/?${q}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const canvasHref = useMemo(() => {
    const p = new URLSearchParams();
    if (experience === "new") {
      p.set("from", "new");
      p.set("experience", "new");
    } else {
      p.set("from", "old");
    }
    if (branchingMode === "additive") {
      p.set("branching", "additive");
    }
    return `/workflow?${p.toString()}`;
  }, [experience, branchingMode]);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f9f7f6]">
      <OldPolicyLanding
        canvasHref={canvasHref}
        experience={experience}
        onExperienceChange={setExperience}
        condensedSingleCard={experience === "new"}
        branchingMode={branchingMode}
        onBranchingModeChange={setBranchingMode}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f9f7f6] text-[#595555]">
          Loading…
        </div>
      }
    >
      <LandingInner />
    </Suspense>
  );
}
