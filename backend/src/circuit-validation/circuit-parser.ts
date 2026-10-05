import { getComponentSpec, handleToTerminal } from './component-registry';
import type { CircuitComponent, CircuitState } from './types';

// Converts the student's final circuit (components + wires) into an
// electrical graph: terminals joined by wires collapse into nodes, and each
// two-terminal component becomes an element between two nodes. The order in
// which wires were drawn does not affect the result.

export interface ParsedElement {
  component: CircuitComponent;
  terminals: [string, string];
  nodes: [string, string];
  /** Number of wires attached to each terminal. */
  wireCounts: [number, number];
}

export interface ParsedCircuit {
  elements: ParsedElement[];
  invalidWires: string[];
  wireCount: number;
}

class UnionFind {
  private parent = new Map<string, string>();

  add(key: string) {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
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

const terminalKey = (componentId: string, terminal: string) =>
  `${componentId}.${terminal}`;

export const parseCircuit = (state: CircuitState): ParsedCircuit => {
  const uf = new UnionFind();
  const componentsById = new Map(state.components.map((c) => [c.id, c]));
  const wireCounts = new Map<string, number>();
  const invalidWires: string[] = [];

  for (const component of state.components) {
    for (const terminal of getComponentSpec(component.kind).terminals) {
      uf.add(terminalKey(component.id, terminal));
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
    const terminal = handleToTerminal(component.kind, end.handle);
    if (!terminal) {
      invalidWires.push(
        `A wire on ${component.label} is attached to an unknown terminal`,
      );
      return null;
    }
    return terminalKey(component.id, terminal);
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

  const elements: ParsedElement[] = state.components.map((component) => {
    const terminals = getComponentSpec(component.kind).terminals;
    const keys = terminals.map((t) => terminalKey(component.id, t));
    return {
      component,
      terminals,
      nodes: [uf.find(keys[0]), uf.find(keys[1])],
      wireCounts: [wireCounts.get(keys[0]) ?? 0, wireCounts.get(keys[1]) ?? 0],
    };
  });

  return { elements, invalidWires, wireCount };
};
