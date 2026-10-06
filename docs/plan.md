# Plan: Grade student circuits against the instructor's reference circuit (graph-based)

## Context

The staged `backend/src/circuit-validation` engine already turns a circuit into a graph. It joins terminals into nodes with union-find (`circuit-parser.ts`) and reduces the graph into a series/parallel tree (`topology.ts`). However, students are graded only against instructor **rules** (allowed topology, Req range):

- the instructor's own wiring is never compared;
- polarity is not checked;
- every equipment has the same 2 generic terminals (`left/top` = 1, `right/bottom` = 2);
- instruments are left out of the graph.

Decisions confirmed with the user:

- **Electrically equivalent** matching: compare canonical series/parallel trees, not exact netlists.
- **Terminals** come from per-kind registry defaults, with an optional override in `defaultConfigJson.terminals`.

**Step 0 of implementation:** save the explainer below as `docs/circuit-validation-graph.md`. The user asked for an MD file explaining the approach with an example.

---

# Explainer (to be saved as `docs/circuit-validation-graph.md`)

## How circuit validation works: graph and tree

The student's circuit is never compared picture-to-picture or wire-by-wire. Both the instructor's circuit and the student's circuit are converted into the same **electrical graph**. That graph is reduced to a **series/parallel tree**, and the trees are compared. Wire order, canvas position, and drawing direction therefore never affect the result.

```
canvas wires ──► terminals ──► nodes (union-find) ──► element graph
     ──► series/parallel tree ──► orientation (+ → −) ──► canonical string
     ──► compare with instructor ──► per-pair diff ──► score + messages
```

### 1. Terminals: every equipment has named connection points

| Kind                               | Terminals                  | Polar?                                         |
| ---------------------------------- | -------------------------- | ---------------------------------------------- |
| Resistor, capacitor, switch, motor | `t1`, `t2`                 | no (either way round)                          |
| Power source                       | `−`, `+`                   | yes                                            |
| LED, diode                         | `A` (anode), `K` (cathode) | yes: current must enter at A                   |
| Ammeter / voltmeter                | `+`, `COM`                 | yes: current must enter at +                   |
| Multimeter                         | `COM`, `V`, `A`            | COM–V acts as a voltmeter, COM–A as an ammeter |
| Potentiometer                      | `t1`, `wiper`, `t2`        | no; acts as two resistors meeting at the wiper |

The canvas shows these labels on the handles. A wire is stored as `componentId.terminal`.

### 2. Worked example: the instructor's circuit

A 12 V supply drives R1, then R2 ∥ R3, then an LED. A voltmeter VM measures across R1.

```
            ┌──── VM ────┐
            │+        COM│
 V1(+) ─────┴──── R1 ────┴──┬── R2 ──┬──── LED1 ──── V1(−)
                  100 Ω     │  300 Ω │   A     K
                            └── R3 ──┘
                               600 Ω
```

Wires the instructor drew:

| #   | From   | To     |
| --- | ------ | ------ |
| w1  | V1.+   | R1.t1  |
| w2  | R1.t2  | R2.t1  |
| w3  | R1.t2  | R3.t1  |
| w4  | R2.t2  | LED1.A |
| w5  | R3.t2  | LED1.A |
| w6  | LED1.K | V1.−   |
| w7  | VM.+   | R1.t1  |
| w8  | VM.COM | R1.t2  |

### 3. Step 1: wires collapse terminals into nodes (union-find)

Every terminal starts alone. Each wire merges the groups of its two ends. Afterwards, each group is one **electrical node**: a set of points that are all at the same voltage.

| Node   | Terminals in it             |
| ------ | --------------------------- |
| **n1** | V1.+, R1.t1, VM.+           |
| **n2** | R1.t2, R2.t1, R3.t1, VM.COM |
| **n3** | R2.t2, R3.t2, LED1.A        |
| **n4** | LED1.K, V1.−                |

Drawing w3 before w2, or drawing a wire right-to-left, produces exactly the same nodes. This is why action order does not matter.

### 4. Step 2: components become edges between nodes

```
            R1
      ┌───────────┐
 n1 ──┤           ├── n2 ══ R2 ══ n3 ── LED1 ──► n4
  ▲   └─────VM────┘    ╚═══ R3 ═══╝              │
  │                                              │
  └──────────────────── V1 (source) ─────────────┘
       (+ at n1)                         (− at n4)
```

| Element | Edge    | Notes                                                    |
| ------- | ------- | -------------------------------------------------------- |
| V1      | n4 – n1 | the source: its nodes are the **ports** (+ = n1, − = n4) |
| R1      | n1 – n2 |                                                          |
| VM      | n1 – n2 | polar, `+` terminal on n1                                |
| R2      | n2 – n3 |                                                          |
| R3      | n2 – n3 |                                                          |
| LED1    | n3 – n4 | polar, anode on n3                                       |

The source is removed, and the remaining network between ports n1 and n4 is analysed.

### 5. Step 3: reduce the graph to a series/parallel tree

Two rules are applied repeatedly until one edge is left:

- **Parallel rule:** edges that join the _same two nodes_ merge into a `P` node.
- **Series rule:** a node (not a port) touched by _exactly two_ edges is removed, and its two edges merge into an `S` node.

| Pass | What happens                                                                     | Edges left                                 |
| ---- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| 1    | R1 and VM both join n1–n2 → `P(R1, VM)`. R2 and R3 both join n2–n3 → `P(R2, R3)` | P(R1,VM) n1–n2, P(R2,R3) n2–n3, LED1 n3–n4 |
| 2    | n2 touches only 2 edges → `S(P(R1,VM), P(R2,R3))`                                | S(…) n1–n3, LED1 n3–n4                     |
| 3    | n3 touches only 2 edges → flatten into the same `S`                              | S(…) n1–n4 ✅ one edge between the ports   |

The resulting tree:

```
S  [n1 → n4]
├── P  [n1 → n2]
│   ├── R1   100 Ω
│   └── VM   (+ on n1)
├── P  [n2 → n3]
│   ├── R2   300 Ω
│   └── R3   600 Ω
└── LED1     [n3 → n4]  (anode on n3)
```

If the reduction gets stuck before one edge is left, the circuit is not series-parallel (see §10).

### 6. Step 4: orientation (polarity)

Conventional current leaves the source at `+` (n1) and returns at `−` (n4). The tree is walked from the root with that direction:

- a `P` node passes the same direction to every child;
- an `S` node passes it along its children in chain order (n1→n2, n2→n3, n3→n4).

Each polar leaf is then checked to see whether current **enters at its "in" terminal**:

| Part | Current enters at | "In" terminal is on | Result     |
| ---- | ----------------- | ------------------- | ---------- |
| VM   | n1                | n1 (`+`)            | forward ✅ |
| LED1 | n3                | n3 (anode)          | forward ✅ |

### 7. Step 5: canonical string (the "fingerprint")

Each tree node is written as text, with the children of each `S` and `P` **sorted** so that ordering stops mattering:

- leaf → `kind:value`, plus `>` (forward) or `<` (reversed) for polar parts
- `S(...)` / `P(...)` → the sorted children

```
P(R:100,VM>)
P(R:300,R:600)
LED>
S(LED>,P(R:100,VM>),P(R:300,R:600))   ← instructor fingerprint
```

**If the student's fingerprint equals this string, the circuits are electrically equivalent.** Identical parts are interchangeable, and series order is free.

### 8. Step 6: pair relations (used for feedback)

For any two parts, the **lowest common ancestor** in the tree indicates how they relate:

- the LCA is `P` → they are **in parallel**;
- the LCA is `S` → they are **in series**.

Instructor relations (10 pairs):

|        | R1  | VM  | R2  | R3  | LED1 |
| ------ | --- | --- | --- | --- | ---- |
| **R1** | –   | P   | S   | S   | S    |
| **VM** |     | –   | S   | S   | S    |
| **R2** |     |     | –   | P   | S    |
| **R3** |     |     |     | –   | S    |

### 9. Student attempts

#### A. Different order, still correct ✅

The student built `V1+ → LED1 → (R3 ∥ R2) → R1 → V1−`, with VM across R1 and its + on the side nearer the supply's +.

```
S [m1 → m4]
├── LED1        [m1 → m2]   anode on m1 → forward
├── P [m2 → m3] (R3, R2)
└── P [m3 → m4] (R1, VM)    VM + on m3 → forward
```

The fingerprint is `S(LED>,P(R:100,VM>),P(R:300,R:600))`, identical to the instructor's, so the result is **Match** and `matchesReference` passes.

#### B. LED reversed ❌

The student's fingerprint is `S(LED<,P(R:100,VM>),P(R:300,R:600))`, which differs.

- Pair relations: 10/10 correct.
- Orientation: VM ✅, LED1 ❌.
- Message: **"LED1 is reversed: its anode must face the + side of the supply."**
- `polarity` fails. The partial reference score is 11/12.

#### C. R2 and R3 in series instead of parallel ❌

```
S
├── P (R1, VM)
├── R2
├── R3
└── LED1
```

The student's fingerprint is `S(LED>,P(R:100,VM>),R:300,R:600)`, which differs. The pair table shows exactly one wrong pair:

| Pair              | Instructor | Student |     |
| ----------------- | ---------- | ------- | --- |
| R2 – R3           | parallel   | series  | ❌  |
| all other 9 pairs | same       | same    | ✅  |

- Message: **"R2 and R3 should be in parallel, but they are in series."**
- Partial reference score: 11/12 (9 of 10 pairs plus 2 of 2 orientations).

#### D. Voltmeter wired in series (common mistake) ❌

The student placed VM between R1 and the R2 ∥ R3 group, giving `S(R1, VM, P(R2,R3), LED1)`.

| Pair    | Instructor | Student |     |
| ------- | ---------- | ------- | --- |
| R1 – VM | parallel   | series  | ❌  |

- Messages: **"VM should be connected across R1, but it is in series."** The `instruments` sanity check also fails, because a voltmeter in series blocks the current.

#### E. Identical parts swapped ✅

If R2 and R3 were both 300 Ω, the student could use either physical part in either position. Both leaves print as `R:300`, so the fingerprint is unchanged. For feedback, the engine chooses the student→instructor mapping that gives the fewest mismatches.

### 10. Circuits that are not series-parallel (e.g. a Wheatstone bridge)

```
       ┌── R1 ──a── R2 ──┐
 V+ ───┤        │        ├─── V−
       └── R3 ──b── R4 ──┘
                │
           R5 between a and b
```

No two edges share both nodes, and nodes a and b each touch 3 edges, so the reduction gets stuck and the topology is `complex`. In that case the engine compares **node partitions**: are the same terminals joined together in both circuits? The search tries the allowed swaps (identical parts, flipping non-polar parts) up to a fixed limit.

### 11. What the student sees

| Check              | Example message                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `matchesReference` | "Your circuit matches the instructor's circuit" / "R2 and R3 should be in parallel, but they are in series" |
| `polarity`         | "LED1 is reversed: its anode must face the + side"                                                          |
| `instruments`      | "VM should be connected across R1, but it is in series"                                                     |
| existing checks    | required components, connections, short circuit, closed loop, topology, Req, steps                          |

---

## Implementation steps

### 1. Named, per-kind terminals (`component-registry.ts`)

- Replace `terminals: [string, string]` with `terminals: TerminalSpec[]`, where each entry is `{ id, label, side, polarity?: 'in'|'out' }`, and add `branches: [string, string][]`.
- Add the `ammeter`, `voltmeter`, `multimeter` (branch chosen by which pair is wired) and `potentiometer` kinds.
- `handleToTerminal` accepts terminal ids and falls back to the legacy `left/top` → 0, `right/bottom` → 1 mapping, so existing wires keep grading.
- `resolveTerminals(kind, config)`: use `config.terminals` when valid, otherwise the registry default.

### 2. Parser: one element per branch (`circuit-parser.ts`)

- Union-find over N terminals, then one `ParsedElement` per branch, keeping `nodes: [string, string]` so `topology.ts` stays 2-terminal.

### 3. Tree orientation and relations (`topology.ts`)

- Tree nodes carry their endpoints `u, v`, recorded in `combine()`.
- Add `orientLeaves(tree, plusNode, minusNode)` → `Map<leafId, 'forward'|'reverse'>` (see §6).
- Add `relationOf(tree, a, b)` → the LCA type (see §8).

### 4. Reference comparison (new `reference-compare.ts`)

- `canonical(tree, orientation, leafInfo)` builds the fingerprint (see §7).
- `compareToReference(refParsed, studentParsed, mapping)` returns `{ match, pairDiffs, polarityDiffs, instrumentDiffs, partialScore }`. It picks the best permutation within identical-part classes (brute force ≤ 6) and falls back to partition comparison for non-series-parallel circuits (state cap of about 5k).
- Both networks **include instruments** here. Topology classification and Req still exclude them, as they do now.

### 5. Validator wiring (`circuit-validator.ts`, `types.ts`, `circuit-rules.ts`)

- `ValidateCircuitInput.reference?: CircuitState`.
- New `CheckKey`s with default weights: `matchesReference`, `polarity`, `instruments`.
- New rule `compareToReference` (default `true`). It applies only when the instructor has drawn wires.

### 6. Load the reference (`lab-circuit.adapter.ts`, `lab-attempt.service.ts`)

- Add `buildReferenceCircuit(placements, wireConnections)`.
- `loadLab` includes `wireConnections` instead of `_count`.
- When rules are saved, run the engine on the instructor's circuit and warn if it is incomplete, shorted, or has a reversed polar part. Return its fingerprint and topology for display.

### 7. Frontend

- In `lab.service.ts`, return the resolved `terminals` for each placement.
- In `equipment-node.tsx` and `student-equipment-node.tsx`, render one labelled `Handle` per terminal, falling back to the 4 positional handles.
- Fix the duplicate `id="right"` handle at `equipment-node.tsx:62-67`.
- In `validation-rules-dialog.tsx`, add a "Compare with my circuit" toggle and show the reference summary and warnings.

## Critical files

- `backend/src/circuit-validation/{component-registry,circuit-parser,topology,circuit-validator,types,circuit-rules,lab-circuit.adapter}.ts`
- `backend/src/circuit-validation/reference-compare.ts` (new)
- `backend/src/lab/lab-attempt.service.ts`, `backend/src/lab/lab.service.ts`
- `frontend/components/lab/circuit-canvas/equipment-node.tsx`, `frontend/components/student/student-equipment-node.tsx`, `frontend/components/lab/validation-rules-dialog.tsx`
- `docs/circuit-validation-graph.md` (new, the explainer above)

## Verification

- `cd backend && npx jest circuit-validation`, using the explainer's examples A–E and the bridge as test cases. Also:
  - the `TEST_PLAN_COMPLEX.md` alternative circuit, `R2 + ((R1+R4) ∥ R3)`, must **fail** the reference match even though its Req is also 500 Ω;
  - legacy `left/right` handles still resolve;
  - shuffled wire and component order gives the same result;
  - the existing tests stay green.
- `cd frontend && npx tsc --noEmit && npm run lint`.
- Manual: follow `TEST_PLAN_COMPLEX.md` Parts C–D with labelled terminals, and confirm the messages name the wrong pair, part, or instrument.
- Have an instructor peer-review the grading semantics before rollout, because existing rule-based labs gain `matchesReference` by default.
