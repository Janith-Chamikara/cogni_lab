import type { ComponentKind, TerminalSide, TerminalSpec } from './types';

// Describes how each kind of component behaves electrically and which named
// terminals (canvas handles) it has. To support a new component, add an
// entry here and (if needed) a keyword to KIND_KEYWORDS.

/** How a branch acts in the circuit. Ammeters conduct, voltmeters do not. */
export type BranchRole = 'load' | 'voltmeter' | 'ammeter';

/**
 * A two-terminal path through a component. Most components have one branch;
 * a multimeter or potentiometer has several and uses the ones that are wired.
 */
export interface BranchSpec {
  id: string;
  /** Terminal indexes. For polar branches current must enter at [0]. */
  between: [number, number];
  polar?: boolean;
  role?: BranchRole;
  /** Fingerprint code when it differs from the component's code. */
  code?: string;
  /** Share of the component value carried by this branch (potentiometer). */
  valueShare?: (params: Record<string, number>) => number;
}

export interface ComponentSpec {
  kind: ComponentKind;
  /** Short prefix used for auto labels, e.g. "R" -> R1, R2. */
  labelPrefix: string;
  /** Code used in circuit fingerprints, e.g. "R" -> R:100. */
  code: string;
  terminals: TerminalSpec[];
  branches: BranchSpec[];
  /** Branch ids to use, given which terminals have wires. Default: all. */
  pickBranches?: (wired: boolean[]) => string[];
  /** configJson key that holds the component's primary value. */
  valueKey?: string;
  unit?: string;
  /** Power sources define the ports of the circuit. */
  isSource?: boolean;
  /** Index of the positive terminal of a source. */
  plusTerminal?: number;
  /** Instruments measure the circuit; they are not part of the load. */
  isInstrument?: boolean;
  /** Counts towards the equivalent resistance. */
  resistive?: boolean;
}

const terminal = (
  id: string,
  label: string,
  name: string,
  side: TerminalSide,
): TerminalSpec => ({ id, label, name, side });

const T1 = terminal('t1', '1', 'terminal 1', 'left');
const T2 = terminal('t2', '2', 'terminal 2', 'right');
const ONE_BRANCH: BranchSpec[] = [{ id: 'main', between: [0, 1] }];
const POLAR_BRANCH: BranchSpec[] = [
  { id: 'main', between: [0, 1], polar: true },
];

const twoTerminal = (
  kind: ComponentKind,
  labelPrefix: string,
  extra: Partial<ComponentSpec> = {},
): ComponentSpec => ({
  kind,
  labelPrefix,
  code: labelPrefix,
  terminals: [T1, T2],
  branches: ONE_BRANCH,
  ...extra,
});

const meterTerminals = [
  terminal('pos', '+', 'positive (+) terminal', 'left'),
  terminal('com', 'COM', 'COM terminal', 'right'),
];

const SPECS: Record<ComponentKind, ComponentSpec> = {
  resistor: twoTerminal('resistor', 'R', {
    valueKey: 'resistance',
    unit: 'Ω',
    resistive: true,
  }),
  capacitor: twoTerminal('capacitor', 'C', {
    valueKey: 'capacitance',
    unit: 'µF',
  }),
  inductor: twoTerminal('inductor', 'L', { valueKey: 'inductance', unit: 'H' }),
  led: {
    kind: 'led',
    labelPrefix: 'LED',
    code: 'LED',
    terminals: [
      terminal('anode', 'A', 'anode', 'left'),
      terminal('cathode', 'K', 'cathode', 'right'),
    ],
    branches: POLAR_BRANCH,
  },
  diode: {
    kind: 'diode',
    labelPrefix: 'D',
    code: 'D',
    terminals: [
      terminal('anode', 'A', 'anode', 'left'),
      terminal('cathode', 'K', 'cathode', 'right'),
    ],
    branches: POLAR_BRANCH,
  },
  power_source: {
    kind: 'power_source',
    labelPrefix: 'V',
    code: 'V',
    terminals: [
      terminal('neg', '−', 'negative (−) terminal', 'left'),
      terminal('pos', '+', 'positive (+) terminal', 'right'),
    ],
    branches: ONE_BRANCH,
    valueKey: 'voltage',
    unit: 'V',
    isSource: true,
    plusTerminal: 1,
  },
  switch: twoTerminal('switch', 'S', { code: 'SW' }),
  motor: twoTerminal('motor', 'M'),
  potentiometer: {
    kind: 'potentiometer',
    labelPrefix: 'P',
    code: 'R',
    terminals: [T1, terminal('wiper', 'W', 'wiper', 'top'), T2],
    branches: [
      { id: 'full', between: [0, 2] },
      {
        id: 'upper',
        between: [0, 1],
        valueShare: (p) => p.wiperPosition ?? 0.5,
      },
      {
        id: 'lower',
        between: [1, 2],
        valueShare: (p) => 1 - (p.wiperPosition ?? 0.5),
      },
    ],
    // All three wired: two resistors meeting at the wiper. Two wired: the
    // part between them (rheostat). Otherwise the whole track.
    pickBranches: ([t1, wiper, t2]) =>
      t1 && wiper && t2
        ? ['upper', 'lower']
        : t1 && wiper
          ? ['upper']
          : wiper && t2
            ? ['lower']
            : ['full'],
    valueKey: 'resistance',
    unit: 'Ω',
    resistive: true,
  },
  ammeter: {
    kind: 'ammeter',
    labelPrefix: 'A',
    code: 'AM',
    terminals: meterTerminals,
    branches: [{ id: 'main', between: [0, 1], polar: true, role: 'ammeter' }],
    isInstrument: true,
  },
  voltmeter: {
    kind: 'voltmeter',
    labelPrefix: 'VM',
    code: 'VM',
    terminals: meterTerminals,
    branches: [{ id: 'main', between: [0, 1], polar: true, role: 'voltmeter' }],
    isInstrument: true,
  },
  multimeter: {
    kind: 'multimeter',
    labelPrefix: 'MM',
    code: 'MM',
    terminals: [
      terminal('com', 'COM', 'COM terminal', 'left'),
      terminal('v', 'V', 'V terminal', 'right'),
      terminal('a', 'A', 'A terminal', 'right'),
    ],
    branches: [
      { id: 'v', between: [1, 0], polar: true, role: 'voltmeter', code: 'VM' },
      { id: 'a', between: [2, 0], polar: true, role: 'ammeter', code: 'AM' },
    ],
    // COM-V measures voltage, COM-A measures current.
    pickBranches: ([, v, a]) => (v && a ? ['v', 'a'] : a ? ['a'] : ['v']),
    isInstrument: true,
  },
  instrument: {
    kind: 'instrument',
    labelPrefix: 'X',
    code: 'X',
    terminals: [
      terminal('probe1', 'P1', 'probe 1', 'left'),
      terminal('probe2', 'P2', 'probe 2', 'right'),
    ],
    branches: [{ id: 'main', between: [0, 1], role: 'voltmeter' }],
    isInstrument: true,
  },
  unknown: twoTerminal('unknown', 'U'),
};

// Order matters: first match wins ("power supply" before generic words).
const KIND_KEYWORDS: Array<[ComponentKind, RegExp]> = [
  [
    'power_source',
    /power\s*supply|battery|\bcell\b|voltage\s*source|dc\s*source|function\s*generator|signal\s*generator/i,
  ],
  ['multimeter', /multi\s*meter|\bdmm\b/i],
  ['ammeter', /amm?eter|ampere\s*meter|current\s*meter/i],
  ['voltmeter', /volt\s*meter/i],
  ['instrument', /oscilloscope|\bmeter\b/i],
  ['potentiometer', /potentiometer|rheostat|\bpot\b/i],
  ['resistor', /resist|resister/i],
  ['capacitor', /capacitor/i],
  ['inductor', /inductor|\bcoil\b/i],
  ['led', /\bled\b/i],
  ['diode', /diode/i],
  ['switch', /switch/i],
  ['motor', /motor/i],
];

// Wires saved before named terminals: left/top are the first terminal,
// right/bottom the second.
const LEGACY_HANDLE_INDEX: Record<string, number> = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};

const TERMINAL_SIDES: TerminalSide[] = ['left', 'right', 'top', 'bottom'];

export const getComponentSpec = (kind: ComponentKind): ComponentSpec =>
  SPECS[kind] ?? SPECS.unknown;

const isComponentKind = (value: unknown): value is ComponentKind =>
  typeof value === 'string' && value in SPECS;

/**
 * Resolve a component kind. An explicit `componentKind` in config wins;
 * otherwise infer from the equipment name, then the equipment type.
 */
export const resolveComponentKind = (
  equipmentName?: string | null,
  equipmentType?: string | null,
  config?: Record<string, unknown> | null,
): ComponentKind => {
  if (isComponentKind(config?.componentKind)) {
    return config.componentKind;
  }
  for (const text of [equipmentName, equipmentType]) {
    if (!text) continue;
    for (const [kind, pattern] of KIND_KEYWORDS) {
      if (pattern.test(text)) return kind;
    }
  }
  return 'unknown';
};

/**
 * Read a terminal override (`config.terminals`). It may rename, relabel or
 * move the kind's terminals, but must keep their number. Invalid overrides
 * are ignored.
 */
export const readTerminalOverride = (
  kind: ComponentKind,
  config?: Record<string, unknown> | null,
): TerminalSpec[] | null => {
  const raw = config?.terminals;
  const defaults = getComponentSpec(kind).terminals;
  if (!Array.isArray(raw) || raw.length !== defaults.length) return null;

  const terminals: TerminalSpec[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    const id = entry.id;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,20}$/.test(id)) {
      return null;
    }
    const text = (value: unknown, fallback: string) =>
      typeof value === 'string' && value.trim()
        ? value.trim().slice(0, 40)
        : fallback;
    terminals.push({
      id,
      label: text(entry.label, id),
      name: text(entry.name, `terminal ${text(entry.label, id)}`),
      side: TERMINAL_SIDES.includes(entry.side as TerminalSide)
        ? (entry.side as TerminalSide)
        : defaults[index].side,
    });
  }
  return new Set(terminals.map((t) => t.id)).size === terminals.length
    ? terminals
    : null;
};

/** The terminals of a component: its override, or the kind's defaults. */
export const resolveTerminals = (
  kind: ComponentKind,
  override?: TerminalSpec[] | null,
): TerminalSpec[] =>
  override && override.length === getComponentSpec(kind).terminals.length
    ? override
    : getComponentSpec(kind).terminals;

/**
 * Map a canvas handle id to a terminal index. Named terminal ids match
 * first; legacy positional handles (left/right/top/bottom) still work.
 */
export const handleToTerminalIndex = (
  terminals: TerminalSpec[],
  handle?: string | null,
): number | null => {
  const named = terminals.findIndex((t) => t.id === handle);
  if (named >= 0) return named;
  return LEGACY_HANDLE_INDEX[handle ?? ''] ?? null;
};

/** Parse numbers stored as numbers or strings like "50V" / "1.5". */
export const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Read a component's primary value from its config (falls back to defaults). */
export const resolveComponentValue = (
  kind: ComponentKind,
  ...configs: Array<Record<string, unknown> | null | undefined>
): number | null => {
  const key = getComponentSpec(kind).valueKey;
  if (!key) return null;
  for (const config of configs) {
    const value = parseNumeric(config?.[key]);
    if (value !== null) return value;
  }
  return null;
};

/** Extra numeric settings a kind needs (potentiometer wiper position). */
export const resolveComponentParams = (
  kind: ComponentKind,
  ...configs: Array<Record<string, unknown> | null | undefined>
): Record<string, number> | undefined => {
  if (kind !== 'potentiometer') return undefined;
  for (const config of configs) {
    const value = parseNumeric(config?.wiperPosition);
    if (value !== null) {
      return { wiperPosition: Math.min(1, Math.max(0, value)) };
    }
  }
  return undefined;
};

export const formatValue = (kind: ComponentKind, value?: number | null) => {
  const unit = getComponentSpec(kind).unit;
  return value === null || value === undefined || !unit
    ? ''
    : `${value} ${unit}`;
};
