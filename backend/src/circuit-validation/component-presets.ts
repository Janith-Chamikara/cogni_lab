import type {
  BuiltInKind,
  ComponentDefinition,
  ConfigField,
  TerminalSide,
  TerminalSpec,
} from './types';

// Ready-made component definitions. A creator picks one as a starting point
// and may change anything before saving. Equipment saved without its own
// definition (older equipment) falls back to the preset its name suggests.

export interface ComponentPreset {
  id: string;
  name: string;
  description: string;
  definition: ComponentDefinition;
}

const terminal = (
  id: string,
  label: string,
  name: string,
  side: TerminalSide,
): TerminalSpec => ({ id, label, name, side });

const T1 = terminal('t1', '1', 'terminal 1', 'left');
const T2 = terminal('t2', '2', 'terminal 2', 'right');
const ANODE = terminal('anode', 'A', 'anode', 'left');
const CATHODE = terminal('cathode', 'K', 'cathode', 'right');
const METER = [
  terminal('pos', '+', 'positive (+) terminal', 'left'),
  terminal('com', 'COM', 'COM terminal', 'right'),
];
const SOURCE = [
  terminal('neg', '−', 'negative (−) terminal', 'left'),
  terminal('pos', '+', 'positive (+) terminal', 'right'),
];

const number = (
  key: string,
  label: string,
  unit?: string,
  extra: Partial<ConfigField> = {},
): ConfigField => ({
  key,
  label,
  type: 'number',
  ...(unit && { unit }),
  ...extra,
});

const select = (
  key: string,
  label: string,
  options: string[],
): ConfigField => ({
  key,
  label,
  type: 'select',
  options,
});

const twoTerminal = (
  kind: BuiltInKind,
  labelPrefix: string,
  extra: Partial<ComponentDefinition> = {},
): ComponentDefinition => ({
  kind,
  labelPrefix,
  role: 'load',
  terminals: [T1, T2],
  branches: [{ id: 'main', from: 't1', to: 't2' }],
  fields: [],
  ...extra,
});

const polar = (
  kind: BuiltInKind,
  labelPrefix: string,
  fields: ConfigField[],
): ComponentDefinition => ({
  kind,
  labelPrefix,
  role: 'load',
  terminals: [ANODE, CATHODE],
  branches: [{ id: 'main', from: 'anode', to: 'cathode', polar: true }],
  fields,
});

const source = (
  fields: ConfigField[],
  valueField: string,
): ComponentDefinition => ({
  kind: 'power_source',
  labelPrefix: 'V',
  role: 'source',
  terminals: SOURCE,
  positiveTerminal: 'pos',
  branches: [{ id: 'main', from: 'neg', to: 'pos' }],
  valueField,
  fields,
});

const meter = (
  kind: BuiltInKind,
  labelPrefix: string,
  role: 'voltmeter' | 'ammeter',
): ComponentDefinition => ({
  kind,
  labelPrefix,
  role: 'instrument',
  terminals: METER,
  branches: [{ id: 'main', from: 'pos', to: 'com', polar: true, role }],
  fields: [],
});

export const COMPONENT_PRESETS: ComponentPreset[] = [
  {
    id: 'resistor',
    name: 'Resistor',
    description: 'Two terminals, no polarity. Counts towards resistance.',
    definition: twoTerminal('resistor', 'R', {
      resistive: true,
      valueField: 'resistance',
      fields: [
        number('resistance', 'Resistance', 'Ω', { min: 0 }),
        number('power', 'Power rating', 'W', { min: 0 }),
      ],
    }),
  },
  {
    id: 'potentiometer',
    name: 'Potentiometer',
    description:
      'Track between t1 and t2 with a wiper. Uses the part of the track that is wired.',
    definition: {
      kind: 'potentiometer',
      labelPrefix: 'P',
      code: 'R',
      role: 'load',
      resistive: true,
      terminals: [T1, terminal('wiper', 'W', 'wiper', 'top'), T2],
      branches: [
        { id: 'full', from: 't1', to: 't2' },
        {
          id: 'upper',
          from: 't1',
          to: 'wiper',
          share: { param: 'wiperPosition' },
        },
        {
          id: 'lower',
          from: 'wiper',
          to: 't2',
          share: { param: 'wiperPosition', invert: true },
        },
      ],
      // All three wired: two resistors meeting at the wiper. Two wired: the
      // part between them (rheostat). Otherwise the whole track.
      modes: [
        { whenWired: ['t1', 'wiper', 't2'], branches: ['upper', 'lower'] },
        { whenWired: ['t1', 'wiper'], branches: ['upper'] },
        { whenWired: ['wiper', 't2'], branches: ['lower'] },
        { whenWired: [], branches: ['full'] },
      ],
      valueField: 'resistance',
      fields: [
        number('resistance', 'Resistance', 'Ω', { min: 0 }),
        number('wiperPosition', 'Wiper position', undefined, {
          min: 0,
          max: 1,
          default: 0.5,
        }),
      ],
    },
  },
  {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'Two terminals, no polarity.',
    definition: twoTerminal('capacitor', 'C', {
      valueField: 'capacitance',
      fields: [
        number('capacitance', 'Capacitance', 'µF', { min: 0 }),
        number('voltage', 'Voltage rating', 'V', { min: 0 }),
      ],
    }),
  },
  {
    id: 'inductor',
    name: 'Inductor',
    description: 'Two terminals, no polarity.',
    definition: twoTerminal('inductor', 'L', {
      valueField: 'inductance',
      fields: [number('inductance', 'Inductance', 'H', { min: 0 })],
    }),
  },
  {
    id: 'led',
    name: 'LED',
    description: 'Current must enter at the anode.',
    definition: polar('led', 'LED', [
      select('color', 'Color', ['Red', 'Green', 'Blue', 'Yellow', 'White']),
      number('forwardVoltage', 'Forward voltage', 'V', { min: 0 }),
    ]),
  },
  {
    id: 'diode',
    name: 'Diode',
    description: 'Current must enter at the anode.',
    definition: polar('diode', 'D', [
      number('forwardVoltage', 'Forward voltage', 'V', { min: 0 }),
    ]),
  },
  {
    id: 'power_supply',
    name: 'DC power supply / battery',
    description: 'Source with − and + terminals. Defines the circuit ports.',
    definition: source(
      [
        number('voltage', 'Voltage', 'V', { min: 0 }),
        number('current', 'Current limit', 'A', { min: 0 }),
      ],
      'voltage',
    ),
  },
  {
    id: 'function_generator',
    name: 'Function generator',
    description: 'Signal source with − and + terminals.',
    definition: source(
      [
        number('amplitude', 'Amplitude', 'V', { min: 0 }),
        number('frequency', 'Frequency', 'Hz', { min: 0 }),
        number('dcOffset', 'DC offset', 'V'),
        select('waveform', 'Waveform', [
          'Sine',
          'Square',
          'Triangle',
          'Sawtooth',
        ]),
      ],
      'amplitude',
    ),
  },
  {
    id: 'switch',
    name: 'Switch',
    description: 'Two terminals; treated as closed.',
    definition: twoTerminal('switch', 'S', { code: 'SW' }),
  },
  {
    id: 'motor',
    name: 'Motor',
    description: 'Two terminals, no polarity.',
    definition: twoTerminal('motor', 'M'),
  },
  {
    id: 'ammeter',
    name: 'Ammeter',
    description: 'Measures current; must be in series. Current enters at +.',
    definition: meter('ammeter', 'A', 'ammeter'),
  },
  {
    id: 'voltmeter',
    name: 'Voltmeter',
    description:
      'Measures voltage; must be across a part. + faces the supply +.',
    definition: meter('voltmeter', 'VM', 'voltmeter'),
  },
  {
    id: 'multimeter',
    name: 'Multimeter',
    description: 'COM–V measures voltage, COM–A measures current.',
    definition: {
      kind: 'multimeter',
      labelPrefix: 'MM',
      role: 'instrument',
      terminals: [
        terminal('com', 'COM', 'COM terminal', 'left'),
        terminal('v', 'V', 'V terminal', 'right'),
        terminal('a', 'A', 'A terminal', 'right'),
      ],
      branches: [
        {
          id: 'v',
          from: 'v',
          to: 'com',
          polar: true,
          role: 'voltmeter',
          code: 'VM',
        },
        {
          id: 'a',
          from: 'a',
          to: 'com',
          polar: true,
          role: 'ammeter',
          code: 'AM',
        },
      ],
      modes: [
        { whenWired: ['v', 'a'], branches: ['v', 'a'] },
        { whenWired: ['a'], branches: ['a'] },
        { whenWired: [], branches: ['v'] },
      ],
      fields: [
        select('mode', 'Mode', [
          'Voltage',
          'Current',
          'Resistance',
          'Continuity',
        ]),
        { key: 'range', label: 'Range', type: 'text' },
      ],
    },
  },
  {
    id: 'oscilloscope',
    name: 'Oscilloscope / probe instrument',
    description: 'Two probes placed across a part, like a voltmeter.',
    definition: {
      kind: 'instrument',
      labelPrefix: 'X',
      role: 'instrument',
      terminals: [
        terminal('probe1', 'P1', 'probe 1', 'left'),
        terminal('probe2', 'P2', 'probe 2', 'right'),
      ],
      branches: [
        { id: 'main', from: 'probe1', to: 'probe2', role: 'voltmeter' },
      ],
      fields: [
        number('timeDiv', 'Time/div', 'ms', { min: 0 }),
        number('voltDiv', 'Volt/div', 'V', { min: 0 }),
        number('channels', 'Channels', undefined, { min: 1 }),
      ],
    },
  },
  {
    id: 'generic',
    name: 'Generic two-terminal part',
    description: 'Two terminals, no polarity, no value.',
    definition: twoTerminal('unknown', 'U'),
  },
];

const PRESETS_BY_ID = new Map(COMPONENT_PRESETS.map((p) => [p.id, p]));

// Order matters: first match wins ("power supply" before generic words).
const PRESET_KEYWORDS: Array<[string, RegExp]> = [
  ['function_generator', /function\s*generator|signal\s*generator/i],
  [
    'power_supply',
    /power\s*supply|battery|\bcell\b|voltage\s*source|dc\s*source/i,
  ],
  ['multimeter', /multi\s*meter|\bdmm\b/i],
  ['ammeter', /amm?eter|ampere\s*meter|current\s*meter/i],
  ['voltmeter', /volt\s*meter/i],
  ['oscilloscope', /oscilloscope|\bmeter\b/i],
  ['potentiometer', /potentiometer|rheostat|\bpot\b/i],
  ['resistor', /resist|resister/i],
  ['capacitor', /capacitor/i],
  ['inductor', /inductor|\bcoil\b/i],
  ['led', /\bled\b/i],
  ['diode', /diode/i],
  ['switch', /switch/i],
  ['motor', /motor/i],
];

export const getPreset = (id: string) => PRESETS_BY_ID.get(id);

/** The first preset of a kind, e.g. "power_source" -> DC power supply. */
export const presetForKind = (kind: string) =>
  COMPONENT_PRESETS.find((p) => p.definition.kind === kind);

/**
 * Preset for equipment without its own definition: an explicit legacy
 * `componentKind` in its config, else keywords in its name, then its type.
 */
export const guessPreset = (
  equipmentName?: string | null,
  equipmentType?: string | null,
  config?: Record<string, unknown> | null,
): ComponentPreset => {
  const kind = config?.componentKind;
  const byKind = typeof kind === 'string' ? presetForKind(kind) : undefined;
  if (byKind) return byKind;
  for (const value of [equipmentName, equipmentType]) {
    if (!value) continue;
    for (const [id, pattern] of PRESET_KEYWORDS) {
      if (pattern.test(value)) return PRESETS_BY_ID.get(id)!;
    }
  }
  return PRESETS_BY_ID.get('generic')!;
};
