import { DEFAULT_CHECK_WEIGHTS } from './circuit-rules';
import { parseCircuit, type ParsedElement } from './circuit-parser';
import { formatValue, getComponentSpec } from './component-registry';
import {
  classifyTopology,
  equivalentValue,
  reduceNetwork,
  type NetworkEdge,
  type ReductionTree,
} from './topology';
import type {
  CheckKey,
  CheckResult,
  CircuitComponent,
  CircuitRules,
  CircuitState,
  StepProgress,
  Topology,
  ValidationResult,
} from './types';

// Validation pipeline:
//   student circuit -> parser (nodes/elements) -> checks against lab rules
//   -> structured result with score.
// Only the final circuit state is evaluated; never the order of actions.

export interface ValidateCircuitInput {
  /** Components the lab requires (from the instructor's placements). */
  required: CircuitComponent[];
  /** The student's final circuit. */
  circuit: CircuitState;
  rules: CircuitRules;
  steps?: StepProgress;
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

const isTopologyAllowed = (detected: Topology, rules: CircuitRules) => {
  if (rules.allowedTopologies.includes('any') || detected === 'single')
    return true;
  if (detected === 'complex') return false;
  return rules.allowedTopologies.includes(detected);
};

/** Group elements that are electrically connected to each other. */
const groupConnectedElements = (elements: ParsedElement[]) => {
  const parent = elements.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const firstOnNode = new Map<string, number>();

  elements.forEach((element, index) => {
    for (const node of element.nodes) {
      const other = firstOnNode.get(node);
      if (other === undefined) firstOnNode.set(node, index);
      else parent[find(index)] = find(other);
    }
  });

  const groups = new Map<number, number[]>();
  elements.forEach((_, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), index]);
  });
  return [...groups.values()];
};

/** Remove elements hanging off the network by a dead-end node. */
const findDanglingElements = (
  elements: ParsedElement[],
  ports: Set<string>,
): ParsedElement[] => {
  let remaining = elements.filter((e) => e.nodes[0] !== e.nodes[1]);
  const dangling: ParsedElement[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    const degree = new Map<string, number>();
    for (const e of remaining) {
      for (const node of e.nodes) degree.set(node, (degree.get(node) ?? 0) + 1);
    }
    const dead = remaining.filter((e) =>
      e.nodes.some((node) => !ports.has(node) && degree.get(node) === 1),
    );
    if (dead.length > 0) {
      dangling.push(...dead);
      remaining = remaining.filter((e) => !dead.includes(e));
      changed = true;
    }
  }
  return dangling;
};

const areNodesConnected = (elements: ParsedElement[], a: string, b: string) => {
  const visited = new Set([a]);
  const queue = [a];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === b) return true;
    for (const e of elements) {
      const [u, v] = e.nodes;
      const next = u === node ? v : v === node ? u : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
};

export const validateCircuit = ({
  required,
  circuit,
  rules,
  steps,
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

  // ---- Parse the circuit into an electrical graph ----------------------
  const parsed = parseCircuit(circuit);
  const { elements } = parsed;
  const isSource = (e: ParsedElement) =>
    !!getComponentSpec(e.component.kind).isSource;
  const isInstrument = (e: ParsedElement) =>
    !!getComponentSpec(e.component.kind).isInstrument;
  const isShorted = (e: ParsedElement) => e.nodes[0] === e.nodes[1];

  // Main circuit: the group containing a power source, otherwise the largest.
  const groups = groupConnectedElements(elements).sort(
    (a, b) =>
      Number(b.some((i) => isSource(elements[i]))) -
        Number(a.some((i) => isSource(elements[i]))) ||
      b.length - a.length ||
      a[0] - b[0],
  );
  const mainGroup = (groups[0] ?? []).map((i) => elements[i]);
  const disconnected = elements.filter((e) => !mainGroup.includes(e));
  const sources = mainGroup.filter(isSource);
  const hasSource = sources.length > 0;

  // ---- Connection validation -------------------------------------------
  const openTerminals = mainGroup.flatMap((e) =>
    e.wireCounts
      .map((count, index) => ({ element: e, index, count }))
      .filter((t) => t.count === 0),
  );
  // Without a power source, the two free ends of the network are its ports.
  const allowedOpenTerminals = hasSource ? 0 : 2;

  const connectionIssues = [...new Set(parsed.invalidWires)];
  const disconnectedMessages = disconnected.map(
    (e) => `${e.component.label} is not connected to the circuit`,
  );
  if (rules.requireAllConnected) connectionIssues.push(...disconnectedMessages);
  else warnings.push(...disconnectedMessages);

  if (openTerminals.length > allowedOpenTerminals) {
    connectionIssues.push(
      ...openTerminals.map(
        (t) =>
          `${t.element.component.label} ${t.element.terminals[t.index]} is not connected`,
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
  const shortIssues = mainGroup
    .filter(isShorted)
    .map((e) =>
      isSource(e)
        ? `Short circuit: the terminals of ${e.component.label} are connected directly`
        : `${e.component.label} is short-circuited (both terminals are connected together)`,
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

  // ---- Network between the ports ----------------------------------------
  const portSource = sources[0];
  const network = mainGroup.filter(
    (e) => e !== portSource && !isInstrument(e) && !isShorted(e),
  );
  const edges: NetworkEdge[] = network.map((e) => ({
    id: e.component.id,
    u: e.nodes[0],
    v: e.nodes[1],
  }));
  const resistanceOf = (id: string) => {
    const element = network.find((e) => e.component.id === id);
    return element?.component.kind === 'resistor'
      ? (element.component.value ?? null)
      : null;
  };
  const inResistanceRange = (value: number | null) => {
    const range = rules.equivalentResistance;
    if (!range) return true;
    if (value === null) return false;
    return (
      (range.min == null || value >= range.min - 1e-9) &&
      (range.max == null || value <= range.max + 1e-9)
    );
  };

  let ports: [string, string] | null = null;
  let tree: ReductionTree | null = null;

  if (portSource) {
    if (!isShorted(portSource)) ports = portSource.nodes;
  } else if (openTerminals.length === 2) {
    const [a, b] = openTerminals;
    ports = [a.element.nodes[a.index], b.element.nodes[b.index]];
  } else if (openTerminals.length < 2 && network.length > 0) {
    // Passive network without a source and fewer than two free ends, e.g.
    // R1 || R2 || R3 (no free ends) or R1 + (R2 || R3) (one free end).
    // Free ends must be ports; search the remaining port, preferring a pair
    // that gives an allowed topology.
    const fixed = openTerminals.map((t) => t.element.nodes[t.index]);
    const nodes = [...new Set(network.flatMap((e) => e.nodes))].sort();
    const pairs: Array<[string, string]> =
      fixed.length === 1
        ? nodes.filter((n) => n !== fixed[0]).map((n) => [fixed[0], n])
        : nodes.flatMap((a, i) =>
            nodes.slice(i + 1).map((b): [string, string] => [a, b]),
          );

    let fallback: { ports: [string, string]; tree: ReductionTree } | null =
      null;
    for (const pair of pairs) {
      const candidate = reduceNetwork(edges, pair[0], pair[1]);
      if (!candidate) continue;
      fallback ??= { ports: pair, tree: candidate };
      if (
        isTopologyAllowed(classifyTopology(candidate), rules) &&
        inResistanceRange(equivalentValue(candidate, resistanceOf))
      ) {
        ports = pair;
        tree = candidate;
        break;
      }
    }
    if (!tree && fallback) ({ ports, tree } = fallback);
  }

  if (ports && !tree) tree = reduceNetwork(edges, ports[0], ports[1]);

  // ---- Completeness / closed loop ---------------------------------------
  const dangling = ports ? findDanglingElements(network, new Set(ports)) : [];
  const completeIssues = dangling.map(
    (e) =>
      `${e.component.label} is on an open branch (current cannot flow through it)`,
  );
  const isComplete =
    network.length > 0 &&
    ports !== null &&
    disconnected.length === 0 &&
    openTerminals.length <= allowedOpenTerminals &&
    dangling.length === 0;
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
    const closed =
      ports !== null &&
      network.length > 0 &&
      areNodesConnected(network, ports[0], ports[1]);
    addCheck(
      'circuitClosed',
      'Circuit closed',
      closed,
      closed
        ? 'Circuit is closed'
        : `Circuit is open: there is no complete path between the terminals of ${portSource.component.label}`,
    );
  }

  // ---- Topology ----------------------------------------------------------
  const detected: Topology | null = tree
    ? classifyTopology(tree)
    : isComplete
      ? 'complex'
      : null;
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
  const equivalentResistance = tree
    ? equivalentValue(tree, resistanceOf)
    : null;
  if (rules.equivalentResistance) {
    const { min, max } = rules.equivalentResistance;
    const rangeText = `${min ?? 0}–${max ?? '∞'} Ω`;
    const passed = inResistanceRange(equivalentResistance);
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
  const earned = all
    .filter((c) => c.passed)
    .reduce((sum, c) => sum + c.weight, 0);

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
  };
};
