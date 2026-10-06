import {
  DEFAULT_CIRCUIT_RULES,
  validateCircuit,
  type CircuitComponent,
  type CircuitRules,
  type CircuitState,
  type CircuitWire,
  type ComponentKind,
} from './index';

// Examples from docs/circuit-validation-graph.md. Wires use named terminals:
// resistors t1/t2, supply pos/neg, LED anode/cathode, meters pos/com.

const part = (
  id: string,
  kind: ComponentKind,
  value: number | null = null,
  extra: Partial<CircuitComponent> = {},
): CircuitComponent => ({ id, label: id, kind, value, ...extra });

/** wire('V1.pos', 'R1.t1') */
const wire = (from: string, to: string): CircuitWire => {
  const [a, ha] = from.split('.');
  const [b, hb] = to.split('.');
  return {
    from: { componentId: a, handle: ha },
    to: { componentId: b, handle: hb },
  };
};

const wires = (pairs: Array<[string, string]>) =>
  pairs.map(([a, b]) => wire(a, b));

const rules = (overrides: Partial<CircuitRules> = {}): CircuitRules => ({
  ...DEFAULT_CIRCUIT_RULES,
  requireStepsCompleted: false,
  ...overrides,
});

// Instructor: V1 drives R1, then R2 ∥ R3, then LED1. VM measures across R1.
const REF_PARTS = [
  part('V1', 'power_source', 12),
  part('R1', 'resistor', 100),
  part('R2', 'resistor', 300),
  part('R3', 'resistor', 600),
  part('LED1', 'led'),
  part('VM', 'voltmeter'),
];
const REFERENCE: CircuitState = {
  components: REF_PARTS,
  wires: wires([
    ['V1.pos', 'R1.t1'],
    ['R1.t2', 'R2.t1'],
    ['R1.t2', 'R3.t1'],
    ['R2.t2', 'LED1.anode'],
    ['R3.t2', 'LED1.anode'],
    ['LED1.cathode', 'V1.neg'],
    ['VM.pos', 'R1.t1'],
    ['VM.com', 'R1.t2'],
  ]),
};
const REF_FINGERPRINT = 'S(LED>,P(R:100,VM>),P(R:300,R:600))';

/** The student's copy of the parts: own ids, linked to the placements. */
const studentParts = (parts = REF_PARTS) =>
  parts.map((p) => ({ ...p, refId: p.id }));

const check = (
  circuit: CircuitState,
  reference: CircuitState | null = REFERENCE,
  labRules = rules(),
) =>
  validateCircuit({
    required: (reference ?? circuit).components,
    circuit,
    rules: labRules,
    reference,
    debug: true,
  });

describe('reference comparison (docs/circuit-validation-graph.md)', () => {
  it('fingerprints the instructor circuit as in the explainer', () => {
    const result = check(REFERENCE);
    expect(result.debug?.reference?.fingerprint).toBe(REF_FINGERPRINT);
    expect(result.debug?.student.fingerprint).toBe(REF_FINGERPRINT);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('A: accepts a different order of the same circuit', () => {
    const result = check({
      components: studentParts(),
      wires: wires([
        ['V1.pos', 'LED1.anode'],
        ['LED1.cathode', 'R3.t1'],
        ['LED1.cathode', 'R2.t1'],
        ['R3.t2', 'R1.t1'],
        ['R2.t2', 'R1.t1'],
        ['R1.t2', 'V1.neg'],
        ['VM.pos', 'R1.t1'],
        ['VM.com', 'R1.t2'],
      ]),
    });
    expect(result.debug?.student.fingerprint).toBe(REF_FINGERPRINT);
    expect(result.checks.matchesReference?.passed).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('B: reports a reversed LED', () => {
    const result = check({
      components: studentParts(),
      wires: wires([
        ['V1.pos', 'R1.t1'],
        ['R1.t2', 'R2.t1'],
        ['R1.t2', 'R3.t1'],
        ['R2.t2', 'LED1.cathode'],
        ['R3.t2', 'LED1.cathode'],
        ['LED1.anode', 'V1.neg'],
        ['VM.pos', 'R1.t1'],
        ['VM.com', 'R1.t2'],
      ]),
    });
    expect(result.debug?.student.fingerprint).toBe(
      'S(LED<,P(R:100,VM>),P(R:300,R:600))',
    );
    expect(result.checks.matchesReference?.passed).toBe(false);
    expect(result.checks.matchesReference?.partial).toBeCloseTo(11 / 12);
    expect(result.checks.polarity?.passed).toBe(false);
    expect(result.errors).toContain(
      'LED1 is reversed: its anode must face the + side of the supply',
    );
  });

  it('C: names the pair that should be in parallel', () => {
    const result = check({
      components: studentParts(),
      wires: wires([
        ['V1.pos', 'R1.t1'],
        ['R1.t2', 'R2.t1'],
        ['R2.t2', 'R3.t1'],
        ['R3.t2', 'LED1.anode'],
        ['LED1.cathode', 'V1.neg'],
        ['VM.pos', 'R1.t1'],
        ['VM.com', 'R1.t2'],
      ]),
    });
    expect(result.debug?.student.fingerprint).toBe(
      'S(LED>,P(R:100,VM>),R:300,R:600)',
    );
    expect(result.errors).toContain(
      'R2 and R3 should be in parallel, but they are in series',
    );
    expect(result.checks.matchesReference?.partial).toBeCloseTo(11 / 12);
    expect(result.debug?.comparison?.pairs).toEqual([
      { a: 'R2', b: 'R3', reference: 'parallel', student: 'series' },
    ]);
  });

  it('D: catches a voltmeter wired in series', () => {
    const result = check({
      components: studentParts(),
      wires: wires([
        ['V1.pos', 'R1.t1'],
        ['R1.t2', 'VM.pos'],
        ['VM.com', 'R2.t1'],
        ['VM.com', 'R3.t1'],
        ['R2.t2', 'LED1.anode'],
        ['R3.t2', 'LED1.anode'],
        ['LED1.cathode', 'V1.neg'],
      ]),
    });
    expect(result.errors).toContain(
      'VM should be connected across R1, but it is in series with it',
    );
    expect(result.checks.instruments?.passed).toBe(false);
    expect(result.errors).toContain(
      'VM should be connected across a component (in parallel), but it is in series',
    );
  });

  it('E: lets identical parts swap places', () => {
    const parts = [
      part('V1', 'power_source', 12),
      part('R1', 'resistor', 300),
      part('R2', 'resistor', 300),
      part('R4', 'resistor', 600),
    ];
    const reference: CircuitState = {
      components: parts,
      wires: wires([
        ['V1.pos', 'R1.t1'],
        ['R1.t2', 'R2.t1'],
        ['R1.t2', 'R4.t1'],
        ['R2.t2', 'V1.neg'],
        ['R4.t2', 'V1.neg'],
      ]),
    };
    // The student uses R2 where the instructor used R1, and the other way.
    const result = check(
      {
        components: studentParts(parts),
        wires: wires([
          ['V1.pos', 'R2.t1'],
          ['R2.t2', 'R1.t1'],
          ['R2.t2', 'R4.t1'],
          ['R1.t2', 'V1.neg'],
          ['R4.t2', 'V1.neg'],
        ]),
      },
      reference,
    );
    expect(result.checks.matchesReference?.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('rejects R2 + ((R1 + R4) ∥ R3) although its Req is also 500 Ω', () => {
    const parts = [
      part('V1', 'power_source', 12),
      part('R1', 'resistor', 100),
      part('R2', 'resistor', 300),
      part('R3', 'resistor', 600),
      part('R4', 'resistor', 200),
    ];
    const reference: CircuitState = {
      components: parts,
      wires: wires([
        ['V1.pos', 'R1.t1'],
        ['R1.t2', 'R2.t1'],
        ['R1.t2', 'R3.t1'],
        ['R2.t2', 'R4.t1'],
        ['R3.t2', 'R4.t1'],
        ['R4.t2', 'V1.neg'],
      ]),
    };
    const result = check(
      {
        components: studentParts(parts),
        wires: wires([
          ['V1.pos', 'R2.t1'],
          ['R2.t2', 'R1.t1'],
          ['R1.t2', 'R4.t1'],
          ['R2.t2', 'R3.t1'],
          ['R4.t2', 'V1.neg'],
          ['R3.t2', 'V1.neg'],
        ]),
      },
      reference,
      rules({ equivalentResistance: { min: 475, max: 525 } }),
    );
    expect(result.checks.equivalentResistance?.passed).toBe(true);
    expect(result.checks.matchesReference?.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('compares bridges (not series-parallel) by their node partitions', () => {
    const parts = [
      part('V1', 'power_source', 12),
      ...[100, 200, 300, 400, 500].map((v, i) =>
        part(`R${i + 1}`, 'resistor', v),
      ),
    ];
    const bridge = (r5a: string, r5b: string): CircuitState => ({
      components: parts,
      wires: wires([
        ['V1.pos', 'R1.t1'],
        ['V1.pos', 'R3.t1'],
        ['R1.t2', 'R2.t1'],
        ['R3.t2', 'R4.t1'],
        ['R2.t2', 'V1.neg'],
        ['R4.t2', 'V1.neg'],
        [r5a, r5b],
      ]),
    });
    const reference = bridge('R5.t1', 'R1.t2');
    reference.wires.push(wire('R5.t2', 'R3.t2'));

    // Same bridge, R5 flipped, wires and parts in another order.
    const same = bridge('R5.t2', 'R1.t2');
    same.wires.push(wire('R3.t2', 'R5.t1'));
    same.wires.reverse();
    same.components = studentParts([...parts].reverse());
    const ok = check(same, reference);
    expect(ok.debug?.comparison?.method).toBe('partition');
    expect(ok.checks.matchesReference?.passed).toBe(true);

    // R5 across R1 and R4's far end instead: a different bridge.
    const other = bridge('R5.t1', 'R1.t2');
    other.wires.push(wire('R5.t2', 'R4.t2'), wire('R2.t2', 'R4.t1'));
    other.components = studentParts(parts);
    expect(check(other, reference).checks.matchesReference?.passed).toBe(false);
  });

  it('still checks the experiment steps', () => {
    const result = validateCircuit({
      required: REF_PARTS,
      circuit: REFERENCE,
      rules: rules({ requireStepsCompleted: true }),
      steps: { total: 3, completed: 1 },
    });
    expect(result.checks.steps?.passed).toBe(false);
    expect(result.errors).toContain('Complete all steps: 1/3 done');
  });

  it('skips the comparison when the instructor drew no wires', () => {
    const result = check(
      { components: studentParts(), wires: REFERENCE.wires },
      { components: REF_PARTS, wires: [] },
    );
    expect(result.checks.matchesReference).toBeUndefined();
  });

  it('gives the same result for legacy handles and shuffled wiring', () => {
    const legacy: Record<string, string> = {
      t1: 'left',
      t2: 'right',
      anode: 'left',
      cathode: 'right',
      neg: 'left',
      pos: 'right',
      com: 'right',
    };
    // VM.pos is its first terminal: legacy "left".
    const toLegacy = (w: CircuitWire): CircuitWire => ({
      from: {
        componentId: w.from.componentId,
        handle:
          w.from.componentId === 'VM' && w.from.handle === 'pos'
            ? 'left'
            : legacy[w.from.handle!],
      },
      to: {
        componentId: w.to.componentId,
        handle:
          w.to.componentId === 'VM' && w.to.handle === 'pos'
            ? 'left'
            : legacy[w.to.handle!],
      },
    });
    const shuffled: CircuitState = {
      components: studentParts([...REF_PARTS].reverse()),
      wires: [...REFERENCE.wires]
        .reverse()
        .map(toLegacy)
        .map((w, i) => (i % 2 ? { from: w.to, to: w.from } : w)),
    };
    const result = check(shuffled);
    expect(result.debug?.student.fingerprint).toBe(REF_FINGERPRINT);
    expect(result.score).toBe(100);
  });

  it('only returns debug details when asked', () => {
    const result = validateCircuit({
      required: REF_PARTS,
      circuit: REFERENCE,
      rules: rules(),
      reference: REFERENCE,
    });
    expect(result.debug).toBeUndefined();

    const debug = check(REFERENCE).debug!;
    expect(debug.student.ports).toEqual({ plus: 'n1', minus: 'n4' });
    expect(debug.student.nodes[0]).toEqual({
      id: 'n1',
      terminals: ['V1.+', 'R1.1', 'VM.+'],
    });
    expect(debug.student.tree?.type).toBe('series');
  });
});

describe('instruments and multi-terminal parts', () => {
  const supply = part('V1', 'power_source', 12);
  const R1 = part('R1', 'resistor', 100);

  it('treats an ammeter in series as a wire', () => {
    const result = check(
      {
        components: [supply, part('A1', 'ammeter'), R1],
        wires: wires([
          ['V1.pos', 'A1.pos'],
          ['A1.com', 'R1.t1'],
          ['R1.t2', 'V1.neg'],
        ]),
      },
      null,
    );
    expect(result.passed).toBe(true);
    expect(result.summary.equivalentResistance).toBe(100);
    expect(result.checks.instruments?.passed).toBe(true);
  });

  it('flags an ammeter connected across a resistor', () => {
    const result = check(
      {
        components: [supply, part('A1', 'ammeter'), R1],
        wires: wires([
          ['V1.pos', 'R1.t1'],
          ['R1.t2', 'V1.neg'],
          ['A1.pos', 'R1.t1'],
          ['A1.com', 'R1.t2'],
        ]),
      },
      null,
    );
    expect(result.checks.instruments?.passed).toBe(false);
    expect(result.errors).toContain(
      'R1 is short-circuited (both terminals are connected together)',
    );
  });

  it('uses the multimeter branch that is wired', () => {
    const dmm = part('DMM', 'multimeter');
    const asAmmeter = check(
      {
        components: [supply, dmm, R1],
        wires: wires([
          ['V1.pos', 'DMM.a'],
          ['DMM.com', 'R1.t1'],
          ['R1.t2', 'V1.neg'],
        ]),
      },
      null,
    );
    expect(asAmmeter.passed).toBe(true);
    expect(asAmmeter.debug?.student.elements.map((e) => e.label)).toContain(
      'DMM (A–COM)',
    );

    const reversedVoltmeter = check(
      {
        components: [supply, dmm, R1],
        wires: wires([
          ['V1.pos', 'R1.t1'],
          ['R1.t2', 'V1.neg'],
          ['DMM.com', 'R1.t1'],
          ['DMM.v', 'R1.t2'],
        ]),
      },
      null,
    );
    expect(reversedVoltmeter.checks.instruments?.passed).toBe(true);
    expect(reversedVoltmeter.checks.polarity?.passed).toBe(false);
  });

  it('uses the wired part of a potentiometer', () => {
    const pot = part('P1', 'potentiometer', 1000, {
      params: { wiperPosition: 0.25 },
    });
    const rheostat = check(
      {
        components: [supply, pot],
        wires: wires([
          ['V1.pos', 'P1.t1'],
          ['P1.wiper', 'V1.neg'],
        ]),
      },
      null,
    );
    expect(rheostat.passed).toBe(true);
    expect(rheostat.summary.equivalentResistance).toBe(250);

    // All three terminals: two resistors meeting at the wiper.
    const divider = check(
      {
        components: [supply, pot, R1],
        wires: wires([
          ['V1.pos', 'P1.t1'],
          ['P1.t2', 'V1.neg'],
          ['P1.wiper', 'R1.t1'],
          ['R1.t2', 'V1.neg'],
        ]),
      },
      null,
    );
    expect(divider.summary.topology).toBe('series-parallel');
    expect(divider.summary.equivalentResistance).toBeCloseTo(
      250 + (750 * 100) / 850,
    );
  });
});
