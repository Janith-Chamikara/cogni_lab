import { getAiPageContext } from "./ai-context";

export type ScreenTarget = {
  id: string;
  label: string;
  kind: "control" | "component" | "wire" | "terminal" | "section";
  action: "show" | "navigate" | "help" | "tab";
  href?: string;
  componentId?: string;
};
export type GuidancePlan = {
  targetId: string;
  mode: "point" | "circle" | "arrow" | "click";
  purpose: "locate" | "issue" | "navigate";
  reason: string;
};
export type GuidanceSnapshot = {
  route: string;
  workspace: string;
  screen: { targets: ScreenTarget[] };
  elements: Map<string, { element: Element; target: ScreenTarget }>;
};
export type GuidanceDisplay = {
  element: Element;
  plan: GuidancePlan;
  label: string;
  signal: AbortSignal;
  complete: (shown: boolean) => void;
};

let sequence = 0;
const clean = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? "";
const safeRoute = (href: string) =>
  /^(?:\/(?:student\/)?dashboard|\/(?:student\/lab|labs)\/[a-zA-Z0-9_-]+|\/modules|\/lab-equipment)$/.test(
    href,
  );
const workspaceVersion = () =>
  JSON.stringify(getAiPageContext().workspace ?? null);
const requestsNavigation = (message: string) =>
  /\b(?:open|click|navigate|visit|launch|go to|take me)\b/i.test(message) &&
  !/\b(?:where|how)\b/i.test(message) &&
  !/\b(?:don't|do not|never|without|no need to)\b.{0,40}\b(?:open|click|navigate|visit|launch|go to|take me)\b/i.test(
    message,
  );

export const isRenderedTarget = (element: Element) => {
  if (
    !element.isConnected ||
    element.closest(
      "#ai-chat-widget, [data-ai-guidance-overlay], [hidden], [aria-hidden='true'], [inert]",
    )
  )
    return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    (element.matches(".react-flow__edge")
      ? rect.width > 1 || rect.height > 1
      : rect.width > 1 && rect.height > 1)
  );
};

export const visibleTargetRect = (element: Element) => {
  if (!isRenderedTarget(element)) return null;
  const rect = element.getBoundingClientRect();
  const edge = element.matches(".react-flow__edge");
  let left = Math.max(0, rect.left - (edge && rect.width < 12 ? 6 : 0)),
    top = Math.max(0, rect.top - (edge && rect.height < 12 ? 6 : 0)),
    right = Math.min(
      window.innerWidth,
      rect.right + (edge && rect.width < 12 ? 6 : 0),
    ),
    bottom = Math.min(
      window.innerHeight,
      rect.bottom + (edge && rect.height < 12 ? 6 : 0),
    );
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) {
      left = Math.max(left, bounds.left);
      right = Math.min(right, bounds.right);
    }
    if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) {
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
  }
  return right - left > 1 && bottom - top > 1
    ? { left, top, width: right - left, height: bottom - top }
    : null;
};

const allowedAction = (
  element: Element,
): { action: ScreenTarget["action"]; href?: string } => {
  if (
    !(element instanceof HTMLElement) ||
    element.matches(":disabled, [aria-disabled='true']")
  )
    return { action: "show" };
  const rawHref =
    element instanceof HTMLAnchorElement
      ? element.getAttribute("href")
      : element.dataset.aiAction === "navigate"
        ? element.dataset.aiHref
        : undefined;
  if (rawHref) {
    try {
      const url = new URL(rawHref, window.location.href);
      if (
        url.origin === window.location.origin &&
        !url.search &&
        !url.hash &&
        safeRoute(url.pathname)
      )
        return { action: "navigate", href: url.pathname };
    } catch {}
  }
  if (
    element.matches("button[data-ai-action='help']") &&
    window.location.pathname.startsWith("/student/lab/")
  )
    return { action: "help" };
  if (
    element.getAttribute("role") === "tab" &&
    (element.closest("[data-ai-reference-guide]") ||
      ["/dashboard", "/student/dashboard"].includes(window.location.pathname))
  )
    return { action: "tab" };
  return { action: "show" };
};

const controlLabel = (element: Element) =>
  clean(
    element.getAttribute("data-ai-label") ??
      element.getAttribute("aria-label") ??
      (clean(element.textContent) || element.getAttribute("title")),
  );

export const collectGuidanceSnapshot = (
  message: string,
): GuidanceSnapshot | undefined => {
  if (
    !/\b(?:where|show|find|locate|point|circle|arrow|draw|highlight|open|click|navigate|visit|launch|error|wrong|issue|struggl|stuck|missing|disconnected|help)\w*\b|can't|cannot|go to|take me/i.test(
      message,
    )
  )
    return undefined;
  const route = window.location.pathname;
  const context = getAiPageContext();
  const elements = new Map<
    string,
    { element: Element; target: ScreenTarget }
  >();
  const targets: ScreenTarget[] = [];
  const prefix = `s${(++sequence).toString(36)}_`;
  const candidates: Array<{
    element: Element;
    kind: ScreenTarget["kind"];
    label: string;
    componentId?: string;
  }> = [];
  document
    .querySelectorAll("a[href], button, [role='tab']")
    .forEach((element) => {
      if (element.closest(".react-flow__node, .react-flow__edge")) return;
      const label = controlLabel(element);
      if (label) candidates.push({ element, kind: "control", label });
    });
  document.querySelectorAll(".react-flow__node[data-id]").forEach((element) => {
    const componentId = element.getAttribute("data-id") ?? undefined;
    const label = clean(element.querySelector("p")?.textContent) || "Equipment";
    candidates.push({ element, kind: "component", label, componentId });
    if (/terminal|pin|port|polarity|handle/i.test(message))
      element
        .querySelectorAll(".react-flow__handle[data-handleid]")
        .forEach((terminal) => {
          candidates.push({
            element: terminal,
            kind: "terminal",
            label: `${label}, ${terminal.getAttribute("data-handleid")} terminal`,
            componentId,
          });
        });
  });
  document.querySelectorAll(".react-flow__edge[data-id]").forEach((element) => {
    const edgeId = element.getAttribute("data-id");
    const wire = context.workspace?.connections.find(
      (connection, index) =>
        ("id" in connection && typeof connection.id === "string"
          ? connection.id
          : `edge-${index}`) === edgeId,
    );
    const labelFor = (id: string) =>
      candidates.find(
        (candidate) =>
          candidate.kind === "component" && candidate.componentId === id,
      )?.label ?? id;
    const label = wire
      ? `${labelFor(wire.sourceEquipmentId)} ${wire.sourceHandle ?? "right"} → ${labelFor(wire.targetEquipmentId)} ${wire.targetHandle ?? "left"}`
      : "Wire connection";
    candidates.push({ element, kind: "wire", label });
  });
  document.querySelectorAll("h1, h2, h3, [role='alert']").forEach((element) => {
    const label = clean(element.textContent);
    if (label) candidates.push({ element, kind: "section", label });
  });
  const wantsIssue =
    /error|wrong|issue|stuck|missing|disconnected|struggl/i.test(message);
  candidates.sort((a, b) =>
    wantsIssue
      ? Number(b.kind !== "control" && b.kind !== "section") -
        Number(a.kind !== "control" && a.kind !== "section")
      : 0,
  );
  for (const candidate of candidates) {
    if (targets.length >= 60 || !isRenderedTarget(candidate.element)) continue;
    const target: ScreenTarget = {
      id: prefix + targets.length,
      label: candidate.label.slice(0, 100),
      kind: candidate.kind,
      ...(candidate.kind === "control"
        ? allowedAction(candidate.element)
        : { action: "show" as const }),
      componentId: candidate.componentId,
    };
    if (JSON.stringify({ targets: [...targets, target] }).length > 9500) break;
    targets.push(target);
    elements.set(target.id, { element: candidate.element, target });
  }
  return targets.length
    ? { route, workspace: workspaceVersion(), screen: { targets }, elements }
    : undefined;
};

const parsePlan = (value: unknown): GuidancePlan => {
  if (!value || typeof value !== "object")
    throw new Error("The assistant returned invalid visual guidance.");
  const plan = value as GuidancePlan;
  if (
    typeof plan.targetId !== "string" ||
    typeof plan.reason !== "string" ||
    !plan.reason.trim() ||
    plan.reason.length > 180 ||
    !["point", "circle", "arrow", "click"].includes(plan.mode) ||
    !["locate", "issue", "navigate"].includes(plan.purpose)
  )
    throw new Error("The assistant returned invalid visual guidance.");
  return plan;
};

export const executeGuidance = async (
  value: unknown,
  snapshot: GuidanceSnapshot | undefined,
  message: string,
  navigate: (href: string) => void,
  signal: AbortSignal,
) => {
  const plan = parsePlan(value);
  const entry = snapshot?.elements.get(plan.targetId);
  if (
    !entry ||
    snapshot?.route !== window.location.pathname ||
    snapshot.workspace !== workspaceVersion() ||
    !isRenderedTarget(entry.element) ||
    signal.aborted
  )
    throw new Error(
      "The screen changed. Ask again so I can locate the current control.",
    );
  const checkClick = () => {
    const current = allowedAction(entry.element);
    if (
      plan.purpose !== "navigate" ||
      !requestsNavigation(message) ||
      current.action === "show" ||
      current.action !== entry.target.action ||
      current.href !== entry.target.href
    )
      throw new Error(
        "I can highlight this control, but the experiment action is yours to perform.",
      );
    if (controlLabel(entry.element).slice(0, 100) !== entry.target.label)
      throw new Error("The target changed. Please ask again.");
    return current;
  };
  if (plan.mode === "click") checkClick();
  if (!visibleTargetRect(entry.element))
    entry.element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  const shown = await new Promise<boolean>((complete) => {
    const finish = (shown: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      complete(shown);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(false), 2500);
    signal.addEventListener("abort", abort, { once: true });
    const detail: GuidanceDisplay = {
      element: entry.element,
      plan,
      label: entry.target.label,
      signal,
      complete: finish,
    };
    window.dispatchEvent(
      new CustomEvent<GuidanceDisplay>("cogni-ai-guidance", { detail }),
    );
  });
  if (!shown || signal.aborted) return;
  if (plan.mode === "click") {
    if (
      snapshot?.route !== window.location.pathname ||
      snapshot.workspace !== workspaceVersion() ||
      !visibleTargetRect(entry.element)
    )
      throw new Error(
        "The screen changed before I could open that view. Please ask again.",
      );
    const current = checkClick();
    if (current.action === "navigate" && current.href) navigate(current.href);
    else if (entry.element instanceof HTMLElement) {
      if (current.action === "tab")
        entry.element.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      else entry.element.click();
    }
  }
};

export const clearVisualGuidance = () =>
  window.dispatchEvent(new Event("cogni-ai-guidance-clear"));
