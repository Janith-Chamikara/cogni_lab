import {
  parseCircuit,
  UnionFind,
  type ParsedCircuit,
  type ParsedElement,
} from './circuit-parser';
import { getComponentSpec } from './component-registry';
import {
  classifyTopology,
  equivalentValue,
  leafAncestors,
  orientLeaves,
  reduceNetwork,
  type NetworkEdge,
  type ReductionTree,
} from './topology';
import type {
  CircuitRules,
  CircuitState,
  Orientation,
  Topology,
} from './types';

// Turns a circuit into everything the checks need: the electrical graph,
// the load network between the source terminals, its series/parallel tree,
// and a second tree that also contains the instruments (used for reference
// comparison, polarity and instrument placement).

export const isSourceElement = (e: ParsedElement) =>
  !!getComponentSpec(e.component.kind).isSource;
export const isInstrumentElement = (e: ParsedElement) =>
  !!getComponentSpec(e.component.kind).isInstrument;
export const roleOf = (e: ParsedElement) => e.branch.role ?? 'load';
export const isShorted = (e: ParsedElement) => e.nodes[0] === e.nodes[1];

export const isTopologyAllowed = (detected: Topology, rules: CircuitRules) => {
  if (rules.allowedTopologies.includes('any') || detected === 'single')
    return true;
  if (detected === 'complex') return false;
  return rules.allowedTopologies.includes(detected);
};

export const inResistanceRange = (
  value: number | null,
  rules: CircuitRules,
) => {
  const range = rules.equivalentResistance;
  if (!range) return true;
  if (value === null) return false;
  return (
    (range.min == null || value >= range.min - 1e-9) &&
    (range.max == null || value <= range.max + 1e-9)
  );
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
  let remaining = elements.filter((e) => !isShorted(e));
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

const toEdges = (elements: ParsedElement[]): NetworkEdge[] =>
  elements.map((e) => ({ id: e.id, u: e.nodes[0], v: e.nodes[1] }));

export interface OpenTerminal {
  element: ParsedElement;
  index: number;
}

/** The network including instruments, on the real (unmerged) nodes. */
export interface FullNetwork {
  elements: ParsedElement[];
  ports: [string, string] | null;
  /** Source terminals, when the circuit has a usable power source. */
  plus: string | null;
  minus: string | null;
  tree: ReductionTree | null;
  /** Direction of current through each element (needs a source). */
  orientation: Map<string, Orientation> | null;
  ancestors: Map<string, ReductionTree[]> | null;
}

export interface CircuitAnalysis {
  parsed: ParsedCircuit;
  elements: ParsedElement[];
  mainGroup: ParsedElement[];
  disconnected: ParsedElement[];
  portSource: ParsedElement | undefined;
  hasSource: boolean;
  openTerminals: OpenTerminal[];
  allowedOpenTerminals: number;
  /** Elements shorted out, after joining the nodes on both sides of ammeters. */
  shorted: ParsedElement[];
  /** Load elements between the ports (no source, instruments or shorts). */
  network: ParsedElement[];
  ports: [string, string] | null;
  tree: ReductionTree | null;
  dangling: ParsedElement[];
  isComplete: boolean;
  isClosed: boolean;
  topology: Topology | null;
  equivalentResistance: number | null;
  full: FullNetwork;
}

export const analyzeCircuit = (
  circuit: CircuitState,
  rules: CircuitRules,
): CircuitAnalysis => {
  const parsed = parseCircuit(circuit);
  const { elements } = parsed;

  // Main circuit: the group containing a power source, otherwise the largest.
  const groups = groupConnectedElements(elements).sort(
    (a, b) =>
      Number(b.some((i) => isSourceElement(elements[i]))) -
        Number(a.some((i) => isSourceElement(elements[i]))) ||
      b.length - a.length ||
      a[0] - b[0],
  );
  const mainGroup = (groups[0] ?? []).map((i) => elements[i]);
  const disconnected = elements.filter((e) => !mainGroup.includes(e));
  const sources = mainGroup.filter(isSourceElement);
  const portSource = sources[0];
  const hasSource = sources.length > 0;

  // An ideal ammeter conducts like a wire: join the nodes on both sides of
  // it before analysing the load. Voltmeters draw no current and are left
  // out of the load entirely.
  const joined = new UnionFind();
  for (const e of mainGroup) {
    if (roleOf(e) === 'ammeter') joined.union(e.nodes[0], e.nodes[1]);
  }
  const load = mainGroup.map(
    (e): ParsedElement => ({
      ...e,
      nodes: [joined.find(e.nodes[0]), joined.find(e.nodes[1])],
    }),
  );
  const loadSource = load.find((e) => e.component === portSource?.component);

  const seenTerminals = new Set<string>();
  const openTerminals: OpenTerminal[] = load.flatMap((element) =>
    element.wireCounts
      .map((count, index) => ({ element, index, count }))
      .filter((t) => {
        const key = `${t.element.component.id}.${t.element.terminals[t.index].id}`;
        if (t.count > 0 || seenTerminals.has(key)) return false;
        seenTerminals.add(key);
        return true;
      })
      .map(({ element: e, index }) => ({ element: e, index })),
  );
  // Without a power source, the two free ends of the network are its ports.
  const allowedOpenTerminals = hasSource ? 0 : 2;

  const shorted = load.filter(
    (e) => isShorted(e) && roleOf(e) !== 'ammeter' && roleOf(e) !== 'voltmeter',
  );
  const network = load.filter(
    (e) =>
      e !== loadSource &&
      !isSourceElement(e) &&
      !isInstrumentElement(e) &&
      !isShorted(e),
  );
  const edges = toEdges(network);
  const resistanceOf = (id: string) => {
    const element = network.find((e) => e.id === id);
    return element && getComponentSpec(element.component.kind).resistive
      ? element.value
      : null;
  };

  let ports: [string, string] | null = null;
  let tree: ReductionTree | null = null;

  if (loadSource) {
    if (!isShorted(loadSource)) ports = loadSource.nodes;
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
        inResistanceRange(equivalentValue(candidate, resistanceOf), rules)
      ) {
        ports = pair;
        tree = candidate;
        break;
      }
    }
    if (!tree && fallback) ({ ports, tree } = fallback);
  }

  if (ports && !tree) tree = reduceNetwork(edges, ports[0], ports[1]);

  const dangling = ports ? findDanglingElements(network, new Set(ports)) : [];
  const isComplete =
    network.length > 0 &&
    ports !== null &&
    disconnected.length === 0 &&
    openTerminals.length <= allowedOpenTerminals &&
    dangling.length === 0;
  const isClosed =
    ports !== null &&
    network.length > 0 &&
    areNodesConnected(network, ports[0], ports[1]);

  const topology: Topology | null = tree
    ? classifyTopology(tree)
    : isComplete
      ? 'complex'
      : null;

  return {
    parsed,
    elements,
    mainGroup,
    disconnected,
    portSource,
    hasSource,
    openTerminals,
    allowedOpenTerminals,
    shorted,
    network,
    ports,
    tree,
    dangling,
    isComplete,
    isClosed,
    topology,
    equivalentResistance: tree ? equivalentValue(tree, resistanceOf) : null,
    full: analyzeFullNetwork(mainGroup, portSource, ports),
  };
};

const analyzeFullNetwork = (
  mainGroup: ParsedElement[],
  portSource: ParsedElement | undefined,
  loadPorts: [string, string] | null,
): FullNetwork => {
  const elements = mainGroup.filter(
    (e) => !isSourceElement(e) && !isShorted(e),
  );
  let plus: string | null = null;
  let minus: string | null = null;
  let ports: [string, string] | null = null;

  if (portSource) {
    if (!isShorted(portSource)) {
      const spec = getComponentSpec(portSource.component.kind);
      const plusIndex = portSource.branch.between.indexOf(
        spec.plusTerminal ?? 1,
      );
      plus = portSource.nodes[plusIndex === 0 ? 0 : 1];
      minus = portSource.nodes[plusIndex === 0 ? 1 : 0];
      ports = [plus, minus];
    }
  } else {
    // Without a source there is no direction; use the load's ports.
    ports = loadPorts;
  }

  const tree =
    ports && elements.length > 0
      ? reduceNetwork(toEdges(elements), ports[0], ports[1])
      : null;

  return {
    elements,
    ports,
    plus,
    minus,
    tree,
    orientation: tree && plus && minus ? orientLeaves(tree, plus, minus) : null,
    ancestors: tree ? leafAncestors(tree) : null,
  };
};
