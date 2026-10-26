import {
  getComponentSpec,
  handleToTerminalIndex,
  resolveTerminals,
  type BranchSpec,
} from './component-registry';
import type { CircuitComponent, CircuitState, TerminalSpec } from './types';

// Converts a circuit (components + wires) into an electrical graph:
// terminals joined by wires collapse into nodes, and each branch of a
// component becomes an element between two nodes. The order in which wires
// were drawn does not affect the result.

export interface ParsedElement {
  /** Component id, plus ":branch" for components with several branches. */
  id: string;
  /** Component label, plus the branch for components with several branches. */
  label: string;
  component: CircuitComponent;
  branch: BranchSpec;
  /** For polar branches, current must enter at terminals[0]. */
  terminals: [TerminalSpec, TerminalSpec];
  nodes: [string, string];
  /** Number of wires attached to each terminal. */
  wireCounts: [number, number];
  /** Value carried by this branch (e.g. part of a potentiometer). */
  value: number | null;
}

export interface ParsedTerminal {
  componentId: string;
  /** e.g. "V1.+" */
  label: string;
  node: string;
  wireCount: number;
}

export interface ParsedCircuit {
  elements: ParsedElement[];
  terminals: ParsedTerminal[];
  invalidWires: string[];
  wireCount: number;
}

class UnionFind {
  private parent = new Map<string, string>();

  add(key: string) {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
    this.add(key);
    let root = key;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // Path compression
    let current = key;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    // Deterministic root choice keeps node ids stable regardless of wire order.
    if (rootA < rootB) this.parent.set(rootB, rootA);
    else this.parent.set(rootA, rootB);
  }
}

export { UnionFind };

const terminalKey = (componentId: string, terminal: string) =>
  `${componentId}.${terminal}`;

export const parseCircuit = (state: CircuitState): ParsedCircuit => {
  const uf = new UnionFind();
  const componentsById = new Map(state.components.map((c) => [c.id, c]));
  const terminalsOf = (component: CircuitComponent) =>
    resolveTerminals(component.kind, component.terminals);
  const wireCounts = new Map<string, number>();
  const invalidWires: string[] = [];

  for (const component of state.components) {
    for (const terminal of terminalsOf(component)) {
      uf.add(terminalKey(component.id, terminal.id));
    }
  }

  const resolveEnd = (end: { componentId: string; handle?: string | null }) => {
    const component = componentsById.get(end.componentId);
    if (!component) {
      invalidWires.push(
        'A wire is connected to a component that is not on the canvas',
      );
      return null;
    }
    const terminals = terminalsOf(component);
    const index = handleToTerminalIndex(terminals, end.handle);
    if (index === null || !terminals[index]) {
      invalidWires.push(
        `A wire on ${component.label} is attached to an unknown terminal`,
      );
      return null;
    }
    return terminalKey(component.id, terminals[index].id);
  };

  let wireCount = 0;
  for (const wire of state.wires) {
    const from = resolveEnd(wire.from);
    const to = resolveEnd(wire.to);
    if (!from || !to || from === to) continue;
    uf.union(from, to);
    wireCounts.set(from, (wireCounts.get(from) ?? 0) + 1);
    wireCounts.set(to, (wireCounts.get(to) ?? 0) + 1);
    wireCount++;
  }

  const elements: ParsedElement[] = [];
  const terminals: ParsedTerminal[] = [];

  for (const component of state.components) {
    const spec = getComponentSpec(component.kind);
    const specTerminals = terminalsOf(component);
    const keys = specTerminals.map((t) => terminalKey(component.id, t.id));
    const counts = keys.map((key) => wireCounts.get(key) ?? 0);

    specTerminals.forEach((terminal, index) =>
      terminals.push({
        componentId: component.id,
        label: `${component.label}.${terminal.label}`,
        node: uf.find(keys[index]),
        wireCount: counts[index],
      }),
    );

    const branchIds = spec.pickBranches
      ? spec.pickBranches(counts.map((count) => count > 0))
      : spec.branches.map((b) => b.id);
    const multiBranch = spec.branches.length > 1;

    for (const branch of spec.branches) {
      if (!branchIds.includes(branch.id)) continue;
      const [a, b] = branch.between;
      const share = branch.valueShare?.(component.params ?? {}) ?? 1;
      elements.push({
        id: multiBranch ? `${component.id}:${branch.id}` : component.id,
        label: multiBranch
          ? `${component.label} (${specTerminals[a].label}–${specTerminals[b].label})`
          : component.label,
        component,
        branch,
        terminals: [specTerminals[a], specTerminals[b]],
        nodes: [uf.find(keys[a]), uf.find(keys[b])],
        wireCounts: [counts[a], counts[b]],
        value:
          component.value === null || component.value === undefined
            ? null
            : component.value * share,
      });
    }
  }

  return { elements, terminals, invalidWires, wireCount };
};
