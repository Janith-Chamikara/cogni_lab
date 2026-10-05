import type {
  EquipmentPlacement,
  ExperimentStep,
  Lab,
  StudentCircuitPayload,
  WireConnection,
} from "@/lib/types";

export type AiPageContext = {
  route?: string;
  pageTitle?: string;
  pageType?: string;
  lab?: { id: string; name: string };
  student?: {
    currentStepIndex?: number;
    completedStepIds?: string[];
    completedSteps?: number;
    totalSteps?: number;
    started?: boolean;
    setupPercent?: number;
  };
  workspace?: StudentCircuitPayload;
  editor?: { hasUnsavedChanges?: boolean };
  hints?: string[];
};

export type AiChatMessage = { role: "user" | "assistant"; content: string };

export const buildLabContext = (
  lab: Lab,
  overrides?: {
    steps?: ExperimentStep[];
    equipments?: EquipmentPlacement[];
    connections?: WireConnection[];
  },
) => ({
  id: lab.id,
  name: lab.labName,
  stepCount: (overrides?.steps ?? lab.experimentSteps)?.length ?? 0,
});

export const inferPageType = (route?: string) => {
  if (route?.startsWith("/student/lab/")) return "student-lab";
  if (route?.startsWith("/labs/")) return "lab-editor";
  if (route?.includes("dashboard")) return "dashboard";
  if (route?.startsWith("/modules")) return "modules";
  if (route?.startsWith("/lab-equipment")) return "lab-equipment";
  return "general";
};

export const setAiPageContext = (context: AiPageContext) => {
  if (typeof window === "undefined") return;
  const route = context.route ?? window.location.pathname;
  window.__COGNI_AI_CONTEXT__ = {
    ...context,
    route,
    pageType: context.pageType ?? inferPageType(route),
  };
  window.dispatchEvent(new Event("cogni-ai-context"));
};

export const clearAiPageContext = (route: string) => {
  if (typeof window === "undefined") return;
  const current = window.__COGNI_AI_CONTEXT__ as AiPageContext | undefined;
  if (current?.route === route) {
    delete window.__COGNI_AI_CONTEXT__;
    window.dispatchEvent(new Event("cogni-ai-context"));
  }
};

export const getAiPageContext = (): AiPageContext => {
  if (typeof window === "undefined") return {};
  const route = window.location.pathname;
  const current = window.__COGNI_AI_CONTEXT__ as AiPageContext | undefined;
  return current?.route === route
    ? current
    : { route, pageType: inferPageType(route) };
};

export const getPageSnapshot = () => {
  if (typeof document === "undefined") return undefined;
  const root = document.querySelector("main") ?? document.body;
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      "#ai-chat-widget, script, style, nav, header, footer, input, textarea, [hidden], [aria-hidden='true']",
    )
    .forEach((element) => element.remove());
  return (
    clone.textContent?.replace(/\s+/g, " ").trim().slice(0, 1800) || undefined
  );
};

export const buildChatRequest = (
  messages: AiChatMessage[],
  context = getAiPageContext(),
) => {
  const history = messages.slice(-20);
  while (
    history.length > 1 &&
    history.reduce((size, message) => size + message.content.length, 0) > 20000
  )
    history.shift();
  while (history.length > 1 && history[0].role === "assistant") history.shift();
  return {
    messages: history.map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    })),
    context: {
      route: context.route,
      pageTitle: document.title.trim().slice(0, 200) || undefined,
      pageText: getPageSnapshot(),
      labId: context.lab?.id,
      currentStepIndex: context.student?.currentStepIndex ?? 0,
      completedStepIds: context.student?.completedStepIds ?? [],
      workspace:
        context.pageType === "student-lab" && context.workspace
          ? {
              components: context.workspace.components.map(
                ({ id, equipmentId, labEquipmentId }) => ({
                  id,
                  equipmentId,
                  labEquipmentId,
                }),
              ),
              connections: context.workspace.connections.map(
                ({
                  sourceEquipmentId,
                  targetEquipmentId,
                  sourceHandle,
                  targetHandle,
                }) => ({
                  sourceEquipmentId,
                  targetEquipmentId,
                  sourceHandle,
                  targetHandle,
                }),
              ),
            }
          : undefined,
    },
  };
};
