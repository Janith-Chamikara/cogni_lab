import { roleOf, type CircuitAnalysis } from './circuit-analysis';
import { canonical, fingerprintOf, leafToken } from './reference-compare';
import type { ReductionTree } from './topology';
import type { CircuitDebug, DebugTree } from './types';

// Serializable view of an analysed circuit for the debug panel: the node
// table (which terminals share a node), the element graph, the oriented
// series/parallel tree and the fingerprint. Node ids are renamed n1, n2, ...
// with the supply's + terminal first.

export const buildCircuitDebug = (
  analysis: CircuitAnalysis,
  includeValues: boolean,
): CircuitDebug => {
  const { full, parsed } = analysis;
  const names = new Map<string, string>();
  const nameOf = (node: string) => {
    if (!names.has(node)) names.set(node, `n${names.size + 1}`);
    return names.get(node)!;
  };
  const ordered = [...parsed.elements].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );

  const inFull = new Map(full.elements.map((e) => [e.id, e]));
  const tokenOf = (id: string) =>
    leafToken(inFull.get(id)!, full.orientation?.get(id), includeValues);

  const toDebugTree = (
    node: ReductionTree,
    from: string,
    to: string,
  ): DebugTree => {
    if (node.type === 'leaf') {
      return {
        type: 'leaf',
        elementId: node.id,
        label: inFull.get(node.id)?.label ?? node.id,
        token: tokenOf(node.id),
        from: nameOf(from),
        to: nameOf(to),
      };
    }
    let children: DebugTree[];
    if (node.type === 'parallel') {
      children = node.children.map((c) => toDebugTree(c, from, to));
    } else {
      // Series: list children in chain order from `from` to `to`.
      children = [];
      const remaining = [...node.children];
      let current = from;
      while (remaining.length > 0) {
        const index = remaining.findIndex(
          (c) => c.u === current || c.v === current,
        );
        const [child] = remaining.splice(Math.max(index, 0), 1);
        const next = child.u === current ? child.v : child.u;
        children.push(toDebugTree(child, current, next));
        current = next;
      }
    }
    return {
      type: node.type,
      token: canonical(node, tokenOf),
      from: nameOf(from),
      to: nameOf(to),
      children,
    };
  };

  const [from, to] =
    full.plus && full.minus
      ? [full.plus, full.minus]
      : full.tree
        ? [full.tree.u, full.tree.v]
        : ['', ''];

  // Name nodes along the path of the current first (n1 = + terminal), then
  // the rest in element order.
  if (full.plus) nameOf(full.plus);
  const tree = full.tree ? toDebugTree(full.tree, from, to) : null;
  ordered.forEach((e) => e.nodes.forEach(nameOf));

  const terminalsByNode = new Map<string, string[]>();
  for (const t of parsed.terminals) {
    const name = nameOf(t.node);
    terminalsByNode.set(name, [...(terminalsByNode.get(name) ?? []), t.label]);
  }

  return {
    nodes: [...terminalsByNode.entries()]
      .map(([id, terminals]) => ({ id, terminals }))
      .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))),
    elements: ordered.map((e) => ({
      id: e.id,
      label: e.label,
      token: inFull.has(e.id)
        ? tokenOf(e.id)
        : leafToken(e, null, includeValues),
      nodes: [nameOf(e.nodes[0]), nameOf(e.nodes[1])],
      role: analysis.portSource === e ? 'source' : roleOf(e),
      polar: !!e.branch.polar,
      orientation: full.orientation?.get(e.id) ?? null,
      inTree: !!full.ancestors?.has(e.id),
    })),
    source: analysis.portSource?.label ?? null,
    ports:
      full.plus && full.minus
        ? { plus: nameOf(full.plus), minus: nameOf(full.minus) }
        : null,
    tree,
    fingerprint: fingerprintOf(analysis, includeValues),
    topology: analysis.topology,
  };
};
