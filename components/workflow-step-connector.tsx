"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddStepPopover } from "@/components/add-step-popover";
import {
  findCatalogItem,
  WORKFLOW_CATALOG_DRAG_MIME,
  type CatalogItemWithCategory,
} from "@/components/add-step-catalog";

type WorkflowStepConnectorProps = {
  className?: string;
  /** Index in the middle-steps array where the new step should be inserted (0 = after trigger). */
  insertIndex: number;
  onInsertStep: (item: CatalogItemWithCategory, insertIndex: number) => void;
  /** True while a sidebar catalog chip is being dragged — expands all connectors as drop targets. */
  catalogDragActive?: boolean;
  /** Called after a successful catalog drop or when drag ends (parent clears drag UI state). */
  onCatalogDragStateEnd?: () => void;
  /**
   * `default` caps width at 250px (main spine). `fillColumn` spans the full branch column width
   * (e.g. 280px) so the drop target matches the step cards.
   */
  layout?: "default" | "fillColumn";
  /**
   * With `layout="fillColumn"`, grow the drop zone vertically (min 72px) so uneven true/false
   * columns can align when one side has no steps yet.
   */
  fillColumnStretch?: boolean;
};

/**
 * Vertical dashed connector with add affordance; opens full “Add a step” popover (Figma).
 */
function acceptsCatalogDrag(
  dt: DataTransfer | null,
  catalogDragActive: boolean
) {
  if (!dt?.types) return false;
  if (dt.types.includes(WORKFLOW_CATALOG_DRAG_MIME)) return true;
  /* Safari may omit custom MIME in `types` during drag; sidebar sets text/plain only for catalog chips. */
  if (catalogDragActive && dt.types.includes("text/plain")) return true;
  return false;
}

/** Centered vertical dashed rail — same stroke as {@link WorkflowStepConnector}. */
const CONNECTOR_RAIL_LINE_CLASS =
  "pointer-events-none absolute left-1/2 top-0 w-0 -translate-x-1/2 border-l border-dashed border-[#8c8888]";

/**
 * SVG stroke tuned to match the hairline `border-l border-dashed border-[#8c8888]` used on connectors
 * (1px weight, short dashes similar to browser default `border-style: dashed`).
 */
export const WORKFLOW_CANVAS_SVG_DASHED_EDGE = {
  strokeWidth: 1,
  strokeDasharray: "3 3",
} as const;

/**
 * Short dashed vertical segment aligned like the main “Add step” connector rail
 * (line through horizontal center). `fillColumn` matches branch column width.
 */
export function WorkflowVerticalRailSegment({
  className,
  heightClass = "h-4",
  layout = "default",
}: {
  className?: string;
  /** Height of the segment (default 16px). */
  heightClass?: string;
  layout?: "default" | "fillColumn";
}) {
  return (
    <div
      className={cn(
        "relative w-full shrink-0",
        layout === "fillColumn" ? "max-w-none self-stretch" : "max-w-[250px] self-center",
        heightClass,
        className
      )}
      aria-hidden
    >
      <div className={cn(CONNECTOR_RAIL_LINE_CLASS, "bottom-0")} />
    </div>
  );
}

export function WorkflowStepConnector({
  className,
  insertIndex,
  onInsertStep,
  catalogDragActive = false,
  onCatalogDragStateEnd,
  layout = "default",
  fillColumnStretch = false,
}: WorkflowStepConnectorProps) {
  const [open, setOpen] = useState(false);
  const [dropOver, setDropOver] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const dropZoneExpanded = open || catalogDragActive || dropOver;

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 300;
    const margin = 8;
    let left = r.right + margin;
    if (left + width > window.innerWidth - margin) {
      left = r.left - width - margin;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const maxH = 380;
    let top = r.top + r.height / 2 - maxH / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - maxH - margin));
    setPopoverStyle({ position: "fixed", top, left, zIndex: 100 });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const t = event.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn(
        fillColumnStretch && layout === "fillColumn"
          ? "relative min-h-[72px] flex-1 grow basis-0 w-full max-h-none overflow-hidden max-w-none"
          : "relative h-[72px] min-h-[72px] max-h-[72px] w-full shrink-0 grow-0 basis-auto flex-none overflow-hidden",
        !fillColumnStretch && layout === "fillColumn" && "max-w-none",
        !fillColumnStretch && layout === "default" && "max-w-[250px]",
        dropOver && "z-20",
        className
      )}
      onDragEnter={(e) => {
        if (!acceptsCatalogDrag(e.dataTransfer, catalogDragActive)) return;
        e.preventDefault();
        setDropOver(true);
      }}
      onDragLeave={(e) => {
        if (!acceptsCatalogDrag(e.dataTransfer, catalogDragActive)) return;
        const next = e.relatedTarget as Node | null;
        if (next && rootRef.current?.contains(next)) return;
        setDropOver(false);
      }}
      onDragOver={(e) => {
        if (!acceptsCatalogDrag(e.dataTransfer, catalogDragActive)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropOver(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropOver(false);
        const id =
          e.dataTransfer.getData(WORKFLOW_CATALOG_DRAG_MIME) ||
          e.dataTransfer.getData("text/plain");
        const item = id ? findCatalogItem(id) : undefined;
        if (item) onInsertStep(item, insertIndex);
        onCatalogDragStateEnd?.();
      }}
    >
      {/* Taller dashed connector through horizontal center; arrow at bottom */}
      <div className={cn(CONNECTOR_RAIL_LINE_CLASS, "bottom-[8px]")} aria-hidden />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#8c8888]"
        aria-hidden
      />

      {/* 18×18 control, dead center of the connector box */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 z-10 flex w-full -translate-x-1/2 -translate-y-1/2 items-center justify-center px-0",
          layout === "fillColumn" ? "max-w-none" : "max-w-[250px]"
        )}
      >
        <button
          ref={anchorRef}
          type="button"
          data-menu-open={open ? "true" : "false"}
          data-drop-expanded={dropZoneExpanded ? "true" : "false"}
          data-drop-target={dropOver ? "true" : "false"}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Add step"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={cn(
            "group relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
            "border border-solid border-[#e0dede] bg-white text-[#595555]",
            "transition-[width,height,border-radius,border-style] duration-200 ease-out",
            "size-[18px]",
            "hover:h-8 hover:w-[175px] hover:rounded-md hover:border-dashed hover:border-black/40 hover:bg-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5aa5e7]/40",
            "focus-visible:h-8 focus-visible:w-[175px] focus-visible:rounded-md focus-visible:border-dashed focus-visible:border-black/40",
            "max-[320px]:hover:w-[min(175px,calc(100vw-48px))] max-[320px]:focus-visible:w-[min(175px,calc(100vw-48px))]",
            "data-[menu-open=true]:h-8 data-[menu-open=true]:w-[175px] data-[menu-open=true]:rounded-md data-[menu-open=true]:border-dashed data-[menu-open=true]:border-black/40",
            "max-[320px]:data-[menu-open=true]:w-[min(175px,calc(100vw-48px))]",
            "data-[drop-expanded=true]:h-8 data-[drop-expanded=true]:w-[175px] data-[drop-expanded=true]:rounded-md data-[drop-expanded=true]:border-dashed data-[drop-expanded=true]:border-black/40",
            "max-[320px]:data-[drop-expanded=true]:w-[min(175px,calc(100vw-48px))]",
            "data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-[#5aa5e7]/50 data-[drop-target=true]:ring-offset-2 data-[drop-target=true]:ring-offset-[#f9f7f6]"
          )}
        >
          <Plus
            className={cn(
              "size-[10px] shrink-0 transition-opacity duration-200",
              "group-hover:opacity-0 group-focus-visible:opacity-0 group-data-[menu-open=true]:opacity-0",
              "group-data-[drop-expanded=true]:opacity-0"
            )}
            strokeWidth={2.25}
          />
          <span
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center px-6",
              "whitespace-nowrap text-[10px] leading-3 tracking-[0.5px] text-[#6f6f72]",
              "opacity-0 transition-opacity duration-200",
              "group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[menu-open=true]:opacity-100",
              "group-data-[drop-expanded=true]:opacity-100"
            )}
            style={{ fontFamily: "'Basel Grotesk', sans-serif", fontWeight: 535 }}
            aria-hidden
          >
            Add step
          </span>
        </button>
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={popoverRef} style={popoverStyle}>
            <AddStepPopover
              onSelect={(item) => {
                onInsertStep(item, insertIndex);
                setOpen(false);
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
