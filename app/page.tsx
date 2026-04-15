"use client";

import {
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
  Menu,
  MoreVertical,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BranchingModeSelect } from "@/components/branching-mode-select";
import {
  PrototypeGlobalNav,
  type PrototypeExperience,
} from "@/components/prototype-global-nav";
import { cn } from "@/lib/utils";

/** Matches Figma `Policy.Card / And.Or` — icon + vertical rule + content per row ([node](https://www.figma.com/design/QpcKUPO8RpJ14eUEYgY97M/%E2%9C%85-Approval?node-id=14793-121753)). */
function PolicyCardSectionRow({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-4">
      <div className="flex w-6 shrink-0 justify-center pt-0.5">
        <Icon className="size-6 shrink-0 text-[#a8a4a4]" strokeWidth={2} aria-hidden />
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

function PolicyCardInstance({
  cardIndex,
  condensed,
  policyDetailsExpanded,
  setPolicyDetailsExpanded,
  canvasHref,
}: {
  cardIndex: 0 | 1 | 2;
  condensed: boolean;
  policyDetailsExpanded: boolean;
  setPolicyDetailsExpanded: (value: SetStateAction<boolean>) => void;
  canvasHref: string;
}) {
  const audienceLabels = condensed
    ? POLICY_AUDIENCE_CHIPS
    : [POLICY_AUDIENCE_CHIPS[cardIndex]];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e0dede] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md">
      <div className="relative z-[1] flex flex-col gap-6 px-6 pb-6 pt-6 pr-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex max-w-[280px] shrink-0 gap-3 lg:w-[255px]">
            <GripVertical className="mt-0.5 size-6 shrink-0 text-[#a8a4a4]" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex flex-col gap-1">
              <p
                className="text-[17px] leading-6 text-black"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535, letterSpacing: "0.25px" }}
              >
                Employment change policies
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
            <PolicyCardSectionRow icon={Menu}>
              <p
                className="text-[15px] leading-[22px] text-[#595555]"
                style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 430, letterSpacing: "0.5px" }}
              >
                Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequat duis
                enim velit. Velit officia consequat duis enim velit mollit.
              </p>
            </PolicyCardSectionRow>

            {policyDetailsExpanded ? (
              <>
                <PolicyCardSectionRow icon={Users}>
                  <p
                    className="text-[11px] font-bold uppercase tracking-wide text-black"
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
              </>
            ) : null}
          </div>
        </div>

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
                      ? "border-black font-semibold text-black"
                      : "border-transparent font-normal text-[#8c8888] hover:text-[#252528]"
                  )}
                  style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: active ? 600 : 430 }}
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
                          "border-black font-semibold text-black"
                        )}
                        style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 600 }}
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
                    Transition approval policies
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
                <div
                  className={cn(
                    "mb-5 flex flex-wrap items-center gap-3",
                    experience === "old" ? "justify-between" : "justify-end"
                  )}
                >
                  {experience === "old" ? (
                    <BranchingModeSelect
                      value={branchingMode}
                      onChange={onBranchingModeChange}
                      popoverAlign="start"
                    />
                  ) : null}
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

                {isCondensed ? (
                  <PolicyCardInstance
                    cardIndex={0}
                    condensed
                    policyDetailsExpanded={policyDetailsExpanded}
                    setPolicyDetailsExpanded={setPolicyDetailsExpanded}
                    canvasHref={canvasHref}
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
