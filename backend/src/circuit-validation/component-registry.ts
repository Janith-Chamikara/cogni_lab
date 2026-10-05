import type { ComponentKind } from './types';

// Describes how each kind of component behaves electrically and how the
// canvas handles map to its terminals. To support a new component, add an
// entry here and (if needed) a keyword to KIND_KEYWORDS.

export interface ComponentSpec {
  kind: ComponentKind;
  /** Short prefix used for auto labels, e.g. "R" -> R1, R2. */
  labelPrefix: string;
  /** Terminal names, in order. */
  terminals: [string, string];
  /** configJson key that holds the component's primary value. */
  valueKey?: string;
  unit?: string;
  /** Power sources define the ports of the circuit. */
  isSource?: boolean;
  /** Instruments are not part of the load network (they measure it). */
  isInstrument?: boolean;
}

const SPECS: Record<ComponentKind, ComponentSpec> = {
  resistor: {
    kind: 'resistor',
    labelPrefix: 'R',
    terminals: ['terminal1', 'terminal2'],
    valueKey: 'resistance',
    unit: 'Ω',
  },
  capacitor: {
    kind: 'capacitor',
    labelPrefix: 'C',
    terminals: ['terminal1', 'terminal2'],
    valueKey: 'capacitance',
    unit: 'µF',
  },
  inductor: {
    kind: 'inductor',
    labelPrefix: 'L',
    terminals: ['terminal1', 'terminal2'],
    valueKey: 'inductance',
    unit: 'H',
  },
  led: { kind: 'led', labelPrefix: 'LED', terminals: ['anode', 'cathode'] },
  diode: { kind: 'diode', labelPrefix: 'D', terminals: ['anode', 'cathode'] },
  power_source: {
    kind: 'power_source',
    labelPrefix: 'V',
    terminals: ['negative', 'positive'],
    valueKey: 'voltage',
    unit: 'V',
    isSource: true,
  },
  switch: {
    kind: 'switch',
    labelPrefix: 'S',
    terminals: ['terminal1', 'terminal2'],
  },
  motor: {
    kind: 'motor',
    labelPrefix: 'M',
    terminals: ['terminal1', 'terminal2'],
  },
  instrument: {
    kind: 'instrument',
    labelPrefix: 'X',
    terminals: ['probe1', 'probe2'],
    isInstrument: true,
  },
  unknown: {
    kind: 'unknown',
    labelPrefix: 'U',
    terminals: ['terminal1', 'terminal2'],
  },
};

// Order matters: first match wins ("power supply" before generic words).
const KIND_KEYWORDS: Array<[ComponentKind, RegExp]> = [
  [
    'power_source',
    /power\s*supply|battery|\bcell\b|voltage\s*source|dc\s*source|function\s*generator|signal\s*generator/i,
  ],
  ['instrument', /multi\s*meter|volt\s*meter|amm?eter|oscilloscope|\bmeter\b/i],
  ['resistor', /resist|resister|potentiometer/i],
  ['capacitor', /capacitor/i],
  ['inductor', /inductor|\bcoil\b/i],
  ['led', /\bled\b/i],
  ['diode', /diode/i],
  ['switch', /switch/i],
  ['motor', /motor/i],
];

// Canvas handles: left/top are terminal 1, right/bottom are terminal 2.
const HANDLE_TO_TERMINAL_INDEX: Record<string, 0 | 1> = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};

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

/** Map a canvas handle id to a terminal name. Unknown handles return null. */
export const handleToTerminal = (
  kind: ComponentKind,
  handle?: string | null,
): string | null => {
  const index = HANDLE_TO_TERMINAL_INDEX[handle ?? ''];
  if (index === undefined) return null;
  return getComponentSpec(kind).terminals[index];
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

export const formatValue = (kind: ComponentKind, value?: number | null) => {
  const unit = getComponentSpec(kind).unit;
  return value === null || value === undefined || !unit
    ? ''
    : `${value} ${unit}`;
};
