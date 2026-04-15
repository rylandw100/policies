"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { triggerCategories, type TriggerCategory, type TriggerItem, type TriggerOption } from "@/lib/trigger-data";
import { triggerCategoriesModal2 } from "@/lib/trigger-data-modal2";
import {
  SET_SCHEDULE_OPTION_ID,
  SET_SCHEDULE_ITEM_ID,
  formatDateYYYYMMDD,
  formatNextHourRoundedLocal,
  type CustomCadence,
  type ScheduleRepeatKind,
} from "@/lib/set-schedule";
import { SetScheduleForm } from "./SetScheduleForm";
import { cn } from "@/lib/utils";
import { X, ChevronRight, ChevronDown, Type, DollarSign, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isWorkflowBasicTriggerOption } from "@/lib/workflow-basic-trigger";
import { SHOW_WORKFLOW_TIER_CHIPS } from "@/components/add-step-catalog";

const BASIC_WORKFLOW_BADGE_TITLE =
  "Only Start date, combined with Basic-tier steps, can keep this workflow on the Basic tier.";

function BasicWorkflowEligibilityBadge({ optionId }: { optionId: string | null | undefined }) {
  if (!SHOW_WORKFLOW_TIER_CHIPS) return null;
  if (!isWorkflowBasicTriggerOption(optionId)) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded border border-[#e0dede] bg-[#f9f7f6] px-1.5 py-0.5 text-[11px] leading-[14px] text-[#595555]"
      title={BASIC_WORKFLOW_BADGE_TITLE}
    >
      Basic
    </span>
  );
}

function TriggerSelectorBasicExplainer() {
  if (!SHOW_WORKFLOW_TIER_CHIPS) return null;
  return (
    <div className="border-b border-[#e0dede] bg-[#fafafa] px-4 py-2.5">
      <p
        className="text-[12px] leading-4 text-[#595555]"
        style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430 }}
      >
        A <span className="font-medium text-[#252528]">Basic</span> workflow is only available when the
        trigger is <span className="font-medium text-[#252528]">Start date</span> and every step stays
        Basic-tier.
      </p>
    </div>
  );
}

function WorkflowTierImpactLine({ optionId }: { optionId: string | null | undefined }) {
  if (!SHOW_WORKFLOW_TIER_CHIPS) return null;
  if (!isWorkflowBasicTriggerOption(optionId)) return null;
  return (
    <p
      className="mt-2 text-[13px] leading-5 text-[#595555]"
      style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430 }}
    >
      <span className="font-medium text-[#252528]">Workflow tier:</span> With Basic-tier steps, this
      trigger can keep the workflow on Basic.
    </p>
  );
}

// Search result interface
interface SearchResult {
  id: string;
  label: string;
  breadcrumbs: string[];
  bucket: "popular" | "when-something-happens" | "fields";
  optionId?: string;
  option?: TriggerOption;
  categoryId?: string;
  itemId?: string;
  subItemId?: string;
}

/** displayLabel = short trigger name (e.g. "Offer is accepted"), not the full category path. */
export type WorkflowTriggerConfirmPayload = {
  displayLabel: string;
  optionId: string | null;
};

interface TriggerSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expandStatusOptions?: boolean;
  expandSpecificOptions?: string[]; // Array of option IDs to expand (e.g., ["document-status", "application-status"])
  useListIconForEvents?: boolean; // If true, use ListIcon for specific events (only for modal 3)
  useModal2Data?: boolean; // If true, use modal 2 trigger data structure
  /** Called when the user confirms a trigger (search or browse). Updates workflow canvas + drawer copy. */
  onTriggerConfirm?: (result: WorkflowTriggerConfirmPayload) => void;
  /**
   * When the modal opens, optionally jump to a browse path (e.g. Popular › Onboarding › Start date)
   * so the right-hand trigger detail pane is visible immediately.
   */
  initialBrowseSelection?: {
    categoryId: string;
    itemId: string;
    subItemId?: string | null;
    optionId: string;
  } | null;
}

// Custom SVG Icon Components
const StarIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12.0008 1.47095L15.4338 8.39995L23.1168 9.51195L17.5568 14.9109L18.8688 22.5299L12.0008 18.9329L5.13277 22.5299L6.44477 14.9109L0.884766 9.51195L8.56777 8.39995L12.0008 1.47095ZM12.0008 4.84995L9.56277 9.77195L4.11777 10.5599L8.05777 14.3859L7.12677 19.7919L12.0018 17.2389L16.8768 19.7919L15.9458 14.3859L19.8858 10.5599L14.4408 9.77195L12.0018 4.84995H12.0008Z" fill="#716F6C"/>
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M16.25 5.375H7.75V2.625H6.25V5.375H1.75V21.375H22.25V5.375H17.75V2.625H16.25V5.375ZM3.25 19.875V10.875H20.75V19.875H3.25Z" fill="#716F6C"/>
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14.3727 0.321045L13.1547 9.25004H20.7777L9.62766 23.679L10.8457 14.75H3.22266L14.3727 0.321045ZM6.27766 13.25H12.5637L11.8717 18.321L17.7217 10.75H11.4357L12.1267 5.67904L6.27766 13.25Z" fill="#716F6C"/>
  </svg>
);

// Request types for approval triggers
const REQUEST_TYPES = [
  "APPS_REQUEST",
  "APP_INSTALL_REQUEST",
  "BANKING_NEW_PAYMENT_REQUEST",
  "CONTRACT_CREATION",
  "CONTRACT_NEGOTIATION",
  "CUSTOM_OBJECT_DATA_ROW_DELETE",
  "CUSTOM_OBJECT_DATA_ROW_CREATE",
  "CUSTOM_OBJECT_DATA_ROW_UPDATE",
  "DEVICES_REQUEST",
  "GLOBAL_PAYROLL_PROCESS_REQUEST_APPROVAL",
  "BACKFILL_HEADCOUNT",
  "NEW_HEADCOUNT",
  "EDIT_HEADCOUNT",
  "CLOSE_HEADCOUNT",
  "HEADCOUNT",
  "TRANSITION",
  "HIRE",
  "TERMINATE",
  "PERSONAL_INFO_CHANGES",
  "APP_ACCESS_REQUEST",
  "PAYROLL_RUN_REQUEST_APPROVAL",
  "GRANT_DEVELOPER_PERMISSION",
  "PROCUREMENT_REQUEST",
  "ATS_OFFER_LETTER_REQUEST",
  "ATS_JOB_REQUISITION_CREATE_REQUEST",
  "ATS_JOB_REQUISITION_EDIT_REQUEST",
  "ATS_DECISION_TO_HIRE_REQUEST",
  "RPASS_REQUEST",
  "SCHEDULING_CHANGE_REQUEST",
  "SCHEDULING_EDIT_SHIFT",
  "SCHEDULING_COVER_OFFER",
  "SCHEDULING_DROP_SHIFT",
  "SCHEDULING_SWAP_OFFER",
  "SCHEDULING_EMPLOYEE_SHIFT_CONFIRM",
  "SPEND_REQUEST",
  "TIME_ENTRY",
  "LEAVE_REQUEST_APPROVAL",
  "FLIGHT_APPROVAL_REQUEST",
  "FLIGHT_PRE_APPROVAL_REQUEST",
  "VARIABLE_COMPENSATION_PAYEE_PAYOUT_V1"
];

const ClockIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12.75 11.25V5.5H11.25V12.75H18.5V11.25H12.75Z" fill="#716F6C"/>
    <path d="M12 1.75C6.339 1.75 1.75 6.339 1.75 12C1.75 17.661 6.339 22.25 12 22.25C17.661 22.25 22.25 17.661 22.25 12C22.25 6.339 17.661 1.75 12 1.75ZM3.25 12C3.25 7.168 7.168 3.25 12 3.25C16.832 3.25 20.75 7.168 20.75 12C20.75 16.833 16.832 20.75 12 20.75C7.168 20.75 3.25 16.832 3.25 12Z" fill="#716F6C"/>
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3.38086 1.94409L20.6189 12.0001L3.38086 22.0561V1.94409ZM4.88086 4.55609V19.4441L17.6429 12.0001L4.88086 4.55609Z" fill="#716F6C"/>
  </svg>
);

const DatabaseIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C7.582 2 4 3.343 4 5V7C4 8.657 7.582 10 12 10C16.418 10 20 8.657 20 7V5C20 3.343 16.418 2 12 2Z" fill="#716F6C"/>
    <path d="M4 9V11C4 12.657 7.582 14 12 14C16.418 14 20 12.657 20 11V9C20 10.657 16.418 12 12 12C7.582 12 4 10.657 4 9Z" fill="#716F6C"/>
    <path d="M4 13V15C4 16.657 7.582 18 12 18C16.418 18 20 16.657 20 15V13C20 14.657 16.418 16 12 16C7.582 16 4 14.657 4 13Z" fill="#716F6C"/>
    <path d="M4 17V19C4 20.657 7.582 22 12 22C16.418 22 20 20.657 20 19V17C20 18.657 16.418 20 12 20C7.582 20 4 18.657 4 17Z" fill="#716F6C"/>
  </svg>
);

const ListIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4.5 6.5C5.328 6.5 6 5.828 6 5C6 4.172 5.328 3.5 4.5 3.5C3.672 3.5 3 4.172 3 5C3 5.828 3.672 6.5 4.5 6.5Z" fill="black"/>
    <path d="M8 5.75H21V4.25H8V5.75Z" fill="black"/>
    <path d="M8 12.75H21V11.25H8V12.75Z" fill="black"/>
    <path d="M21 19.75H8V18.25H21V19.75Z" fill="black"/>
    <path d="M6 12C6 12.828 5.328 13.5 4.5 13.5C3.672 13.5 3 12.828 3 12C3 11.172 3.672 10.5 4.5 10.5C5.328 10.5 6 11.172 6 12Z" fill="black"/>
    <path d="M4.5 20.5C5.328 20.5 6 19.828 6 19C6 18.172 5.328 17.5 4.5 17.5C3.672 17.5 3 18.172 3 19C3 19.828 3.672 20.5 4.5 20.5Z" fill="black"/>
  </svg>
);

const CheckSquareIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M1.5 12C1.5 17.799 6.201 22.5 12 22.5C17.799 22.5 22.5 17.799 22.5 12C22.5 6.201 17.799 1.5 12 1.5C6.201 1.5 1.5 6.201 1.5 12ZM8.25 12C8.25 9.929 9.929 8.25 12 8.25C14.071 8.25 15.75 9.929 15.75 12C15.75 14.071 14.071 15.75 12 15.75C9.929 15.75 8.25 14.071 8.25 12Z" fill="#716F6C"/>
  </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12.9695 2.97004C15.1955 0.744037 18.8045 0.744037 21.0305 2.97004C21.6265 3.56504 22.0625 4.26004 22.3385 5.00004C23.0965 7.02704 22.6595 9.40004 21.0295 11.03L18.0295 14.03C16.8765 15.183 15.3525 15.739 13.8425 15.697C12.4365 15.658 11.0425 15.103 9.9695 14.03C9.2975 13.358 8.8285 12.561 8.5625 11.713C9.0015 11.436 9.5035 11.298 10.0055 11.299C10.2035 11.91 10.5455 12.484 11.0305 12.969C11.8365 13.775 12.8895 14.185 13.9455 14.199C13.9485 14.199 13.9515 14.199 13.9545 14.199C13.9855 14.199 14.0165 14.199 14.0475 14.199C14.0965 14.198 14.1455 14.197 14.1945 14.195C14.7085 14.171 15.2185 14.054 15.6965 13.842C16.1585 13.638 16.5905 13.347 16.9685 12.969L19.9685 9.96904C21.6085 8.32904 21.6085 5.67004 19.9685 4.03004C18.3285 2.39004 15.6695 2.39004 14.0295 4.03004L11.1655 6.89404C10.5335 6.79104 9.8915 6.77204 9.2555 6.83804C9.4605 6.53104 9.6985 6.24004 9.9685 5.97004L12.9685 2.97004H12.9695Z" fill="#716F6C"/>
    <path d="M8.49933 8.50011C7.57233 8.75211 6.69633 9.24211 5.96833 9.97011L2.96833 12.9701C0.742328 15.1961 0.742328 18.8051 2.96833 21.0311C5.19433 23.2571 8.80333 23.2571 11.0293 21.0311L14.0293 18.0311C14.3003 17.7601 14.5383 17.4691 14.7433 17.1621C14.1073 17.2281 13.4653 17.2091 12.8333 17.1061L9.96933 19.9701C8.32933 21.6101 5.67033 21.6101 4.03033 19.9701C2.39033 18.3301 2.39033 15.6711 4.03033 14.0311L7.03033 11.0311C8.67033 9.39111 11.3303 9.39011 12.9703 11.0311L13.0003 11.0611C13.5553 11.6271 13.9173 12.3121 14.0873 13.0321C14.5613 12.9041 15.0323 12.6291 15.4443 12.3111C15.1793 11.4551 14.7083 10.6491 14.0303 9.97111C12.9573 8.89811 11.5633 8.34211 10.1573 8.30411C9.60033 8.28911 9.04133 8.35411 8.50033 8.50111L8.49933 8.50011Z" fill="#716F6C"/>
  </svg>
);

// Icon mapping for categories
const getCategoryIcon = (categoryId: string) => {
  switch (categoryId) {
    case "popular":
      return StarIcon;
    case "relative-to-date":
      return CalendarIcon;
    case "set-schedule":
      return ClockIcon;
    case "something-happens":
      return ZapIcon;
    case "object-creation-updates":
      return DatabaseIcon;
    case "manual":
      return PlayIcon;
    default:
      return null;
  }
};

// Icon mapping for options based on data type
// useListIcon: if true, use ListIcon for specific events (only for modal 3)
const getOptionIcon = (optionId: string, dataType?: string, categoryId?: string, itemId?: string, useListIcon?: boolean) => {
  if (optionId === SET_SCHEDULE_OPTION_ID) {
    return ClockIcon;
  }
  // Special case: approval request triggers (ending with "-request") should use thunderbolt icon (they're events, not dates)
  // Check this FIRST before any other logic
  if (optionId.endsWith("-request")) {
    return ZapIcon;
  }
  
  // Special case: rejection-reason-status-updated should use thunderbolt icon (it's an event, not a date)
  if (optionId === "rejection-reason-status-updated") {
    return ZapIcon;
  }
  
  // Special case: job-requisition-status-created should use thunderbolt icon (not ListIcon)
  if (optionId === "job-requisition-status-created") {
    return ZapIcon;
  }
  
  // Specific events that should use ListIcon (only in modal 3)
  if (useListIcon) {
    const listIconOptions = [
      "job-requisition-status",
      "leave-request-status",
      "new-hire-status",
      "profile-change-status",
      "termination-request-status"
    ];
    
    // Check if this option should use ListIcon (including expanded variants)
    // But exclude job-requisition-status-created
    if (optionId !== "job-requisition-status-created" && listIconOptions.some(baseId => optionId === baseId || optionId.startsWith(`${baseId}-`))) {
      return ListIcon;
    }
  }
  
  // For options in "Data changes" category or any "object-*" options, always use DatabaseIcon
  if (categoryId === "object-creation-updates" || optionId.startsWith("object-")) {
    return DatabaseIcon;
  }
  
  // If dataType is provided, use it to determine icon
  if (dataType) {
    switch (dataType.toLowerCase()) {
      case "date":
        return CalendarIcon;
      case "link":
        return LinkIcon;
      case "text":
        return Type;
      case "choice":
        return CheckSquareIcon;
      case "boolean":
        return CheckSquareIcon;
      case "currency":
        return DollarSign;
      default:
        return ZapIcon;
    }
  }
  
  // Fallback to checking optionId for date-related fields
  if (optionId.includes("date") || optionId.includes("Date") || 
      optionId.includes("deadline") ||
      optionId.includes("-day-") || optionId.endsWith("-day") ||
      optionId === "birthday" || optionId === "work-anniversary" ||
      optionId === "processed-at") {
    return CalendarIcon;
  }
  return ZapIcon;
};

// Category descriptions
const getCategoryDescription = (categoryId: string) => {
  switch (categoryId) {
    case "popular":
      return "Design for one of these popular flows";
    case "relative-to-date":
      return "Before, on, or after any Rippling date field";
    case "set-schedule":
      return "Run automatically at a regular cadence";
    case "something-happens":
      return "Trigger when an event occurs in Rippling";
    case "object-creation-updates":
      return "When records are created or updated in Rippling";
    case "manual":
      return "Click 'Run workflow' from the dashboard";
    default:
      return "";
  }
};

// Get trigger details based on option
const getTriggerDetails = (optionId: string, optionLabel?: string, optionDescription?: string, categoryId?: string, itemId?: string, subItemId?: string, isModal1?: boolean, useModal2Data?: boolean) => {
  if (optionId === SET_SCHEDULE_OPTION_ID) {
    return {
      title: "On a set schedule",
      description: [] as string[],
      selectLabel: "",
      selectOptions: [] as string[],
    };
  }
  // Check if this is an expanded status option (e.g., "new-hire-status-submitted")
  const statusOptionMatch = optionId.match(/^(.+?)-(submitted|approved|rejected|canceled|sent|viewed|signed|deleted|expires|created|updated|offer-stage|final-stage|is-effective)$/);
  const baseOptionId = statusOptionMatch ? statusOptionMatch[1] : optionId;
  const statusOption = statusOptionMatch ? statusOptionMatch[2] : null;
  
  // Determine if we're in modal 3 (has expandSpecificOptions, not modal 1)
  const isModal3 = !isModal1 && categoryId !== undefined; // Modal 3 will have categoryId when called
  
  // Exclude date fields under "Data changes > Employee" from date UX form
  // These should use the same UX as other fields in that pane
  const isObjectCreationUpdateField = optionId.startsWith("object-employee-") && 
                                      categoryId === "object-creation-updates" &&
                                      itemId === "object-employee";
  
  // Exclude rejection-reason-status-updated from date detection (it's an event, not a date)
  const isRejectionReasonUpdated = optionId === "rejection-reason-status-updated";
  
  // Exclude approval request triggers (ending with "-request") from date detection (they're events, not dates)
  const isApprovalRequest = optionId.endsWith("-request");
  
  // Handle date-related triggers FIRST (before checking details object)
  // But exclude object-creation-updates date fields, rejection-reason-status-updated, and approval requests
  if (!isObjectCreationUpdateField && !isRejectionReasonUpdated && !isApprovalRequest &&
      (optionId.includes("-relative") || optionId.includes("date") || optionId.includes("Date") || 
       optionId.includes("deadline") ||
       optionId.includes("-day-") || optionId.endsWith("-day") ||
       optionId === "birthday" || optionId === "work-anniversary" ||
       optionId === "processed-at")) {
    const titleMap: Record<string, string> = {
      "start-date-relative": "Start date",
      "first-start-date-relative": "First start date",
      "probation-end-date-relative": "Probation period end date",
      "start-date": "Start date",
      "first-start-date": "First start date",
      "probation-period-end-date": "Probation period end date",
      "start-date-as-employee": "Start date as employee",
      "start-date-as-employee-non-contractor": "Start date as employee (non-contractor)",
      "company-pay-run-approval-deadline": "Company pay run approval deadline",
      "company-pay-run-take-action-deadline": "Company pay run take action deadline",
      "birthday": "Birthday",
      "work-anniversary": "Work anniversary",
      "contract-duration-end-date": "Contract duration end date",
      "current-entity-information-start-date": "Current entity information - start date",
      "date-joined-rippling": "Date joined Rippling",
      "date-of-birth": "Date of birth",
      "effective-from-salary-date": "Effective from salary date",
      "equity-grant-date": "Equity grant date",
      "expected-date-for-ssn": "Expected date for SSN",
      "extended-probation-period-end-date": "Extended probation period end date",
      "invitation-date": "Invitation date",
      "last-day-of-work": "Last day of work",
      "last-password-change-date": "Last password change date",
      "last-password-reset-date": "Last password reset date",
      "next-event-based-leave-end-date": "Next event-based leave end date",
      "next-event-based-leave-start-date": "Next event-based leave start date",
      "offer-accepted-date": "Offer accepted date",
      "offer-expiration-date": "Offer expiration date",
      "projected-end-date": "Projected end date",
      "start-date-with-current-entity": "Start date with current entity"
    };
    
    let title = titleMap[optionId];
    if (!title) {
      // Auto-generate title from optionId, handling special cases
      title = optionId
        .split("-")
        .map((word, index) => {
          // Handle special cases like "ssn", "i9", etc.
          if (word === "ssn") return "SSN";
          if (word === "i9") return "I9";
          // Capitalize first letter
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
    }
    
    return {
      title: title,
      description: [],
      selectLabel: "",
      selectOptions: []
    };
  }

  const details: Record<string, { title: string; description: string[]; selectLabel: string; selectOptions: string[] }> = {
    "interview-canceled": {
      title: "Interview Canceled",
      description: [
        "Triggers when an application interview is canceled."
      ],
      selectLabel: "",
      selectOptions: []
    },
    "new-hire-status": {
      title: optionLabel || "New hire request status",
      description: [
        "Triggers when the hiring flow is completed in Rippling. You can choose to trigger this workflow when a hiring request is submitted, approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when new hire request...",
      selectOptions: ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"]
    },
    "employment-agreement-status": {
      title: "Employment agreement is sent",
      description: [
        "Triggers when a hiring request is finalized and an employment agreement is created in Rippling. This trigger fires regardless of whether or not the request required approval."
      ],
      selectLabel: "",
      selectOptions: []
    },
    "first-start-date": {
      title: "First start date",
      description: [
        "This workflow starts on a specific date relative to an employee's first start date. Configure the timing and offset below."
      ],
      selectLabel: "Trigger when first start date...",
      selectOptions: ["Occurs"]
    },
    "offer-status": {
      title: "Offer is accepted",
      description: [
        "Triggers when a candidate signs their employment agreement in Rippling. This trigger only fires if an employment agreement was included in the hiring flow."
      ],
      selectLabel: "",
      selectOptions: []
    },
    "probation-period-end-date": {
      title: "Probation period end date",
      description: [
        "This workflow starts on a specific date relative to when an employee's probation period ends. Configure the timing and offset below."
      ],
      selectLabel: "Trigger when probation period end date...",
      selectOptions: ["Occurs"]
    },
    "start-date": {
      title: "Start date",
      description: [
        "This workflow starts on a specific date relative to an employee's start date. Configure the timing and offset below."
      ],
      selectLabel: "Trigger when start date...",
      selectOptions: ["Occurs"]
    },
    "start-date-as-employee": {
      title: "Start date as employee",
      description: [
        "This workflow starts on a specific date relative to when someone becomes an employee (excluding contractors). Configure the timing and offset below."
      ],
      selectLabel: "Trigger when start date as employee...",
      selectOptions: ["Occurs"]
    },
    "rippling-access-shut-off": {
      title: "Rippling access is shut off",
      description: [
        "Fires when a person's access to Rippling is revoked and their status changes to Offboarded. This does not necessarily correspond to the person's last day of employment, which may be scheduled for a future date."
      ],
      selectLabel: "Trigger when Rippling access is shut off...",
      selectOptions: ["Occurs"]
    },
    "termination-request-status": {
      title: "Termination request status",
      description: [
        "Fires when the offboarding flow is completed in Rippling. You can configure this trigger to run when the offboarding request is submitted, approved, rejected, or canceled. A person's last day of employment and system access shutoff may be scheduled for a later date."
      ],
      selectLabel: "Trigger when termination request...",
      selectOptions: ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"]
    },
    "profile-change-status": {
      title: optionLabel || "Profile change status",
      description: [
        "Fires when an active worker's personal or employment information changes. This excludes updates made while the worker is not active (for example, after an offer is accepted or after termination). You can choose to trigger this workflow when a change request is submitted, approved, rejected, canceled, or is effective."
      ],
      selectLabel: "Trigger when profile change...",
      selectOptions: ["Is submitted", "Is fully approved", "Is rejected", "Is canceled", "Is effective"]
    },
    "projected-end-date": {
      title: "Projected end date",
      description: [
        "This workflow starts on a specific date relative to an employee's projected end date. Configure the timing and offset below."
      ],
      selectLabel: "Trigger when projected end date...",
      selectOptions: ["Occurs"]
    },
    "last-day-of-work": {
      title: "Last day of work",
      description: [
        "This workflow starts on a specific date relative to an employee's last day of work. Configure the timing and offset below."
      ],
      selectLabel: "Trigger when last day of work...",
      selectOptions: ["Occurs"]
    },
    "object-employee-any-record": {
      title: "Any Employee record",
      description: [
        "This workflow starts whenever any Employee record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when Any Employee record...",
      selectOptions: ["Is created", "Is updated"]
    },
    "rwebb_co_department": {
      title: "rwebb_co_department",
      description: [
        "This workflow starts whenever a rwebb_co_department record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when rwebb_co_department...",
      selectOptions: ["Is created", "Is updated"]
    },
    "rwebb_co_work_location": {
      title: "rwebb_co_work_location",
      description: [
        "This workflow starts whenever a rwebb_co_work_location record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when rwebb_co_work_location...",
      selectOptions: ["Is created", "Is updated"]
    },
    "rwebb_co_manager": {
      title: "rwebb_co_manager",
      description: [
        "This workflow starts whenever a rwebb_co_manager record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when rwebb_co_manager...",
      selectOptions: ["Is created", "Is updated"]
    },
    "rwebb_co_title": {
      title: "rwebb_co_title",
      description: [
        "This workflow starts whenever a rwebb_co_title record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when rwebb_co_title...",
      selectOptions: ["Is created", "Is updated"]
    },
    "rwebb_co_employment_status": {
      title: "rwebb_co_employment_status",
      description: [
        "This workflow starts whenever a rwebb_co_employment_status record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when rwebb_co_employment_status...",
      selectOptions: ["Is created", "Is updated"]
    },
    "rwebb_co_base_compensation": {
      title: "rwebb_co_base_compensation",
      description: [
        "This workflow starts whenever a rwebb_co_base_compensation record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when rwebb_co_base_compensation...",
      selectOptions: ["Is created", "Is updated"]
    },
    "rwebb_co_last_day_of_work": {
      title: "rwebb_co_last_day_of_work",
      description: [
        "This workflow starts whenever a rwebb_co_last_day_of_work record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both."
      ],
      selectLabel: "Trigger when rwebb_co_last_day_of_work...",
      selectOptions: ["Is created", "Is updated"]
    },
    "ats-applicant-reaches-specific-state": {
      title: "Applicant moves to a new stage",
      description: [
        "Triggers when an applicant moves to a different stage within any milestone. Fires on every stage transition, enabling granular tracking of candidate progress."
      ],
      selectLabel: "",
      selectOptions: []
    },
    "applicant-hits-milestone": {
      title: "Applicant hits a new milestone",
      description: [
        "Triggers when an applicant reaches the Screen, Final Interview, Offer, or Offer Accepted milestones. If an applicant progresses through all of these stages, the workflow will trigger four separate times. This workflow does not trigger at the Application Review stage."
      ],
      selectLabel: "",
      selectOptions: []
    },
    "applicant-moves-to-offer-stage": {
      title: "Applicant moves to offer stage",
      description: [
        "Unlike \"Applicant moves to a new stage\" or \"Applicant hits a new milestone,\" this event triggers only when the applicant moves to the Offer stage."
      ],
      selectLabel: "",
      selectOptions: []
    },
    "document-status": {
      title: "Document status",
      description: [
        "Fires when an action occurs on a Rippling document. You can configure this trigger to run when a document is sent, viewed, signed, deleted, or expires."
      ],
      selectLabel: "Trigger when document...",
      selectOptions: ["Is sent", "Is viewed", "Is signed", "Is deleted", "Expires"]
    },
    "leave-request-status": {
      title: optionLabel || "Leave request status",
      description: [
        "Fires when a new time off request is created in Rippling, including vacation, sick time, and other leaves of absence. Requests imported via CSV are excluded. You can configure this trigger to run when a request is submitted, approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when leave request...",
      selectOptions: ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"]
    },
    "employee-goes-on-leave": {
      title: "Employee goes on leave",
      description: [
        "Fires on the first business day of an employee's leave, including vacation, sick time, and other leaves of absence."
      ],
      selectLabel: "Trigger when employee goes on leave...",
      selectOptions: ["Occurs"]
    },
    "employee-returns-from-leave": {
      title: "Employee returns from leave",
      description: [
        "Fires on the first business day an employee returns from time off, including vacation, sick time, and other leaves of absence."
      ],
      selectLabel: "Trigger when employee returns from leave...",
      selectOptions: ["Occurs"]
    },
    "request-is-approved": {
      title: useModal2Data ? "Any request is approved" : "Request is approved",
      description: useModal2Data 
        ? ["This workflow starts when any request is approved."]
        : ["This workflow starts when a request is approved. You can configure which types of requests trigger the workflow."],
      selectLabel: useModal2Data ? "" : "Trigger when this is approved",
      selectOptions: useModal2Data ? [] : ["Any request type", ...REQUEST_TYPES]
    },
    "request-is-rejected": {
      title: useModal2Data ? "Any request is rejected" : "Request is rejected",
      description: useModal2Data 
        ? ["This workflow starts when any request is rejected."]
        : ["This workflow starts when a request is rejected. You can configure which types of requests trigger the workflow."],
      selectLabel: useModal2Data ? "" : "Trigger when this is rejected",
      selectOptions: useModal2Data ? [] : ["Any request type", ...REQUEST_TYPES]
    },
    "app-access-request-status": {
      title: optionLabel || "App access request status",
      description: [
        "This workflow starts when an app access request reaches a specific approval status. The workflow will trigger once the request has enough approvals to change its status."
      ],
      selectLabel: "Trigger when app access request...",
      selectOptions: ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"]
    },
    "course-completed": {
      title: "Course completed",
      description: [
        "Triggers when the status of a course changes to complete"
      ],
      selectLabel: "Trigger when course...",
      selectOptions: ["Is completed"]
    },
    // Approval request triggers for modal 2
    "apps-request": {
      title: optionLabel || "Apps request",
      description: [
        "Triggers when an apps request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when apps request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "app-install-request": {
      title: optionLabel || "App install request",
      description: [
        "Triggers when an app install request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when app install request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "banking-new-payment-request": {
      title: optionLabel || "Banking new payment request",
      description: [
        "Triggers when a banking new payment request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when banking new payment request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "benefits-carrier-request-request": {
      title: optionLabel || "Benefits carrier request",
      description: [
        "Triggers when a benefits carrier request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when benefits carrier request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "chat-channel-creation-request": {
      title: optionLabel || "Chat channel creation request",
      description: [
        "Triggers when a chat channel creation request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when chat channel creation request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "chat-channel-groups-update-request": {
      title: optionLabel || "Chat channel groups update request",
      description: [
        "Triggers when a chat channel groups update request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when chat channel groups update request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "contract-creation-request": {
      title: optionLabel || "Contract creation request",
      description: [
        "Triggers when a contract creation request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when contract creation request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "invoice-submission-request": {
      title: optionLabel || "Invoice submission request",
      description: [
        "Triggers when an invoice submission request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when invoice submission request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "contract-negotiation-request": {
      title: optionLabel || "Contract negotiation request",
      description: [
        "Triggers when a contract negotiation request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when contract negotiation request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "custom-object-data-row-delete-request": {
      title: optionLabel || "Custom object data row delete request",
      description: [
        "Triggers when a custom object data row delete request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when custom object data row delete request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "custom-object-data-row-create-request": {
      title: optionLabel || "Custom object data row create request",
      description: [
        "Triggers when a custom object data row create request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when custom object data row create request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "custom-object-data-row-update-request": {
      title: optionLabel || "Custom object data row update request",
      description: [
        "Triggers when a custom object data row update request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when custom object data row update request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "custom-object-data-row-run-business-process-request": {
      title: optionLabel || "Custom object data row run business process request",
      description: [
        "Triggers when a custom object data row run business process request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when custom object data row run business process request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "devices-request": {
      title: optionLabel || "Devices request",
      description: [
        "Triggers when a devices request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when devices request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "global-payroll-process-request-approval-request": {
      title: optionLabel || "Global payroll process request approval request",
      description: [
        "Triggers when a global payroll process request approval request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when global payroll process request approval request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "backfill-headcount-request": {
      title: optionLabel || "Backfill headcount request",
      description: [
        "Triggers when a backfill headcount request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when backfill headcount request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "new-headcount-request": {
      title: optionLabel || "New headcount request",
      description: [
        "Triggers when a new headcount request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when new headcount request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "edit-headcount-request": {
      title: optionLabel || "Edit headcount request",
      description: [
        "Triggers when an edit headcount request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when edit headcount request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "close-headcount-request": {
      title: optionLabel || "Close headcount request",
      description: [
        "Triggers when a close headcount request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when close headcount request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "forecasted-attrition-headcount-request": {
      title: optionLabel || "Forecasted attrition headcount request",
      description: [
        "Triggers when a forecasted attrition headcount request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when forecasted attrition headcount request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "headcount-request": {
      title: optionLabel || "Headcount request",
      description: [
        "Triggers when a headcount request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when headcount request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "transition-request": {
      title: optionLabel || "Transition request",
      description: [
        "Triggers when a transition request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when transition request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "personal-info-changes-request": {
      title: optionLabel || "Personal info changes request",
      description: [
        "Triggers when a personal info changes request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when personal info changes request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "payroll-run-request-approval-request": {
      title: optionLabel || "Payroll run request approval request",
      description: [
        "Triggers when a payroll run request approval request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when payroll run request approval request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "grant-developer-permission-request": {
      title: optionLabel || "Grant developer permission request",
      description: [
        "Triggers when a grant developer permission request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when grant developer permission request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "procurement-request": {
      title: optionLabel || "Procurement request",
      description: [
        "Triggers when a procurement request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when procurement request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "ats-offer-letter-request": {
      title: optionLabel || "Ats offer letter request",
      description: [
        "Triggers when an ats offer letter request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when ats offer letter request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "ats-job-requisition-create-request-request": {
      title: optionLabel || "Ats job requisition create request",
      description: [
        "Triggers when an ats job requisition create request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when ats job requisition create request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "ats-job-requisition-edit-request-request": {
      title: optionLabel || "Ats job requisition edit request",
      description: [
        "Triggers when an ats job requisition edit request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when ats job requisition edit request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "ats-decision-to-hire-request-request": {
      title: optionLabel || "Ats decision to hire request",
      description: [
        "Triggers when an ats decision to hire request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when ats decision to hire request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "rpass-request": {
      title: optionLabel || "Rpass request",
      description: [
        "Triggers when an rpass request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when rpass request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-change-request": {
      title: optionLabel || "Scheduling change request",
      description: [
        "Triggers when a scheduling change request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling change request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-edit-shift-request": {
      title: optionLabel || "Scheduling edit shift request",
      description: [
        "Triggers when a scheduling edit shift request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling edit shift request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-cover-offer-request": {
      title: optionLabel || "Scheduling cover offer request",
      description: [
        "Triggers when a scheduling cover offer request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling cover offer request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-drop-shift-request": {
      title: optionLabel || "Scheduling drop shift request",
      description: [
        "Triggers when a scheduling drop shift request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling drop shift request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-swap-offer-request": {
      title: optionLabel || "Scheduling swap offer request",
      description: [
        "Triggers when a scheduling swap offer request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling swap offer request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-employee-shift-confirm-request": {
      title: optionLabel || "Scheduling employee shift confirm request",
      description: [
        "Triggers when a scheduling employee shift confirm request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling employee shift confirm request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-shift-publish-request": {
      title: optionLabel || "Scheduling shift publish request",
      description: [
        "Triggers when a scheduling shift publish request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling shift publish request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "scheduling-employee-shift-publish-request": {
      title: optionLabel || "Scheduling employee shift publish request",
      description: [
        "Triggers when a scheduling employee shift publish request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when scheduling employee shift publish request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "refresh-schedule-change-request": {
      title: optionLabel || "Refresh schedule change request",
      description: [
        "Triggers when a refresh schedule change request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when refresh schedule change request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "spend-request": {
      title: optionLabel || "Spend request",
      description: [
        "Triggers when a spend request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when spend request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "time-entry-request": {
      title: optionLabel || "Time entry request",
      description: [
        "Triggers when a time entry request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when time entry request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "flight-approval-request": {
      title: optionLabel || "Flight approval request",
      description: [
        "Triggers when a flight approval request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when flight approval request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "flight-pre-approval-request": {
      title: optionLabel || "Flight pre approval request",
      description: [
        "Triggers when a flight pre approval request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when flight pre approval request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    "variable-compensation-payee-payout-v1-request": {
      title: optionLabel || "Variable compensation payee payout v1 request",
      description: [
        "Triggers when a variable compensation payee payout v1 request reaches a specific approval status. You can choose to trigger this workflow when a request is fully approved, rejected, or canceled."
      ],
      selectLabel: "Trigger when variable compensation payee payout v1 request...",
      selectOptions: ["Is fully approved", "Is rejected", "Is canceled"]
    },
    // Add all other trigger details here - using a fallback for any missing ones
  };
  
  // Handle expanded status options (e.g., "new-hire-status-submitted")
  // This must happen BEFORE the fallback logic
  if (statusOptionMatch && baseOptionId && statusOption) {
    // Special case: rejection-reason-status-updated should be styled as an event (no dropdown)
    // Check both the exact optionId and the baseOptionId + statusOption combination
    if (optionId === "rejection-reason-status-updated" || 
        (baseOptionId === "rejection-reason-status" && statusOption === "updated")) {
      return {
        title: "Rejection reason is updated",
        description: ["Triggers when an ATS applicant rejection reason changes."],
        selectLabel: "",
        selectOptions: []
      };
    }
    
    // Try to get base details from the details object
    let baseDetails = details[baseOptionId];
    
    // If not found, try to generate it using the fallback logic
    if (!baseDetails) {
      // Check if it's a status trigger (ending in -status)
      if (baseOptionId.endsWith("-status") || optionLabel?.toLowerCase().endsWith("status")) {
        const label = optionLabel || baseOptionId
          .replace(/-status$/, "")
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        
        const labelWithoutStatus = label.replace(/\s+status$/i, "");
        
        baseDetails = {
          title: label,
          description: ["This workflow starts when this status changes. You can configure which status changes trigger the workflow."],
          selectLabel: `Trigger when ${labelWithoutStatus}...`,
          selectOptions: ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"]
        };
      }
    }
    
    if (baseDetails) {
      // Map status slugs back to display text
      const statusDisplayMap: Record<string, string> = {
        "submitted": "Is submitted",
        "approved": "Is fully approved",
        "rejected": "Is rejected",
        "canceled": "Is canceled",
        "sent": "Is sent",
        "viewed": "Is viewed",
        "signed": "Is signed",
        "deleted": "Is deleted",
        "expires": "Expires",
        "created": "Is created",
        "updated": "Is updated",
        "offer-stage": "Offer stage",
        "final-stage": "Final stage",
        "is-effective": "Is effective"
      };
      
      const statusDisplay = statusDisplayMap[statusOption] || statusOption;
      
      // Generate specific description based on the status
      // Use optionLabel first (which should be the expanded label like "New hire request is submitted")
      // Extract entity name from the option label
      let entityName = "";
      if (optionLabel) {
        // Remove the status part from the label (e.g., "New hire request is submitted" -> "New hire request")
        entityName = optionLabel
          .replace(/\s+is\s+(submitted|fully approved|rejected|canceled|sent|viewed|signed|deleted|expires|created|updated)$/i, "")
          .replace(/\s+reaches\s+(offer stage|final stage)$/i, "")
          .replace(/\s+is\s+effective$/i, "")
          .trim();
      } else {
        // Fallback: use base title and remove "status"
        const baseTitle = baseDetails.title || baseOptionId;
        entityName = baseTitle.replace(/\s+status$/i, "").trim();
      }
      
      const statusDescriptionMap: Record<string, string> = {
        "submitted": `This workflow starts when ${entityName.toLowerCase()} is submitted.`,
        "approved": `This workflow starts when ${entityName.toLowerCase()} is fully approved.`,
        "rejected": `This workflow starts when ${entityName.toLowerCase()} is rejected.`,
        "canceled": `This workflow starts when ${entityName.toLowerCase()} is canceled.`,
        "sent": `This workflow starts when ${entityName.toLowerCase()} is sent.`,
        "viewed": `This workflow starts when ${entityName.toLowerCase()} is viewed.`,
        "signed": `This workflow starts when ${entityName.toLowerCase()} is signed.`,
        "deleted": `This workflow starts when ${entityName.toLowerCase()} is deleted.`,
        "expires": `This workflow starts when ${entityName.toLowerCase()} expires.`,
        "created": `This workflow starts when ${entityName.toLowerCase()} is created.`,
        "updated": `This workflow starts when ${entityName.toLowerCase()} is updated.`,
        "offer-stage": `This workflow starts when an applicant reaches the offer stage in your ATS.`,
        "final-stage": `This workflow starts when an applicant reaches the final stage in your ATS.`,
        "is-effective": `This workflow starts when ${entityName.toLowerCase()} is effective.`
      };
      
      const description = statusDescriptionMap[statusOption] || baseDetails.description[0] || `This workflow starts when ${entityName.toLowerCase()} ${statusDisplay.toLowerCase()}.`;
      
      return {
        title: optionLabel || baseDetails.title,
        description: [description],
        selectLabel: baseDetails.selectLabel,
        selectOptions: [statusDisplay] // Only show the selected status
      };
    }
  }
  
  // If not found in details, try to generate from optionId
  if (!details[optionId]) {
    // Special cases for specific status triggers
    if (optionId === "application-status") {
      return {
        title: optionLabel || "Application status",
        description: [optionDescription || "This workflow starts when an application's status changes. You can configure which status changes trigger the workflow."],
        selectLabel: "Trigger when application...",
        selectOptions: ["Is submitted", "Is rejected"]
      };
    }
    
    if (optionId === "applicant-profile-status") {
      // Modal 1: Show as "Applicant profile created" without dropdown
      if (isModal1) {
        return {
          title: "Applicant profile created",
          description: ["Triggers when an ATS applicant is created in Rippling."],
          selectLabel: "",
          selectOptions: []
        };
      }
      return {
        title: optionLabel || "Applicant profile status",
        description: [optionDescription || "Triggers when an ATS applicant is created in Rippling."],
        selectLabel: "Trigger when applicant profile...",
        selectOptions: ["Is created"]
      };
    }
    
    if (optionId === "rejection-reason-status") {
      // Modal 1: Show as "Rejection reason updated" without dropdown
      if (isModal1) {
        return {
          title: "Rejection reason updated",
          description: ["This workflow starts immediately when a rejection reason is updated."],
          selectLabel: "",
          selectOptions: []
        };
      }
      return {
        title: optionLabel || "Rejection reason status",
        description: [optionDescription || "This workflow starts when a rejection reason is created or updated. You can configure whether to trigger on creation, updates, or both."],
        selectLabel: "Trigger when rejection reason...",
        selectOptions: ["Is created", "Is updated"]
      };
    }
    
    // Special handling for job-requisition-status in modal 1
    if (optionId === "job-requisition-status" && isModal1) {
      return {
        title: "Job requisitions is created",
        description: ["This workflow starts immediately when a job requisition is created."],
        selectLabel: "",
        selectOptions: []
      };
    }
    
    // Special handling for application-status in modal 1
    if (optionId === "application-status" && isModal1) {
      return {
        title: "Application rejected",
        description: ["This workflow starts immediately when an application is rejected."],
        selectLabel: "",
        selectOptions: []
      };
    }
    
    // Special handling for job-requisition-status-created in modal 3 (no dropdown)
    if (optionId === "job-requisition-status-created") {
      return {
        title: "Job requisition is created",
        description: ["This workflow starts immediately when a job requisition is created."],
        selectLabel: "",
        selectOptions: []
      };
    }
    
    // For status triggers (ending in -status), use standard status options
    if (optionId.endsWith("-status") || optionLabel?.toLowerCase().endsWith("status")) {
      const label = optionLabel || optionId
        .replace(/-status$/, "")
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      
      // Remove "status" from the label if present
      const labelWithoutStatus = label.replace(/\s+status$/i, "");
      
      const description = optionDescription || "This workflow starts when this status changes. You can configure which status changes trigger the workflow.";
      
      return {
        title: optionLabel || label,
        description: [description],
        selectLabel: `Trigger when ${labelWithoutStatus}...`,
        selectOptions: ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"]
      };
    }
    
    // For object creation triggers, use generic format
    if (optionId.startsWith("object-")) {
      // Handle "any-record" options for custom objects
      if (optionId.includes("-any-record")) {
        // Extract object name from optionId (e.g., "object-custom_project-any-record" -> "Project")
        const objectNameMatch = optionId.match(/object-(.+?)-any-record/);
        if (objectNameMatch) {
          const objectNameParts = objectNameMatch[1].split("_");
          const objectName = objectNameParts
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          
          return {
            title: `Any ${objectName} record`,
            description: [
              `This workflow starts whenever any ${objectName} record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both.`
            ],
            selectLabel: `Trigger when Any ${objectName} record...`,
            selectOptions: ["Is created", "Is updated"]
          };
        }
      }
      
      // Handle field change options for custom objects
      // Extract object name and field name (e.g., "object-custom_project-name" -> "Project" and "name")
      const objectFieldMatch = optionId.match(/object-(.+?)-(.+)$/);
      if (objectFieldMatch) {
        const [, objectPart, fieldPart] = objectFieldMatch;
        const objectNameParts = objectPart.split("_");
        const objectName = objectNameParts
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        
        // Convert field name from snake_case to Title Case
        const fieldNameParts = fieldPart.split("_");
        const fieldName = fieldNameParts
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        
        // Use provided description or generate one, then add the additional sentence
        const baseDescription = optionDescription || `This workflow starts whenever a ${objectName} record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both.`;
        // Ensure baseDescription ends with a period
        const baseDescriptionWithPeriod = baseDescription.endsWith('.') ? baseDescription : `${baseDescription}.`;
        const additionalSentence = `Selecting this option adds a trigger that fires when a ${objectName.toLowerCase()} is updated and their ${fieldName.toLowerCase()} changes.`;
        const description = `${baseDescriptionWithPeriod} ${additionalSentence}`;
        
        return {
          title: `${fieldName} change`,
          description: [description],
          selectLabel: `Trigger when ${fieldName}...`,
          selectOptions: ["Changes at all", "Changes to"]
        };
      }
      
      // Fallback for other object- prefixed options (e.g., employee fields)
      const label = optionLabel || optionId
        .replace("object-", "")
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      
      // Extract field name by removing " change" or " changes" suffix if present
      const fieldName = label.endsWith(" change") ? label.replace(" change", "") : 
                        label.endsWith(" changes") ? label.replace(" changes", "") : label;
      
      // Use provided description or generate one, then add the additional sentence
      const baseDescription = optionDescription || `This workflow starts whenever a ${label} record is created or updated in Rippling. You can configure whether to trigger on creation, updates, or both.`;
      // Ensure baseDescription ends with a period
      const baseDescriptionWithPeriod = baseDescription.endsWith('.') ? baseDescription : `${baseDescription}.`;
      const additionalSentence = `Selecting this option adds a trigger that fires when an employee is updated and their ${fieldName.toLowerCase()} changes.`;
      const description = `${baseDescriptionWithPeriod} ${additionalSentence}`;
      
      return {
        title: label,
        description: [description],
        selectLabel: `Trigger when ${fieldName}...`,
        selectOptions: ["Changes at all", "Changes to"]
      };
    }
    
    // Fallback
    const description = optionDescription || "This workflow starts when this trigger condition is met. Configure the specific conditions below.";
    return {
      title: optionLabel || optionId.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      description: [description],
      selectLabel: "Trigger when...",
      selectOptions: ["Occurs"]
    };
  }
  
  // If details exist but we have a custom description, use it
  let result = details[optionId] || details[baseOptionId];
  
  // Check if we're in the Approvals > HR Management section (approval request version)
  const isApprovalRequestVersion = itemId === "approvals" && subItemId === "hr-management-approvals";
  
  // Update descriptions for HR Management options to differentiate between approval request and product versions
  if (result && isApprovalRequestVersion) {
    const approvalRequestDescriptions: Record<string, string[]> = {
      "new-hire-status": [
        "Triggers when a hiring approval request reaches a specific status. This trigger listens to the approval request status and pulls data available in the approval request."
      ],
      "termination-request-status": [
        "Triggers when a termination approval request reaches a specific status. This trigger listens to the approval request status and pulls data available in the approval request."
      ],
      "profile-change-status": [
        "Triggers when an employment change approval request reaches a specific status. This trigger listens to the approval request status and pulls data available in the approval request."
      ],
      "personal-info-changes-request": [
        "Triggers when a personal info change approval request reaches a specific status. This trigger listens to the approval request status and pulls data available in the approval request."
      ]
    };
    
    if (approvalRequestDescriptions[optionId] || approvalRequestDescriptions[baseOptionId]) {
      result = {
        ...result,
        description: approvalRequestDescriptions[optionId] || approvalRequestDescriptions[baseOptionId] || result.description
      };
    }
    
    // Filter out "Is submitted" and "Is effective" from HR Management options under Approvals
    if (result.selectOptions) {
      const filteredOptions = result.selectOptions.filter(opt => 
        opt !== "Is submitted" && opt !== "Is effective"
      );
      result = {
        ...result,
        selectOptions: filteredOptions
      };
    }
  } else if (result && itemId === "hr-management" && categoryId === "something-happens") {
    // Update descriptions for top-level HR Management (product version)
    const productDescriptions: Record<string, string[]> = {
      "new-hire-status": [
        "Triggers when the hiring flow is completed in Rippling. This trigger listens to the product status and data that appears and is available in the product. You can choose to trigger this workflow when a hiring request is submitted, approved, rejected, or canceled."
      ],
      "termination-request-status": [
        "Fires when the offboarding flow is completed in Rippling. This trigger listens to the product status and data that appears and is available in the product. You can configure this trigger to run when the offboarding request is submitted, approved, rejected, or canceled. A person's last day of employment and system access shutoff may be scheduled for a later date."
      ],
      "profile-change-status": [
        "Fires when an active worker's personal or employment information changes. This trigger listens to the product status and data that appears and is available in the product. This excludes updates made while the worker is not active (for example, after an offer is accepted or after termination). You can choose to trigger this workflow when a change request is submitted, approved, rejected, canceled, or is effective."
      ]
    };
    
    if (productDescriptions[optionId] || productDescriptions[baseOptionId]) {
      result = {
        ...result,
        description: productDescriptions[optionId] || productDescriptions[baseOptionId] || result.description
      };
    }
  }
  
  if (optionDescription) {
    return {
      ...result,
      description: [optionDescription]
    };
  }
  
  return result;
};

// Build search index from all categories, items, and options
const buildSearchIndex = (categories: TriggerCategory[]): SearchResult[] => {
  const results: SearchResult[] = [];
  
  categories.forEach((category) => {
    const categoryBreadcrumb = [category.label];
    let bucket: "popular" | "when-something-happens" | "fields" = "when-something-happens";
    
    // Determine bucket based on category
    if (category.id === "popular") {
      bucket = "popular";
    } else if (category.id === "something-happens") {
      bucket = "when-something-happens";
    }
    
    category.items.forEach((item) => {
      const itemBreadcrumb = [...categoryBreadcrumb, item.label];
      
      // If item has options (triggers), add them
      if (item.options) {
        item.options.forEach((option) => {
          // For object creation fields, use "fields" bucket
          const optionBucket = option.id.startsWith("object-") && !option.id.includes("-any-record") 
            ? "fields" 
            : bucket;
          
          // Create unique ID by combining category, item, and option IDs
          const uniqueId = `${category.id}-${item.id}-${option.id}`;
          
          results.push({
            id: uniqueId,
            label: option.label,
            breadcrumbs: [...itemBreadcrumb],
            bucket: optionBucket,
            optionId: option.id,
            option: option,
            categoryId: category.id,
            itemId: item.id,
          });
        });
      }
      
      // If item has sub-items, traverse them
      if (item.items) {
        item.items.forEach((subItem) => {
          const subItemBreadcrumb = [...itemBreadcrumb, subItem.label];
          
          if (subItem.options) {
            subItem.options.forEach((option) => {
              // For object creation fields, use "fields" bucket
              const optionBucket = option.id.startsWith("object-") && !option.id.includes("-any-record") 
                ? "fields" 
                : bucket;
              
              // Create unique ID by combining category, item, subItem, and option IDs
              const uniqueId = `${category.id}-${item.id}-${subItem.id}-${option.id}`;
              
              results.push({
                id: uniqueId,
                label: option.label,
                breadcrumbs: [...subItemBreadcrumb],
                bucket: optionBucket,
                optionId: option.id,
                option: option,
                categoryId: category.id,
                itemId: item.id,
                subItemId: subItem.id,
              });
            });
          }
        });
      }
    });
  });
  
  return results;
};

// Rank search results
const rankResults = (query: string, results: SearchResult[]): SearchResult[] => {
  const lowerQuery = query.toLowerCase();
  
  // Filter results that match
  const matched = results.filter((result) => 
    result.label.toLowerCase().includes(lowerQuery)
  );
  
  // Sort by bucket priority, then by match type, then by length, then alphabetically
  return matched.sort((a, b) => {
    // Bucket priority: popular > when-something-happens > fields
    const bucketPriority: Record<string, number> = {
      "popular": 0,
      "when-something-happens": 1,
      "fields": 2,
    };
    const bucketDiff = bucketPriority[a.bucket] - bucketPriority[b.bucket];
    if (bucketDiff !== 0) return bucketDiff;
    
    // Within bucket: startsWith > contains
    const aStartsWith = a.label.toLowerCase().startsWith(lowerQuery);
    const bStartsWith = b.label.toLowerCase().startsWith(lowerQuery);
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    
    // Then by length (shorter first)
    const lengthDiff = a.label.length - b.label.length;
    if (lengthDiff !== 0) return lengthDiff;
    
    // Then alphabetically
    return a.label.localeCompare(b.label);
  });
};

// Render highlighted label with bold matching portions
const renderHighlightedLabel = (label: string, query: string): React.ReactNode => {
  if (!query) return label;
  
  const lowerLabel = label.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = lowerLabel.indexOf(lowerQuery, lastIndex);
  
  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push(label.substring(lastIndex, index));
    }
    
    // Add bold match (preserve original casing)
    parts.push(
      <strong key={index} className="font-semibold">
        {label.substring(index, index + query.length)}
      </strong>
    );
    
    lastIndex = index + query.length;
    index = lowerLabel.indexOf(lowerQuery, lastIndex);
  }
  
  // Add remaining text
  if (lastIndex < label.length) {
    parts.push(label.substring(lastIndex));
  }
  
  return <>{parts}</>;
};

// Helper function to get status options for an option ID
const getStatusOptionsForOption = (optionId: string, optionLabel?: string): string[] | null => {
  // Map of option IDs to their status options
  const statusOptionsMap: Record<string, string[]> = {
    "new-hire-status": ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"],
    "profile-change-status": ["Is submitted", "Is fully approved", "Is rejected", "Is canceled", "Is effective"],
    "termination-request-status": ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"],
    "leave-request-status": ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"],
    "document-status": ["Is sent", "Is viewed", "Is signed", "Is deleted", "Expires"],
    "application-status": ["Is submitted", "Is rejected"],
    "applicant-profile-status": ["Is created"],
    "rejection-reason-status": ["Is created", "Is updated"],
    "job-requisition-status": ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"],
    "app-access-request-status": ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"],
  };
  
  // Check direct mapping
  if (statusOptionsMap[optionId]) {
    return statusOptionsMap[optionId];
  }
  
  // Exclude offer-status and employment-agreement-status from generic status expansion (they're now simple events)
  if (optionId === "offer-status" || optionId === "employment-agreement-status") {
    return null;
  }
  
  // Check if it ends with -status (generic status trigger)
  if (optionId.endsWith("-status")) {
    return ["Is submitted", "Is fully approved", "Is rejected", "Is canceled"];
  }
  
  return null;
};

// Function to expand status options into separate options
const expandStatusOptions = (categories: TriggerCategory[], specificOptionIds?: string[], isModal2?: boolean, isModal3?: boolean): TriggerCategory[] => {
  return categories.map((category) => {
    // Only expand for "popular" and "something-happens" categories
    if (category.id !== "popular" && category.id !== "something-happens") {
      return category;
    }

    return {
      ...category,
      items: category.items.map((item) => {
        if (!item.options) {
          return item;
        }

        const expandedOptions: TriggerOption[] = [];
        
        item.options.forEach((option) => {
          // If specificOptionIds is provided, only expand those options
          // Otherwise, expand all status options (for modal 2)
          const shouldExpand = specificOptionIds 
            ? specificOptionIds.includes(option.id)
            : true;
          
          if (!shouldExpand) {
            // Keep non-expanded options as-is
            expandedOptions.push(option);
            return;
          }
          
          // Get status options for this option
          let statusOptions = getStatusOptionsForOption(option.id, option.label);
          
          // Modal 2 specific filtering
          if (isModal2 && statusOptions) {
            if (option.id === "application-status") {
              // Remove "Is submitted" from application-status
              statusOptions = statusOptions.filter(opt => opt !== "Is submitted");
            } else if (option.id === "job-requisition-status") {
              // Change "Is submitted" to "Is created" and remove other options
              statusOptions = ["Is created"];
            } else if (option.id === "rejection-reason-status") {
              // Remove "Is created" from rejection-reason-status
              statusOptions = statusOptions.filter(opt => opt !== "Is created");
            }
          }
          
          // Modal 3 specific filtering
          if (isModal3 && statusOptions) {
            if (option.id === "application-status") {
              // Remove "Is submitted" from application-status
              statusOptions = statusOptions.filter(opt => opt !== "Is submitted");
            } else if (option.id === "job-requisition-status") {
              // Change "Is submitted" to "Is created" and remove other options
              statusOptions = ["Is created"];
            } else if (option.id === "rejection-reason-status") {
              // Remove "Is created" from rejection-reason-status
              statusOptions = statusOptions.filter(opt => opt !== "Is created");
            }
          }
          
          // Check if this option has status options (more than just "Occurs")
          if (statusOptions && statusOptions.length > 0) {
            // Expand into separate options for each status
            statusOptions.forEach((statusOption) => {
              // Create a status slug from the option text
              const statusSlug = statusOption.toLowerCase()
                .replace(/^is /, "")
                .replace(/\s+/g, "-")
                .replace(/fully-approved/g, "approved")
                .replace(/offer-stage/g, "offer-stage")
                .replace(/final-stage/g, "final-stage");
              
              const expandedOptionId = `${option.id}-${statusSlug}`;
              const baseLabel = option.label.replace(/\s+status$/i, "").trim();
              
              // Special handling for ATS applicant reaches specific state
              let expandedLabel: string;
              if (option.id === "ats-applicant-reaches-specific-state") {
                if (statusOption === "Any new stage") {
                  expandedLabel = "Applicant moves to any new stage";
                } else if (statusOption === "Screen, final interview, offer, or offer accepted") {
                  expandedLabel = "Applicant moves to screen, final interview, offer, or offer accepted";
                } else if (statusOption === "Offer state") {
                  expandedLabel = "Applicant moves to offer state";
                } else {
                  expandedLabel = `${baseLabel} ${statusOption.toLowerCase()}`;
                }
              } else if (option.id === "job-requisition-status" && statusOption === "Is created") {
                // Special handling for job-requisition-status-created in modal 3
                expandedLabel = "Job requisition is created";
              } else {
                expandedLabel = `${baseLabel} ${statusOption.toLowerCase()}`;
              }
              
              // For job-requisition-status-created, use the label as-is (already properly capitalized)
              const finalLabel = (option.id === "job-requisition-status" && statusOption === "Is created") 
                ? expandedLabel 
                : expandedLabel.charAt(0).toUpperCase() + expandedLabel.slice(1);
              
              expandedOptions.push({
                id: expandedOptionId,
                label: finalLabel,
                dataType: option.dataType,
                description: option.description
              });
            });
          } else {
            // Keep non-status options as-is
            expandedOptions.push(option);
          }
        });

        return {
          ...item,
          options: expandedOptions
        };
      })
    };
  });
};

export default function TriggerSelector({
  open,
  onOpenChange,
  expandStatusOptions: shouldExpand = false,
  expandSpecificOptions,
  useListIconForEvents = false,
  useModal2Data = false,
  onTriggerConfirm,
  initialBrowseSelection = null,
}: TriggerSelectorProps) {
  // Use expanded categories if shouldExpand is true or if expandSpecificOptions is provided
  const categoriesToUse = useMemo(() => {
    // If using modal 2 data, use that structure
    if (useModal2Data) {
      return triggerCategoriesModal2;
    }
    
    // Determine if we're in modal 1 (no expansion)
    const isModal1 = !shouldExpand && (!expandSpecificOptions || expandSpecificOptions.length === 0);
    
    if (shouldExpand) {
      // Modal 2: expand all status options with modal 2 specific filtering
      return expandStatusOptions(triggerCategories, undefined, true);
    } else if (expandSpecificOptions && expandSpecificOptions.length > 0) {
      // Modal 3: expand only specific options with modal 3 specific filtering
      return expandStatusOptions(triggerCategories, expandSpecificOptions, false, true);
    }
    // Modal 1: use original categories but update labels for specific options
    if (isModal1) {
      return triggerCategories.map(category => {
        // Update labels in both "popular" and "something-happens" categories
        if (category.id === "popular" || category.id === "something-happens") {
          return {
            ...category,
            items: category.items.map(item => {
              // Update labels in Recruiting items
              if (item.id === "recruiting" || item.id === "recruiting-something") {
                return {
                  ...item,
                  options: item.options?.map(option => {
                    // Update labels for modal 1
                    if (option.id === "applicant-profile-status") {
                      return { ...option, label: "Applicant profile created" };
                    }
                    if (option.id === "job-requisition-status") {
                      return { ...option, label: "Job requisitions is created" };
                    }
                    if (option.id === "application-status") {
                      return { ...option, label: "Application rejected" };
                    }
                    if (option.id === "rejection-reason-status") {
                      return { ...option, label: "Rejection reason updated" };
                    }
                    return option;
                  })
                };
              }
              return item;
            })
          };
        }
        return category;
      });
    }
    return triggerCategories;
  }, [shouldExpand, expandSpecificOptions]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  
  // Animation state: track navigation direction for pane transitions
  // Direction: 'forward' = drilling deeper (new content from right), 'back' = going back (content from left)
  const [navigationDirection, setNavigationDirection] = useState<'forward' | 'back' | null>(null);
  const prevSelectedOptionIdRef = useRef<string | null>(null);
  const prevSelectedSubItemIdRef = useRef<string | null>(null);
  const prevBreadcrumbPathRef = useRef<typeof breadcrumbPath>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedSearchResultId, setSelectedSearchResultId] = useState<string | null>(null);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState<number>(-1);
  const [searchFilter, setSearchFilter] = useState<"all" | "events" | "dates" | "cud">("all");
  const [objectTypeFilter, setObjectTypeFilter] = useState<"all" | "native" | "custom">("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const activeResultRef = useRef<HTMLButtonElement>(null);
  const searchFieldRef = useRef<HTMLDivElement>(null);
  
  // Pre-search state snapshot
  const preSearchStateRef = useRef<{
    selectedCategoryId: string | null;
    selectedItemId: string | null;
    selectedSubItemId: string | null;
    selectedOptionId: string | null;
  } | null>(null);
  
  // Form state for relative-to-date triggers
  const [timingOption, setTimingOption] = useState<string>("on-this-date");
  const [offsetMode, setOffsetMode] = useState<string>("exactly");
  const [offsetValue, setOffsetValue] = useState<string>("");
  const [offsetMin, setOffsetMin] = useState<string>("");
  const [offsetMax, setOffsetMax] = useState<string>("");
  const [timeValue, setTimeValue] = useState<string>("11:00 AM");
  const [selectedTriggerOption, setSelectedTriggerOption] = useState<string>("");
  const [timezoneValue, setTimezoneValue] = useState<string>("Your local timezone");
  const [anniversaryOnly, setAnniversaryOnly] = useState<boolean>(false);
  
  // State for approval request type selection
  const [approvalRequestType, setApprovalRequestType] = useState<string>("Any request type");

  const [scheduleTriggerDate, setScheduleTriggerDate] = useState("");
  const [scheduleTimeValue, setScheduleTimeValue] = useState("");
  const [scheduleRepeatKind, setScheduleRepeatKind] = useState<ScheduleRepeatKind>("dont-repeat");
  const [scheduleCustomInterval, setScheduleCustomInterval] = useState("1");
  const [scheduleCustomCadence, setScheduleCustomCadence] = useState<CustomCadence>("days");
  
  // State for "Changes to" input values
  const [changesToTextValue, setChangesToTextValue] = useState<string>("");
  const [changesToNumberValue, setChangesToNumberValue] = useState<string>("");
  const [changesToCurrencyValue, setChangesToCurrencyValue] = useState<string>("");
  const [changesToDateValue, setChangesToDateValue] = useState<string>("");
  const [changesToMultiselectValue, setChangesToMultiselectValue] = useState<string[]>([]);
  const [isMultiselectOpen, setIsMultiselectOpen] = useState<boolean>(false);
  const [changesToPersonValue, setChangesToPersonValue] = useState<string>("");
  const [isPersonSelectOpen, setIsPersonSelectOpen] = useState<boolean>(false);

  // Memoize search index
  const searchIndex = useMemo(() => buildSearchIndex(categoriesToUse), [categoriesToUse]);
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Compute search results with filter
  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    const allResults = rankResults(debouncedSearchQuery, searchIndex);
    
    // Always exclude popular use case results
    let filteredResults = allResults.filter(result => result.bucket !== "popular" && result.categoryId !== "popular");
    
    // Apply original filter (all/events/dates/cud)
    if (searchFilter === "all") {
      // Keep all results
    } else if (searchFilter === "events") {
      // Show only results from "Common events" category (something-happens)
      filteredResults = filteredResults.filter(result => {
        return result.categoryId === "something-happens";
      });
    } else if (searchFilter === "dates") {
      // Show only results from "Relative to a date" category
      filteredResults = filteredResults.filter(result => {
        return result.categoryId === "relative-to-date";
      });
    } else if (searchFilter === "cud") {
      // Show only results from "Data changes" category (object-creation-updates)
      filteredResults = filteredResults.filter(result => {
        // Include fields bucket (Employee fields)
        if (result.bucket === "fields") return true;
        // Include items under object-creation-updates
        if (result.breadcrumbs.some(bc => bc === "Data changes" || bc === "Object creation and updates" || bc === "Object Creation and Updates")) return true;
        // Check if it's under "object-creation-updates" category
        if (result.categoryId === "object-creation-updates") return true;
        return false;
      });
    }
    
    // Apply object type filter (all/native/custom)
    if (objectTypeFilter === "all") {
      // Keep all results
    } else if (objectTypeFilter === "native") {
      // Exclude custom objects (rwebb_co_*)
      filteredResults = filteredResults.filter(result => {
        return !result.optionId?.startsWith("rwebb_co_");
      });
    } else if (objectTypeFilter === "custom") {
      // Show only custom objects (rwebb_co_*)
      filteredResults = filteredResults.filter(result => {
        return result.optionId?.startsWith("rwebb_co_") || false;
      });
    }
    
    return filteredResults;
  }, [debouncedSearchQuery, searchIndex, searchFilter, objectTypeFilter]);
  
  // Reset active index when results change (but don't auto-select first result)
  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveSearchResultIndex(-1);
    }
    // Don't auto-set to 0 - only set via keyboard navigation
  }, [searchResults]);
  
  // Scroll active result into view
  useEffect(() => {
    if (activeResultRef.current && searchResultsRef.current) {
      activeResultRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeSearchResultIndex]);
  
  // Snapshot pre-search state when entering search mode
  useEffect(() => {
    if (debouncedSearchQuery.trim() && !preSearchStateRef.current) {
      preSearchStateRef.current = {
        selectedCategoryId,
        selectedItemId,
        selectedSubItemId,
        selectedOptionId,
      };
    }
  }, [debouncedSearchQuery, selectedCategoryId, selectedItemId, selectedSubItemId, selectedOptionId]);
  
  // Handle search clear
  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setSelectedSearchResultId(null);
    setActiveSearchResultIndex(-1);
    setSearchFilter("all");
    setObjectTypeFilter("all");
    setIsFilterDropdownOpen(false);
    
    // Restore pre-search state
    if (preSearchStateRef.current) {
      setSelectedCategoryId(preSearchStateRef.current.selectedCategoryId);
      setSelectedItemId(preSearchStateRef.current.selectedItemId);
      setSelectedSubItemId(preSearchStateRef.current.selectedSubItemId);
      setSelectedOptionId(preSearchStateRef.current.selectedOptionId);
      preSearchStateRef.current = null;
    }
  }, []);

  // Handle click outside filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };

    if (isFilterDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isFilterDropdownOpen]);
  
  // Handle search result selection
  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    setSelectedSearchResultId(result.id);
    // Initialize approval state if selecting an approval option
    if (result.option && (result.option.id === "request-is-approved" || result.option.id === "request-is-rejected")) {
      setApprovalRequestType((prev) => prev || "Any request type");
    } else {
      setApprovalRequestType("Any request type");
    }
    if (result.option?.id === SET_SCHEDULE_OPTION_ID) {
      const now = new Date();
      setScheduleTriggerDate(formatDateYYYYMMDD(now));
      setScheduleTimeValue(formatNextHourRoundedLocal(now));
      setScheduleRepeatKind("dont-repeat");
      setScheduleCustomInterval("1");
      setScheduleCustomCadence("days");
    }
    // Don't navigate away from search mode - just select the result for details view
  }, []);
  
  // Handle keyboard navigation in search
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!debouncedSearchQuery.trim() || searchResults.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSearchResultIndex((prev) => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSearchResultIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && activeSearchResultIndex >= 0) {
      e.preventDefault();
      const result = searchResults[activeSearchResultIndex];
      if (result) {
        handleSearchResultSelect(result);
      }
    }
  }, [debouncedSearchQuery, searchResults, activeSearchResultIndex, handleSearchResultSelect]);

  // Reset search/timing when modal opens; optionally jump to a browse path (e.g. Start date detail).
  useEffect(() => {
    if (!open) return;

    setSearchQuery("");
    setDebouncedSearchQuery("");
    setSelectedSearchResultId(null);
    setActiveSearchResultIndex(-1);
    setSearchFilter("all");
    setObjectTypeFilter("all");
    setIsFilterDropdownOpen(false);
    preSearchStateRef.current = null;
    setTimingOption("on-this-date");
    setOffsetMode("exactly");
    setOffsetValue("");
    setOffsetMin("");
    setOffsetMax("");
    setTimeValue("11:00 AM");
    setTimezoneValue("Your local timezone");
    setAnniversaryOnly(false);
    setNavigationDirection(null);
    prevSelectedOptionIdRef.current = null;
    prevSelectedSubItemIdRef.current = null;
    prevBreadcrumbPathRef.current = [];

    if (initialBrowseSelection) {
      setSelectedCategoryId(initialBrowseSelection.categoryId);
      setSelectedItemId(initialBrowseSelection.itemId);
      setSelectedSubItemId(initialBrowseSelection.subItemId ?? null);
      setSelectedOptionId(initialBrowseSelection.optionId);
    } else {
      setSelectedCategoryId("popular");
      setSelectedItemId(null);
      setSelectedSubItemId(null);
      setSelectedOptionId(null);
    }
  }, [
    open,
    initialBrowseSelection?.categoryId,
    initialBrowseSelection?.itemId,
    initialBrowseSelection?.subItemId,
    initialBrowseSelection?.optionId,
  ]);

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
        // Modal is closing, reset to defaults
        setSelectedCategoryId(null);
        setSelectedItemId(null);
        setSelectedSubItemId(null);
        setSelectedOptionId(null);
      setSearchQuery("");
      setTimingOption("on-this-date");
      setOffsetMode("exactly");
      setOffsetValue("");
      setOffsetMin("");
      setOffsetMax("");
      setTimeValue("11:00 AM");
      setTimezoneValue("Your local timezone");
      setAnniversaryOnly(false);
      setApprovalRequestType("Any request type");
      // Reset "Changes to" input values
      setChangesToTextValue("");
      setChangesToNumberValue("");
      setChangesToCurrencyValue("");
      setChangesToDateValue("");
      setChangesToMultiselectValue([]);
      setIsMultiselectOpen(false);
      setChangesToPersonValue("");
      setIsPersonSelectOpen(false);
      setScheduleTriggerDate("");
      setScheduleTimeValue("");
      setScheduleRepeatKind("dont-repeat");
      setScheduleCustomInterval("1");
      setScheduleCustomCadence("days");
    }
    onOpenChange(newOpen);
  };
  
  // Check if current selection is a date-related trigger (relative-to-date category or date options)
  const isDateRelatedOption = (optionId: string) => {
    // Exclude rejection-reason-status-updated (it's an event, not a date)
    if (optionId === "rejection-reason-status-updated") {
      return false;
    }
    // Exclude approval request triggers (ending with "-request") - they're events, not dates
    if (optionId.endsWith("-request")) {
      return false;
    }
    return optionId.includes("date") || optionId.includes("Date") || 
           optionId.includes("deadline") ||
           optionId.includes("-day-") || optionId.endsWith("-day") ||
           optionId === "birthday" || optionId === "work-anniversary" ||
           optionId === "processed-at";
  };
  // Exclude date fields under "Data changes" category from date UX form
  // These should use the same UX as other fields in that pane
  const isObjectCreationUpdateDateField = selectedOptionId?.startsWith("object-") && 
                                          selectedCategoryId === "object-creation-updates";
  
  const isRelativeToDateTrigger = (selectedCategoryId === "relative-to-date" && selectedOptionId) || 
                                   (selectedOptionId && isDateRelatedOption(selectedOptionId) && !isObjectCreationUpdateDateField);

  const isSetScheduleTrigger = selectedOptionId === SET_SCHEDULE_OPTION_ID;

  const selectedCategory = categoriesToUse.find((cat) => cat.id === selectedCategoryId);
  const selectedItem = selectedCategory?.items.find((item) => item.id === selectedItemId);
  const selectedSubItem = selectedItem?.items?.find((item) => item.id === selectedSubItemId);
  const selectedOption = selectedSubItem?.options?.find((opt) => opt.id === selectedOptionId) || 
                         selectedItem?.options?.find((opt) => opt.id === selectedOptionId);
  // Determine if we're in modal 1 (no expansion)
  const isModal1 = !shouldExpand && (!expandSpecificOptions || expandSpecificOptions.length === 0);
  const triggerDetails = selectedOptionId ? getTriggerDetails(selectedOptionId, selectedOption?.label, selectedOption?.description, selectedCategoryId || undefined, selectedItemId || undefined, selectedSubItemId || undefined, isModal1, useModal2Data) : null;

  const handleCategorySelect = (categoryId: string) => {
    console.log('handleCategorySelect called with:', categoryId);
    setSelectedCategoryId(categoryId);
    setSelectedSubItemId(null);
    if (categoryId === "set-schedule") {
      setSelectedItemId(SET_SCHEDULE_ITEM_ID);
      setSelectedOptionId(SET_SCHEDULE_OPTION_ID);
      const now = new Date();
      setScheduleTriggerDate(formatDateYYYYMMDD(now));
      setScheduleTimeValue(formatNextHourRoundedLocal(now));
      setScheduleRepeatKind("dont-repeat");
      setScheduleCustomInterval("1");
      setScheduleCustomCadence("days");
    } else {
      setSelectedItemId(null);
      setSelectedOptionId(null);
    }
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedSubItemId(null);
    if (selectedCategoryId === "set-schedule" && itemId === SET_SCHEDULE_ITEM_ID) {
      setSelectedOptionId(SET_SCHEDULE_OPTION_ID);
    } else {
      setSelectedOptionId(null);
    }
  };

  const handleSubItemSelect = (subItemId: string) => {
    setSelectedSubItemId(subItemId);
    setSelectedOptionId(null);
  };

  const handleOptionSelect = (optionId: string) => {
    setSelectedOptionId(optionId);
    // Reset approval state if switching to a non-approval option
    if (optionId !== "request-is-approved" && optionId !== "request-is-rejected") {
      setApprovalRequestType("Any request type");
    }
    // Reset "Changes to" input values when switching options
    setChangesToTextValue("");
    setChangesToNumberValue("");
    setChangesToCurrencyValue("");
    setChangesToDateValue("");
    setChangesToMultiselectValue([]);
    setSelectedTriggerOption("");
    setIsMultiselectOpen(false);
    setChangesToPersonValue("");
    setIsPersonSelectOpen(false);
  };
  
  // Reset approval state when option changes
  useEffect(() => {
    if (selectedOptionId !== "request-is-approved" && selectedOptionId !== "request-is-rejected") {
      setApprovalRequestType("Any request type");
    } else if (selectedOptionId === "request-is-approved" || selectedOptionId === "request-is-rejected") {
      // Initialize to "Any request type" if not already set
      if (!approvalRequestType) {
        setApprovalRequestType("Any request type");
      }
    }
  }, [selectedOptionId, approvalRequestType]);
  
  // Reset "Changes to" input values when dropdown changes away from "Changes to"
  useEffect(() => {
    if (selectedTriggerOption !== "Changes to") {
      setChangesToTextValue("");
      setChangesToNumberValue("");
      setChangesToCurrencyValue("");
      setChangesToDateValue("");
      setChangesToMultiselectValue([]);
      setIsMultiselectOpen(false);
      setChangesToPersonValue("");
      setIsPersonSelectOpen(false);
    }
  }, [selectedTriggerOption]);
  
  // Close multiselect dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMultiselectOpen && !target.closest('.multiselect-container')) {
        setIsMultiselectOpen(false);
      }
      if (isPersonSelectOpen && !target.closest('.person-select-container')) {
        setIsPersonSelectOpen(false);
      }
    };
    
    if (isMultiselectOpen || isPersonSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMultiselectOpen, isPersonSelectOpen]);

  const handleSelectTrigger = () => {
    if (selectedSearchResultId && debouncedSearchQuery.trim()) {
      const selectedResult = searchResults.find((r) => r.id === selectedSearchResultId);
      if (selectedResult?.option) {
        let displayLabel = selectedResult.option.label;
        if (isRelativeToDateTrigger && timeValue) {
          displayLabel += ` at ${timeValue}`;
        }
        onTriggerConfirm?.({
          displayLabel,
          optionId: selectedResult.option.id,
        });
        onOpenChange(false);
        return;
      }
    }

    if (selectedOption) {
      let displayLabel: string;
      if (isSetScheduleTrigger) {
        displayLabel = `On a set schedule — ${scheduleTriggerDate} at ${scheduleTimeValue}`;
        if (timezoneValue) displayLabel += ` (${timezoneValue})`;
        if (scheduleRepeatKind !== "dont-repeat") {
          displayLabel += ` · ${scheduleRepeatKind}`;
        }
      } else {
        displayLabel = selectedOption.label;
        if (isRelativeToDateTrigger && timeValue) {
          displayLabel += ` at ${timeValue}`;
        }
      }
      onTriggerConfirm?.({ displayLabel, optionId: selectedOption.id });
      onOpenChange(false);
    }
  };

  // Build breadcrumb path with navigation handlers
  const breadcrumbPath = (() => {
    const fullPath = [
      { label: "Browse", level: 0 as const },
      selectedCategory ? { label: selectedCategory.label, level: 1 as const, categoryId: selectedCategory.id } : null,
      selectedItem && selectedCategoryId ? { label: selectedItem.label, level: 2 as const, categoryId: selectedCategoryId, itemId: selectedItem.id } : null,
      selectedSubItem && selectedCategoryId ? { label: selectedSubItem.label, level: 3 as const, categoryId: selectedCategoryId, itemId: selectedItemId, subItemId: selectedSubItem.id } : null,
      selectedOption && selectedCategoryId ? { label: selectedOption.label, level: 4 as const, categoryId: selectedCategoryId, itemId: selectedItemId, subItemId: selectedSubItemId, optionId: selectedOption.id } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (selectedCategoryId === "set-schedule" && selectedCategory) {
      return [
        { label: "Browse", level: 0 as const },
        { label: selectedCategory.label, level: 1 as const, categoryId: selectedCategory.id },
      ];
    }
    return fullPath;
  })();

  // Track navigation direction based on state changes
  // Forward navigation: selectedOptionId changes from null to value, or selectedSubItemId changes from null to value
  // Back navigation: selectedOptionId changes from value to null, or breadcrumb path shortens
  useEffect(() => {
    // Detect drill-in to trigger details (forward)
    if (selectedOptionId !== prevSelectedOptionIdRef.current) {
      if (selectedOptionId && !prevSelectedOptionIdRef.current) {
        setNavigationDirection('forward');
      } else if (!selectedOptionId && prevSelectedOptionIdRef.current) {
        setNavigationDirection('back');
      }
      prevSelectedOptionIdRef.current = selectedOptionId;
    }
    
    // Detect navigation to 4th pane (forward)
    if (selectedSubItemId !== prevSelectedSubItemIdRef.current) {
      if (selectedSubItemId && !prevSelectedSubItemIdRef.current) {
        setNavigationDirection('forward');
      } else if (!selectedSubItemId && prevSelectedSubItemIdRef.current) {
        setNavigationDirection('back');
      }
      prevSelectedSubItemIdRef.current = selectedSubItemId;
    }
    
    // Detect breadcrumb navigation (back)
    const currentBreadcrumbLength = breadcrumbPath.length;
    const prevBreadcrumbLength = prevBreadcrumbPathRef.current.length;
    if (currentBreadcrumbLength < prevBreadcrumbLength) {
      setNavigationDirection('back');
    } else if (currentBreadcrumbLength > prevBreadcrumbLength) {
      setNavigationDirection('forward');
    }
    prevBreadcrumbPathRef.current = breadcrumbPath;
    
    // Reset direction after animation completes
    if (navigationDirection) {
      const timer = setTimeout(() => setNavigationDirection(null), 320);
      return () => clearTimeout(timer);
    }
  }, [selectedOptionId, selectedSubItemId, breadcrumbPath, navigationDirection]);

  // Calculate visible panes: exclude "Browse" and take the last 3
  const breadcrumbsWithoutBrowse = breadcrumbPath.slice(1);
  const visiblePanes = breadcrumbsWithoutBrowse.slice(-3);
  
  // Track navigation direction based on state changes
  // Forward navigation: selectedOptionId changes from null to value, or selectedSubItemId changes from null to value
  // Back navigation: selectedOptionId changes from value to null, or breadcrumb path shortens
  useEffect(() => {
    // Detect drill-in to trigger details (forward)
    if (selectedOptionId !== prevSelectedOptionIdRef.current) {
      if (selectedOptionId && !prevSelectedOptionIdRef.current) {
        setNavigationDirection('forward');
      } else if (!selectedOptionId && prevSelectedOptionIdRef.current) {
        setNavigationDirection('back');
      }
      prevSelectedOptionIdRef.current = selectedOptionId;
    }
    
    // Detect navigation to 4th pane (forward)
    if (selectedSubItemId !== prevSelectedSubItemIdRef.current) {
      if (selectedSubItemId && !prevSelectedSubItemIdRef.current) {
        setNavigationDirection('forward');
      } else if (!selectedSubItemId && prevSelectedSubItemIdRef.current) {
        setNavigationDirection('back');
      }
      prevSelectedSubItemIdRef.current = selectedSubItemId;
    }
    
    // Detect breadcrumb navigation (back)
    const currentBreadcrumbLength = breadcrumbPath.length;
    const prevBreadcrumbLength = prevBreadcrumbPathRef.current.length;
    if (currentBreadcrumbLength < prevBreadcrumbLength) {
      setNavigationDirection('back');
    } else if (currentBreadcrumbLength > prevBreadcrumbLength) {
      setNavigationDirection('forward');
    }
    prevBreadcrumbPathRef.current = breadcrumbPath;
    
    // Reset direction after animation completes
    if (navigationDirection) {
      const timer = setTimeout(() => setNavigationDirection(null), 320);
      return () => clearTimeout(timer);
    }
  }, [selectedOptionId, selectedSubItemId, breadcrumbPath, navigationDirection]);
  
  // Debug: log visible panes when sub-item is selected
  if (selectedSubItemId !== null) {
    console.log('[Breadcrumb] breadcrumbPath:', breadcrumbPath.map(p => `${p.label} (level ${p.level})`));
    console.log('[Breadcrumb] breadcrumbsWithoutBrowse:', breadcrumbsWithoutBrowse.map(p => `${p.label} (level ${p.level})`));
    console.log('[Breadcrumb] visiblePanes:', visiblePanes.map(p => `${p.label} (level ${p.level})`));
  }
  
  // Check for reduced motion preference - respect user's accessibility settings
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      
      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const handleBreadcrumbClick = (breadcrumb: typeof breadcrumbPath[0]) => {
    if (breadcrumb.level === 0) {
      // Reset to initial state (no selection)
      setSelectedCategoryId(null);
      setSelectedItemId(null);
      setSelectedSubItemId(null);
      setSelectedOptionId(null);
    } else if (breadcrumb.level === 1 && breadcrumb.categoryId) {
      // Navigate to category
      setSelectedCategoryId(breadcrumb.categoryId);
      setSelectedSubItemId(null);
      if (breadcrumb.categoryId === "set-schedule") {
        setSelectedItemId(SET_SCHEDULE_ITEM_ID);
        setSelectedOptionId(SET_SCHEDULE_OPTION_ID);
        const now = new Date();
        setScheduleTriggerDate(formatDateYYYYMMDD(now));
        setScheduleTimeValue(formatNextHourRoundedLocal(now));
        setScheduleRepeatKind("dont-repeat");
        setScheduleCustomInterval("1");
        setScheduleCustomCadence("days");
      } else {
        setSelectedItemId(null);
        setSelectedOptionId(null);
      }
    } else if (breadcrumb.level === 2 && breadcrumb.categoryId && breadcrumb.itemId) {
      // Navigate to item
      setSelectedCategoryId(breadcrumb.categoryId);
      setSelectedItemId(breadcrumb.itemId);
      setSelectedSubItemId(null);
      if (breadcrumb.categoryId === "set-schedule" && breadcrumb.itemId === SET_SCHEDULE_ITEM_ID) {
        setSelectedOptionId(SET_SCHEDULE_OPTION_ID);
      } else {
        setSelectedOptionId(null);
      }
    } else if (breadcrumb.level === 3 && breadcrumb.categoryId && breadcrumb.itemId && breadcrumb.subItemId) {
      // Navigate to sub-item
      setSelectedCategoryId(breadcrumb.categoryId);
      setSelectedItemId(breadcrumb.itemId);
      setSelectedSubItemId(breadcrumb.subItemId);
      setSelectedOptionId(null);
    } else if (breadcrumb.level === 4 && breadcrumb.categoryId && breadcrumb.itemId && breadcrumb.optionId) {
      // Navigate to option (sub-item may be null when options sit directly under an item)
      setSelectedCategoryId(breadcrumb.categoryId);
      setSelectedItemId(breadcrumb.itemId);
      setSelectedSubItemId(breadcrumb.subItemId ?? null);
      setSelectedOptionId(breadcrumb.optionId);
    }
  };

  // Helper function to render a pane based on a breadcrumb node
  const renderPaneFromBreadcrumb = (breadcrumb: typeof breadcrumbPath[0], index: number) => {
    // CRITICAL: Never render level 1 (browse pane) when a sub-item is selected (4+ levels deep)
    // This should never happen if filtering is correct, but this is a safety check
    if (breadcrumb.level === 1) {
      if (selectedSubItemId !== null) {
        console.error('[renderPaneFromBreadcrumb] CRITICAL ERROR: Attempted to render level 1 pane when sub-item is selected! This should never happen.');
        return null;
      }
    }
    
    if (breadcrumb.level === 1 && breadcrumb.categoryId) {
      
      // Render category pane (browse pane)
      const category = categoriesToUse.find((cat) => cat.id === breadcrumb.categoryId);
      if (!category) return null;

      // Generate unique key for animation tracking
      // Animation logic: new panes (last in array when forward) slide in from right
      // Existing panes shift left smoothly via CSS transition
      const paneKey = `${breadcrumb.level}-${breadcrumb.categoryId || ''}`;
      const isNewPane = navigationDirection === 'forward' && index === visiblePanes.length - 1;
      
      return (
        <div 
          key={paneKey}
          className={cn(
            "w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto",
            isNewPane && !prefersReducedMotion && "pane-enter-forward"
          )}
          style={{
            transition: prefersReducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {categoriesToUse.map((cat) => {
            const Icon = getCategoryIcon(cat.id);
            const isSelected = breadcrumb.categoryId === cat.id;
            
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={cn(
                  "w-full flex items-start justify-between px-[18px] transition-colors border-b border-[#e0dede] text-left",
                  isSelected
                    ? "bg-[#e1d8d2]"
                    : "bg-white hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 py-3">
                  {Icon && (
                    <Icon className="size-4 text-[#6f6f72] shrink-0" />
                  )}
                  <div className="flex flex-col items-start flex-1 min-w-0 text-left">
                    <p className={cn(
                      "text-base leading-6 truncate w-full text-left mt-1",
                      isSelected ? "font-medium" : "font-normal"
                    )} style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}>
                      {cat.label}
                    </p>
                    <p className="text-[12px] leading-[16px] tracking-[0.5px] text-[#202022] font-sans font-normal text-left mb-1">
                      {getCategoryDescription(cat.id)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center self-stretch">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                    <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      );
    } else if (breadcrumb.level === 2 && breadcrumb.categoryId && breadcrumb.itemId) {
      // Render item pane
      const category = categoriesToUse.find((cat) => cat.id === breadcrumb.categoryId);
      const items = category?.items || [];

      // Generate unique key for animation tracking
      const paneKey = `${breadcrumb.level}-${breadcrumb.categoryId || ''}-${breadcrumb.itemId || ''}`;
      const isNewPane = navigationDirection === 'forward' && index === visiblePanes.length - 1;
      
      return (
        <div 
          key={paneKey}
          className={cn(
            "w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto",
            isNewPane && !prefersReducedMotion && "pane-enter-forward"
          )}
          style={{
            transition: prefersReducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div className="pt-2 px-[18px]">
            <div className="h-[33px] flex flex-col justify-end">
              <div className="flex gap-3 items-center">
                <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                  {breadcrumb.categoryId === "relative-to-date" ? "Popular categories" : "Select a use case"}
                </p>
              </div>
              <div className="bg-[#d9d9d9] h-px w-full mt-1" />
            </div>
          </div>

          {items.map((item, itemIndex) => {
            const isSelected = breadcrumb.itemId === item.id;
            const isTimeOff = item.id === "object-time-off";
            const isAccountingIntegrations = item.id === "object-accounting-integrations";
            
            return (
              <div key={item.id}>
                {isAccountingIntegrations && (
                  <div className="pt-2 px-[18px]">
                    <div className="h-[33px] flex flex-col justify-end">
                      <div className="flex gap-3 items-center">
                        <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                          Categories
                        </p>
                      </div>
                      <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleItemSelect(item.id)}
                  className={cn(
                    "w-full h-10 flex items-center justify-between px-[18px] transition-colors",
                    isSelected
                      ? "bg-[#e1d8d2]"
                      : "bg-white hover:bg-gray-50"
                  )}
                >
                  <p className={cn(
                    "flex-1 text-base leading-6 truncate text-left font-normal"
                  )} style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}>
                    {item.label}
                  </p>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                    <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      );
    } else if (breadcrumb.level === 3 && breadcrumb.categoryId && breadcrumb.itemId && breadcrumb.subItemId) {
      // Render sub-item pane (showing sub-items list)
      const category = categoriesToUse.find((cat) => cat.id === breadcrumb.categoryId);
      const item = category?.items.find((i) => i.id === breadcrumb.itemId);
      const subItems = item?.items || [];
      const itemOptions = item?.options || [];

      // Generate unique key for animation tracking
      const paneKey = `${breadcrumb.level}-${breadcrumb.categoryId || ''}-${breadcrumb.itemId || ''}-${breadcrumb.subItemId || ''}`;
      const isNewPane = navigationDirection === 'forward' && index === visiblePanes.length - 1;
      
      return (
        <div 
          key={paneKey}
          className={cn(
            "w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto",
            isNewPane && !prefersReducedMotion && "pane-enter-forward"
          )}
          style={{
            transition: prefersReducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Show options first if they exist */}
          {itemOptions.length > 0 && (
            <>
              <div className="pt-2 px-[18px]">
                <div className="h-[33px] flex flex-col justify-end">
                  <div className="flex gap-3 items-center">
                    <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                      Select a trigger
                    </p>
                  </div>
                  <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                </div>
              </div>

              {itemOptions.map((option) => {
                const Icon = getOptionIcon(option.id, option.dataType, breadcrumb.categoryId || undefined, breadcrumb.itemId || undefined, useListIconForEvents);
                const isSelected = breadcrumb.optionId === option.id;
                
                return (
                  <div key={option.id}>
                    <button
                      onClick={() => handleOptionSelect(option.id)}
                      className={cn(
                        "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                        isSelected
                          ? "bg-[#e1d8d2]"
                          : "hover:bg-gray-50"
                      )}
                    >
                      {Icon && (
                        <Icon className="size-4 text-[#6f6f72] shrink-0" />
                      )}
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <p
                          className={cn("min-w-0 flex-1 text-base leading-6 truncate text-left font-normal")}
                          style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}
                        >
                          {option.label}
                        </p>
                        <BasicWorkflowEligibilityBadge optionId={option.id} />
                      </div>
                    </button>
                  </div>
                );
              })}
              
              {/* Separator between options and sub-items */}
              <div className="pt-2 px-[18px]">
                <div className="h-[33px] flex flex-col justify-end">
                  <div className="flex gap-3 items-center">
                    <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                      Popular categories
                    </p>
                  </div>
                  <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                </div>
              </div>
            </>
          )}
          
          {/* Show sub-items */}
          {itemOptions.length === 0 && (
            <div className="pt-2 px-[18px]">
              <div className="h-[33px] flex flex-col justify-end">
                <div className="flex gap-3 items-center">
                  <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                    Popular categories
                  </p>
                </div>
                <div className="bg-[#d9d9d9] h-px w-full mt-1" />
              </div>
            </div>
          )}

          {subItems.map((subItem) => {
            const isSelected = breadcrumb.subItemId === subItem.id;
            const isTimeOff = subItem.id === "object-time-off";
            
            return (
              <div key={subItem.id}>
                <button
                  onClick={() => handleSubItemSelect(subItem.id)}
                  className={cn(
                    "w-full h-10 flex items-center justify-between px-[18px] transition-colors",
                    isSelected
                      ? "bg-[#e1d8d2]"
                      : "bg-white hover:bg-gray-50"
                  )}
                >
                  <p className={cn(
                    "flex-1 text-base leading-6 truncate text-left font-normal"
                  )} style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}>
                    {subItem.label}
                  </p>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                </svg>
                </button>
                {isTimeOff && (
                  <div className="pt-2 px-[18px]">
                    <div className="h-[33px] flex flex-col justify-end">
                      <div className="flex gap-3 items-center">
                        <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                          Select a category
                        </p>
                      </div>
                      <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    } else if (breadcrumb.level === 4 && breadcrumb.categoryId && breadcrumb.itemId && breadcrumb.subItemId && breadcrumb.optionId) {
      // Render option pane (showing options)
      const category = categoriesToUse.find((cat) => cat.id === breadcrumb.categoryId);
      const item = category?.items.find((i) => i.id === breadcrumb.itemId);
      const subItem = item?.items?.find((si) => si.id === breadcrumb.subItemId);
      const options = subItem?.options || item?.options || [];

      // Generate unique key for animation tracking
      const paneKey = `${breadcrumb.level}-${breadcrumb.categoryId || ''}-${breadcrumb.itemId || ''}-${breadcrumb.subItemId || ''}-${breadcrumb.optionId || ''}`;
      const isNewPane = navigationDirection === 'forward' && index === visiblePanes.length - 1;
      
      return (
        <div 
          key={paneKey}
          className={cn(
            "flex-1 bg-white overflow-y-auto",
            isNewPane && !prefersReducedMotion && "pane-enter-forward"
          )}
          style={{
            transition: prefersReducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div className="pt-2 px-[18px]">
            <div className="h-[33px] flex flex-col justify-end">
              <div className="flex gap-3 items-center">
                <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                  Select a trigger
                </p>
              </div>
              <div className="bg-[#d9d9d9] h-px w-full mt-1" />
            </div>
          </div>

          {options.map((option) => {
            const Icon = getOptionIcon(option.id, option.dataType, breadcrumb.categoryId || undefined, breadcrumb.subItemId || breadcrumb.itemId || undefined, useListIconForEvents);
            const isSelected = breadcrumb.optionId === option.id;
            const isEmployeeAnyRecord = option.id === "object-employee-any-record";
            
            return (
              <div key={option.id}>
                <button
                  onClick={() => handleOptionSelect(option.id)}
                  className={cn(
                    "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                    isSelected
                      ? "bg-[#e1d8d2]"
                      : "hover:bg-gray-50"
                  )}
                >
                  {Icon && (
                    <Icon className="size-4 text-[#6f6f72] shrink-0" />
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <p
                      className="min-w-0 flex-1 text-base leading-6 truncate text-left font-normal"
                      style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}
                    >
                      {option.label}
                    </p>
                    <BasicWorkflowEligibilityBadge optionId={option.id} />
                  </div>
                </button>
                {isEmployeeAnyRecord && (
                  <div className="pt-2 px-[18px]">
                    <div className="h-[33px] flex flex-col justify-end">
                      <div className="flex gap-3 items-center">
                        <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                          Select a specific field
                        </p>
                      </div>
                      <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[939px] h-[689px] p-0 flex flex-col overflow-hidden gap-0 rounded-[16px] sm:rounded-[16px] [&>button]:hidden">
        <DialogTitle className="sr-only">Create a workflow trigger</DialogTitle>
        {/* Header */}
        <div className="border-b border-[#e0dede] h-16 flex items-center justify-between px-4 py-3 bg-white">
          <div className="flex gap-2 items-center">
            <p className="text-lg leading-[22px] text-center" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 535, color: "#000000" }}>
              Create a workflow trigger
            </p>
          </div>
          <div className="flex gap-6 items-center">
            {/* Search */}
            <div ref={searchFieldRef} className="relative flex flex-col items-start gap-1 w-[433px] h-10">
              <input
                type="text"
                placeholder="Find"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  if (searchFieldRef.current) {
                    searchFieldRef.current.classList.remove('gap-1');
                    searchFieldRef.current.classList.add('gap-2');
                  }
                }}
                onBlur={() => {
                  if (searchFieldRef.current && !searchQuery) {
                    searchFieldRef.current.classList.remove('gap-2');
                    searchFieldRef.current.classList.add('gap-1');
                  }
                }}
                className="w-full h-10 pl-11 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-gray-700 placeholder:text-[#8c8888] focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center pointer-events-none">
                <Search className="size-5 text-[#6f6f72]" />
              </div>
              {searchQuery && (
                <button
                  onClick={handleSearchClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded pointer-events-auto"
                  aria-label="Clear search"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5C8.15 5 5 8.15 5 12C5 15.85 8.15 19 12 19C15.85 19 19 15.85 19 12C19 8.15 15.85 5 12 5ZM14.8 14.05L14.1 14.75L12 12.65L9.9 14.75L9.2 14.05L11.3 11.95L9.2 9.85L9.9 9.15L12 11.25L14.1 9.15L14.8 9.85L12.7 11.95L14.8 14.05Z" fill="black"/>
                  </svg>
                </button>
              )}
            </div>
            {/* Close */}
            <button
              onClick={() => handleOpenChange(false)}
              className="relative w-8 h-8 rounded-md flex items-center justify-center hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="size-5 text-[#6f6f72]" />
            </button>
          </div>
        </div>

        <TriggerSelectorBasicExplainer />

        {/* Breadcrumb Navigation or Search Results Count */}
        <div className="bg-white border-b border-[#e0dede] h-10 flex items-center justify-between px-4 shadow-sm py-0">
          {debouncedSearchQuery.trim() ? (
            <div className="flex gap-4 items-center justify-between w-full">
              <span className="text-base leading-6 font-medium" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}>
                {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
              </span>
              <div className="flex gap-2 items-center">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setSearchFilter("all")}
                    className={cn(
                      "box-border flex flex-row items-center transition-colors",
                      searchFilter === "all"
                        ? "bg-[#7A005D] border border-black/20"
                        : "bg-[#F9F7F6] border border-black/10"
                    )}
                    style={{
                      padding: "6px 8px",
                      height: "24px",
                      borderRadius: "6px",
                      gap: searchFilter === "all" ? "0px" : "10px"
                    }}
                  >
                    <span className="flex-none order-0 flex-grow-0" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: searchFilter === "all" ? "#FFFFFF" : "#000000", height: "16px" }}>
                      All
                    </span>
                  </button>
                  <button
                    onClick={() => setSearchFilter("events")}
                    className={cn(
                      "box-border flex flex-row items-center transition-colors",
                      searchFilter === "events"
                        ? "bg-[#7A005D] border border-black/20"
                        : "bg-[#F9F7F6] border border-black/10"
                    )}
                    style={{
                      padding: "6px 8px",
                      height: "24px",
                      borderRadius: "6px",
                      gap: searchFilter === "events" ? "0px" : "10px"
                    }}
                  >
                    <span className="flex-none order-0 flex-grow-0" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: searchFilter === "events" ? "#FFFFFF" : "#000000", height: "16px" }}>
                      Events
                    </span>
                  </button>
                  <button
                    onClick={() => setSearchFilter("dates")}
                    className={cn(
                      "box-border flex flex-row items-center transition-colors",
                      searchFilter === "dates"
                        ? "bg-[#7A005D] border border-black/20"
                        : "bg-[#F9F7F6] border border-black/10"
                    )}
                    style={{
                      padding: "6px 8px",
                      height: "24px",
                      borderRadius: "6px",
                      gap: searchFilter === "dates" ? "0px" : "10px"
                    }}
                  >
                    <span className="flex-none order-0 flex-grow-0" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: searchFilter === "dates" ? "#FFFFFF" : "#000000", height: "16px" }}>
                      Dates
                    </span>
                  </button>
                  <button
                    onClick={() => setSearchFilter("cud")}
                    className={cn(
                      "box-border flex flex-row items-center transition-colors",
                      searchFilter === "cud"
                        ? "bg-[#7A005D] border border-black/20"
                        : "bg-[#F9F7F6] border border-black/10"
                    )}
                    style={{
                      padding: "6px 8px",
                      height: "24px",
                      borderRadius: "6px",
                      gap: searchFilter === "cud" ? "0px" : "10px"
                    }}
                  >
                    <span className="flex-none order-0 flex-grow-0" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: searchFilter === "cud" ? "#FFFFFF" : "#000000", height: "16px" }}>
                      Data changes
                    </span>
                  </button>
                </div>
                <div className="h-4 w-px bg-[#e0dede] mx-1" />
                <div className="flex items-center gap-2">
                  <span className="text-xs leading-4 text-[#6f6f72]" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 400 }}>
                    Scope:
                  </span>
                  <div className="relative" ref={filterDropdownRef}>
                    <button
                      onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                      className="box-border flex flex-row items-center transition-colors bg-[#F9F7F6] border border-black/10 hover:bg-[#F0EDEA]"
                      style={{
                        padding: "6px 8px 6px 12px",
                        height: "24px",
                        borderRadius: "6px",
                        gap: "8px"
                      }}
                    >
                      <span className="flex-none order-0 flex-grow-0" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#000000", height: "16px" }}>
                        {objectTypeFilter === "all" ? "All" : objectTypeFilter === "native" ? "Native fields" : "Custom objects"}
                      </span>
                      <ChevronDown 
                        className={cn(
                          "size-3 text-[#6f6f72] transition-transform",
                          isFilterDropdownOpen && "rotate-180"
                        )}
                      />
                    </button>
                    {isFilterDropdownOpen && (
                      <div className="absolute right-0 mt-1 bg-white border border-[#e0dede] rounded-lg shadow-lg z-50 min-w-[160px] overflow-hidden">
                        <button
                          onClick={() => {
                            setObjectTypeFilter("all");
                            setIsFilterDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors",
                            objectTypeFilter === "all" && "bg-[#e1d8d2]"
                          )}
                          style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#000000" }}
                        >
                          All
                        </button>
                        <button
                          onClick={() => {
                            setObjectTypeFilter("native");
                            setIsFilterDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors",
                            objectTypeFilter === "native" && "bg-[#e1d8d2]"
                          )}
                          style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#000000" }}
                        >
                          Native fields
                        </button>
                        <button
                          onClick={() => {
                            setObjectTypeFilter("custom");
                            setIsFilterDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors",
                            objectTypeFilter === "custom" && "bg-[#e1d8d2]"
                          )}
                          style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, fontSize: "12px", lineHeight: "16px", color: "#000000" }}
                        >
                          Custom objects
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
              <div className="flex gap-1 items-center text-sm">
              {breadcrumbPath.map((crumb, index) => {
                const isActive = index === breadcrumbPath.length - 1;
                return (
                  <div key={index} className="flex items-center gap-1">
                    <button
                      onClick={() => handleBreadcrumbClick(crumb)}
                      disabled={isActive}
                      className={cn(
                        "flex flex-row items-center gap-1 transition-all flex-none order-0 flex-grow-0",
                        "h-6",
                        isActive
                          ? "cursor-default py-0"
                          : "cursor-pointer py-2 hover:text-[#716F6C] hover:underline focus:justify-center focus:py-0 focus:rounded focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                      style={{
                        fontFamily: "'Basel Grotesk'",
                        fontWeight: 430,
                        fontSize: "16px",
                        lineHeight: "24px",
                        color: isActive ? "#000000" : "#716F6C",
                        width: "auto"
                      }}
                    >
                      {crumb.label}
                    </button>
                    {index < breadcrumbPath.length - 1 && (
                      <span className="text-[#8c8888] mx-1">›</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        {debouncedSearchQuery.trim() ? (
          // Search mode: Split view (1/3 results, 2/3 details)
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Search Results (1/3) */}
            <div ref={searchResultsRef} className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No results found
                </div>
              ) : (
                <div>
                  {searchResults.map((result, index) => {
                    const isSelected = selectedSearchResultId === result.id;
                    const isActive = activeSearchResultIndex === index;
                    
                    return (
                      <button
                        key={result.id}
                        ref={isActive ? activeResultRef : null}
                        onClick={() => handleSearchResultSelect(result)}
                        className={cn(
                          "w-full flex items-start justify-start px-[18px] transition-colors border-b border-[#e0dede] text-left",
                          isSelected
                            ? "bg-[#e1d8d2]"
                            : isActive
                            ? "bg-gray-50"
                            : "bg-white hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 py-3">
                          {result.option && (
                            (() => {
                              const Icon = getOptionIcon(result.option.id, result.option.dataType, result.categoryId, result.itemId, useListIconForEvents);
                              return Icon ? <Icon className="size-4 text-[#6f6f72] shrink-0" /> : null;
                            })()
                          )}
                          <div className="flex-1 min-w-0 flex flex-col text-left">
                            <div className="mt-1 flex min-w-0 items-start justify-between gap-2">
                              <p
                                className="min-w-0 flex-1 text-base leading-6 font-normal text-left"
                                style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}
                              >
                                {renderHighlightedLabel(result.label, debouncedSearchQuery)}
                              </p>
                              <BasicWorkflowEligibilityBadge optionId={result.option?.id} />
                            </div>
                            <p className="text-[12px] leading-[16px] tracking-[0.5px] text-[#202022] font-sans font-normal mb-1 text-left break-words">
                              {result.breadcrumbs.join(" / ")}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Right: Details Panel (2/3) */}
            <div className="flex-1 bg-[#f9f7f6] overflow-y-auto">
              {selectedSearchResultId ? (
                (() => {
                  const selectedResult = searchResults.find(r => r.id === selectedSearchResultId);
                  if (!selectedResult || !selectedResult.option) {
                    return (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Select a search result to see details
                      </div>
                    );
                  }
                  
                  const triggerDetails = getTriggerDetails(
                    selectedResult.option.id,
                    selectedResult.option.label,
                    selectedResult.option.description,
                    selectedResult.categoryId,
                    selectedResult.itemId,
                    selectedResult.subItemId,
                    isModal1,
                    useModal2Data
                  );

                  if (selectedResult.option.id === SET_SCHEDULE_OPTION_ID) {
                    return (
                      <div className="flex items-start justify-center py-8">
                        <div className="flex flex-col gap-6 items-start w-[576px]">
                          <SetScheduleForm
                            triggerDate={scheduleTriggerDate}
                            onTriggerDateChange={setScheduleTriggerDate}
                            timeValue={scheduleTimeValue}
                            onTimeValueChange={setScheduleTimeValue}
                            repeatKind={scheduleRepeatKind}
                            onRepeatKindChange={setScheduleRepeatKind}
                            customInterval={scheduleCustomInterval}
                            onCustomIntervalChange={setScheduleCustomInterval}
                            customCadence={scheduleCustomCadence}
                            onCustomCadenceChange={setScheduleCustomCadence}
                          />
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="flex items-start justify-center py-8">
                      <div className="flex flex-col gap-6 items-start w-[576px]">
                        <div>
                          <h2 className="font-sans font-medium text-[22px] leading-[26px] text-black">
                            {triggerDetails.title}
                          </h2>
                          <WorkflowTierImpactLine optionId={selectedResult.option.id} />
                        </div>
                        
                        {/* Trigger Details */}
                        <div>
                          <div className="space-y-1">
                            {triggerDetails.description.map((desc, idx) => (
                              <p key={idx} className="text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}>
                                {desc}
                              </p>
                            ))}
                          </div>
                        </div>
                        
                        {/* Select Input */}
                        {triggerDetails.selectLabel && triggerDetails.selectOptions && triggerDetails.selectOptions.length > 1 && (
                          <>
                            <div className="w-full">
                              <label className="block font-sans font-medium text-[16px] leading-[24px] text-black mb-2">
                                {triggerDetails.selectLabel}
                              </label>
                              <div className="relative">
                                <select 
                                  className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] appearance-none"
                                    value={selectedTriggerOption || (triggerDetails.selectOptions.includes("Is sent") ? "Is sent" : (triggerDetails.selectOptions.includes("Is created") ? "Is created" : (triggerDetails.selectOptions.includes("Is submitted") ? "Is submitted" : triggerDetails.selectOptions[0]))) || ""}
                                    onChange={(e) => setSelectedTriggerOption(e.target.value)}
                                  >
                                    {triggerDetails.selectOptions.map((option, index) => (
                                      <option key={index} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                                </div>
                              </div>
                          </>
                        )}
                        
                        {/* Render "Changes to" input based on field type */}
                        {selectedTriggerOption === "Changes to" && 
                         selectedResult.option.id.startsWith("object-") && 
                         !selectedResult.option.id.includes("-any-record") &&
                         selectedResult.option.dataType && (
                          <div className="w-full" style={{ marginTop: "6px" }}>
                            {(() => {
                              const dataType = selectedResult.option.dataType?.toLowerCase();
                              const optionId = selectedResult.option.id;
                              const isPersonField = optionId.includes("manager") || optionId.includes("employee-link");
                              
                              // Person field (manager) -> single select with avatars
                              if (dataType === "link" && isPersonField) {
                                const employees = [
                                  { id: "emp1", name: "John Doe", avatar: "JD" },
                                  { id: "emp2", name: "Jane Smith", avatar: "JS" },
                                  { id: "emp3", name: "Bob Johnson", avatar: "BJ" },
                                ];
                                
                                const selectedEmployee = employees.find(emp => emp.id === changesToPersonValue);
                                
                                return (
                                  <div className="w-full relative person-select-container">
                                    <button
                                      type="button"
                                      onClick={() => setIsPersonSelectOpen(!isPersonSelectOpen)}
                                      className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {selectedEmployee ? (
                                          <>
                                            <div className="w-6 h-6 rounded-full bg-[#5AA5E7] flex items-center justify-center text-white text-[10px] font-medium shrink-0">
                                              {selectedEmployee.avatar}
                                            </div>
                                            <span className="text-black truncate">{selectedEmployee.name}</span>
                                          </>
                                        ) : (
                                          <span className="text-gray-400">Select employee</span>
                                        )}
                                      </div>
                                      <ChevronDown className={`size-5 text-[#6f6f72] transition-transform shrink-0 ${isPersonSelectOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    {isPersonSelectOpen && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border border-[#e0dede] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {employees.map((employee) => {
                                          const isSelected = changesToPersonValue === employee.id;
                                          return (
                                            <div
                                              key={employee.id}
                                              onClick={() => {
                                                setChangesToPersonValue(employee.id);
                                                setIsPersonSelectOpen(false);
                                              }}
                                              className={`px-4 py-2 cursor-pointer hover:bg-gray-50 flex items-center gap-3 ${
                                                isSelected ? "bg-[#e1d8d2]" : ""
                                              }`}
                                            >
                                              <div className="w-6 h-6 rounded-full bg-[#5AA5E7] flex items-center justify-center text-white text-[10px] font-medium shrink-0">
                                                {employee.avatar}
                                              </div>
                                              <span className="text-[15px] text-black flex-1">{employee.name}</span>
                                              {isSelected && (
                                                <svg className="w-4 h-4 text-[#5AA5E7] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Link (list) -> multiselect dropdown
                              if (dataType === "link") {
                                const multiselectOptions = [
                                  { value: "option1", label: "Option 1" },
                                  { value: "option2", label: "Option 2" },
                                  { value: "option3", label: "Option 3" },
                                ];
                                
                                return (
                                  <div className="w-full relative multiselect-container">
                                    <button
                                      type="button"
                                      onClick={() => setIsMultiselectOpen(!isMultiselectOpen)}
                                      className={`w-full min-h-[40px] pl-4 pr-10 py-2 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] flex items-center justify-between ${
                                        changesToMultiselectValue.length === 0 ? "" : "items-start"
                                      }`}
                                    >
                                      <div className="flex-1 flex flex-wrap gap-2 items-center">
                                        {changesToMultiselectValue.length === 0 ? (
                                          <span className="text-gray-400">Select values</span>
                                        ) : (
                                          changesToMultiselectValue.map((value) => {
                                            const option = multiselectOptions.find(opt => opt.value === value);
                                            if (!option) return null;
                                            return (
                                              <span
                                                key={value}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-[#e1d8d2] rounded text-[13px] text-black"
                                              >
                                                {option.label}
                                                <span
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChangesToMultiselectValue(changesToMultiselectValue.filter(v => v !== value));
                                                  }}
                                                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5 cursor-pointer"
                                                  role="button"
                                                  tabIndex={0}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setChangesToMultiselectValue(changesToMultiselectValue.filter(v => v !== value));
                                                    }
                                                  }}
                                                >
                                                  <X className="size-3 text-[#6f6f72]" />
                                                </span>
                                              </span>
                                            );
                                          })
                                        )}
                                      </div>
                                      <ChevronDown className={`size-5 text-[#6f6f72] transition-transform shrink-0 ${isMultiselectOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    {isMultiselectOpen && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border border-[#e0dede] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {multiselectOptions.map((option) => {
                                          const isSelected = changesToMultiselectValue.includes(option.value);
                                          return (
                                            <div
                                              key={option.value}
                                              onClick={() => {
                                                if (isSelected) {
                                                  setChangesToMultiselectValue(changesToMultiselectValue.filter(v => v !== option.value));
                                                } else {
                                                  setChangesToMultiselectValue([...changesToMultiselectValue, option.value]);
                                                }
                                              }}
                                              className={`px-4 py-2 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${
                                                isSelected ? "bg-[#e1d8d2]" : ""
                                              }`}
                                            >
                                              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                                isSelected ? "border-[#5AA5E7] bg-[#5AA5E7]" : "border-[#e0dede]"
                                              }`}>
                                                {isSelected && (
                                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                  </svg>
                                                )}
                                              </div>
                                              <span className="text-[15px] text-black">{option.label}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Currency -> Currency field
                              if (dataType === "currency") {
                                return (
                                  <div className="w-full">
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-black">$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={changesToCurrencyValue}
                                        onChange={(e) => setChangesToCurrencyValue(e.target.value)}
                                        className="w-full h-10 pl-8 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Number -> number input
                              if (dataType === "number" || dataType === "boolean") {
                                return (
                                  <div className="w-full">
                                    <input
                                      type="number"
                                      value={changesToNumberValue}
                                      onChange={(e) => setChangesToNumberValue(e.target.value)}
                                      className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                      placeholder="Enter number"
                                    />
                                  </div>
                                );
                              }
                              
                              // Date -> date input
                              if (dataType === "date") {
                                return (
                                  <div className="w-full">
                                    <input
                                      type="date"
                                      value={changesToDateValue}
                                      onChange={(e) => setChangesToDateValue(e.target.value)}
                                      className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                    />
                                  </div>
                                );
                              }
                              
                              // Text (string) -> text input (default)
                              return (
                                <div className="w-full">
                                  <input
                                    type="text"
                                    value={changesToTextValue}
                                    onChange={(e) => setChangesToTextValue(e.target.value)}
                                    className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                    placeholder="Enter text"
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        
                        {/* Render date form if needed */}
                        {/* Exclude date fields under "Data changes > Employee" from date UX form */}
                        {/* Exclude rejection-reason-status-updated (it's an event, not a date) */}
                        {(() => {
                          const isObjectCreationUpdateDateField = selectedResult.option.id.startsWith("object-") && 
                                                                    selectedResult.categoryId === "object-creation-updates";
                          const isRejectionReasonUpdated = selectedResult.option.id === "rejection-reason-status-updated";
                          const isApprovalRequest = selectedResult.option.id.endsWith("-request");
                          return isDateRelatedOption(selectedResult.option.id) && !isObjectCreationUpdateDateField && !isRejectionReasonUpdated && !isApprovalRequest;
                        })() && (
                          <div className="w-full space-y-4">
                            {/* Offset Inputs (only for Before/After - shown ABOVE timing dropdown) */}
                            {(timingOption === "before-this-date" || timingOption === "after-this-date") && (
                              <div className="w-full flex flex-col gap-4">
                                {/* Mode Selector */}
                                <div className="w-full">
                                  <div className="relative">
                                    <select
                                      value={offsetMode}
                                      onChange={(e) => setOffsetMode(e.target.value)}
                                      className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] appearance-none"
                                    >
                                      <option value="exactly">Exactly</option>
                                      <option value="once-between">Once between</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                                  </div>
                                </div>

                                {/* Offset Value Input */}
                                {offsetMode === "exactly" ? (
                                  <div className="w-full">
                                    <input
                                      type="number"
                                      placeholder="0"
                                      value={offsetValue}
                                      onChange={(e) => setOffsetValue(e.target.value)}
                                      className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full flex gap-2">
                                    <input
                                      type="number"
                                      placeholder="Min"
                                      value={offsetMin}
                                      onChange={(e) => setOffsetMin(e.target.value)}
                                      className="flex-1 h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                                    />
                                    <input
                                      type="number"
                                      placeholder="Max"
                                      value={offsetMax}
                                      onChange={(e) => setOffsetMax(e.target.value)}
                                      className="flex-1 h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                                    />
                                  </div>
                                )}

                                {/* Cadence Selector */}
                                <div className="w-full">
                                  <div className="relative">
                                    <select className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] appearance-none">
                                      <option>Days</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Timing Dropdown */}
                            <div className="w-full">
                              <div className="relative">
                                <select
                                  value={timingOption}
                                  onChange={(e) => setTimingOption(e.target.value)}
                                  className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] appearance-none"
                                >
                                  <option value="on-this-date">On this date</option>
                                  <option value="before-this-date">Before this date</option>
                                  <option value="after-this-date">After this date</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                              </div>
                            </div>

                            {/* Time and Timezone (show for all timing options) */}
                            <div className="w-full flex flex-col gap-4">
                              {/* Time Input */}
                              <div className="w-full">
                                <label className="block font-sans font-medium text-[16px] leading-[24px] text-black mb-2">
                                  At<span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5" />
                                  <input
                                    type="text"
                                    value={timeValue}
                                    onChange={(e) => setTimeValue(e.target.value)}
                                    className="w-full h-10 pl-10 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                                    placeholder="11:00 AM"
                                  />
                                </div>
                              </div>

                              {/* Timezone Selector */}
                              <div className="w-full">
                                <label className="block font-sans font-medium text-[16px] leading-[24px] text-black mb-2">
                                  Timezone
                                </label>
                                <div className="relative">
                                  <select
                                    value={timezoneValue}
                                    onChange={(e) => setTimezoneValue(e.target.value)}
                                    className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-gray-100 text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent appearance-none"
                                  >
                                    <option>Your local timezone</option>
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                                </div>
                              </div>
                            </div>

                            {/* Info Text */}
                            <p className="text-sm text-gray-600 font-sans">
                              It can take up to 15 minutes after the scheduled time for the workflows to trigger.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a search result to see details
                </div>
              )}
            </div>
          </div>
        ) : selectedOptionId && triggerDetails ? (
          // Show details view (2/3) + options list (1/3)
          // Animation: When drilling into trigger details, the right-most pane slides left to become the left pane,
          // and trigger details slides in from the right
          // Set schedule: left pane is the full category list (On a set schedule selected); right pane is the form.
          <div className="flex-1 flex overflow-hidden relative">
            {isSetScheduleTrigger ? (
              <div
                key="set-schedule-category-pane"
                className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto"
              >
                {categoriesToUse.map((cat) => {
                  const Icon = getCategoryIcon(cat.id);
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={cn(
                        "w-full flex items-start justify-between px-[18px] transition-colors border-b border-[#e0dede] text-left",
                        isSelected ? "bg-[#e1d8d2]" : "bg-white hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 py-3">
                        {Icon && <Icon className="size-4 text-[#6f6f72] shrink-0" />}
                        <div className="flex flex-col items-start flex-1 min-w-0 text-left">
                          <p
                            className={cn(
                              "text-base leading-6 truncate w-full text-left mt-1",
                              isSelected ? "font-medium" : "font-normal"
                            )}
                            style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}
                          >
                            {cat.label}
                          </p>
                          <p className="text-[12px] leading-[16px] tracking-[0.5px] text-[#202022] font-sans font-normal text-left mb-1">
                            {getCategoryDescription(cat.id)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center self-stretch">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                          <path
                            d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z"
                            fill="black"
                          />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
            <div 
              key={`options-${selectedItemId || selectedSubItemId}`}
              className={cn(
                "w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto",
                navigationDirection === 'forward' && !prefersReducedMotion && "pane-slide-left"
              )}
              style={{
                transition: prefersReducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Header */}
              <div className="pt-2 px-[18px]">
                <div className="h-[33px] flex flex-col justify-end">
                  <div className="flex gap-3 items-center">
                    <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                      Select a trigger
                    </p>
                  </div>
                  <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                </div>
              </div>

              {/* Options */}
              {selectedSubItem?.options && selectedSubItem.options.length > 0 ? (
                selectedSubItem.options.map((option) => {
                  const Icon = getOptionIcon(option.id, option.dataType, selectedCategoryId || undefined, selectedSubItemId || undefined, useListIconForEvents);
                  const isSelected = selectedOptionId === option.id;
                  const isEmployeeAnyRecord = option.id === "object-employee-any-record";
                  
                  return (
                    <div key={option.id}>
                      <button
                        onClick={() => handleOptionSelect(option.id)}
                        className={cn(
                          "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                          isSelected
                            ? "bg-[#e1d8d2]"
                            : "hover:bg-gray-50"
                        )}
                      >
                        {Icon && (
                          <Icon className="size-4 text-[#6f6f72] shrink-0" />
                        )}
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <p className="min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left font-sans font-normal text-black">
                            {option.label}
                          </p>
                          <BasicWorkflowEligibilityBadge optionId={option.id} />
                        </div>
                      </button>
                      {isEmployeeAnyRecord && (
                        <div className="pt-2 px-[18px]">
                          <div className="h-[33px] flex flex-col justify-end">
                            <div className="flex gap-3 items-center">
                              <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                Select a specific field
                              </p>
                            </div>
                            <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : selectedItem?.options && selectedItem.options.length > 0 ? (
                selectedItem.options.map((option) => {
                  const Icon = getOptionIcon(option.id, option.dataType, selectedCategoryId || undefined, selectedItemId || undefined, useListIconForEvents);
                  const isSelected = selectedOptionId === option.id;
                  const isEmployeeAnyRecord = option.id === "object-employee-any-record";
                  
                  return (
                    <div key={option.id}>
                      <button
                        onClick={() => handleOptionSelect(option.id)}
                        className={cn(
                          "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                          isSelected
                            ? "bg-[#e1d8d2]"
                            : "hover:bg-gray-50"
                        )}
                      >
                        {Icon && (
                          <Icon className="size-4 text-[#6f6f72] shrink-0" />
                        )}
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <p className="min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left font-sans font-normal text-black">
                            {option.label}
                          </p>
                          <BasicWorkflowEligibilityBadge optionId={option.id} />
                        </div>
                      </button>
                      {isEmployeeAnyRecord && (
                        <div className="pt-2 px-[18px]">
                          <div className="h-[33px] flex flex-col justify-end">
                            <div className="flex gap-3 items-center">
                              <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                Select a specific field
                              </p>
                            </div>
                            <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : null}
            </div>
            )}

            {/* Right: Trigger Details (2/3) - slides in from right when drilling into trigger details */}
            <div 
              key={`details-${selectedOptionId}`}
              className={cn(
                "flex-[2] bg-[#f9f7f6] overflow-y-auto",
                !isSetScheduleTrigger &&
                  navigationDirection === "forward" &&
                  !prefersReducedMotion &&
                  "pane-enter-forward"
              )}
              style={{
                transition:
                  isSetScheduleTrigger || prefersReducedMotion
                    ? "none"
                    : "transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div className="flex items-start justify-center py-8">
                <div className="flex flex-col gap-6 items-start w-[576px]">
                  {isSetScheduleTrigger ? (
                    <SetScheduleForm
                      triggerDate={scheduleTriggerDate}
                      onTriggerDateChange={setScheduleTriggerDate}
                      timeValue={scheduleTimeValue}
                      onTimeValueChange={setScheduleTimeValue}
                      repeatKind={scheduleRepeatKind}
                      onRepeatKindChange={setScheduleRepeatKind}
                      customInterval={scheduleCustomInterval}
                      onCustomIntervalChange={setScheduleCustomInterval}
                      customCadence={scheduleCustomCadence}
                      onCustomCadenceChange={setScheduleCustomCadence}
                    />
                  ) : isRelativeToDateTrigger && selectedOptionId !== "rejection-reason-status-updated" ? (
                    // Relative to Date Form
                    <>
                      {/* Title */}
                      <div className="w-full">
                        <h2 className="font-sans font-medium text-[22px] leading-[26px] text-black">
                          {triggerDetails.title}
                        </h2>
                        <WorkflowTierImpactLine optionId={selectedOptionId} />
                      </div>

                      {/* Offset Inputs (only for Before/After - shown ABOVE timing dropdown) */}
                      {(timingOption === "before-this-date" || timingOption === "after-this-date") && (
                        <div className="w-full flex flex-col gap-4">
                          {/* Mode Selector */}
                          <div className="w-full">
                            <div className="relative">
                              <select
                                value={offsetMode}
                                onChange={(e) => setOffsetMode(e.target.value)}
                                className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent appearance-none"
                              >
                                <option value="exactly">Exactly</option>
                                <option value="once-between">Once between</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                            </div>
                          </div>

                          {/* Offset Value Input */}
                          {offsetMode === "exactly" ? (
                            <div className="w-full">
                              <input
                                type="number"
                                placeholder="0"
                                value={offsetValue}
                                onChange={(e) => setOffsetValue(e.target.value)}
                                className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                              />
                            </div>
                          ) : (
                            <div className="w-full flex gap-2">
                              <input
                                type="number"
                                placeholder="Min"
                                value={offsetMin}
                                onChange={(e) => setOffsetMin(e.target.value)}
                                className="flex-1 h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                              />
                              <input
                                type="number"
                                placeholder="Max"
                                value={offsetMax}
                                onChange={(e) => setOffsetMax(e.target.value)}
                                className="flex-1 h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                              />
                            </div>
                          )}

                          {/* Cadence Selector */}
                          <div className="w-full">
                            <div className="relative">
                              <select className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] appearance-none">
                                <option>Days</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timing Dropdown */}
                      <div className="w-full">
                        <div className="relative">
                          <select
                            value={timingOption}
                            onChange={(e) => setTimingOption(e.target.value)}
                            className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent appearance-none"
                          >
                            <option value="on-this-date">On this date</option>
                            <option value="before-this-date">Before this date</option>
                            <option value="after-this-date">After this date</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                        </div>
                      </div>

                      {/* Time and Timezone (show for all timing options) */}
                      <div className="w-full flex flex-col gap-4">
                        {/* Time Input */}
                        <div className="w-full">
                          <label className="block font-sans font-medium text-[16px] leading-[24px] text-black mb-2">
                            At<span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5" />
                            <input
                              type="text"
                              value={timeValue}
                              onChange={(e) => setTimeValue(e.target.value)}
                              className="w-full h-10 pl-10 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent"
                              placeholder="11:00 AM"
                            />
                          </div>
                        </div>

                        {/* Timezone Selector */}
                        <div className="w-full">
                          <label className="block font-sans font-medium text-[16px] leading-[24px] text-black mb-2">
                            Timezone
                          </label>
                          <div className="relative">
                            <select
                              value={timezoneValue}
                              onChange={(e) => setTimezoneValue(e.target.value)}
                              className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-gray-100 text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-transparent appearance-none"
                            >
                              <option>Your local timezone</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Info Text */}
                      <p className="text-sm text-gray-600 font-sans">
                        It can take up to 15 minutes after the scheduled time for the workflows to trigger.
                      </p>
                    </>
                  ) : (
                    // Regular Trigger Details
                    <>
                      {/* Title */}
                      <div>
                        <h2 className="font-sans font-medium text-[22px] leading-[26px] text-black">
                          {triggerDetails.title}
                        </h2>
                        <WorkflowTierImpactLine optionId={selectedOptionId} />
                      </div>

                      {/* Trigger Details */}
                      <div>
                        <div className="space-y-1">
                          {triggerDetails.description.map((desc, index) => (
                            <p key={index} className="text-base leading-6 text-black" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430, color: "#000000" }}>
                              {desc}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Select Input */}
                      {triggerDetails && triggerDetails.selectOptions && triggerDetails.selectOptions.length > 1 ? (
                          <div className="w-full">
                            <label className="block font-sans font-medium text-[16px] leading-[24px] text-black mb-2">
                              {triggerDetails.selectLabel}
                            </label>
                            <div className="relative">
                              <select 
                                className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] appearance-none"
                                value={selectedTriggerOption || (triggerDetails.selectOptions.includes("Is sent") ? "Is sent" : (triggerDetails.selectOptions.includes("Is created") ? "Is created" : (triggerDetails.selectOptions.includes("Is submitted") ? "Is submitted" : triggerDetails.selectOptions[0]))) || ""}
                                onChange={(e) => setSelectedTriggerOption(e.target.value)}
                              >
                                {triggerDetails.selectOptions.map((option, index) => (
                                  <option key={index} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-[#6f6f72] pointer-events-none" />
                            </div>
                            {((["new-hire-status", "termination-request-status", "profile-change-status", "leave-request-status"].includes(selectedOptionId || "")) || 
                              (selectedOptionId?.endsWith("-request") && triggerDetails.selectOptions.includes("Is fully approved"))) && (() => {
                              // Get the current dropdown value using the same logic as the select element
                              const currentValue = selectedTriggerOption || (triggerDetails.selectOptions.includes("Is sent") ? "Is sent" : (triggerDetails.selectOptions.includes("Is created") ? "Is created" : (triggerDetails.selectOptions.includes("Is submitted") ? "Is submitted" : triggerDetails.selectOptions[0]))) || "";
                              let helpText = "";
                              if (currentValue === "Is submitted") {
                                helpText = "Fires as soon as the request is submitted, regardless of whether approvals are required";
                              } else if (currentValue === "Is fully approved") {
                                helpText = "Fires as soon as the request moves from pending to approved. This will still trigger if a request doesn't require approval.";
                              } else if (currentValue === "Is rejected") {
                                helpText = "Fires as soon as the request moves from pending to rejected";
                              } else if (currentValue === "Is canceled") {
                                helpText = "Fires as soon as the initial request is canceled";
                              } else if (currentValue === "Is effective") {
                                helpText = "Fires as soon as the requested change is made in Rippling";
                              }
                              return helpText ? (
                                <p className="mt-2 text-sm text-[#6f6f72] font-sans" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 430 }}>
                                  {helpText}
                                </p>
                              ) : null;
                            })()}
                          </div>
                      ) : null}
                      
                      {/* Render "Changes to" input based on field type */}
                      {selectedTriggerOption === "Changes to" && 
                       selectedOptionId?.startsWith("object-") && 
                       !selectedOptionId.includes("-any-record") &&
                       selectedOption?.dataType && (
                        <div className="w-full" style={{ marginTop: "6px" }}>
                          {(() => {
                            const dataType = selectedOption.dataType?.toLowerCase();
                            const optionId = selectedOptionId || "";
                            const isPersonField = optionId.includes("manager") || optionId.includes("employee-link");
                            
                            // Person field (manager) -> single select with avatars
                            if (dataType === "link" && isPersonField) {
                              const employees = [
                                { id: "emp1", name: "John Doe", avatar: "JD" },
                                { id: "emp2", name: "Jane Smith", avatar: "JS" },
                                { id: "emp3", name: "Bob Johnson", avatar: "BJ" },
                              ];
                              
                              const selectedEmployee = employees.find(emp => emp.id === changesToPersonValue);
                              
                              return (
                                <div className="w-full relative person-select-container">
                                  <button
                                    type="button"
                                    onClick={() => setIsPersonSelectOpen(!isPersonSelectOpen)}
                                    className="w-full h-10 pl-4 pr-10 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {selectedEmployee ? (
                                        <>
                                          <div className="w-6 h-6 rounded-full bg-[#5AA5E7] flex items-center justify-center text-white text-[10px] font-medium shrink-0">
                                            {selectedEmployee.avatar}
                                          </div>
                                          <span className="text-black truncate">{selectedEmployee.name}</span>
                                        </>
                                      ) : (
                                        <span className="text-gray-400">Select employee</span>
                                      )}
                                    </div>
                                    <ChevronDown className={`size-5 text-[#6f6f72] transition-transform shrink-0 ${isPersonSelectOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  {isPersonSelectOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-[#e0dede] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {employees.map((employee) => {
                                        const isSelected = changesToPersonValue === employee.id;
                                        return (
                                          <div
                                            key={employee.id}
                                            onClick={() => {
                                              setChangesToPersonValue(employee.id);
                                              setIsPersonSelectOpen(false);
                                            }}
                                            className={`px-4 py-2 cursor-pointer hover:bg-gray-50 flex items-center gap-3 ${
                                              isSelected ? "bg-[#e1d8d2]" : ""
                                            }`}
                                          >
                                            <div className="w-6 h-6 rounded-full bg-[#5AA5E7] flex items-center justify-center text-white text-[10px] font-medium shrink-0">
                                              {employee.avatar}
                                            </div>
                                            <span className="text-[15px] text-black flex-1">{employee.name}</span>
                                            {isSelected && (
                                              <svg className="w-4 h-4 text-[#5AA5E7] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // Link (list) -> multiselect dropdown
                            if (dataType === "link") {
                              const multiselectOptions = [
                                { value: "option1", label: "Option 1" },
                                { value: "option2", label: "Option 2" },
                                { value: "option3", label: "Option 3" },
                              ];
                              
                              return (
                                <div className="w-full relative multiselect-container">
                                  <button
                                    type="button"
                                    onClick={() => setIsMultiselectOpen(!isMultiselectOpen)}
                                    className={`w-full min-h-[40px] pl-4 pr-10 py-2 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7] flex items-center justify-between ${
                                      changesToMultiselectValue.length === 0 ? "" : "items-start"
                                    }`}
                                  >
                                    <div className="flex-1 flex flex-wrap gap-2 items-center">
                                      {changesToMultiselectValue.length === 0 ? (
                                        <span className="text-gray-400">Select values</span>
                                        ) : (
                                          changesToMultiselectValue.map((value) => {
                                            const option = multiselectOptions.find(opt => opt.value === value);
                                            if (!option) return null;
                                            return (
                                              <span
                                                key={value}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-[#e1d8d2] rounded text-[13px] text-black"
                                              >
                                                {option.label}
                                                <span
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChangesToMultiselectValue(changesToMultiselectValue.filter(v => v !== value));
                                                  }}
                                                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5 cursor-pointer"
                                                  role="button"
                                                  tabIndex={0}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setChangesToMultiselectValue(changesToMultiselectValue.filter(v => v !== value));
                                                    }
                                                  }}
                                                >
                                                  <X className="size-3 text-[#6f6f72]" />
                                                </span>
                                              </span>
                                            );
                                          })
                                        )}
                                    </div>
                                    <ChevronDown className={`size-5 text-[#6f6f72] transition-transform shrink-0 ${isMultiselectOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  {isMultiselectOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-[#e0dede] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {multiselectOptions.map((option) => {
                                        const isSelected = changesToMultiselectValue.includes(option.value);
                                        return (
                                          <div
                                            key={option.value}
                                            onClick={() => {
                                              if (isSelected) {
                                                setChangesToMultiselectValue(changesToMultiselectValue.filter(v => v !== option.value));
                                              } else {
                                                setChangesToMultiselectValue([...changesToMultiselectValue, option.value]);
                                              }
                                            }}
                                            className={`px-4 py-2 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${
                                              isSelected ? "bg-[#e1d8d2]" : ""
                                            }`}
                                          >
                                            <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                              isSelected ? "border-[#5AA5E7] bg-[#5AA5E7]" : "border-[#e0dede]"
                                            }`}>
                                              {isSelected && (
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                              )}
                                            </div>
                                            <span className="text-[15px] text-black">{option.label}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // Currency -> Currency field
                            if (dataType === "currency") {
                              return (
                                <div className="w-full">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-black">$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={changesToCurrencyValue}
                                      onChange={(e) => setChangesToCurrencyValue(e.target.value)}
                                      className="w-full h-10 pl-8 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                              );
                            }
                            
                            // Number -> number input
                            if (dataType === "number" || dataType === "boolean") {
                              return (
                                <div className="w-full">
                                  <input
                                    type="number"
                                    value={changesToNumberValue}
                                    onChange={(e) => setChangesToNumberValue(e.target.value)}
                                    className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                    placeholder="Enter number"
                                  />
                                </div>
                              );
                            }
                            
                            // Date -> date input
                            if (dataType === "date") {
                              return (
                                <div className="w-full">
                                  <input
                                    type="date"
                                    value={changesToDateValue}
                                    onChange={(e) => setChangesToDateValue(e.target.value)}
                                    className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                  />
                                </div>
                              );
                            }
                            
                            // Text (string) -> text input (default)
                            return (
                              <div className="w-full">
                                <input
                                  type="text"
                                  value={changesToTextValue}
                                  onChange={(e) => setChangesToTextValue(e.target.value)}
                                  className="w-full h-10 pl-4 pr-4 border border-[#e0dede] rounded-lg bg-white text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#5AA5E7] focus:border-[#5AA5E7]"
                                  placeholder="Enter text"
                                />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Show breadcrumb-driven panes (last 3 after "Browse")
          // Animation: When navigating to 4th pane, leftmost pane slides out left, new pane slides in from right
          <div className="flex-1 flex overflow-hidden relative">
            {(() => {
              // Always show maximum 3 panes
              // If a sub-item is selected, we're at 4 levels deep (Browse > B > C > D)
              // In this case, ALWAYS filter out level 1 (browse pane) and show exactly 3 panes
              
              if (selectedSubItemId !== null) {
                // We have a sub-item selected, so filter out level 1 (browse pane) completely
                // visiblePanes should contain: [level 1, level 2, level 3] or [level 2, level 3]
                // After filtering level > 1, we get: [level 2, level 3]
                // We want to render exactly 2 panes (level 2 and 3) + 1 options pane = 3 total
                // CRITICAL: Filter out level 1 BEFORE any other operations
                // Note: The browse pane (showing all categories) is not in visiblePanes - it's rendered separately
                // When we filter out level 1, we're hiding the category pane (e.g., "When something happens")
                // The actual browse pane is already hidden by the conditional rendering logic
                const panesWithoutBrowse = visiblePanes.filter(pane => {
                  const shouldInclude = pane.level > 1;
                  if (!shouldInclude && pane.level === 1) {
                    console.log('[Filter] Excluding level 1 pane:', pane.label);
                  }
                  return shouldInclude;
                });
                
                console.log('[Sub-item selected] visiblePanes:', visiblePanes.map(p => `${p.label} (level ${p.level})`));
                console.log('[Sub-item selected] panesWithoutBrowse:', panesWithoutBrowse.map(p => `${p.label} (level ${p.level})`));
                
                // If sub-item has options, show last 2 panes + options pane = 3 panes total
                if (selectedSubItem && selectedSubItem.options && selectedSubItem.options.length > 0) {
                  // Take the last 2 panes (should be level 2 and 3)
                  const panesToRender = panesWithoutBrowse.slice(-2);
                  
                  // Debug: log what we're rendering
                  console.log('[Options] visiblePanes:', visiblePanes.map(p => `${p.label} (level ${p.level})`));
                  console.log('[Options] panesWithoutBrowse:', panesWithoutBrowse.map(p => `${p.label} (level ${p.level})`));
                  console.log('[Options] panesToRender:', panesToRender.map(p => `${p.label} (level ${p.level})`));
                  
                  return (
                    <>
                      {/* Show exactly 2 panes (C and D), excluding browse pane */}
                      {panesToRender.map((pane, index) => {
                        // Double-check: never render level 1
                        if (pane.level === 1) {
                          console.error('[Options] CRITICAL: Attempted to render level 1 pane, skipping');
                          return null;
                        }
                        console.log(`[Options] Rendering pane ${index}:`, pane.label, 'level', pane.level);
                        const rendered = renderPaneFromBreadcrumb(pane, index);
                        if (!rendered) {
                          console.warn(`[Options] renderPaneFromBreadcrumb returned null for pane ${index}:`, pane.label);
                        }
                        return rendered;
                      })}
                      {/* Show options pane for the selected sub-item (3rd pane) - slides in from right when navigating to 4th pane */}
                      <div 
                        key={`options-pane-${selectedSubItemId}`}
                        className={cn(
                          "w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto",
                          navigationDirection === 'forward' && !prefersReducedMotion && "pane-enter-forward"
                        )}
                        style={{
                          transition: prefersReducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        <div className="pt-2 px-[18px]">
                          <div className="h-[33px] flex flex-col justify-end">
                            <div className="flex gap-3 items-center">
                              <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                Select a trigger
                              </p>
                            </div>
                            <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                          </div>
                        </div>

                        {selectedSubItem.options.map((option) => {
                          const Icon = getOptionIcon(option.id, option.dataType, selectedCategoryId || undefined, selectedSubItemId || undefined, useListIconForEvents);
                          const isSelected = selectedOptionId === option.id;
                          const isEmployeeAnyRecord = option.id === "object-employee-any-record";
                          
                          return (
                            <div key={option.id}>
                              <button
                                onClick={() => handleOptionSelect(option.id)}
                                className={cn(
                                  "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                                  isSelected
                                    ? "bg-[#e1d8d2]"
                                    : "hover:bg-gray-50"
                                )}
                              >
                                {Icon && (
                                  <Icon className="size-4 text-[#6f6f72] shrink-0" />
                                )}
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <p className="min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left font-sans font-normal text-black">
                                    {option.label}
                                  </p>
                                  <BasicWorkflowEligibilityBadge optionId={option.id} />
                                </div>
                              </button>
                              {isEmployeeAnyRecord && (
                                <div className="pt-2 px-[18px]">
                                  <div className="h-[33px] flex flex-col justify-end">
                                    <div className="flex gap-3 items-center">
                                      <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                        Select a specific field
                                      </p>
                                    </div>
                                    <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                }
                
                // Sub-item selected, check if it has items
                if (selectedSubItem && selectedSubItem.items && selectedSubItem.items.length > 0) {
                  // Take the last 2 panes (should be level 2 and 3)
                  // CRITICAL: Filter out level 1 explicitly to ensure we never render it
                  const panesToRender = panesWithoutBrowse.filter(p => p.level > 1).slice(-2);
                  
                  // Debug: log what we're rendering
                  console.log('[Items] breadcrumbPath length:', breadcrumbPath.length);
                  console.log('[Items] visiblePanes:', visiblePanes.map(p => `${p.label} (level ${p.level})`));
                  console.log('[Items] panesWithoutBrowse:', panesWithoutBrowse.map(p => `${p.label} (level ${p.level})`));
                  console.log('[Items] panesToRender (after filter):', panesToRender.map(p => `${p.label} (level ${p.level})`));
                  console.log('[Items] selectedSubItemId:', selectedSubItemId);
                  
                  // Ensure we only render exactly 2 panes from breadcrumbs + 1 items pane = 3 total
                  if (panesToRender.length !== 2) {
                    console.error('[Items] Expected 2 panes to render, got:', panesToRender.length);
                  }
                  
                  return (
                    <>
                      {/* Show exactly 2 panes (C and D), excluding browse pane */}
                      {panesToRender.map((pane, index) => {
                        // Triple-check: never render level 1
                        if (pane.level === 1) {
                          console.error('[Items] CRITICAL: Attempted to render level 1 pane, this should never happen!');
                          return null;
                        }
                        const rendered = renderPaneFromBreadcrumb(pane, index);
                        console.log(`[Items] Rendered pane ${index}:`, pane.label, 'level', pane.level);
                        return rendered;
                      })}
                      {/* Show items pane for the selected sub-item (3rd pane) - slides in from right when navigating to 4th pane */}
                      <div 
                        key={`items-pane-${selectedSubItemId}`}
                        className={cn(
                          "w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto",
                          navigationDirection === 'forward' && !prefersReducedMotion && "pane-enter-forward"
                        )}
                        style={{
                          transition: prefersReducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        <div className="pt-2 px-[18px]">
                          <div className="h-[33px] flex flex-col justify-end">
                            <div className="flex gap-3 items-center">
                              <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                {selectedCategoryId === "relative-to-date" ? "Popular categories" : "Select a use case"}
                              </p>
                            </div>
                            <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                          </div>
                        </div>

                        {selectedSubItem.items.map((item) => {
                          const isSelected = false; // No deeper selection for now
                          
                          return (
                            <button
                              key={item.id}
                              className={cn(
                                "w-full h-10 flex items-center justify-between px-[18px] transition-colors",
                                "bg-white hover:bg-gray-50"
                              )}
                            >
                              <p className={cn(
                                "flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left",
                                "font-sans font-normal text-black"
                              )}>
                                {item.label}
                              </p>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                </svg>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                }
                
                // Sub-item selected but no options/items, show only last 2 panes after filtering (C and D)
                // This ensures we never show the browse pane (level 1) and only show 2 panes
                const panesToRender = panesWithoutBrowse.slice(-2);
                console.log('[No options/items] visiblePanes:', visiblePanes.map(p => `${p.label} (level ${p.level})`));
                console.log('[No options/items] panesWithoutBrowse:', panesWithoutBrowse.map(p => `${p.label} (level ${p.level})`));
                console.log('[No options/items] panesToRender:', panesToRender.map(p => `${p.label} (level ${p.level})`));
                console.log('[No options/items] selectedSubItemId:', selectedSubItemId);
                
                return (
                  <>
                    {panesToRender.map((pane, index) => {
                      // Safety check: never render level 1 when sub-item is selected
                      if (pane.level === 1) {
                        console.warn('[No options/items] Attempted to render level 1 pane, skipping');
                        return null;
                      }
                      return renderPaneFromBreadcrumb(pane, index);
                    })}
                  </>
                );
              }
              
              // No sub-item selected, render the last 3 panes from visiblePanes normally
              // CRITICAL: This path should NEVER execute when selectedSubItemId !== null
              // because we return early in the if block above
              if (visiblePanes.length >= 3) {
                // Double-check: if we have 4+ levels, filter out level 1
                const panesToRender = visiblePanes.length >= 4 
                  ? visiblePanes.filter(pane => pane.level > 1).slice(-3)
                  : visiblePanes.slice(-3);
                return panesToRender.map((pane, index) => {
                  // Safety check: never render level 1
                  if (pane.level === 1 && visiblePanes.length >= 4) {
                    console.warn('[No sub-item] Blocked level 1 pane render');
                    return null;
                  }
                  return renderPaneFromBreadcrumb(pane, index);
                });
              }
              
              // Fallback to explicit rendering for fewer than 3 panes
              return null;
            })()}
            {/* CRITICAL: Only render fallback if no sub-item is selected AND we have fewer than 3 panes */}
            {/* This should NEVER render when selectedSubItemId !== null */}
            {(() => {
              if (selectedSubItemId !== null) {
                console.log('[Fallback] Blocked: selectedSubItemId is not null:', selectedSubItemId);
                return false;
              }
              if (visiblePanes.length >= 3) {
                console.log('[Fallback] Blocked: visiblePanes.length >= 3:', visiblePanes.length);
                return false;
              }
              if (!selectedCategoryId) {
                return false;
              }
              console.log('[Fallback] WILL RENDER - this should not happen when sub-item is selected!');
              return true;
            })() && (
              <>
                {/* When we have fewer than 3 panes, use explicit rendering */}
                {/* Always show categories pane when a category is selected */}
                <div className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto">
                  {categoriesToUse.map((cat) => {
                    const Icon = getCategoryIcon(cat.id);
                    const isSelected = selectedCategoryId === cat.id;
                    
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={cn(
                          "w-full flex items-start justify-between px-[18px] transition-colors border-b border-[#e0dede] text-left",
                          isSelected
                            ? "bg-[#e1d8d2]"
                            : "bg-white hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 py-3">
                          {Icon && (
                            <Icon className="size-4 text-[#6f6f72] shrink-0" />
                          )}
                          <div className="flex flex-col items-start flex-1 min-w-0 text-left">
                            <p className={cn(
                              "text-[15px] leading-[19px] tracking-[0.25px] truncate w-full text-left mt-1",
                              "font-sans",
                              isSelected ? "font-medium text-black" : "font-normal text-black"
                            )}>
                              {cat.label}
                            </p>
                            <p className="text-[12px] leading-[16px] tracking-[0.5px] text-[#202022] font-sans font-normal text-left mb-1">
                              {getCategoryDescription(cat.id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center self-stretch">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                            <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Always show items pane when a category is selected */}
                {selectedCategoryId && (
                  <div className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto">
                    {!selectedCategory ? (
                      <div className="px-[18px] py-12 text-sm text-gray-500 text-center">
                        Category not found: {selectedCategoryId}
                      </div>
                    ) : !selectedCategory.items || selectedCategory.items.length === 0 ? (
                      <div className="px-[18px] py-12 text-sm text-gray-500 text-center">
                        No items available for {selectedCategory.label}
                      </div>
                    ) : (
                      <>
                        <div className="pt-2 px-[18px]">
                          <div className="h-[33px] flex flex-col justify-end">
                            <div className="flex gap-3 items-center">
                              <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                {selectedCategoryId === "relative-to-date" ? "Popular categories" : "Select a use case"}
                              </p>
                            </div>
                            <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                          </div>
                        </div>

                        {selectedCategory.items.map((item, itemIndex) => {
                          const isSelected = selectedItemId === item.id;
                          const isTimeOff = item.id === "object-time-off";
                          const isAccountingIntegrations = item.id === "object-accounting-integrations";
                          
                          return (
                            <div key={item.id}>
                              {isAccountingIntegrations && (
                                <div className="pt-2 px-[18px]">
                                  <div className="h-[33px] flex flex-col justify-end">
                                    <div className="flex gap-3 items-center">
                                      <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                        Categories
                                      </p>
                                    </div>
                                    <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => handleItemSelect(item.id)}
                                className={cn(
                                  "w-full h-10 flex items-center justify-between px-[18px] transition-colors",
                                  isSelected
                                    ? "bg-[#e1d8d2]"
                                    : "bg-white hover:bg-gray-50"
                                )}
                              >
                                <p className={cn(
                                  "flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left",
                                  "font-sans font-normal text-black"
                                )}>
                                  {item.label}
                                </p>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
                
                {/* Render sub-items pane when an item is selected and has sub-items */}
                {selectedItemId && selectedItem && selectedItem.items && selectedItem.items.length > 0 && (
                  <div className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto">
                    {/* Show options first if they exist */}
                    {selectedItem.options && selectedItem.options.length > 0 && (
                      <>
                        <div className="pt-2 px-[18px]">
                          <div className="h-[33px] flex flex-col justify-end">
                            <div className="flex gap-3 items-center">
                              <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                Select a trigger
                              </p>
                            </div>
                            <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                          </div>
                        </div>

                        {selectedItem.options.map((option) => {
                          const Icon = getOptionIcon(option.id, option.dataType, selectedCategoryId || undefined, selectedItemId || undefined, useListIconForEvents);
                          const isSelected = selectedOptionId === option.id;
                          
                          return (
                            <div key={option.id}>
                              <button
                                onClick={() => handleOptionSelect(option.id)}
                                className={cn(
                                  "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                                  isSelected
                                    ? "bg-[#e1d8d2]"
                                    : "hover:bg-gray-50"
                                )}
                              >
                                {Icon && (
                                  <Icon className="size-4 text-[#6f6f72] shrink-0" />
                                )}
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <p
                                    className={cn(
                                      "min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left",
                                      "font-sans font-normal text-black"
                                    )}
                                  >
                                    {option.label}
                                  </p>
                                  <BasicWorkflowEligibilityBadge optionId={option.id} />
                                </div>
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* Separator between options and sub-items */}
                        <div className="pt-2 px-[18px]">
                          <div className="h-[33px] flex flex-col justify-end">
                            <div className="flex gap-3 items-center">
                              <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                Popular categories
                              </p>
                            </div>
                            <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Show sub-items */}
                    {(!selectedItem.options || selectedItem.options.length === 0) && (
                      <div className="pt-2 px-[18px]">
                        <div className="h-[33px] flex flex-col justify-end">
                          <div className="flex gap-3 items-center">
                            <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                              Popular categories
                            </p>
                          </div>
                          <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                        </div>
                      </div>
                    )}

                    {selectedItem.items.map((subItem) => {
                      const isSelected = selectedSubItemId === subItem.id;
                      const isTimeOff = subItem.id === "object-time-off";
                      
                      return (
                        <div key={subItem.id}>
                          <button
                            onClick={() => handleSubItemSelect(subItem.id)}
                            className={cn(
                              "w-full h-10 flex items-center justify-between px-[18px] transition-colors",
                              isSelected
                                ? "bg-[#e1d8d2]"
                                : "bg-white hover:bg-gray-50"
                            )}
                          >
                            <p className={cn(
                              "flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left",
                              "font-sans font-normal text-black"
                            )}>
                              {subItem.label}
                            </p>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                </svg>
                          </button>
                          {isTimeOff && (
                            <div className="pt-2 px-[18px]">
                              <div className="h-[33px] flex flex-col justify-end">
                                <div className="flex gap-3 items-center">
                                  <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                    Select a category
                                  </p>
                                </div>
                                <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Render options pane when an item is selected and has options (but no sub-items) */}
                {selectedItemId && selectedItem && selectedItem.options && selectedItem.options.length > 0 && !selectedItem.items && (
                  <div className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto">
                    <div className="pt-2 px-[18px]">
                      <div className="h-[33px] flex flex-col justify-end">
                        <div className="flex gap-3 items-center">
                          <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                            Select a trigger
                          </p>
                        </div>
                        <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                      </div>
                    </div>

                    {selectedItem.options.map((option) => {
                      const Icon = getOptionIcon(option.id, option.dataType, selectedCategoryId || undefined, selectedItemId || undefined, useListIconForEvents);
                      const isSelected = selectedOptionId === option.id;
                      const isEmployeeAnyRecord = option.id === "object-employee-any-record";
                      
                      return (
                        <div key={option.id}>
                          <button
                            onClick={() => handleOptionSelect(option.id)}
                            className={cn(
                              "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                              isSelected
                                ? "bg-[#e1d8d2]"
                                : "hover:bg-gray-50"
                            )}
                          >
                            {Icon && (
                              <Icon className="size-4 text-[#6f6f72] shrink-0" />
                            )}
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <p className="min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left font-sans font-normal text-black">
                                {option.label}
                              </p>
                              <BasicWorkflowEligibilityBadge optionId={option.id} />
                            </div>
                          </button>
                          {isEmployeeAnyRecord && (
                            <div className="pt-2 px-[18px]">
                              <div className="h-[33px] flex flex-col justify-end">
                                <div className="flex gap-3 items-center">
                                  <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                    Select a specific field
                                  </p>
                                </div>
                                <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Render options pane when a sub-item is selected and has options */}
                {selectedSubItemId && selectedSubItem && selectedSubItem.options && selectedSubItem.options.length > 0 && (
                  <div className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto">
                    <div className="pt-2 px-[18px]">
                      <div className="h-[33px] flex flex-col justify-end">
                        <div className="flex gap-3 items-center">
                          <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                            Select a trigger
                          </p>
                        </div>
                        <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                      </div>
                    </div>

                    {selectedSubItem.options.map((option) => {
                      const Icon = getOptionIcon(option.id, option.dataType, selectedCategoryId || undefined, selectedSubItemId || undefined, useListIconForEvents);
                      const isSelected = selectedOptionId === option.id;
                      const isEmployeeAnyRecord = option.id === "object-employee-any-record";
                      
                      return (
                        <div key={option.id}>
                          <button
                            onClick={() => handleOptionSelect(option.id)}
                            className={cn(
                              "w-full h-10 flex items-center gap-2 px-[18px] transition-colors",
                              isSelected
                                ? "bg-[#e1d8d2]"
                                : "hover:bg-gray-50"
                            )}
                          >
                            {Icon && (
                              <Icon className="size-4 text-[#6f6f72] shrink-0" />
                            )}
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <p className="min-w-0 flex-1 text-[15px] leading-[22px] tracking-[0.5px] truncate text-left font-sans font-normal text-black">
                                {option.label}
                              </p>
                              <BasicWorkflowEligibilityBadge optionId={option.id} />
                            </div>
                          </button>
                          {isEmployeeAnyRecord && (
                            <div className="pt-2 px-[18px]">
                              <div className="h-[33px] flex flex-col justify-end">
                                <div className="flex gap-3 items-center">
                                  <p className="font-sans font-medium text-[11px] text-[#202022] tracking-[1px] uppercase leading-[14px] flex-1">
                                    Select a specific field
                                  </p>
                                </div>
                                <div className="bg-[#d9d9d9] h-px w-full mt-1" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {/* If no panes and no category selected, show categories (initial state) */}
            {visiblePanes.length === 0 && !selectedCategoryId && (
              <div className="w-[313px] border-r border-[#e0dede] bg-white overflow-y-auto">
                {categoriesToUse.map((category) => {
                  const Icon = getCategoryIcon(category.id);
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className="w-full flex items-start justify-between px-[18px] transition-colors border-b border-[#e0dede] text-left bg-white hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 py-3">
                        {Icon && (
                          <Icon className="size-4 text-[#6f6f72] shrink-0" />
                        )}
                        <div className="flex flex-col items-start flex-1 min-w-0 text-left">
                          <p className="text-[15px] leading-[19px] tracking-[0.25px] truncate w-full text-left font-sans font-normal text-black mt-1">
                            {category.label}
                          </p>
                          <p className="text-[12px] leading-[16px] tracking-[0.5px] text-[#202022] font-sans font-normal text-left mb-1">
                            {getCategoryDescription(category.id)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center self-stretch">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                          <path d="M10.2641 16.53L9.20312 15.469L12.6731 11.999L9.20312 8.52902L10.2641 7.46802L14.7941 11.998L10.2641 16.528V16.53Z" fill="black"/>
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {(selectedOptionId || selectedSearchResultId) && (
          <div className="bg-white border-t border-[#e0dede] h-18 flex items-center justify-end px-4 py-3 gap-3">
            <Button
              onClick={() => {
                // TODO: Implement "Select and add a filter" functionality
                handleSelectTrigger();
              }}
              className="flex flex-row justify-center items-center"
              style={{
                padding: "0px 16px",
                gap: "8px",
                height: "40px",
                background: "#FFFFFF",
                border: "1px solid rgba(0, 0, 0, 0.2)",
                borderRadius: "8px",
                width: "auto",
                minWidth: "80px"
              }}
            >
              <span 
                className="text-center whitespace-nowrap flex-none order-1 flex-grow-0" 
                style={{ 
                  fontFamily: "'Basel Grotesk'",
                  fontStyle: "normal",
                  fontWeight: 535,
                  fontSize: "16px",
                  lineHeight: "24px",
                  textAlign: "center",
                  color: "#000000"
                }}
              >
                Select and add filter
              </span>
            </Button>
            <Button
              onClick={handleSelectTrigger}
              className="flex flex-row justify-center items-center px-4 gap-2 w-20 h-10 bg-[#7A005D] rounded-lg hover:bg-[#7A005D]/90"
            >
              <span className="font-['Basel_Grotesk'] font-normal text-base leading-6 text-center text-white flex-none order-1 flex-grow-0" style={{ fontFamily: "'Basel Grotesk'", fontWeight: 535 }}>
                Select
              </span>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
