import {
  buildReferenceCircuit,
  buildRequiredComponents,
  buildStudentCircuit,
  COMPONENT_PRESETS,
  DEFAULT_CIRCUIT_RULES,
  describeEquipmentComponent,
  normalizeComponentDefinition,
  validateCircuit,
  type CircuitRules,
  type ComponentDefinition,
  type LabPlacementLike,
} from './index';

// Component definitions written by equipment creators: checking them, and
// grading circuits built from custom components.

const rules = (overrides: Partial<CircuitRules> = {}): CircuitRules => ({
  ...DEFAULT_CIRCUIT_RULES,
  requireStepsCompleted: false,
  ...overrides,
});

const SUPPLY = COMPONENT_PRESETS.find(
  (p) => p.id === 'power_supply',
)!.definition;

/** A resistor pack: two independent resistors in one part. */
const PACK: ComponentDefinition = {
  kind: 'resistor_pack',
  labelPrefix: 'RP',
  role: 'load',
  resistive: true,
  terminals: [
    { id: 'a1', label: 'A1', name: 'A1', side: 'left' },
    { id: 'a2', label: 'A2', name: 'A2', side: 'right' },
    { id: 'b1', label: 'B1', name: 'B1', side: 'left' },
    { id: 'b2', label: 'B2', name: 'B2', side: 'right' },
  ],
  branches: [
    { id: 'a', from: 'a1', to: 'a2' },
    { id: 'b', from: 'b1', to: 'b2' },
  ],
  valueField: 'resistance',
  fields: [
    {
      key: 'resistance',
      label: 'Resistance',
      type: 'number',
      unit: 'Ω',
      default: 50,
    },
  ],
};

/** A polar part with custom terminal ids. */
const BUZZER: ComponentDefinition = {
  kind: 'buzzer',
  labelPrefix: 'BZ',
  role: 'load',
  terminals: [
    { id: 'red', label: 'R', name: 'red lead', side: 'left' },
    { id: 'black', label: 'B', name: 'black lead', side: 'right' },
  ],
  branches: [{ id: 'main', from: 'red', to: 'black', polar: true }],
  fields: [],
};

const placement = (
  id: string,
  definition: ComponentDefinition,
  configJson: Record<string, unknown> | null = null,
): LabPlacementLike => ({
  id,
  equipmentId: `eq-${id}`,
  configJson,
  equipment: {
    // Names that would match no (or the wrong) preset: the definition wins.
    equipmentName: `Custom ${id}`,
    equipmentType: 'Resistor',
    componentSpecJson: definition,
  },
});

type Wire = [string, string, string, string];
const studentCircuit = (placements: LabPlacementLike[], wires: Wire[]) =>
  buildStudentCircuit(placements, {
    components: placements.map((p) => ({
      id: `s-${p.id}`,
      equipmentId: p.equipmentId,
      labEquipmentId: p.id,
    })),
    connections: wires.map(([from, fromHandle, to, toHandle]) => ({
      sourceEquipmentId: `s-${from}`,
      sourceHandle: fromHandle,
      targetEquipmentId: `s-${to}`,
      targetHandle: toHandle,
    })),
  });

describe('normalizeComponentDefinition', () => {
  it.each(COMPONENT_PRESETS.map((p) => [p.id, p.definition] as const))(
    'accepts the %s preset unchanged',
    (_, definition) => {
      expect(normalizeComponentDefinition(definition)).toEqual(definition);
    },
  );

  it('fills in defaults and drops unknown keys', () => {
    const result = normalizeComponentDefinition({
      kind: 'lamp',
      labelPrefix: 'LP',
      terminals: [{ id: 'x' }, { id: 'y', side: 'right' }],
      branches: [{ id: 'main', from: 'x', to: 'y' }],
      somethingElse: true,
    });
    expect(result).toEqual({
      kind: 'lamp',
      labelPrefix: 'LP',
      role: 'load',
      terminals: [
        { id: 'x', label: 'x', name: 'terminal x', side: 'left' },
        { id: 'y', label: 'y', name: 'terminal y', side: 'right' },
      ],
      branches: [{ id: 'main', from: 'x', to: 'y' }],
      fields: [],
    });
  });

  const invalid: Array<
    [string, Partial<ComponentDefinition> | object, RegExp]
  > = [
    ['a bad kind', { kind: 'Bad Kind' }, /Component kind/],
    [
      'duplicate terminals',
      { terminals: [{ id: 'a' }, { id: 'a' }] },
      /used more than once/,
    ],
    ['a single terminal', { terminals: [{ id: 'a' }] }, /2–8 entries/],
    [
      'a branch to an unknown terminal',
      { branches: [{ id: 'm', from: 'a1', to: 'zz' }] },
      /not a terminal/,
    ],
    [
      'a branch from a terminal to itself',
      { branches: [{ id: 'm', from: 'a1', to: 'a1' }] },
      /two different terminals/,
    ],
    [
      'a measuring branch on a load',
      { branches: [{ id: 'm', from: 'a1', to: 'a2', role: 'voltmeter' }] },
      /only instruments/,
    ],
    [
      'resistive without a value field',
      { valueField: undefined },
      /value field/,
    ],
    [
      'a value field that is not a number',
      {
        valueField: 'colour',
        fields: [{ key: 'colour', label: 'Colour', type: 'text' }],
      },
      /number field/,
    ],
    [
      'a reserved field key',
      { fields: [{ key: 'name', label: 'Name', type: 'text' }] },
      /reserved/,
    ],
    [
      'a select default outside its options',
      {
        fields: [
          { key: 'resistance', label: 'R', type: 'number' },
          {
            key: 'c',
            label: 'C',
            type: 'select',
            options: ['a'],
            default: 'b',
          },
        ],
      },
      /one of its options/,
    ],
    [
      'a mode with an unknown branch',
      { modes: [{ whenWired: ['a1'], branches: ['nope'] }] },
      /does not exist/,
    ],
    [
      'a source without a positive terminal',
      { role: 'source', branches: [{ id: 'm', from: 'a1', to: 'a2' }] },
      /Positive terminal/,
    ],
    [
      'a code that would break fingerprints',
      { code: 'R(1)' },
      /not a valid id/,
    ],
  ];

  it.each(invalid)('rejects %s', (_, change, message) => {
    expect(() => normalizeComponentDefinition({ ...PACK, ...change })).toThrow(
      message,
    );
  });
});

describe('equipment definitions', () => {
  it('uses the stored definition over name keywords', () => {
    const { component, terminals } = describeEquipmentComponent({
      equipmentName: 'Resistor',
      equipmentType: 'Resistor',
      componentSpecJson: BUZZER,
    });
    expect(component.kind).toBe('buzzer');
    expect(terminals.map((t) => t.id)).toEqual(['red', 'black']);
  });

  it('falls back to a preset for equipment without a definition', () => {
    const { component } = describeEquipmentComponent({
      equipmentName: '9V Battery',
      equipmentType: 'Power',
    });
    expect(component.kind).toBe('power_source');
    expect(component.positiveTerminal).toBe('pos');
  });

  it('falls back to a preset when the stored definition is invalid', () => {
    const { component } = describeEquipmentComponent({
      equipmentName: 'Capacitor',
      equipmentType: 'Component',
      componentSpecJson: { kind: 'broken' },
    });
    expect(component.kind).toBe('capacitor');
  });

  it('reads values from the placement, then defaults, then the field default', () => {
    const [fromField, fromPlacement] = buildRequiredComponents([
      placement('p1', PACK),
      placement('p2', PACK, { resistance: 75, name: 'Pack B' }),
    ]);
    expect(fromField).toMatchObject({
      label: 'RP1',
      kind: 'resistor_pack',
      value: 50,
    });
    expect(fromPlacement).toMatchObject({ label: 'Pack B', value: 75 });
  });
});

describe('grading custom components', () => {
  const placements = [
    placement('v', SUPPLY, { voltage: 9 }),
    placement('pack', PACK, { resistance: 100 }),
    placement('bz', BUZZER),
  ];
  // + -> pack A -> pack B -> buzzer (red -> black) -> −
  const correct: Wire[] = [
    ['v', 'pos', 'pack', 'a1'],
    ['pack', 'a2', 'pack', 'b1'],
    ['pack', 'b2', 'bz', 'red'],
    ['bz', 'black', 'v', 'neg'],
  ];
  const reference = buildReferenceCircuit(
    placements,
    correct.map(([a, ha, b, hb]) => ({
      sourceEquipmentId: a,
      sourceHandle: ha,
      targetEquipmentId: b,
      targetHandle: hb,
    })),
  );
  const grade = (wires: Wire[]) =>
    validateCircuit({
      required: buildRequiredComponents(placements),
      circuit: studentCircuit(placements, wires),
      rules: rules(),
      reference,
    });

  it('uses every branch of a multi-branch part and its own terminals', () => {
    const result = grade(correct);
    expect(result.errors).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.summary.topology).toBe('series');
  });

  it('adds up the resistance of both branches', () => {
    const parts = placements.slice(0, 2);
    const result = validateCircuit({
      required: buildRequiredComponents(parts),
      circuit: studentCircuit(parts, [
        ['v', 'pos', 'pack', 'a1'],
        ['pack', 'a2', 'pack', 'b1'],
        ['pack', 'b2', 'v', 'neg'],
      ]),
      rules: rules({ equivalentResistance: { min: 199, max: 201 } }),
    });
    expect(result.passed).toBe(true);
    expect(result.summary.equivalentResistance).toBe(200);
  });

  it('checks polarity using the creator’s from/to direction', () => {
    const result = grade([
      ['v', 'pos', 'pack', 'a1'],
      ['pack', 'a2', 'pack', 'b1'],
      ['pack', 'b2', 'bz', 'black'],
      ['bz', 'red', 'v', 'neg'],
    ]);
    expect(result.checks.polarity?.passed).toBe(false);
    expect(result.errors.join(' ')).toContain('BZ1');
  });

  it('reports an unwired branch of a multi-branch part', () => {
    const result = grade([
      ['v', 'pos', 'pack', 'a1'],
      ['pack', 'a2', 'bz', 'red'],
      ['bz', 'black', 'v', 'neg'],
    ]);
    expect(result.passed).toBe(false);
    expect(result.checks.connections?.passed).toBe(false);
  });
});
