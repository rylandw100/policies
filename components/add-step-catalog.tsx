"use client";

import type { ReactNode } from "react";
import {
  Mail,
  MessageSquare,
  Bell,
  ClipboardList,
  FileText,
  BarChart3,
  Clock,
  Star,
  CreditCard,
  PlusSquare,
  Pencil,
  Trash2,
  Calendar,
  Globe,
  Database,
  ArrowRightLeft,
  Hourglass,
  Pause,
  GitBranch,
} from "lucide-react";

export type AddStepCatalogItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

export type AddStepCatalogGroup = {
  category: string;
  items: AddStepCatalogItem[];
};

function TeamsIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 23" fill="none" aria-hidden>
      <g clipPath="url(#clip0_teams_cat)">
        <path
          d="M16.7403 8.37207H22.9395C23.5252 8.37207 24 8.84685 24 9.43253V15.0792C24 17.2318 22.255 18.9767 20.1025 18.9767H20.0841C17.9316 18.977 16.1863 17.2323 16.186 15.0798V8.92631C16.186 8.62021 16.4342 8.37207 16.7403 8.37207Z"
          fill="#5059C9"
        />
        <path
          d="M20.9301 7.25592C22.3172 7.25592 23.4417 6.13143 23.4417 4.74429C23.4417 3.35716 22.3172 2.23267 20.9301 2.23267C19.543 2.23267 18.4185 3.35716 18.4185 4.74429C18.4185 6.13143 19.543 7.25592 20.9301 7.25592Z"
          fill="#5059C9"
        />
        <path
          d="M13.1162 7.25582C15.1198 7.25582 16.7441 5.63155 16.7441 3.62791C16.7441 1.62427 15.1198 0 13.1162 0C11.1126 0 9.48828 1.62427 9.48828 3.62791C9.48828 5.63155 11.1126 7.25582 13.1162 7.25582Z"
          fill="#7B83EB"
        />
        <path
          d="M17.9535 8.37207H7.7206C7.1419 8.38639 6.68411 8.86665 6.69754 9.44538V15.8858C6.61673 19.3586 9.3643 22.2406 12.8371 22.3256C16.3099 22.2406 19.0574 19.3586 18.9766 15.8858V9.44538C18.99 8.86665 18.5322 8.38639 17.9535 8.37207Z"
          fill="#7B83EB"
        />
        <path
          d="M1.02306 5.02319H11.256C11.821 5.02319 12.2791 5.48124 12.2791 6.04626V16.2792C12.2791 16.8442 11.821 17.3023 11.256 17.3023H1.02306C0.458037 17.3023 0 16.8442 0 16.2792V6.04626C0 5.48124 0.458048 5.02319 1.02306 5.02319Z"
          fill="url(#paint0_teams_cat)"
        />
        <path d="M8.8322 8.91796H6.78661V14.4882H5.48336V8.91796H3.44727V7.8374H8.8322V8.91796Z" fill="white" />
      </g>
      <defs>
        <linearGradient
          id="paint0_teams_cat"
          x1="2.13312"
          y1="4.22379"
          x2="10.1459"
          y2="18.1017"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5A62C3" />
          <stop offset="0.5" stopColor="#4D55BD" />
          <stop offset="1" stopColor="#3940AB" />
        </linearGradient>
        <clipPath id="clip0_teams_cat">
          <rect width="24" height="22.3256" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.8 10.2a1.6 1.6 0 11-3.2 0 1.6 1.6 0 013.2 0zm1 0a1.6 1.6 0 013.2 0v4a1.6 1.6 0 01-3.2 0v-4z"
        fill="#E01E5A"
      />
      <path
        d="M6.4 3.8a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2zm0 1a1.6 1.6 0 010 3.2h-4a1.6 1.6 0 110-3.2h4z"
        fill="#36C5F0"
      />
      <path
        d="M12.8 6.4a1.6 1.6 0 113.2 0 1.6 1.6 0 01-3.2 0zm-1 0a1.6 1.6 0 01-3.2 0v-4a1.6 1.6 0 013.2 0v4z"
        fill="#2EB67D"
      />
      <path
        d="M10.2 12.8a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zm0-1a1.6 1.6 0 010-3.2h4a1.6 1.6 0 110 3.2h-4z"
        fill="#ECB22E"
      />
    </svg>
  );
}

const icon = (c: ReactNode) => c;

/** Mirrors the “Add a step” left pane (Actions + Logic), per Embeddable canvas / Figma. */
export const ADD_STEP_CATALOG_GROUPS: AddStepCatalogGroup[] = [
  {
    category: "Notifications",
    items: [
      { id: "notif-email", label: "Send an email", icon: icon(<Mail className="size-4 text-[#595555]" />) },
      { id: "notif-sms", label: "Send an SMS", icon: icon(<MessageSquare className="size-4 text-[#595555]" />) },
      { id: "notif-push", label: "Send a push notification", icon: icon(<Bell className="size-4 text-[#595555]" />) },
      { id: "notif-task", label: "Assign a task", icon: icon(<ClipboardList className="size-4 text-[#595555]" />) },
      { id: "notif-teams", label: "Send a Teams message", icon: icon(<TeamsIcon />) },
      { id: "notif-slack", label: "Send a Slack message", icon: icon(<SlackIcon />) },
    ],
  },
  {
    category: "Rippling actions",
    items: [
      { id: "rp-survey", label: "Send a survey", icon: icon(<FileText className="size-4 text-[#595555]" />) },
      { id: "rp-report", label: "Send a report", icon: icon(<BarChart3 className="size-4 text-[#595555]" />) },
      { id: "rp-timeoff", label: "Make a time off adjustment", icon: icon(<Clock className="size-4 text-[#595555]" />) },
      { id: "rp-review", label: "Assign a review", icon: icon(<Star className="size-4 text-[#595555]" />) },
      { id: "rp-payment", label: "Make a payment", icon: icon(<CreditCard className="size-4 text-[#595555]" />) },
      { id: "rp-create-obj", label: "Create custom object", icon: icon(<PlusSquare className="size-4 text-[#595555]" />) },
      { id: "rp-update-obj", label: "Update custom object", icon: icon(<Pencil className="size-4 text-[#595555]" />) },
      { id: "rp-delete-obj", label: "Delete custom object", icon: icon(<Trash2 className="size-4 text-[#595555]" />) },
    ],
  },
  {
    category: "Other",
    items: [
      { id: "other-gcal", label: "Create Google Calendar ev...", icon: icon(<Calendar className="size-4 text-[#595555]" />) },
      { id: "other-api", label: "Call a public API", icon: icon(<Globe className="size-4 text-[#595555]" />) },
      { id: "other-query", label: "Query Rippling data", icon: icon(<Database className="size-4 text-[#595555]" />) },
      { id: "other-var", label: "Assign value to a variable", icon: icon(<ArrowRightLeft className="size-4 text-[#595555]" />) },
      { id: "other-wait-event", label: "Wait for an event", icon: icon(<Hourglass className="size-4 text-[#595555]" />) },
      { id: "other-wait-duration", label: "Pause for a set duration", icon: icon(<Pause className="size-4 text-[#595555]" />) },
    ],
  },
  {
    category: "Logic",
    items: [
      { id: "logic-if-else", label: "If/else", icon: icon(<GitBranch className="size-4 text-[#595555]" />) },
      { id: "logic-wait", label: "Wait", icon: icon(<Hourglass className="size-4 text-[#595555]" />) },
    ],
  },
];

export type CatalogItemWithCategory = AddStepCatalogItem & { category: string };

/** HTML5 DataTransfer type for dragging catalog chips from the sidebar onto canvas connectors. */
export const WORKFLOW_CATALOG_DRAG_MIME =
  "application/x-workflow-catalog-item-id" as const;

/**
 * Catalog steps that keep a workflow **Basic** when they are the only non-trigger steps.
 * Any other catalog step (or AI / widget steps) makes the workflow **Advanced**.
 */
export const WORKFLOW_BASIC_CATALOG_IDS = new Set<string>([
  "notif-email",
  "notif-task",
]);

export function isCatalogItemBasicTier(itemId: string): boolean {
  return WORKFLOW_BASIC_CATALOG_IDS.has(itemId);
}

/** Matches the workflow header Basic / Advanced pills (sidebar + popover use the same). */
export const WORKFLOW_TIER_CHIP_CLASS_BASIC =
  "inline-flex h-5 shrink-0 items-center rounded border border-[#e0dede] bg-[#f9f7f6] px-2 text-[12px] leading-[15px] tracking-[0.25px] text-[#595555]";

export const WORKFLOW_TIER_CHIP_CLASS_ADVANCED =
  "inline-flex h-5 shrink-0 items-center rounded border border-[#d4c4f0] bg-[#f7f4fc] px-2 text-[12px] leading-[15px] tracking-[0.25px] text-[#5c3d9a]";

export const WORKFLOW_TIER_CHIP_FONT_STYLE: {
  fontFamily: string;
  fontWeight: number;
} = {
  fontFamily: "'Basel Grotesk', sans-serif",
  fontWeight: 430,
};

export function getAddStepCatalogFlat(): CatalogItemWithCategory[] {
  return ADD_STEP_CATALOG_GROUPS.flatMap((g) =>
    g.items.map((item) => ({ ...item, category: g.category }))
  );
}

export function findCatalogItem(id: string): CatalogItemWithCategory | undefined {
  for (const g of ADD_STEP_CATALOG_GROUPS) {
    const item = g.items.find((i) => i.id === id);
    if (item) return { ...item, category: g.category };
  }
  return undefined;
}
