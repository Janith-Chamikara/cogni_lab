"use client";

import type { CircuitDebug, ComparisonDebug, DebugTree } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

// Visualises how the grader sees a circuit (see
// docs/circuit-validation-graph.md): the node graph after union-find, the
// series/parallel tree with current direction, and the fingerprint.

const WIDTH = 420;
const HEIGHT = 260;

type Point = { x: number; y: number };

const ROLE_STYLE: Record<string, string> = {
  source: "stroke-red-500",
  voltmeter: "stroke-violet-500",
  ammeter: "stroke-violet-500",
  load: "stroke-foreground",
};

/** Node graph: nodes on an ellipse in current order, elements as edges. */
export function CircuitGraph({ debug }: { debug: CircuitDebug }) {
  const nodes = debug.nodes.map((n) => n.id);
  const used = new Set(debug.elements.flatMap((e) => e.nodes));
  const shown = nodes.filter((n) => used.has(n));
  const position = new Map<string, Point>(
    shown.map((id, i) => {
      // n1 (+) on the left, then clockwise around the ellipse.
      const angle = Math.PI + (2 * Math.PI * i) / Math.max(shown.length, 1);
      return [
        id,
        {
          x: WIDTH / 2 + Math.cos(angle) * (WIDTH / 2 - 50),
          y: HEIGHT / 2 + Math.sin(angle) * (HEIGHT / 2 - 40),
        },
      ];
    }),
  );

  // Spread parallel edges between the same two nodes.
  const groups = new Map<string, number>();
  const edges = debug.elements.map((element) => {
    const [a, b] = element.nodes;
    const key = [a, b].sort().join("|");
    const index = groups.get(key) ?? 0;
    groups.set(key, index + 1);
    return { element, index, key };
  });

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full rounded-md border bg-muted/30"
      role="img"
      aria-label="Circuit node graph"
    >
      <defs>
        <marker
          id="debug-arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-current" />
        </marker>
      </defs>

      {edges.map(({ element, index, key }) => {
        const p0 = position.get(element.nodes[0]);
        const p1 = position.get(element.nodes[1]);
        if (!p0 || !p1) return null;
        const count = groups.get(key) ?? 1;
        const stroke = element.inTree
          ? (ROLE_STYLE[element.role] ?? ROLE_STYLE.load)
          : "stroke-muted-foreground";
        const dash =
          element.role === "load" || element.role === "source"
            ? element.inTree || element.role === "source"
              ? undefined
              : "2 4"
            : "6 4";

        // Shorted element: a small loop on its node.
        if (element.nodes[0] === element.nodes[1]) {
          return (
            <g key={element.id}>
              <circle
                cx={p0.x}
                cy={p0.y - 22}
                r={14}
                className={`fill-none ${stroke}`}
                strokeWidth={2}
                strokeDasharray="3 3"
              />
              <text
                x={p0.x}
                y={p0.y - 40}
                textAnchor="middle"
                className="fill-foreground text-[10px]"
              >
                {element.label} (shorted)
              </text>
            </g>
          );
        }

        const offset = (index - (count - 1) / 2) * 34;
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const length = Math.hypot(dx, dy) || 1;
        const control = {
          x: (p0.x + p1.x) / 2 + (-dy / length) * offset * 2,
          y: (p0.y + p1.y) / 2 + (dx / length) * offset * 2,
        };
        const mid = {
          x: 0.25 * p0.x + 0.5 * control.x + 0.25 * p1.x,
          y: 0.25 * p0.y + 0.5 * control.y + 0.25 * p1.y,
        };
        const tangent = { x: dx / length, y: dy / length };
        const arrowTone =
          element.orientation === "reverse"
            ? "text-red-500"
            : "text-emerald-500";

        return (
          <g key={element.id}>
            <path
              d={`M${p0.x},${p0.y} Q${control.x},${control.y} ${p1.x},${p1.y}`}
              className={`fill-none ${stroke}`}
              strokeWidth={2}
              strokeDasharray={dash}
            />
            {element.polar && (
              // Arrow points from the terminal current must enter at.
              <line
                x1={mid.x - tangent.x * 6}
                y1={mid.y - tangent.y * 6}
                x2={mid.x + tangent.x * 6}
                y2={mid.y + tangent.y * 6}
                className={`stroke-current ${arrowTone}`}
                strokeWidth={2}
                markerEnd="url(#debug-arrow)"
              />
            )}
            <text
              x={mid.x}
              y={mid.y - 8}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-medium"
              paintOrder="stroke"
              stroke="var(--background)"
              strokeWidth={3}
            >
              {element.label}
            </text>
          </g>
        );
      })}

      {shown.map((id) => {
        const p = position.get(id)!;
        const isPlus = debug.ports?.plus === id;
        const isMinus = debug.ports?.minus === id;
        return (
          <g key={id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={12}
              className={`fill-background ${
                isPlus
                  ? "stroke-red-500"
                  : isMinus
                    ? "stroke-blue-500"
                    : "stroke-muted-foreground"
              }`}
              strokeWidth={isPlus || isMinus ? 3 : 1.5}
            />
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-semibold"
            >
              {id}
            </text>
            {(isPlus || isMinus) && (
              <text
                x={p.x}
                y={p.y + 26}
                textAnchor="middle"
                className={`text-[11px] font-bold ${isPlus ? "fill-red-500" : "fill-blue-500"}`}
              >
                {isPlus ? "+" : "−"}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TreeNode({ node, depth = 0 }: { node: DebugTree; depth?: number }) {
  const span = (
    <span className="text-muted-foreground">
      [{node.from} → {node.to}]
    </span>
  );
  if (node.type === "leaf") {
    return (
      <li className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium">{node.label}</span>
        <code className="text-xs">{node.token}</code>
        {span}
      </li>
    );
  }
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-2">
        <Badge
          variant="outline"
          className={
            node.type === "series"
              ? "border-sky-500 text-sky-600 dark:text-sky-400"
              : "border-amber-500 text-amber-600 dark:text-amber-400"
          }
        >
          {node.type === "series" ? "S" : "P"}
        </Badge>
        {span}
        {depth === 0 && (
          <span className="text-xs text-muted-foreground">
            {node.children.length} children
          </span>
        )}
      </div>
      <ul className="ml-3 mt-1 space-y-1 border-l pl-3">
        {node.children.map((child, i) => (
          <TreeNode key={i} node={child} depth={depth + 1} />
        ))}
      </ul>
    </li>
  );
}

export function CircuitDebugView({ debug }: { debug: CircuitDebug }) {
  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-1">
        <h4 className="font-semibold">Fingerprint</h4>
        <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
          {debug.fingerprint ?? "— (not series-parallel or incomplete)"}
        </code>
        <p className="text-xs text-muted-foreground">
          Topology: {debug.topology ?? "unknown"} · Source:{" "}
          {debug.source ?? "none"}
          {debug.ports &&
            ` · + at ${debug.ports.plus}, − at ${debug.ports.minus}`}
        </p>
      </section>

      <section className="space-y-1">
        <h4 className="font-semibold">Graph</h4>
        <CircuitGraph debug={debug} />
        <p className="text-xs text-muted-foreground">
          Red: source · violet dashed: instruments · grey dotted: not in the
          tree · arrows: polar parts (green forward, red reversed).
        </p>
      </section>

      <section className="space-y-1">
        <h4 className="font-semibold">Series/parallel tree</h4>
        {debug.tree ? (
          <ul className="space-y-1">
            <TreeNode node={debug.tree} />
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            The network does not reduce to one series/parallel tree (it is
            incomplete, has an open branch, or is a bridge).
          </p>
        )}
      </section>

      <section className="space-y-1">
        <h4 className="font-semibold">Nodes (union-find)</h4>
        <table className="w-full text-xs">
          <tbody>
            {debug.nodes.map((node) => (
              <tr key={node.id} className="border-b last:border-0">
                <td className="w-12 py-1 font-semibold">{node.id}</td>
                <td className="py-1 font-mono">{node.terminals.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-1">
        <h4 className="font-semibold">Elements</h4>
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">Part</th>
              <th>Token</th>
              <th>Edge</th>
              <th>Role</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            {debug.elements.map((e) => (
              <tr
                key={e.id}
                className={`border-b last:border-0 ${e.inTree ? "" : "text-muted-foreground"}`}
              >
                <td className="py-1 font-medium">{e.label}</td>
                <td className="font-mono">{e.token}</td>
                <td>
                  {e.nodes[0]} – {e.nodes[1]}
                </td>
                <td>{e.role}</td>
                <td>{e.polar ? (e.orientation ?? "?") : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function ComparisonDebugView({
  comparison,
  studentFingerprint,
  referenceFingerprint,
}: {
  comparison: ComparisonDebug;
  studentFingerprint: string | null;
  referenceFingerprint: string | null;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={comparison.match ? "bg-green-600" : ""}>
          {comparison.match ? "Match" : "Different"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Method: {comparison.method} · Partial score:{" "}
          {Math.round(comparison.partialScore * 100)}%
        </span>
      </div>

      <section className="space-y-1 text-xs">
        <div>
          <span className="font-semibold">Instructor </span>
          <code className="break-all">{referenceFingerprint ?? "—"}</code>
        </div>
        <div>
          <span className="font-semibold">Student&nbsp;&nbsp;&nbsp; </span>
          <code className="break-all">{studentFingerprint ?? "—"}</code>
        </div>
      </section>

      <section className="space-y-1">
        <h4 className="font-semibold">Part mapping (student → instructor)</h4>
        <p className="font-mono text-xs">
          {comparison.mapping
            .map((m) => `${m.student} → ${m.reference}`)
            .join(" · ") || "—"}
        </p>
      </section>

      <section className="space-y-1">
        <h4 className="font-semibold">Pairs related differently</h4>
        {comparison.pairs.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Pair</th>
                <th>Instructor</th>
                <th>Student</th>
              </tr>
            </thead>
            <tbody>
              {comparison.pairs.map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1">
                    {p.a} – {p.b}
                  </td>
                  <td>{p.reference}</td>
                  <td className="text-red-600 dark:text-red-400">
                    {p.student ?? "not connected"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-1">
        <h4 className="font-semibold">Polar parts</h4>
        {comparison.polarity.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {comparison.polarity.map((p) => (
              <li
                key={p.label}
                className={
                  p.reference === p.student
                    ? ""
                    : "text-red-600 dark:text-red-400"
                }
              >
                {p.label}: instructor {p.reference}, student {p.student}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
