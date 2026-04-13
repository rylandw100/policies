/**
 * Heuristic parsing for the AI “describe a workflow” path (prototype).
 * Produces a trigger label plus a single **Run function** step, with a Basic vs Advanced tier.
 *
 * **Basic** — the inferred automation is only sending email, or only assigning a task.
 * **Advanced** — any other behavior (Slack/SMS/query/logic/multiple intents, etc.).
 */

export type AiFunctionTier = "basic" | "advanced";

export type ParsedAiWorkflow = {
  workflowName: string;
  triggerLabel: string;
  /** When set, must be in `WORKFLOW_BASIC_TRIGGER_OPTION_IDS` for a Basic workflow tier. */
  triggerOptionId: string | null;
  /** Card subtitle (matches WFchat “Run function” affordance). */
  runLabel: string;
  /** Primary title on the function step card. */
  functionTitle: string;
  summary: string;
  functionTier: AiFunctionTier;
  assumptions: string[];
  /** Prototype generated Rippling Function source shown in the drawer. */
  generatedCode: string;
};

export type RefinedRunFunction = {
  runLabel: string;
  functionTitle: string;
  summary: string;
  functionTier: AiFunctionTier;
  assumptions: string[];
  generatedCode: string;
};

const DEFAULT_TRIGGER = "On a schedule or event you configure";

function shortenTitle(raw: string, max: number): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 12 ? cut.slice(0, sp) : cut).trim() + "…";
}

function inferWorkflowName(text: string): string {
  const cleaned = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(please|can you|could you)\s+/i, "")
    .replace(/^i\s+(want|need)\s+to\s+/i, "")
    .replace(/^(create|build|make|set up)\s+(a|an|the)?\s*/i, "");
  return shortenTitle(cleaned || "New workflow", 48);
}

/** Schedule / event trigger labels (subset of WFchat-style patterns). */
function inferTriggerLabel(text: string, lower: string): string {
  const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  const time = timeMatch ? timeMatch[0] : "9:00 AM";
  const tz = /\bpst\b/i.test(lower)
    ? "PST"
    : /\best\b/i.test(lower)
      ? "EST"
      : "America/Los_Angeles";

  if (/\b(?:every|each)\s+week\b/i.test(lower) || /\bweekly\b/i.test(lower)) {
    const dayMatch = text.match(
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri)\b/i
    );
    const day = dayMatch ? dayMatch[1].slice(0, 3).toUpperCase() : "WED";
    return `Every ${day} at ${time} ${tz}`;
  }
  if (/\b(?:every\s+)?day\b/i.test(lower) && /\b(?:at|every)\b/i.test(lower)) {
    return `Every day at ${time} ${tz}`;
  }
  if (/\b(?:monthly|each\s+month)\b/i.test(lower)) {
    return `Monthly at ${time} ${tz}`;
  }
  if (/\b(?:business\s+day|weekday)\b/i.test(lower)) {
    return `Every business day at ${time} ${tz}`;
  }

  if (
    /\b(?:new\s+hire|onboard|start\s+date|first\s+day|employee\s+start|hired|joining)\b/i.test(
      lower
    )
  ) {
    return "Employee start date at 9:00 AM PST";
  }
  if (/\b(?:terminat|offboard|last\s+day)\b/i.test(lower)) {
    return "Termination request submitted";
  }
  if (/\b(?:anniversary|work\s+iversary)\b/i.test(lower)) {
    return "Work anniversary";
  }
  if (/\b(?:pay\s*run|payroll\s+run)\b/i.test(lower)) {
    return "Pay run completed";
  }
  if (/\b(?:leave|pto|time\s+off)\b/i.test(lower)) {
    return "Leave management event";
  }
  if (/\b(?:approv|sign\s+off)\b/i.test(lower)) {
    return "Approval completed";
  }
  if (/\b(?:document|signed|contract)\b/i.test(lower)) {
    return "Document event";
  }

  if (/\bwhen\b.*\b(schedule|runs?|trigger)\b/i.test(lower)) {
    return shortenTitle(text.replace(/^.{0,80}when\s+/i, "").trim(), 72) || DEFAULT_TRIGGER;
  }

  return DEFAULT_TRIGGER;
}

type IntentFlags = {
  email: boolean;
  task: boolean;
  slack: boolean;
  sms: boolean;
  push: boolean;
  teams: boolean;
  query: boolean;
  api: boolean;
  payment: boolean;
  survey: boolean;
  conditional: boolean;
  otherRippling: boolean;
};

function detectIntents(lower: string): IntentFlags {
  const email =
    /\b(send\s+(an?\s+)?email|e-?mail\s+(to|the)|notify\s+.{0,40}\sby\s+email|drop\s+(an?\s+)?email)\b/i.test(
      lower
    ) || (/\bemail\b/i.test(lower) && /\b(send|notify|draft)\b/i.test(lower));

  const task =
    /\b(assign|create|add)\s+(an?\s+)?(onboarding\s+)?task\b/i.test(lower) ||
    /\btask\s+for\b/i.test(lower) ||
    /\bto-?do\s+for\b/i.test(lower);

  return {
    email,
    task,
    slack: /\bslack\b/i.test(lower) || /\bpost\s+to\s+#/.test(lower),
    sms: /\bsms\b/i.test(lower) || /\btext\s+message\b/i.test(lower),
    push: /\bpush\s+notif/i.test(lower),
    teams: /\bteams\b/i.test(lower) || /\bmicrosoft\s+teams\b/i.test(lower),
    query: /\bquery\s+rippling|\bget\s+data\s+from\s+rippling|\blook\s+up\b.*\brippling\b/i.test(
      lower
    ),
    api: /\bapi\b/i.test(lower) || /\bwebhook\b/i.test(lower),
    payment: /\bpayment\b/i.test(lower) || /\bpay\s+out\b/i.test(lower),
    survey: /\bsurvey\b/i.test(lower),
    conditional:
      /\bif\s+.+?\s+(then|send|assign)\b/i.test(lower) ||
      /\botherwise\b/i.test(lower) ||
      /\belse\b.*\b(send|email|slack)\b/i.test(lower),
    otherRippling:
      /\btime\s+off\s+adjust|custom\s+object|report\b.*\bsend\b/i.test(lower),
  };
}

/**
 * **Basic** only when the described behavior is exclusively email-like OR exclusively task-like,
 * with no other automation intents detected.
 */
export function inferFunctionTierFromPrompt(text: string): AiFunctionTier {
  const lower = text.toLowerCase();

  if (
    /\b(more\s+advanced|make\s+it\s+advanced|make\s+this\s+more\s+advanced|beyond\s+(a\s+)?single\s+(email|task)|not\s+just\s+(email|task)|add\s+(slack|sms|teams|logic|branching))\b/i.test(
      lower
    )
  ) {
    return "advanced";
  }

  const f = detectIntents(lower);

  const other =
    f.slack ||
    f.sms ||
    f.push ||
    f.teams ||
    f.query ||
    f.api ||
    f.payment ||
    f.survey ||
    f.conditional ||
    f.otherRippling;

  const exclusiveEmail = f.email && !f.task && !other;
  const exclusiveTask = f.task && !f.email && !other;

  if (exclusiveEmail || exclusiveTask) {
    return "basic";
  }

  return "advanced";
}

/**
 * Prototype-only generated source: Basic = email-or-task only; Advanced = multi-channel / logic.
 */
export function buildGeneratedRipplingFunctionCode(
  text: string,
  functionTier: AiFunctionTier
): string {
  const lower = text.toLowerCase();
  const f = detectIntents(lower);

  const header = `import RipplingSDK from "@rippling/rippling-sdk";

export async function onRipplingEvent(event, context) {
  const sdk = new RipplingSDK({ bearerToken: context.token });`;

  if (functionTier === "basic") {
    if (f.email && !f.task) {
      return `${header}

  await sdk.notifications.sendEmail({
    to: event.payload?.recipientEmail,
    subject: "Workflow notification",
    body: "Automated message from your workflow.",
  });
}`;
    }
    if (f.task && !f.email) {
      return `${header}

  await sdk.tasks.create({
    title: "Workflow task",
    assigneeId: event.subjectEmployeeId,
    dueInDays: 3,
  });
}`;
    }
    return `${header}

  // Basic tier: single email or single task — implement one path only.
  await sdk.notifications.sendEmail({
    to: event.payload?.recipientEmail,
    subject: "Workflow notification",
    body: "Automated message from your workflow.",
  });
}`;
  }

  const lines: string[] = [header, ""];

  if (f.slack || f.teams) {
    lines.push(
      "  const profile = await sdk.employees.getProfile(event.subjectEmployeeId);",
      `  await sdk.integrations.${f.teams ? "teams" : "slack"}.postMessage({`,
      `    ${f.teams ? "chatId" : "channel"}: ${f.teams ? '"team-chat-id"' : '"#hr-ops"'},`,
      `    text: \`Update for \${profile?.fullName ?? "employee"} (advanced automation).\`,`,
      "  });"
    );
  }
  if (f.sms) {
    lines.push(
      '  await sdk.notifications.sendSms({',
      '    to: event.payload?.phoneE164,',
      '    body: "Time-sensitive workflow alert.",',
      "  });"
    );
  }
  if (f.query) {
    lines.push(
      "  const rows = await sdk.reporting.runSavedQuery({ reportKey: event.payload?.reportKey });",
      "  // Use rows to branch or notify different channels below.",
    );
  }
  if (f.conditional) {
    lines.push(
      "  if (event.payload?.escalate) {",
      "    await sdk.notifications.sendEmail({ to: event.payload.escalationEmail, subject: \"Escalation\", body: \"…\" });",
      "  } else {",
      "    await sdk.notifications.sendEmail({ to: event.payload?.recipientEmail, subject: \"Standard\", body: \"…\" });",
      "  }",
    );
  }
  if (lines.length === 2) {
    lines.push(
      "  // Advanced: multiple actions beyond a single email or task.",
      "  const profile = await sdk.employees.getProfile(event.subjectEmployeeId);",
      "  await sdk.notifications.sendEmail({",
      "    to: profile.workEmail,",
      "    subject: \"Workflow update\",",
      "    body: `Advanced automation for ${profile.fullName}.`,",
      "  });",
      "  await sdk.audit.log({ message: \"Advanced function executed\", eventId: event.id });",
    );
  }

  lines.push("}");
  return lines.join("\n");
}

function inferFunctionTitle(flags: IntentFlags, lower: string): string {
  if (flags.email && !flags.task) return "Send email from workflow";
  if (flags.task && !flags.email) return "Assign task from workflow";
  if (flags.slack) return "Post to Slack";
  if (flags.query) return "Query Rippling and act";
  if (flags.conditional) return "Branch and notify";
  if (/\bclassif|escalat|rout/i.test(lower)) return "Classify and route";
  return "Run custom automation";
}

function buildSummary(
  flags: IntentFlags,
  functionTier: AiFunctionTier,
  triggerLabel: string
): string {
  const parts: string[] = [];
  parts.push(`Runs after: ${triggerLabel}.`);
  if (functionTier === "basic") {
    if (flags.email) parts.push("Sends one email using workflow context.");
    else if (flags.task) parts.push("Creates or assigns one task.");
    return parts.join(" ");
  }
  const acts: string[] = [];
  if (flags.email) acts.push("email");
  if (flags.task) acts.push("task");
  if (flags.slack) acts.push("Slack");
  if (flags.sms) acts.push("SMS");
  if (flags.query) acts.push("Rippling query");
  if (flags.conditional) acts.push("branching");
  if (acts.length) {
    parts.push(`Implements: ${acts.join(", ")} (and related logic in code).`);
  } else {
    parts.push("Implements custom logic in a Rippling Function.");
  }
  return parts.join(" ");
}

export function parseAiWorkflowFromPrompt(text: string): ParsedAiWorkflow {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const assumptions: string[] = [];

  const triggerLabel = inferTriggerLabel(trimmed, lower);
  const triggerOptionId =
    /\b(?:new\s+hire|onboard|start\s+date|first\s+day|employee\s+start|hired|joining)\b/i.test(
      lower
    )
      ? "start-date"
      : null;
  if (triggerLabel === DEFAULT_TRIGGER) {
    assumptions.push("Pick a specific trigger in the editor—the prompt did not match a known pattern.");
  }

  const flags = detectIntents(lower);
  const functionTier = inferFunctionTierFromPrompt(trimmed);
  const functionTitle = inferFunctionTitle(flags, lower);
  const summary = buildSummary(flags, functionTier, triggerLabel);
  const generatedCode = buildGeneratedRipplingFunctionCode(trimmed, functionTier);

  if (functionTier === "advanced") {
    assumptions.push(
      "This function is Advanced-tier: it goes beyond a single email or task action."
    );
  }

  return {
    workflowName: inferWorkflowName(trimmed),
    triggerLabel,
    triggerOptionId,
    runLabel: "Run function",
    functionTitle,
    summary,
    functionTier,
    assumptions,
    generatedCode,
  };
}

/**
 * Re-parse only the Run function from a follow-up chat message. Keeps trigger fields in the caller;
 * use the current trigger label when building summaries.
 */
export function refineRunFunctionFromPrompt(
  text: string,
  ctx: { triggerLabel: string }
): RefinedRunFunction {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const assumptions: string[] = [];

  const flags = detectIntents(lower);
  const functionTier = inferFunctionTierFromPrompt(trimmed);
  const functionTitle = inferFunctionTitle(flags, lower);
  const summary = buildSummary(flags, functionTier, ctx.triggerLabel);
  const generatedCode = buildGeneratedRipplingFunctionCode(trimmed, functionTier);

  if (functionTier === "advanced") {
    assumptions.push(
      "This function is Advanced-tier: it goes beyond a single email or task action."
    );
  }

  return {
    runLabel: "Run function",
    functionTitle,
    summary,
    functionTier,
    assumptions,
    generatedCode,
  };
}

/** Use on a canvas step to branch UI or validation for AI-generated function steps. */
export function isAiRunFunctionBasicTier(step: {
  role: string;
  functionTier?: AiFunctionTier;
}): boolean {
  return step.role === "runFunction" && step.functionTier === "basic";
}
