import {
  buildRequiredComponents,
  buildStudentCircuit,
  DEFAULT_CIRCUIT_RULES,
  normalizeCircuitRules,
  readStoredCircuitRules,
  validateCircuit,
  type CircuitComponent,
  type CircuitRules,
  type CircuitState,
  type CircuitWire,
} from './index';

// Handles on the canvas: left/top = terminal 1, right/bottom = terminal 2.
const R = (id: string, value: number): CircuitComponent => ({
  id,
  label: id,
  kind: 'resistor',
  value,
});
const V = (id: string, value = 12): CircuitComponent => ({
  id,
  label: id,
  kind: 'power_source',
  value,
});

/** wire('R1.right', 'R2.left') */
const wire = (from: string, to: string): CircuitWire => {
  const [a, ha] = from.split('.');
  const [b, hb] = to.split('.');
  return {
    from: { componentId: a, handle: ha },
    to: { componentId: b, handle: hb },
  };
};

const R1 = R('R1', 100);
const R2 = R('R2', 200);
const R3 = R('R3', 300);
const REQUIRED = [R1, R2, R3];

const rules = (overrides: Partial<CircuitRules> = {}): CircuitRules => ({
  ...DEFAULT_CIRCUIT_RULES,
  allowedTopologies: ['series', 'parallel'],
  requireStepsCompleted: false,
  ...overrides,
});

const validate = (
  circuit: CircuitState,
  labRules = rules(),
  required = REQUIRED,
) => validateCircuit({ required, circuit, rules: labRules });

const series = (order: CircuitComponent[]): CircuitState => ({
  components: order,
  wires: order
    .slice(1)
    .map((c, i) => wire(`${order[i].id}.right`, `${c.id}.left`)),
});

const parallel = (order: CircuitComponent[]): CircuitState => ({
  components: order,
  wires: order
    .slice(1)
    .flatMap((c, i) => [
      wire(`${order[i].id}.left`, `${c.id}.left`),
      wire(`${order[i].id}.right`, `${c.id}.right`),
    ]),
});

/** Replays an action sequence into a final circuit state. */
type Action =
  | { action: 'ADD'; component: CircuitComponent }
  | { action: 'REMOVE'; componentId: string }
  | { action: 'CONNECT' | 'DISCONNECT'; from: string; to: string };

const replay = (actions: Action[]): CircuitState => {
  const state: CircuitState = { components: [], wires: [] };
  for (const a of actions) {
    if (a.action === 'ADD') state.components.push(a.component);
    if (a.action === 'REMOVE') {
      state.components = state.components.filter((c) => c.id !== a.componentId);
    }
    if (a.action === 'CONNECT') state.wires.push(wire(a.from, a.to));
    if (a.action === 'DISCONNECT') {
      const key = `${a.from}-${a.to}`;
      state.wires = state.wires.filter(
        (w) =>
          `${w.from.componentId}.${w.from.handle}-${w.to.componentId}.${w.to.handle}` !==
          key,
      );
    }
  }
  return state;
};

describe('circuit validator: multiple valid configurations', () => {
  it('Test 1: accepts a valid series circuit', () => {
    const result = validate(series([R1, R2, R3]));

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.checks.topology?.detected).toBe('series');
    expect(result.summary.equivalentResistance).toBe(600);
    expect(result.errors).toEqual([]);
  });

  it('Test 2: accepts a valid parallel circuit', () => {
    const result = validate(parallel([R1, R2, R3]));

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.checks.topology?.detected).toBe('parallel');
    expect(result.summary.equivalentResistance).toBeCloseTo(54.55, 2);
  });

  it('Test 3: fails when a required component is missing', () => {
    const result = validate(series([R1, R2]));

    expect(result.passed).toBe(false);
    expect(result.checks.requiredComponents?.passed).toBe(false);
    expect(result.errors).toContain('Missing component: R3 (resistor, 300 Ω)');
  });

  it('Test 4: fails when a component is disconnected', () => {
    const circuit = series([R1, R2]);
    circuit.components.push(R3);

    const result = validate(circuit);

    expect(result.passed).toBe(false);
    expect(result.checks.requiredComponents?.passed).toBe(true);
    expect(result.checks.connections?.passed).toBe(false);
    expect(result.checks.circuitComplete?.passed).toBe(false);
    expect(result.errors).toContain('R3 is not connected to the circuit');
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
  });

  describe('Test 5: electrically invalid connections', () => {
    it('detects a shorted component', () => {
      const circuit = series([R1, R2, R3]);
      circuit.wires.push(wire('R2.left', 'R2.right'));

      const result = validate(circuit);

      expect(result.passed).toBe(false);
      expect(result.checks.shortCircuit?.passed).toBe(false);
      expect(result.errors).toContain(
        'R2 is short-circuited (both terminals are connected together)',
      );
    });

    it('detects a power supply shorted by a wire', () => {
      const V1 = V('V1');
      const circuit: CircuitState = {
        components: [V1, R1, R2, R3],
        wires: [
          ...series([R1, R2, R3]).wires,
          wire('V1.right', 'R1.left'),
          wire('R3.right', 'V1.left'),
          wire('V1.left', 'V1.right'),
        ],
      };

      const result = validate(circuit, rules(), [V1, ...REQUIRED]);

      expect(result.passed).toBe(false);
      expect(result.checks.shortCircuit?.passed).toBe(false);
      expect(result.errors).toContain(
        'Short circuit: the terminals of V1 are connected directly',
      );
    });

    it('rejects a wire to a component that is not on the canvas', () => {
      const circuit = series([R1, R2, R3]);
      circuit.wires.push(wire('R3.right', 'R9.left'));

      const result = validate(circuit);

      expect(result.passed).toBe(false);
      expect(result.checks.connections?.passed).toBe(false);
    });

    it('rejects an open branch hanging off a powered circuit', () => {
      const V1 = V('V1');
      const circuit: CircuitState = {
        components: [V1, R1, R2, R3],
        wires: [
          wire('V1.right', 'R1.left'),
          wire('R1.right', 'R2.left'),
          wire('R2.right', 'V1.left'),
          wire('R2.right', 'R3.left'), // R3's other end goes nowhere
        ],
      };

      const result = validate(circuit, rules(), [V1, ...REQUIRED]);

      expect(result.passed).toBe(false);
      expect(result.errors).toContain('R3 terminal 2 is not connected');
    });
  });

  it('Test 6: different action orders produce the same result', () => {
    const studentA = replay([
      { action: 'ADD', component: R1 },
      { action: 'ADD', component: R2 },
      { action: 'CONNECT', from: 'R1.right', to: 'R2.left' },
      { action: 'ADD', component: R3 },
      { action: 'CONNECT', from: 'R2.right', to: 'R3.left' },
    ]);
    const studentB = replay([
      { action: 'ADD', component: R3 },
      { action: 'ADD', component: R1 },
      { action: 'ADD', component: R2 },
      { action: 'CONNECT', from: 'R2.right', to: 'R3.left' },
      { action: 'CONNECT', from: 'R1.right', to: 'R2.left' },
    ]);
    // A student who made a mistake and fixed it ends up with the same circuit.
    const studentC = replay([
      { action: 'ADD', component: R1 },
      { action: 'ADD', component: R2 },
      { action: 'ADD', component: R3 },
      { action: 'CONNECT', from: 'R1.right', to: 'R3.left' },
      { action: 'DISCONNECT', from: 'R1.right', to: 'R3.left' },
      { action: 'CONNECT', from: 'R2.right', to: 'R3.left' },
      { action: 'CONNECT', from: 'R1.right', to: 'R2.left' },
    ]);

    const resultA = validate(studentA);
    expect(resultA.passed).toBe(true);
    expect(validate(studentB)).toEqual(resultA);
    expect(validate(studentC)).toEqual(resultA);
  });

  describe('Test 7: same topology with different component ordering', () => {
    it('treats R1→R2→R3 and R3→R1→R2 as the same valid series circuit', () => {
      const a = validate(series([R1, R2, R3]));
      const b = validate(series([R3, R1, R2]));

      expect(a.passed).toBe(true);
      expect(b.passed).toBe(true);
      expect(b.checks.topology?.detected).toBe('series');
      expect(b.summary.equivalentResistance).toBe(
        a.summary.equivalentResistance,
      );
    });

    it('treats R1||R2||R3 and R3||R1||R2 as the same valid parallel circuit', () => {
      const a = validate(parallel([R1, R2, R3]));
      const b = validate(parallel([R3, R1, R2]));

      expect(a.passed).toBe(true);
      expect(b.passed).toBe(true);
      expect(b.checks.topology?.detected).toBe('parallel');
      expect(b.summary.equivalentResistance).toBeCloseTo(
        a.summary.equivalentResistance!,
      );
    });

    it('ignores wire direction (left-to-right vs right-to-left)', () => {
      const reversed: CircuitState = {
        components: [R1, R2, R3],
        wires: [wire('R3.left', 'R2.right'), wire('R2.left', 'R1.right')],
      };

      expect(validate(reversed).passed).toBe(true);
    });
  });

  describe('instructor configuration', () => {
    it('series-only lab rejects a parallel circuit', () => {
      const result = validate(
        parallel([R1, R2, R3]),
        rules({ allowedTopologies: ['series'] }),
      );

      expect(result.passed).toBe(false);
      expect(result.checks.topology?.passed).toBe(false);
      expect(result.checks.topology?.message).toBe(
        'Detected a parallel configuration, but this lab accepts: series',
      );
    });

    it('parallel-only lab rejects a series circuit', () => {
      const result = validate(
        series([R1, R2, R3]),
        rules({ allowedTopologies: ['parallel'] }),
      );

      expect(result.passed).toBe(false);
      expect(result.checks.topology?.detected).toBe('series');
    });

    it('detects a series-parallel combination and accepts it only when allowed', () => {
      // R1 in series with (R2 || R3)
      const circuit: CircuitState = {
        components: [R1, R2, R3],
        wires: [
          wire('R1.right', 'R2.left'),
          wire('R1.right', 'R3.left'),
          wire('R2.right', 'R3.right'),
        ],
      };

      const strict = validate(circuit);
      expect(strict.checks.topology?.detected).toBe('series-parallel');
      expect(strict.passed).toBe(false);

      const relaxed = validate(
        circuit,
        rules({ allowedTopologies: ['series-parallel'] }),
      );
      expect(relaxed.passed).toBe(true);
      expect(relaxed.summary.equivalentResistance).toBe(220);
    });

    it('checks the required equivalent resistance range', () => {
      const range = rules({ equivalentResistance: { min: 50, max: 100 } });

      expect(validate(parallel([R1, R2, R3]), range).passed).toBe(true);

      const tooHigh = validate(series([R1, R2, R3]), range);
      expect(tooHigh.passed).toBe(false);
      expect(tooHigh.checks.equivalentResistance?.detected).toBe(600);
    });

    it('checks component values within tolerance', () => {
      const wrong = R('R3', 330);
      const result = validate(series([R1, R2, wrong]));

      expect(result.checks.requiredComponents?.passed).toBe(false);

      const ignoreValues = validate(
        series([R1, R2, wrong]),
        rules({ checkComponentValues: false }),
      );
      expect(ignoreValues.checks.requiredComponents?.passed).toBe(true);
    });

    it('applies the extra-components policy', () => {
      const R4 = R('R4', 400);
      const circuit = series([R1, R2, R3, R4]);

      const warn = validate(circuit);
      expect(warn.passed).toBe(true);
      expect(warn.warnings).toHaveLength(1);

      const fail = validate(circuit, rules({ extraComponents: 'fail' }));
      expect(fail.passed).toBe(false);
      expect(fail.checks.extraComponents?.passed).toBe(false);
    });

    it('requires a closed loop through the power source', () => {
      const V1 = V('V1');
      const required = [V1, ...REQUIRED];
      const closed: CircuitState = {
        components: [V1, R1, R2, R3],
        wires: [
          ...parallel([R1, R2, R3]).wires,
          wire('V1.right', 'R1.left'),
          wire('R3.right', 'V1.left'),
        ],
      };

      const result = validate(closed, rules(), required);
      expect(result.passed).toBe(true);
      expect(result.checks.circuitClosed?.passed).toBe(true);
      expect(result.checks.topology?.detected).toBe('parallel');

      const open: CircuitState = {
        components: [V1, R1, R2, R3],
        wires: [...series([R1, R2, R3]).wires, wire('V1.right', 'R1.left')],
      };
      const openResult = validate(open, rules(), required);
      expect(openResult.passed).toBe(false);
      expect(openResult.checks.circuitClosed?.passed).toBe(false);
    });

    it('reports a bridge network as complex', () => {
      const R4 = R('R4', 400);
      const R5 = R('R5', 500);
      const V1 = V('V1');
      // Wheatstone bridge between nodes A (V1.right) and B (V1.left)
      const circuit: CircuitState = {
        components: [V1, R1, R2, R3, R4, R5],
        wires: [
          wire('V1.right', 'R1.left'),
          wire('V1.right', 'R2.left'),
          wire('R1.right', 'R3.left'),
          wire('R2.right', 'R4.left'),
          wire('R3.right', 'V1.left'),
          wire('R4.right', 'V1.left'),
          wire('R1.right', 'R5.left'),
          wire('R5.right', 'R2.right'),
        ],
      };
      const required = [V1, R1, R2, R3, R4, R5];

      expect(
        validate(circuit, rules(), required).checks.topology?.detected,
      ).toBe('complex');
      expect(
        validate(circuit, rules({ allowedTopologies: ['any'] }), required)
          .passed,
      ).toBe(true);
    });
  });

  describe('rules normalisation', () => {
    it('fills defaults and rejects invalid topologies', () => {
      expect(
        normalizeCircuitRules({ allowedTopologies: ['parallel'] }),
      ).toMatchObject({
        allowedTopologies: ['parallel'],
        requireClosedCircuit: true,
        extraComponents: 'warn',
      });
      expect(() =>
        normalizeCircuitRules({ allowedTopologies: ['star'] }),
      ).toThrow();
      expect(() =>
        normalizeCircuitRules({ equivalentResistance: { min: 100, max: 50 } }),
      ).toThrow();
    });

    it('treats missing stored rules as "use the defaults"', () => {
      expect(readStoredCircuitRules(null)).toBeNull();
      expect(readStoredCircuitRules(undefined)).toBeNull();
    });
  });
});

describe('Test 8: existing laboratories', () => {
  // Shapes taken from the existing database: coarse equipmentType, the real
  // kind only in equipmentName (including the "Resister" spelling), and
  // configJson = null on placements.
  const placements = [
    {
      id: 'p-supply',
      equipmentId: 'eq-supply',
      configJson: null,
      equipment: {
        equipmentName: 'Dc Power Supply',
        equipmentType: 'Power',
        defaultConfigJson: '{"voltage":12,"currentLimit":1,"unit":"V"}',
      },
    },
    {
      id: 'p-res',
      equipmentId: 'eq-res',
      configJson: null,
      equipment: {
        equipmentName: 'Resister',
        equipmentType: 'Resister',
        defaultConfigJson: { resistance: 1000, unit: 'Ω' },
      },
    },
    {
      id: 'p-led',
      equipmentId: 'eq-led',
      configJson: null,
      equipment: {
        equipmentName: 'LED',
        equipmentType: 'Component',
        defaultConfigJson: null,
      },
    },
  ];

  it('derives required components from existing placements', () => {
    expect(buildRequiredComponents(placements)).toEqual([
      { id: 'p-supply', label: 'V1', kind: 'power_source', value: 12 },
      { id: 'p-res', label: 'R1', kind: 'resistor', value: 1000 },
      { id: 'p-led', label: 'LED1', kind: 'led', value: null },
    ]);
  });

  it('grades an existing lab with rules using server-side component values', () => {
    const circuit = buildStudentCircuit(placements, {
      components: [
        { id: 's1', equipmentId: 'eq-supply', labEquipmentId: 'p-supply' },
        { id: 's2', equipmentId: 'eq-res', labEquipmentId: 'p-res' },
        // Older clients do not send labEquipmentId; equipmentId is enough.
        { id: 's3', equipmentId: 'eq-led' },
      ],
      connections: [
        {
          sourceEquipmentId: 's1',
          sourceHandle: 'right',
          targetEquipmentId: 's2',
          targetHandle: 'left',
        },
        {
          sourceEquipmentId: 's2',
          sourceHandle: 'right',
          targetEquipmentId: 's3',
          targetHandle: 'left',
        },
        {
          sourceEquipmentId: 's3',
          sourceHandle: 'bottom',
          targetEquipmentId: 's1',
          targetHandle: 'top',
        },
      ],
    });

    const result = validateCircuit({
      required: buildRequiredComponents(placements),
      circuit,
      rules: rules({ allowedTopologies: ['series'] }),
    });

    expect(result.passed).toBe(true);
    expect(result.checks.topology?.detected).toBe('series');
  });
});
