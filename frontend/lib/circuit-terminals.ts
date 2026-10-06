import type { TerminalSpec } from "@/lib/types";

// Named terminals (e.g. "+" / "−", anode / cathode) come from the API on each
// equipment (see backend component-registry.ts). Wires saved before named
// terminals use positional handles: left/top are the first terminal and
// right/bottom the second, the same mapping the grader uses.

const LEGACY_HANDLE_INDEX: Record<string, number> = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};

export const getTerminals = (
  equipment?: { terminals?: TerminalSpec[] } | null,
): TerminalSpec[] | null =>
  equipment?.terminals && equipment.terminals.length > 0
    ? equipment.terminals
    : null;

/** The handle id to draw a stored wire end on. */
export const resolveHandleId = (
  terminals: TerminalSpec[] | null,
  handle: string | null | undefined,
  fallback: "left" | "right",
): string => {
  const id = handle || fallback;
  if (!terminals || terminals.some((t) => t.id === id)) return id;
  return terminals[LEGACY_HANDLE_INDEX[id] ?? -1]?.id ?? id;
};

/** Handle colour: red for +, dark for −/COM/cathode, blue otherwise. */
export const terminalTone = (terminal: TerminalSpec) => {
  if (terminal.id === "pos") return "!border-red-500";
  if (["neg", "com", "cathode"].includes(terminal.id))
    return "!border-slate-700 dark:!border-slate-300";
  return "!border-blue-500";
};
