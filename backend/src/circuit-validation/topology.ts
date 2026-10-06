import type { Orientation, Relation, Topology } from './types';

// Series-parallel reduction of a two-port network.
// Repeatedly merges elements that share both nodes (parallel) and elements
// joined by a non-port node of degree 2 (series). If the network collapses to
// a single element between the two ports, it is series-parallel and the
// reduction tree describes its topology. Results do not depend on the order
// of components or wires.

// Every tree node records the two network nodes it sits between (u, v), so
// the direction of current can be traced through it later.
export type ReductionTree =
  | { type: 'leaf'; id: string; u: string; v: string }
  | {
      type: 'series' | 'parallel';
      children: ReductionTree[];
      u: string;
      v: string;
    };

export interface NetworkEdge {
  id: string;
  u: string;
  v: string;
}

interface WorkingEdge {
  u: string;
  v: string;
  tree: ReductionTree;
}

const combine = (
  type: 'series' | 'parallel',
  a: ReductionTree,
  b: ReductionTree,
  u: string,
  v: string,
): ReductionTree => {
  // Flatten nested nodes of the same type: (R1+R2)+R3 -> R1+R2+R3
  const children = [a, b].flatMap((t) => (t.type === type ? t.children : [t]));
  return { type, children, u, v };
};

const pairKey = (u: string, v: string) => (u < v ? `${u}|${v}` : `${v}|${u}`);

/** Reduce the network between two ports. Returns null if it is not series-parallel. */
export const reduceNetwork = (
  edges: NetworkEdge[],
  portA: string,
  portB: string,
): ReductionTree | null => {
  if (edges.length === 0 || portA === portB) return null;

  let working: WorkingEdge[] = edges.map((e) => ({
    u: e.u,
    v: e.v,
    tree: { type: 'leaf', id: e.id, u: e.u, v: e.v },
  }));

  let changed = true;
  while (changed && working.length > 1) {
    changed = false;

    // Parallel merge: elements sharing the same pair of nodes.
    const groups = new Map<string, WorkingEdge[]>();
    for (const edge of working) {
      if (edge.u === edge.v) continue;
      const key = pairKey(edge.u, edge.v);
      groups.set(key, [...(groups.get(key) ?? []), edge]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const merged = group.reduce((acc, edge) => ({
        u: acc.u,
        v: acc.v,
        tree: combine('parallel', acc.tree, edge.tree, acc.u, acc.v),
      }));
      working = [...working.filter((e) => !group.includes(e)), merged];
      changed = true;
    }
    if (changed) continue;

    // Series merge: an internal node touched by exactly two elements.
    const incident = new Map<string, WorkingEdge[]>();
    for (const edge of working) {
      if (edge.u === edge.v) continue;
      for (const node of [edge.u, edge.v]) {
        incident.set(node, [...(incident.get(node) ?? []), edge]);
      }
    }
    const nodes = [...incident.keys()].sort();
    for (const node of nodes) {
      if (node === portA || node === portB) continue;
      const touching = incident.get(node)!;
      if (touching.length !== 2) continue;
      const [a, b] = touching;
      const x = a.u === node ? a.v : a.u;
      const y = b.u === node ? b.v : b.u;
      const merged: WorkingEdge = {
        u: x,
        v: y,
        tree: combine('series', a.tree, b.tree, x, y),
      };
      working = [...working.filter((e) => e !== a && e !== b), merged];
      changed = true;
      break;
    }
  }

  if (working.length !== 1) return null;
  const [last] = working;
  return pairKey(last.u, last.v) === pairKey(portA, portB) ? last.tree : null;
};

export const classifyTopology = (tree: ReductionTree): Topology => {
  const types = new Set<string>();
  const visit = (node: ReductionTree) => {
    if (node.type === 'leaf') return;
    types.add(node.type);
    node.children.forEach(visit);
  };
  visit(tree);

  if (types.size === 0) return 'single';
  if (types.size === 2) return 'series-parallel';
  return types.has('series') ? 'series' : 'parallel';
};

/** Equivalent value (e.g. resistance). Null if any element has no value. */
export const equivalentValue = (
  tree: ReductionTree,
  valueOf: (id: string) => number | null,
): number | null => {
  if (tree.type === 'leaf') return valueOf(tree.id);

  const values = tree.children.map((child) => equivalentValue(child, valueOf));
  if (values.some((v) => v === null)) return null;
  const numbers = values as number[];

  if (tree.type === 'series') return numbers.reduce((sum, v) => sum + v, 0);
  if (numbers.some((v) => v === 0)) return 0;
  return 1 / numbers.reduce((sum, v) => sum + 1 / v, 0);
};

/**
 * Direction of current through every leaf when current enters the tree at
 * `from` and leaves at `to`. "forward" means it flows from the leaf's u to v.
 */
export const orientLeaves = (
  tree: ReductionTree,
  from: string,
  to: string,
): Map<string, Orientation> => {
  const result = new Map<string, Orientation>();
  const visit = (node: ReductionTree, a: string, b: string) => {
    if (node.type === 'leaf') {
      result.set(node.id, node.u === a ? 'forward' : 'reverse');
      return;
    }
    if (node.type === 'parallel') {
      node.children.forEach((child) => visit(child, a, b));
      return;
    }
    // Series: walk the chain from a to b, one child at a time.
    const remaining = [...node.children];
    let current = a;
    while (remaining.length > 0) {
      const index = remaining.findIndex(
        (c) => c.u === current || c.v === current,
      );
      if (index < 0) break;
      const [child] = remaining.splice(index, 1);
      const next = child.u === current ? child.v : child.u;
      visit(child, current, next);
      current = next;
    }
  };
  visit(tree, from, to);
  return result;
};

/** Ancestors (root first) of every leaf, for relation lookups. */
export const leafAncestors = (
  tree: ReductionTree,
): Map<string, ReductionTree[]> => {
  const result = new Map<string, ReductionTree[]>();
  const visit = (node: ReductionTree, path: ReductionTree[]) => {
    if (node.type === 'leaf') {
      result.set(node.id, path);
      return;
    }
    node.children.forEach((child) => visit(child, [...path, node]));
  };
  visit(tree, []);
  return result;
};

/**
 * How two leaves relate: the type of their lowest common ancestor. Null if
 * either leaf is not in the tree.
 */
export const relationOf = (
  ancestors: Map<string, ReductionTree[]>,
  a: string,
  b: string,
): Relation | null => {
  const pathA = ancestors.get(a);
  const pathB = ancestors.get(b);
  if (!pathA || !pathB || a === b) return null;
  let lowest: ReductionTree | null = null;
  for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
    if (pathA[i] !== pathB[i]) break;
    lowest = pathA[i];
  }
  return lowest && lowest.type !== 'leaf' ? lowest.type : null;
};

/** The parent of every leaf (null for a single-leaf tree). */
export const leafParentType = (
  ancestors: Map<string, ReductionTree[]>,
  id: string,
): Relation | null => {
  const path = ancestors.get(id);
  const parent = path?.[path.length - 1];
  return parent && parent.type !== 'leaf' ? parent.type : null;
};
