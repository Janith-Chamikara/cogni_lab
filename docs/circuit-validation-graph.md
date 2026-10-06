# How circuit validation works: graph and tree

The student's circuit is never compared picture-to-picture or wire-by-wire. Both the instructor's circuit and the student's circuit are converted into the same **electrical graph**. That graph is reduced to a **series/parallel tree**, and the trees are compared. Wire order, canvas position, and drawing direction therefore never affect the result.

```
canvas wires ──► terminals ──► nodes (union-find) ──► element graph
     ──► series/parallel tree ──► orientation (+ → −) ──► canonical string
     ──► compare with instructor ──► per-pair diff ──► score + messages
```

### 1. Terminals: every equipment has named connection points

| Kind                               | Terminal ids (labels)                    | Polar?                                             |
| ---------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| Resistor, capacitor, switch, motor | `t1` (1), `t2` (2)                       | no (either way round)                              |
| Power source                       | `neg` (−), `pos` (+)                     | yes                                                |
| LED, diode                         | `anode` (A), `cathode` (K)               | yes: current must enter at A                       |
| Ammeter / voltmeter                | `pos` (+), `com` (COM)                   | yes: current must enter at +                       |
| Multimeter                         | `com` (COM), `v` (V), `a` (A)            | COM–V acts as a voltmeter, COM–A as an ammeter     |
| Potentiometer                      | `t1` (1), `wiper` (W), `t2` (2)          | no; acts as two resistors meeting at the wiper     |

The canvas draws one labelled handle per terminal. A wire stores the
terminal **id** as its handle (`sourceHandle: "pos"`); this page writes
terminals with their labels (`V1.+`), as the debug panel does.

- Terminals come from `component-registry.ts`. An equipment can override
  them with `terminals` in its config (same number of terminals; ids, labels
  and sides may change).
- Wires saved before named terminals used positional handles. They still
  work: `left`/`top` mean the first terminal, `right`/`bottom` the second.
- A multimeter uses the branch that is wired (COM–V, COM–A, or both). A
  potentiometer with all three terminals wired becomes two resistors split
  by `wiperPosition` (0–1, default 0.5); with two wired it is the part
  between them (a rheostat).

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
| w1  | V1.+   | R1.1  |
| w2  | R1.2  | R2.1  |
| w3  | R1.2  | R3.1  |
| w4  | R2.2  | LED1.A |
| w5  | R3.2  | LED1.A |
| w6  | LED1.K | V1.−   |
| w7  | VM.+   | R1.1  |
| w8  | VM.COM | R1.2  |

### 3. Step 1: wires collapse terminals into nodes (union-find)

Every terminal starts alone. Each wire merges the groups of its two ends. Afterwards, each group is one **electrical node**: a set of points that are all at the same voltage.

| Node   | Terminals in it             |
| ------ | --------------------------- |
| **n1** | V1.+, R1.1, VM.+           |
| **n2** | R1.2, R2.1, R3.1, VM.COM |
| **n3** | R2.2, R3.2, LED1.A        |
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

Two versions of this network are built:

- **Load network** (topology check, equivalent resistance, closed loop):
  instruments behave as ideal meters. An ammeter conducts like a wire, so the
  nodes on both sides of it are joined; a voltmeter draws no current, so it
  is left out.
- **Full network** (reference comparison, polarity, instrument placement):
  every part, instruments included, stays in the graph as drawn.

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
- Message: **"LED1 is reversed: its anode must face the + side of the supply"**.
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

- Messages: **"VM should be connected across R1, but it is in series with it."** The `instruments` sanity check also fails (**"VM should be connected across a component (in parallel), but it is in series"**), because a voltmeter in series blocks the current.

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
| `polarity`         | "LED1 is reversed: its anode must face the + side of the supply"                                           |
| `instruments`      | "VM should be connected across a component (in parallel), but it is in series"                              |
| existing checks    | required components, connections, short circuit, closed loop, topology, Req                          |

### 12. Results, scoring and rules

Students see a result, not a mark: **Validated** when every check passes,
otherwise **Not validated yet** with the failed checks. Every lab is
validated this way; a lab without saved rules uses the default rules. The
weights below only rank a student's attempts (a validated attempt always
ranks first) and are not shown as a percentage.

| Check              | Default weight | When it runs                                                                                  |
| ------------------ | -------------- | --------------------------------------------------------------------------------------------- |
| `matchesReference` | 30             | `compareToReference` is on (default) and the instructor saved at least one wire               |
| `polarity`         | 10             | the circuit has a supply, polar parts and a series/parallel tree                              |
| `instruments`      | 10             | the circuit has meters and a series/parallel tree                                             |

- `matchesReference` passes only when the fingerprints are equal. When it
  fails, it still earns part of its weight: the share of part pairs related
  correctly plus polar parts facing the right way (11/12 in examples B and C).
- `polarity` compares each polar part with the instructor's circuit. Without
  a reference circuit every polar part must face forward.
- Component values are part of the fingerprint when **Check component
  values** is on. Values must match exactly; the value tolerance applies only
  to the required-components check.
- Without a power source there is no current direction, so polarity is not
  checked and the comparison uses the free ends of the network as its ports.
- Non-series-parallel circuits are matched by node partitions with a search
  limit of 5,000 steps; identical-part swaps are tried for groups of up to
  6 parts.

### 13. Debugging: see the graph, tree and fingerprint

**Student lab editor (live).** Set `NEXT_PUBLIC_CIRCUIT_DEBUG=true` in the
frontend environment and restart Next.js. A bug icon appears in the lab
toolbar. Turning it on opens a panel that refreshes as you wire:

- **Student** / **Instructor** tabs: fingerprint, node graph (n1 is the
  supply's +; red = source, violet dashed = instruments, arrows = polar
  parts, green forward / red reversed), the series/parallel tree with current
  direction, the union-find node table and the element table.
- **Compare** tab: match result, the student→instructor part mapping, the
  pairs related differently and each polar part's direction.

The backend sends these details only to instructors and admins, because
they reveal the expected circuit. For local testing with a student account,
set `CIRCUIT_DEBUG=true` in the backend environment. Do not enable it in
production.

**Instructor rules dialog.** **Circuit Validation Rules** grades the saved
circuit (`GET /labs/:id/reference`, instructors only) and shows its
fingerprint, topology, Req and any problems (e.g. a reversed LED) that would
make every student fail. **Graph & tree** shows the same debug view. Save the
lab first: unsaved canvas changes are not included.

