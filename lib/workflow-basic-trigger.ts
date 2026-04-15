/**
 * Trigger option IDs that keep a workflow eligible for **Basic** (with Basic-tier steps).
 * Includes Popular › Onboarding rows such as `start-date` and `new-hire-status` (see
 * `trigger-data.ts`). Expanded status IDs (e.g. `new-hire-status-submitted`) resolve to the base id.
 */
export const WORKFLOW_BASIC_TRIGGER_OPTION_IDS = new Set<string>([
  "start-date",
  "new-hire-status",
]);

/** Suffix pattern for status-style option ids (matches TriggerSelector expanded options). */
const BASIC_TRIGGER_STATUS_SUFFIX =
  /^(.+)-(submitted|approved|rejected|canceled|sent|viewed|signed|deleted|expires|created|updated|offer-stage|final-stage|is-effective)$/;

export function isWorkflowBasicTriggerOption(id: string | null | undefined): boolean {
  if (id == null) return false;
  if (WORKFLOW_BASIC_TRIGGER_OPTION_IDS.has(id)) return true;
  const m = id.match(BASIC_TRIGGER_STATUS_SUFFIX);
  return m != null && WORKFLOW_BASIC_TRIGGER_OPTION_IDS.has(m[1]);
}

/** Browse path to the canonical “Start date” row under Popular › Onboarding (Basic-eligible). */
export const WORKFLOW_BASIC_START_DATE_BROWSE_PATH = {
  categoryId: "popular",
  itemId: "onboarding",
  subItemId: null as string | null,
  optionId: "start-date",
} as const;

/** Browse path to “New hire request” under Popular › Onboarding (Basic-eligible). */
export const WORKFLOW_BASIC_NEW_HIRE_BROWSE_PATH = {
  categoryId: "popular",
  itemId: "onboarding",
  subItemId: null as string | null,
  optionId: "new-hire-status",
} as const;

export type WorkflowBasicStartDateBrowsePath = {
  categoryId: string;
  itemId: string;
  subItemId?: string | null;
  optionId: string;
};
