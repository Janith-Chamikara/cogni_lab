import type { CircuitAnalysis } from './circuit-analysis';
import { roleOf } from './circuit-analysis';
import type { ParsedElement } from './circuit-parser';
import { getComponentSpec } from './component-registry';
import { relationOf, type ReductionTree } from './topology';
import type { ComparisonDebug, Orientation, Relation } from './types';

// Compares a student's circuit with the instructor's (reference) circuit.
// Both are reduced to series/parallel trees and printed as a canonical
// string (the "fingerprint"); equal fingerprints mean the circuits are
// electrically equivalent. For feedback, student parts are mapped onto the
// instructor's parts (identical parts are interchangeable) and every pair of
// parts is checked: same relation (series/parallel) and same direction.

/** Max permutations tried per group of identical parts. */
const MAX_GROUP_FOR_SEARCH = 6;
/** Max search steps when comparing circuits that are not series-parallel. */
const PARTITION_SEARCH_BUDGET = 5000;
const MAX_MESSAGES = 4;

const formatNumber = (value: number) => String(Number(value.toPrecision(6)));

/** Kind and value of an element, e.g. "R:100". Orientation not included. */
export const classKey = (e: ParsedElement, includeValues: boolean) => {
  const code = e.branch.code ?? getComponentSpec(e.component.kind).code;
  return includeValues && e.value !== null
    ? `${code}:${formatNumber(e.value)}`
    : code;
};

/** Leaf token: class key plus ">" (forward) or "<" (reversed) if polar. */
export const leafToken = (
  e: ParsedElement,
  orientation: Orientation | null | undefined,
  includeValues: boolean,
) =>
  classKey(e, includeValues) +
  (e.branch.polar && orientation
    ? orientation === 'forward'
      ? '>'
      : '<'
    : '');

/** Canonical text of a tree: children sorted so order never matters. */
export const canonical = (
  tree: ReductionTree,
  tokenOf: (id: string) => string,
): string => {
  if (tree.type === 'leaf') return tokenOf(tree.id);
  const children = tree.children.map((c) => canonical(c, tokenOf)).sort();
  return `${tree.type === 'series' ? 'S' : 'P'}(${children.join(',')})`;
};

export const fingerprintOf = (
  analysis: CircuitAnalysis,
  includeValues: boolean,
): string | null => {
  const { tree, elements, orientation } = analysis.full;
  if (!tree) return null;
  const byId = new Map(elements.map((e) => [e.id, e]));
  return canonical(tree, (id) =>
    leafToken(byId.get(id)!, orientation?.get(id), includeValues),
  );
};

export interface PairDiff {
  /** Reference elements. */
  a: ParsedElement;
  b: ParsedElement;
  reference: Relation;
  student: Relation | null;
}

export interface ReferenceComparison {
  method: 'tree' | 'partition' | 'none';
  match: boolean;
  referenceFingerprint: string | null;
  studentFingerprint: string | null;
  /** Student element id -> reference element. */
  mapping: Map<string, ParsedElement>;
  pairDiffs: PairDiff[];
  totalPairs: number;
  /** 0-1: share of part pairs and polar parts that agree with the reference. */
  partialScore: number;
  messages: string[];
}

type Mapping = Map<ParsedElement, ParsedElement | null>; // reference -> student

const naturalKey = (e: ParsedElement, isStudent: boolean) =>
  `${isStudent ? (e.component.refId ?? '') : e.component.id}:${e.branch.id}`;

/** Group reference and student elements by class (kind and value). */
const groupByClass = (
  reference: ParsedElement[],
  student: ParsedElement[],
  includeValues: boolean,
) => {
  const classes = new Map<
    string,
    { ref: ParsedElement[]; stud: ParsedElement[] }
  >();
  const entry = (key: string) => {
    if (!classes.has(key)) classes.set(key, { ref: [], stud: [] });
    return classes.get(key)!;
  };
  reference.forEach((e) => entry(classKey(e, includeValues)).ref.push(e));
  student.forEach((e) => entry(classKey(e, includeValues)).stud.push(e));
  return classes;
};

/** Start from the parts the student took from the same placement. */
const initialMapping = (classes: ReturnType<typeof groupByClass>): Mapping => {
  const mapping: Mapping = new Map();
  for (const { ref, stud } of classes.values()) {
    const unused = [...stud];
    const pending: ParsedElement[] = [];
    for (const r of ref) {
      const index = unused.findIndex(
        (s) => naturalKey(s, true) === naturalKey(r, false),
      );
      if (index >= 0) mapping.set(r, unused.splice(index, 1)[0]);
      else pending.push(r);
    }
    for (const r of pending) mapping.set(r, unused.shift() ?? null);
  }
  return mapping;
};

/** k-permutations of items (k <= items.length). */
const permutations = <T>(items: T[], k: number): T[][] => {
  if (k === 0) return [[]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)], k - 1).map(
      (rest) => [item, ...rest],
    ),
  );
};

export const compareToReference = (
  reference: CircuitAnalysis,
  student: CircuitAnalysis,
  includeValues: boolean,
): ReferenceComparison => {
  const refFull = reference.full;
  const studFull = student.full;
  const referenceFingerprint = fingerprintOf(reference, includeValues);
  const studentFingerprint = fingerprintOf(student, includeValues);
  const classes = groupByClass(
    refFull.elements,
    studFull.elements,
    includeValues,
  );

  const base = {
    referenceFingerprint,
    studentFingerprint,
    pairDiffs: [] as PairDiff[],
    totalPairs: 0,
  };
  const toStudentMap = (mapping: Mapping) =>
    new Map(
      [...mapping]
        .filter(([, s]) => s !== null)
        .map(([r, s]) => [s!.id, r] as const),
    );

  // ---- Not series-parallel: compare how terminals are joined -------------
  if (!refFull.tree || !studFull.tree) {
    const bothComplex =
      !refFull.tree &&
      !studFull.tree &&
      reference.isComplete &&
      student.isComplete;
    const match =
      bothComplex && partitionMatch(reference, student, includeValues);
    return {
      ...base,
      method: bothComplex ? 'partition' : 'none',
      match,
      mapping: toStudentMap(initialMapping(classes)),
      partialScore: match ? 1 : 0,
      messages: match
        ? []
        : !student.isComplete
          ? [
              'Complete your circuit so it can be compared with the instructor’s circuit',
            ]
          : ['Your circuit is wired differently from the instructor’s circuit'],
    };
  }

  // ---- Series-parallel: compare trees -------------------------------------
  const refAncestors = refFull.ancestors!;
  const studAncestors = studFull.ancestors!;
  const refElements = refFull.elements;
  const refPairs: Array<[ParsedElement, ParsedElement, Relation]> = [];
  refElements.forEach((a, i) =>
    refElements.slice(i + 1).forEach((b) => {
      const relation = relationOf(refAncestors, a.id, b.id);
      if (relation) refPairs.push([a, b, relation]);
    }),
  );

  const evaluate = (mapping: Mapping) => {
    const diffs: PairDiff[] = [];
    for (const [a, b, relation] of refPairs) {
      const sa = mapping.get(a);
      const sb = mapping.get(b);
      const studentRelation =
        sa && sb ? relationOf(studAncestors, sa.id, sb.id) : null;
      if (studentRelation !== relation) {
        diffs.push({ a, b, reference: relation, student: studentRelation });
      }
    }
    let reversed = 0;
    for (const [r, s] of mapping) {
      if (!r.branch.polar) continue;
      const expected = refFull.orientation?.get(r.id);
      const actual = s ? studFull.orientation?.get(s.id) : undefined;
      if (expected && expected !== actual) reversed++;
    }
    return { diffs, reversed, cost: diffs.length + reversed };
  };

  // Identical parts are interchangeable: try the assignments within each
  // group and keep the one with the fewest differences (ties keep the
  // student's own placement mapping).
  let mapping = initialMapping(classes);
  let best = evaluate(mapping);
  for (let round = 0; round < 2 && best.cost > 0; round++) {
    for (const { ref, stud } of classes.values()) {
      const slots = Math.min(ref.length, stud.length);
      if (slots < 1 || stud.length < 2 || stud.length > MAX_GROUP_FOR_SEARCH) {
        continue;
      }
      for (const order of permutations(stud, slots)) {
        const candidate: Mapping = new Map(mapping);
        ref.forEach((r, i) => candidate.set(r, order[i] ?? null));
        const result = evaluate(candidate);
        if (result.cost < best.cost) {
          mapping = candidate;
          best = result;
        }
      }
    }
  }

  const match =
    referenceFingerprint !== null &&
    referenceFingerprint === studentFingerprint;
  const pairDiffs = match ? [] : best.diffs;
  const totalPairs = refPairs.length;
  // Partial credit: pairs related correctly plus parts facing the right way.
  const polarCount = refElements.filter(
    (e) => e.branch.polar && refFull.orientation?.has(e.id),
  ).length;
  const total = totalPairs + polarCount;
  const wrong = pairDiffs.length + (match ? 0 : best.reversed);

  return {
    ...base,
    method: 'tree',
    match,
    mapping: toStudentMap(mapping),
    pairDiffs,
    totalPairs,
    partialScore: match ? 1 : total > 0 ? (total - wrong) / total : 0,
    messages: match ? [] : describeDiffs(pairDiffs, mapping),
  };
};

const describeDiffs = (diffs: PairDiff[], mapping: Mapping): string[] => {
  const labelOf = (r: ParsedElement) => mapping.get(r)?.label ?? r.label;
  const messages: string[] = [];
  const notInCircuit = new Set<string>();

  for (const diff of diffs) {
    if (diff.student === null) {
      for (const r of [diff.a, diff.b]) {
        const s = mapping.get(r);
        if (!s) notInCircuit.add(`${r.label} is missing from your circuit`);
      }
      continue;
    }
    const [a, b] = [labelOf(diff.a), labelOf(diff.b)];
    const meter = [diff.a, diff.b].find((e) => roleOf(e) !== 'load');
    const other = meter === diff.a ? b : a;
    if (diff.reference === 'parallel') {
      messages.push(
        meter && roleOf(meter) === 'voltmeter'
          ? `${labelOf(meter)} should be connected across ${other}, but it is in series with it`
          : `${a} and ${b} should be in parallel, but they are in series`,
      );
    } else {
      messages.push(
        meter && roleOf(meter) === 'ammeter'
          ? `${labelOf(meter)} should be in series with ${other}, but it is connected across it`
          : meter
            ? `${labelOf(meter)} should not be connected across ${other}`
            : `${a} and ${b} should be in series, but they are in parallel`,
      );
    }
  }

  const all = [...notInCircuit, ...messages];
  return all.length > MAX_MESSAGES
    ? [
        ...all.slice(0, MAX_MESSAGES),
        `…and ${all.length - MAX_MESSAGES} more difference(s) from the instructor’s circuit`,
      ]
    : all;
};

/**
 * For circuits that are not series-parallel (e.g. a bridge): is there a
 * matching of parts and nodes so that every part joins the same nodes in
 * both circuits? Non-polar parts may be flipped; identical parts swapped.
 */
const partitionMatch = (
  reference: CircuitAnalysis,
  student: CircuitAnalysis,
  includeValues: boolean,
): boolean => {
  const refEls = reference.full.elements;
  const studEls = student.full.elements;
  if (refEls.length !== studEls.length) return false;
  const classes = groupByClass(refEls, studEls, includeValues);
  for (const { ref, stud } of classes.values()) {
    if (ref.length !== stud.length) return false;
  }

  const r2s = new Map<string, string>();
  const s2r = new Map<string, string>();
  const bind = (r: string, s: string, undo: Array<() => void>) => {
    const mappedS = r2s.get(r);
    const mappedR = s2r.get(s);
    if (mappedS !== undefined || mappedR !== undefined) {
      return mappedS === s && mappedR === r;
    }
    r2s.set(r, s);
    s2r.set(s, r);
    undo.push(() => {
      r2s.delete(r);
      s2r.delete(s);
    });
    return true;
  };

  const seed: Array<() => void> = [];
  const { plus: rp, minus: rm } = reference.full;
  const { plus: sp, minus: sm } = student.full;
  if (rp && rm && sp && sm && (!bind(rp, sp, seed) || !bind(rm, sm, seed))) {
    return false;
  }

  const used = new Set<ParsedElement>();
  let budget = PARTITION_SEARCH_BUDGET;
  const search = (index: number): boolean => {
    if (index === refEls.length) return true;
    if (--budget < 0) return false;
    const r = refEls[index];
    const key = classKey(r, includeValues);
    for (const s of studEls) {
      if (used.has(s) || classKey(s, includeValues) !== key) continue;
      const options: Array<[number, number]> = r.branch.polar
        ? [[0, 1]]
        : [
            [0, 1],
            [1, 0],
          ];
      for (const [x, y] of options) {
        const undo: Array<() => void> = [];
        if (
          bind(r.nodes[0], s.nodes[x], undo) &&
          bind(r.nodes[1], s.nodes[y], undo)
        ) {
          used.add(s);
          if (search(index + 1)) return true;
          used.delete(s);
        }
        undo.reverse().forEach((fn) => fn());
      }
    }
    return false;
  };
  return search(0);
};

/** Serializable summary of a comparison, for the debug panel. */
export const comparisonDebug = (
  comparison: ReferenceComparison,
  student: CircuitAnalysis,
  reference: CircuitAnalysis,
): ComparisonDebug => {
  const studentById = new Map(student.full.elements.map((e) => [e.id, e]));
  const studentOf = (r: ParsedElement) =>
    [...comparison.mapping].find(([, ref]) => ref === r)?.[0];
  const polarity: ComparisonDebug['polarity'] = [];
  for (const [studentId, r] of comparison.mapping) {
    const s = studentById.get(studentId);
    const expected = reference.full.orientation?.get(r.id);
    const actual = student.full.orientation?.get(studentId);
    if (s?.branch.polar && expected && actual) {
      polarity.push({ label: s.label, reference: expected, student: actual });
    }
  }
  const labelOf = (r: ParsedElement) => {
    const id = studentOf(r);
    return id
      ? (studentById.get(id)?.label ?? r.label)
      : `${r.label} (missing)`;
  };
  return {
    match: comparison.match,
    method: comparison.method,
    mapping: [...comparison.mapping].map(([studentId, r]) => ({
      student: studentById.get(studentId)?.label ?? studentId,
      reference: r.label,
    })),
    pairs: comparison.pairDiffs.map((d) => ({
      a: labelOf(d.a),
      b: labelOf(d.b),
      reference: d.reference,
      student: d.student,
    })),
    polarity,
    partialScore: Math.round(comparison.partialScore * 1000) / 1000,
  };
};
