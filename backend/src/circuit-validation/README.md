# circuit-validation

Grades a student's circuit against a lab's rules and the instructor's own
circuit. It is plain TypeScript with no Nest or Prisma imports: it takes plain
objects and returns a structured result, so it can be unit-tested on its own.

Only the final circuit is graded. Wire order, canvas positions and drawing
direction never change the result. The algorithm itself is explained step by
step in [docs/circuit-validation-graph.md](../../../docs/circuit-validation-graph.md).

## Pipeline

```
DB rows (placements, wires, equipment)
  │  lab-circuit.adapter.ts      rows → CircuitState, each part with its spec
  ▼
CircuitState { components, wires }
  │  circuit-parser.ts           terminals joined by wires → nodes; branches → elements
  ▼
electrical graph
  │  circuit-analysis.ts         main group, ports, shorts, dangling parts
  │  topology.ts                 series/parallel reduction tree, R_eq, current direction
  ▼
CircuitAnalysis
  │  reference-compare.ts        fingerprint + part-by-part diff with the instructor
  │  circuit-validator.ts        runs every check, weights them, builds messages
  ▼
ValidationResult { passed, score, checks, errors, warnings, summary, debug? }
```

How each component behaves (its terminals, branches, polarity and role) comes
from its **component definition**. The definition is stored on the equipment,
or a preset is used when the equipment has none.

## Files

### Entry points

| File | What it is for |
| --- | --- |
| `index.ts` | Public API of the folder. Code outside the folder should import from here. |
| `lab-circuit.adapter.ts` | Turns Prisma-shaped rows into engine input: `buildRequiredComponents` (the lab's required parts), `buildReferenceCircuit` (the instructor's wiring), `buildStudentCircuit` (the student's submission; kinds and values are always taken from the server). `describeEquipmentComponent` gives the editors an equipment's definition and terminals. |
| `circuit-validator.ts` | `validateCircuit`: the main function. Runs every check (components, connections, shorts, complete/closed, topology, resistance, reference match, polarity, instruments) and computes the score. |
| `circuit-rules.ts` | Grading rules an instructor sets per lab: their defaults, the default check weights, and `normalizeCircuitRules`, which validates rules sent to `PUT /labs/:id/rules`. |

### Component definitions (how each part behaves)

| File | What it is for |
| --- | --- |
| `component-definition.ts` | `normalizeComponentDefinition` checks a creator's definition (ids, limits, references) and is the security boundary for that input. `compileDefinition` turns it into the index-based `ComponentSpec` the engine uses. |
| `component-presets.ts` | Ready-made definitions (resistor, LED, power supply, multimeter, …) that the create dialog starts from. Also the name-keyword guess used for older equipment that has no stored definition. |
| `component-registry.ts` | Resolves which spec a component uses (`specOf`, `resolveEquipmentDefinition`) and reads values and settings from configs. It also maps legacy wire handles (`left`/`right`) to terminals. |

### Analysis stages

| File | What it is for |
| --- | --- |
| `circuit-parser.ts` | Builds the electrical graph. Terminals joined by wires become nodes (union-find), and every active branch of a part becomes an element between two nodes. Wiring modes and value shares (for example a potentiometer's halves) are applied here. |
| `circuit-analysis.ts` | Works out what the checks need from the graph: the main connected group, disconnected and shorted parts, open terminals, the ports (the source terminals, or the free ends when there is no source), dangling branches, topology and equivalent resistance. It treats ammeters as wires and leaves voltmeters out of the load. |
| `topology.ts` | Series/parallel reduction of a two-port network into a tree. It also classifies the topology, computes equivalent resistance, and traces the direction of current through each part. |
| `reference-compare.ts` | Compares the student's circuit with the instructor's. Equal canonical fingerprints such as `S(R:100,P(R:300,R:600),LED>)` mean the circuits are equivalent. Otherwise it maps parts onto each other and diffs every pair (series or parallel, and direction) to build feedback and partial credit. |
| `circuit-debug.ts` | Builds the optional `debug` block: nodes, elements, tree and fingerprints for both circuits. The instructor's debug panel shows it. |

### Shared

| File | What it is for |
| --- | --- |
| `types.ts` | All shared types: `CircuitState`, `CircuitRules`, `ComponentDefinition`/`ComponentSpec`, `ValidationResult` and the debug shapes. |

### Tests

| File | What it covers |
| --- | --- |
| `circuit-validator.spec.ts` | Each check and rule, scoring, and existing labs built from DB-shaped rows. |
| `reference-compare.spec.ts` | Fingerprints, matching against the instructor's circuit, polarity, instruments, potentiometer and multimeter. Uses the examples from the docs. |
| `component-definition.spec.ts` | Definition validation, preset fallback, and grading circuits built from custom components. |

Run them with `npx jest src/circuit-validation` from `backend/`.

## Who uses it

| Caller | Uses |
| --- | --- |
| `lab/lab-attempt.service.ts` | Check Progress (`POST /labs/:id/validate`) and Submit (`POST /labs/:id/attempts`) |
| `lab/lab.service.ts` | Saving rules, the instructor's reference view (`GET /labs/:id/reference`), and part labels and terminals for the editors |
| `lab-equipment/lab-equipment.service.ts` | Validating and storing component definitions, the presets endpoint, and terminals for the canvas |
| `ai/ai-tools.service.ts` | Building the student circuit for the AI assistant's context |
| `prisma/seed.ts` | Default rules and presets for the demo lab |

## Common tasks

- **Offer a new kind of part.** Usually no code change is needed: a creator
  defines it in the create dialog. To make it a starting point for everyone,
  add an entry to `COMPONENT_PRESETS` (and a keyword to `PRESET_KEYWORDS` if
  older equipment with that name should use it).
- **Change what a rule does or its default.** See `circuit-rules.ts` (defaults
  and weights) and the matching section of `circuit-validator.ts`.
- **Add a new check.** Add its key to `CheckKey` in `types.ts`, give it a weight
  in `DEFAULT_CHECK_WEIGHTS`, compute it in `validateCircuit` with `addCheck`,
  and add tests.
- **Understand a surprising grade.** Send `debug: true` to
  `POST /labs/:id/validate` as an instructor or admin, or set
  `CIRCUIT_DEBUG=true` locally. The result then includes the graph, tree and
  fingerprints of both circuits.

## Terms

- **Terminal:** a named connection point on a part (`pos`, `anode`, `t1`). Wires store its id.
- **Node:** a set of terminals joined by wires; electrically a single point.
- **Branch / element:** a two-terminal path through a part. A part with several branches (a multimeter or potentiometer) gives one element per branch in use.
- **Ports:** the two nodes the circuit is analysed between, normally the power source's − and +.
- **Fingerprint:** the canonical text of the series/parallel tree; equal fingerprints mean equivalent circuits.
