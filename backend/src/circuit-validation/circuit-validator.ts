import { DEFAULT_CHECK_WEIGHTS } from './circuit-rules';
import {
  analyzeCircuit,
  inResistanceRange,
  isInstrumentElement,
  isTopologyAllowed,
  isSourceElement,
  roleOf,
} from './circuit-analysis';
import { buildCircuitDebug } from './circuit-debug';
import { formatValue } from './component-registry';
import {
  compareToReference,
  comparisonDebug,
  type ReferenceComparison,
} from './reference-compare';
import { leafParentType } from './topology';
import type {
  CheckKey,
  CheckResult,
  CircuitComponent,
  CircuitRules,
  CircuitState,
  StepProgress,
  ValidationResult,
} from './types';

// Validation pipeline:
//   student circuit -> analysis (nodes, elements, series/parallel tree)
//   -> checks against lab rules and the instructor's circuit
//   -> structured result with score.
// Only the final circuit state is evaluated; never the order of actions.

export interface ValidateCircuitInput {
  /** Components the lab requires (from the instructor's placements). */
  required: CircuitComponent[];
  /** The student's final circuit. */
  circuit: CircuitState;
  rules: CircuitRules;
  steps?: StepProgress;
  /** The instructor's wired circuit, compared when rules allow it. */
  reference?: CircuitState | null;
  /** Include graph, tree and fingerprint details in the result. */
  debug?: boolean;
}

const withinTolerance = (actual: number, expected: number, percent: number) =>
  expected === 0
    ? actual === 0
    : (Math.abs(actual - expected) / Math.abs(expected)) * 100 <=
      percent + 1e-9;

const describe = (component: CircuitComponent) => {
  const value = formatValue(component.kind, component.value);
  const kind = component.kind.replace('_', ' ');
  return `${component.label} (${value ? `${kind}, ${value}` : kind})`;
};

const round = (value: number) => Math.round(value * 100) / 100;

export const validateCircuit = ({
  required,
  circuit,
  rules,
  steps,
  reference,
  debug,
}: ValidateCircuitInput): ValidationResult => {
  const weights = { ...DEFAULT_CHECK_WEIGHTS, ...rules.weights };
  const checks: Partial<Record<string, CheckResult>> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  const addCheck = (
    key: CheckKey,
    label: string,
    passed: boolean,
    message: string,
    issues: string[] = [],
    detected?: string | number | null,
  ) => {
    checks[key] = {
      passed,
      label,
      message,
      weight: weights[key],
      ...(detected !== undefined && { detected }),
    };
    if (!passed) errors.push(...(issues.length > 0 ? issues : [message]));
  };

  // ---- Component validation -------------------------------------------
  const unmatched = [...circuit.components];
  const missing: CircuitComponent[] = [];
  const valueMatters = (req: CircuitComponent) =>
    rules.checkComponentValues && req.value !== null && req.value !== undefined;

  // Requirements with specific values are matched first so a value-less
  // requirement cannot take a component another requirement needs.
  const orderedRequired = [...required].sort(
    (a, b) => Number(valueMatters(b)) - Number(valueMatters(a)),
  );
  for (const req of orderedRequired) {
    const candidates = unmatched.filter(
      (c) =>
        c.kind === req.kind &&
        (!valueMatters(req) ||
          (c.value != null &&
            withinTolerance(c.value, req.value!, rules.valueTolerancePercent))),
    );
    if (candidates.length === 0) {
      missing.push(req);
      continue;
    }
    // Closest value wins, so tolerances cannot steal a better match.
    const best = valueMatters(req)
      ? candidates.reduce((a, b) =>
          Math.abs(a.value! - req.value!) <= Math.abs(b.value! - req.value!)
            ? a
            : b,
        )
      : candidates[0];
    unmatched.splice(unmatched.indexOf(best), 1);
  }

  addCheck(
    'requiredComponents',
    'Required components',
    missing.length === 0,
    missing.length === 0
      ? `All required components are present (${required.length}/${required.length})`
      : `${required.length - missing.length}/${required.length} required components are present`,
    missing.map((req) => `Missing component: ${describe(req)}`),
  );

  const extraMessages = unmatched.map(
    (c) => `${describe(c)} is not part of this lab's requirements`,
  );
  if (rules.extraComponents === 'fail') {
    addCheck(
      'extraComponents',
      'No extra components',
      unmatched.length === 0,
      unmatched.length === 0
        ? 'No extra components were used'
        : `${unmatched.length} extra component(s) were used`,
      extraMessages,
    );
  } else if (rules.extraComponents === 'warn') {
    warnings.push(...extraMessages);
  }

  // ---- Analyse the circuit as an electrical graph ----------------------
  const analysis = analyzeCircuit(circuit, rules);
  const {
    parsed,
    elements,
    disconnected,
    portSource,
    hasSource,
    openTerminals,
    allowedOpenTerminals,
    dangling,
    isComplete,
    full,
  } = analysis;

  // ---- Connection validation -------------------------------------------
  const connectionIssues = [...new Set(parsed.invalidWires)];
  const disconnectedMessages = [
    ...new Set(disconnected.map((e) => e.component.label)),
  ].map((label) => `${label} is not connected to the circuit`);
  if (rules.requireAllConnected) connectionIssues.push(...disconnectedMessages);
  else warnings.push(...disconnectedMessages);

  if (openTerminals.length > allowedOpenTerminals) {
    connectionIssues.push(
      ...openTerminals.map(
        (t) =>
          `${t.element.component.label} terminal ${t.element.terminals[t.index].label} is not connected`,
      ),
    );
  }

  if (elements.length === 0) {
    connectionIssues.push('No components have been placed on the canvas');
  }

  addCheck(
    'connections',
    'Connections',
    connectionIssues.length === 0,
    connectionIssues.length === 0
      ? 'All components are connected'
      : 'Some connections are missing or invalid',
    connectionIssues,
  );

  // ---- Short circuits ----------------------------------------------------
  const shortIssues = analysis.shorted.map((e) =>
    isSourceElement(e)
      ? `Short circuit: the terminals of ${e.component.label} are connected directly`
      : `${e.label} is short-circuited (both terminals are connected together)`,
  );
  if (rules.forbidShortCircuit) {
    addCheck(
      'shortCircuit',
      'No short circuits',
      shortIssues.length === 0,
      shortIssues.length === 0
        ? 'No short circuits detected'
        : 'Short circuit detected',
      shortIssues,
    );
  } else {
    warnings.push(...shortIssues);
  }

  // ---- Completeness / closed loop ---------------------------------------
  const completeIssues = dangling.map(
    (e) => `${e.label} is on an open branch (current cannot flow through it)`,
  );
  addCheck(
    'circuitComplete',
    'Circuit complete',
    isComplete,
    isComplete ? 'Circuit is complete' : 'Circuit is incomplete',
    completeIssues.length > 0
      ? ['Circuit is incomplete', ...completeIssues]
      : [],
  );

  if (hasSource && rules.requireClosedCircuit) {
    addCheck(
      'circuitClosed',
      'Circuit closed',
      analysis.isClosed,
      analysis.isClosed
        ? 'Circuit is closed'
        : `Circuit is open: there is no complete path between the terminals of ${portSource!.component.label}`,
    );
  }

  // ---- Topology ----------------------------------------------------------
  const detected = analysis.topology;
  const allowedText = rules.allowedTopologies.join(', ');
  addCheck(
    'topology',
    'Topology',
    detected !== null && isTopologyAllowed(detected, rules),
    detected === null
      ? 'Topology could not be determined because the circuit is incomplete'
      : isTopologyAllowed(detected, rules)
        ? `Valid ${detected} configuration`
        : `Detected a ${detected} configuration, but this lab accepts: ${allowedText}`,
    [],
    detected,
  );

  // ---- Electrical validation ---------------------------------------------
  const equivalentResistance = analysis.equivalentResistance;
  if (rules.equivalentResistance) {
    const { min, max } = rules.equivalentResistance;
    const rangeText = `${min ?? 0}–${max ?? '∞'} Ω`;
    const passed = inResistanceRange(equivalentResistance, rules);
    addCheck(
      'equivalentResistance',
      'Equivalent resistance',
      passed,
      equivalentResistance === null
        ? `Equivalent resistance could not be calculated (required ${rangeText})`
        : `Equivalent resistance is ${round(equivalentResistance)} Ω (required ${rangeText})`,
      [],
      equivalentResistance === null ? null : round(equivalentResistance),
    );
  }

  // ---- Instructor's circuit (reference) ---------------------------------
  const includeValues = rules.checkComponentValues;
  const referenceAnalysis =
    rules.compareToReference && reference && reference.wires.length > 0
      ? analyzeCircuit(reference, rules)
      : null;
  let comparison: ReferenceComparison | null = null;
  if (referenceAnalysis) {
    comparison = compareToReference(referenceAnalysis, analysis, includeValues);
    addCheck(
      'matchesReference',
      'Matches the instructor’s circuit',
      comparison.match,
      comparison.match
        ? 'Your circuit matches the instructor’s circuit'
        : 'Your circuit differs from the instructor’s circuit',
      comparison.messages,
    );
    if (!comparison.match && comparison.partialScore > 0) {
      checks.matchesReference!.partial = comparison.partialScore;
    }
  }

  // ---- Polarity ------------------------------------------------------------
  // Polar parts (LEDs, diodes, meters) must let current in at the right
  // terminal: as in the instructor's circuit, or forward when there is none.
  const polar = full.elements.filter((e) => e.branch.polar);
  if (polar.length > 0 && full.orientation) {
    const polarityIssues: string[] = [];
    for (const e of polar) {
      const actual = full.orientation.get(e.id);
      const ref = comparison?.mapping.get(e.id);
      const expected =
        (ref && referenceAnalysis?.full.orientation?.get(ref.id)) ?? 'forward';
      if (!actual || actual === expected) continue;
      polarityIssues.push(
        expected === 'forward'
          ? `${e.label} is reversed: its ${e.terminals[0].name} must face the + side of the supply`
          : `${e.label} is the other way round in the instructor’s circuit`,
      );
    }
    addCheck(
      'polarity',
      'Polarity',
      polarityIssues.length === 0,
      polarityIssues.length === 0
        ? 'All polarised parts face the right way'
        : 'Some parts are connected the wrong way round',
      polarityIssues,
    );
  }

  // ---- Instruments ---------------------------------------------------------
  // Voltmeters go across a part (parallel); ammeters go in series.
  const meters = full.elements.filter(
    (e) => isInstrumentElement(e) && roleOf(e) !== 'load',
  );
  if (meters.length > 0 && full.ancestors) {
    const instrumentIssues: string[] = [];
    for (const e of meters) {
      const parent = leafParentType(full.ancestors, e.id);
      if (roleOf(e) === 'voltmeter' && parent === 'series') {
        instrumentIssues.push(
          `${e.label} should be connected across a component (in parallel), but it is in series`,
        );
      }
      if (roleOf(e) === 'ammeter' && parent !== 'series') {
        instrumentIssues.push(
          `${e.label} should be in series, but it is connected across ${parent ? 'another part' : 'the supply'}, which short-circuits it`,
        );
      }
    }
    addCheck(
      'instruments',
      'Instrument placement',
      instrumentIssues.length === 0,
      instrumentIssues.length === 0
        ? 'Instruments are connected correctly'
        : 'Some instruments are connected incorrectly',
      instrumentIssues,
    );
  }

  // ---- Steps ---------------------------------------------------------------
  if (rules.requireStepsCompleted && steps && steps.total > 0) {
    const done = Math.min(steps.completed, steps.total);
    addCheck(
      'steps',
      'Steps completed',
      done >= steps.total,
      done >= steps.total
        ? 'All steps completed'
        : `Complete all steps: ${done}/${steps.total} done`,
    );
  }

  // ---- Score ---------------------------------------------------------------
  const all = Object.values(checks).filter(
    (c): c is CheckResult => c !== undefined,
  );
  const totalWeight = all.reduce((sum, c) => sum + c.weight, 0);
  const earned = all.reduce(
    (sum, c) => sum + (c.passed ? c.weight : c.weight * (c.partial ?? 0)),
    0,
  );

  return {
    mode: 'rules',
    passed: all.every((c) => c.passed),
    score: totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0,
    checks,
    errors,
    warnings,
    summary: {
      topology: detected,
      equivalentResistance:
        equivalentResistance === null ? null : round(equivalentResistance),
      componentCount: circuit.components.length,
      connectionCount: parsed.wireCount,
    },
    ...(debug && {
      debug: {
        student: buildCircuitDebug(analysis, includeValues),
        reference: referenceAnalysis
          ? buildCircuitDebug(referenceAnalysis, includeValues)
          : null,
        comparison:
          comparison && referenceAnalysis
            ? comparisonDebug(comparison, analysis, referenceAnalysis)
            : null,
      },
    }),
  };
};
