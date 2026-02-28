import type {
  EquipmentPlacement,
  ExperimentStep,
  Lab,
  WireConnection,
} from "@/lib/types";

export type AiLabContext = {
  id: string;
  name: string;
  description?: string | null;
  moduleName?: string | null;
  tolerances?: {
    min?: number | null;
    max?: number | null;
    unit?: string | null;
  };
  steps?: Array<{
    number: number;
    description: string;
    procedure?: string | null;
    minTolerance?: number | null;
    maxTolerance?: number | null;
    unit?: string | null;
  }>;
  equipment?: Array<{
    id?: string;
    name?: string | null;
    type?: string | null;
    position?: { x: number; y: number };
    config?: Record<string, unknown> | null;
  }>;
  connections?: Array<{
    from?: string;
    to?: string;
    fromHandle?: string | null;
    toHandle?: string | null;
    color?: string | null;
  }>;
};

export type AiPageContext = {
  route?: string;
  pageTitle?: string;
  pageType?: string;
  pageText?: string;
  lab?: AiLabContext;
  student?: {
    currentStepIndex?: number;
    completedSteps?: number;
    totalSteps?: number;
    started?: boolean;
    setupPercent?: number;
  };
  editor?: {
    hasUnsavedChanges?: boolean;
  };
  hints?: string[];
};

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const CONTEXT_KEY = "__COGNI_AI_CONTEXT__";

const isBrowser = () => typeof window !== "undefined";

const cleanText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const limitArray = <T,>(items: T[] | undefined, limit = 20) =>
  items ? items.slice(0, limit) : undefined;

const limitText = (value?: string, limit = 1200) =>
  value ? value.slice(0, limit) : undefined;

const buildEquipmentSummary = (
  equipments?: EquipmentPlacement[],
): AiLabContext["equipment"] =>
  limitArray(equipments, 25)?.map((equipment) => ({
    id: equipment.id,
    name: equipment.equipment?.equipmentName ?? null,
    type: equipment.equipment?.equipmentType ?? null,
    position: {
      x: equipment.positionX,
      y: equipment.positionY,
    },
    config: equipment.configJson ?? null,
  }));

const buildStepSummary = (
  steps?: ExperimentStep[],
): AiLabContext["steps"] =>
  limitArray(steps, 30)?.map((step) => ({
    number: step.stepNumber,
    description: step.stepDescription,
    procedure: step.procedure ?? null,
    minTolerance: step.minTolerance ?? null,
    maxTolerance: step.maxTolerance ?? null,
    unit: step.unit ?? null,
  }));

const buildConnectionSummary = (
  connections?: WireConnection[],
): AiLabContext["connections"] =>
  limitArray(connections, 40)?.map((connection) => ({
    from: connection.sourceEquipmentId,
    to: connection.targetEquipmentId,
    fromHandle: connection.sourceHandle ?? null,
    toHandle: connection.targetHandle ?? null,
    color: connection.wireColor ?? null,
  }));

export const buildLabContext = (
  lab: Lab,
  overrides?: {
    steps?: ExperimentStep[];
    equipments?: EquipmentPlacement[];
    connections?: WireConnection[];
  },
): AiLabContext => ({
  id: lab.id,
  name: lab.labName,
  description: lab.description ?? null,
  moduleName: lab.module?.moduleName ?? null,
  tolerances: {
    min: lab.toleranceMin ?? null,
    max: lab.toleranceMax ?? null,
    unit: lab.toleranceUnit ?? null,
  },
  steps: buildStepSummary(overrides?.steps ?? lab.experimentSteps),
  equipment: buildEquipmentSummary(overrides?.equipments ?? lab.labEquipments),
  connections: buildConnectionSummary(
    overrides?.connections ?? lab.wireConnections,
  ),
});

export const inferPageType = (route?: string) => {
  if (!route) return "unknown";
  if (route.startsWith("/labs/")) return "lab-editor";
  if (route.startsWith("/student/lab/")) return "student-lab";
  if (route.startsWith("/modules")) return "modules";
  if (route.startsWith("/lab-equipment")) return "lab-equipment";
  if (route.startsWith("/dashboard")) return "dashboard";
  if (route.startsWith("/onboarding")) return "onboarding";
  if (route.startsWith("/sign-in") || route.startsWith("/sign-up"))
    return "auth";
  return "general";
};

export const setAiPageContext = (next: AiPageContext) => {
  if (!isBrowser()) return;
  const current = (window as any)[CONTEXT_KEY] as AiPageContext | undefined;
  (window as any)[CONTEXT_KEY] = { ...current, ...next };
};

export const getAiPageContext = (): AiPageContext => {
  if (!isBrowser()) return {};
  return ((window as any)[CONTEXT_KEY] as AiPageContext) ?? {};
};

export const getPageSnapshot = (options?: {
  maxChars?: number;
  selector?: string;
}) => {
  if (!isBrowser()) return undefined;
  const selector = options?.selector ?? "main";
  const maxChars = options?.maxChars ?? 1200;
  const element =
    document.querySelector(selector) ?? document.body ?? document.documentElement;
  const text = element?.textContent ? cleanText(element.textContent) : "";
  return limitText(text, maxChars);
};

export const buildSystemPrompt = (context: AiPageContext) => {
  const lines: string[] = [
    "You are the Cogni Lab assistant.",
    "Use the provided page and lab context to answer.",
    "If context is missing or unclear, ask a concise clarifying question.",
    "Prefer actionable, step-by-step guidance tied to the current page.",
    "Response style: plain text only. No markdown, no bold/italics, no emojis.",
    "When listing items, use '-' bullet points and keep them short.",
    "Do not repeat the user's question.",
    "Do not invent components or lab details that are not in the provided context.",
    "If the user asks about correctness, base it on the listed equipment and connections.",
  ];

  if (context.route) lines.push(`Route: ${context.route}`);
  if (context.pageType) lines.push(`Page: ${context.pageType}`);
  if (context.pageTitle) lines.push(`Title: ${context.pageTitle}`);

  if (context.lab) {
    const equipmentNameById = new Map(
      context.lab.equipment?.map((equipment) => [
        equipment.id ?? "",
        equipment.name ?? "Unknown equipment",
      ]) ?? [],
    );
    const connectionSummary =
      context.lab.connections?.map((connection) => {
        const fromName =
          connection.from && equipmentNameById.get(connection.from)
            ? `${equipmentNameById.get(connection.from)} (${connection.from})`
            : connection.from ?? "Unknown";
        const toName =
          connection.to && equipmentNameById.get(connection.to)
            ? `${equipmentNameById.get(connection.to)} (${connection.to})`
            : connection.to ?? "Unknown";
        return `${fromName} -> ${toName}`;
      }) ?? [];

    lines.push(
      `Lab: ${context.lab.name} (${context.lab.id})`,
      `Module: ${context.lab.moduleName ?? "N/A"}`,
      `Description: ${context.lab.description ?? "N/A"}`,
    );
    if (context.lab.tolerances) {
      lines.push(
        `Tolerances: ${context.lab.tolerances.min ?? "?"} to ${context.lab.tolerances.max ?? "?"} ${context.lab.tolerances.unit ?? ""}`,
      );
    }
    if (context.lab.steps?.length) {
      lines.push(
        `Steps: ${context.lab.steps
          .map((step) => `${step.number}. ${step.description}`)
          .join(" | ")}`,
      );
    }
    if (context.lab.equipment?.length) {
      lines.push(
        `Equipment: ${context.lab.equipment
          .map(
            (equipment) =>
              equipment.name ?? equipment.id ?? "Unknown equipment",
          )
          .join(", ")}`,
      );
    } else {
      lines.push("Equipment: none listed");
    }
    if (connectionSummary.length) {
      lines.push(`Connections: ${connectionSummary.join(" | ")}`);
    } else {
      lines.push("Connections: none listed");
    }
  }

  if (context.student) {
    const stepNumber = (context.student.currentStepIndex ?? 0) + 1;
    lines.push(
      `Student progress: step ${stepNumber}/${context.student.totalSteps ?? "?"}, completed ${context.student.completedSteps ?? 0}`,
    );
    if (typeof context.student.setupPercent === "number") {
      lines.push(`Setup percent: ${Math.round(context.student.setupPercent)}%`);
    }
  }

  if (context.editor?.hasUnsavedChanges) {
    lines.push("Editor state: unsaved changes.");
  }

  if (context.pageText) {
    lines.push(`Page excerpt: ${context.pageText}`);
  }

  if (context.hints?.length) {
    lines.push(`Hints: ${context.hints.join(" | ")}`);
  }

  return lines.join("\n");
};

export const buildChatPayload = (
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: AiPageContext,
): AiChatMessage[] => {
  const systemPrompt = buildSystemPrompt(context);
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
};

export const buildDynamicHints = (input: {
  lastUserMessage?: string;
  context?: AiPageContext;
}) => {
  const hints: string[] = [];
  const message = (input.lastUserMessage ?? "").toLowerCase();
  const equipmentNames =
    input.context?.lab?.equipment
      ?.map((equipment) => equipment.name?.toLowerCase())
      .filter(Boolean) ?? [];
  const hasLed = equipmentNames.some((name) => name?.includes("led"));
  const hasResistor = equipmentNames.some((name) => name?.includes("resistor"));
  const hasPower = equipmentNames.some((name) => name?.includes("power"));

  if (
    message.includes("circuit correct") ||
    message.includes("is my circuit") ||
    message.includes("is my cct") ||
    message.includes("is this circuit")
  ) {
    hints.push(
      "If the question is about correctness, verify the listed connections form a closed loop.",
      "If equipment includes power, resistor, LED, confirm the path power -> resistor -> LED -> return.",
      "If any link is missing, state which connection is missing based on the connections list.",
      "Do not mention capacitors or switches unless they exist in the equipment list.",
    );
  }

  if (message.includes("light") && message.includes("led")) {
    hints.push(
      "Give minimal steps to light an LED using listed equipment only.",
      "Mention LED polarity and that a series resistor is required if a resistor is listed.",
      "If resistor value or supply voltage is unknown, ask for those values briefly.",
    );
  }

  if (!hasResistor && hasLed && hasPower) {
    hints.push(
      "If no resistor is listed, say a current-limiting resistor is missing.",
    );
  }

  return hints;
};
