# Circuit validation and lab editor changes

This document summarises the changes made on top of the staged
`circuit-validation` work: graph-based grading against the instructor's
circuit, the debug tools, AI feedback on Check Progress, the reworked lab
editors and the seed data. Read it together with:

- [circuit-validation-graph.md](circuit-validation-graph.md): how the graph,
  tree and fingerprint work, with worked examples.
- [ai-agent.md](ai-agent.md): the AI assistant, including the Check Progress
  feedback section.

Nothing has been committed yet.

## 1. Summary

| Area | Before | Now |
| --- | --- | --- |
| Grading | Rule checks (topology, Req), or "basic grading" (equipment and wire counts) for labs without rules | Every lab is validated by the circuit engine and compared with the instructor's wired circuit. Basic grading is removed |
| Result shown to students | Percentage score ("Score: 72%", "Best 72%") | **Validated** / **Not validated yet**, plus the failed checks |
| Terminals | Every part had two generic handles (left/top, right/bottom) | Named terminals per kind (+/−, anode/cathode, + /COM, COM/V/A, wiper) |
| Polarity and meters | Not checked; ammeters broke the circuit | Polarity checked; ammeters conduct, voltmeters are open; meter placement checked |
| Check Progress | Static list of checks | AI explanation of the result above the checks |
| Steps | Students ticked "Mark Complete"; steps were graded | Steps are read-only instructions and are not graded |
| Help | "Get Help" and "Student Help" buttons (same dialog) | Removed from both editors; the AI assistant is the help |
| Editors | Fixed 1280px width, fixed sidebars, page taller than the window | Full width, collapsible sidebars, full-screen mode |
| Debugging | None | Bug icon showing the graph, tree and fingerprint (behind an env flag) |

## 2. Grading engine (backend)

### How a circuit is validated

1. Wires join named terminals into electrical nodes (union-find).
2. Each component branch becomes an edge between two nodes.
3. The network between the supply terminals is reduced to a series/parallel
   tree.
4. The tree is oriented from + to − and printed as a canonical string, the
   **fingerprint**. Equal fingerprints mean the circuits are electrically
   equivalent, whatever the wire order, layout or drawing direction.
5. For feedback, student parts are mapped onto the instructor's parts
   (identical parts may swap) and every pair is compared: in series or in
   parallel, and facing the same way.

Circuits that are not series-parallel (for example a Wheatstone bridge) are
compared by node partitions instead.

### Checks

| Check | Default weight | Notes |
| --- | --- | --- |
| `matchesReference` | 30 | Runs when `compareToReference` is on (default) and the instructor has saved wires. Messages name the wrong pair, e.g. "R2 and R3 should be in parallel, but they are in series" |
| `polarity` | 10 | LEDs, diodes and meters must match the instructor's direction (or face forward when there is no reference) |
| `instruments` | 10 | Voltmeters must be across a part; ammeters in series |
| Existing checks | unchanged | Required components, connections, short circuit, complete, closed, topology, equivalent resistance |
| `steps` | removed from grading | Steps are instructions only |

The score is still calculated and stored (the `LabAttempt.score` column
requires it). It is no longer shown. It only ranks a student's attempts: a
validated attempt always ranks first, then the most checks passed, then the
earliest.

### Component kinds and terminals

| Kind | Terminal ids (labels) |
| --- | --- |
| Resistor, capacitor, inductor, switch, motor | `t1` (1), `t2` (2) |
| Power source | `neg` (−), `pos` (+) |
| LED, diode | `anode` (A), `cathode` (K) |
| Ammeter, voltmeter (new) | `pos` (+), `com` (COM) |
| Multimeter (new) | `com` (COM), `v` (V), `a` (A); uses the wired branch |
| Potentiometer (new) | `t1`, `wiper` (W), `t2`; `wiperPosition` 0–1 in config |

- Wires saved with the old `left`/`top`/`right`/`bottom` handles still grade
  and display (first and second terminal).
- An equipment config may override terminals with `terminals: [{ id, label,
  side }]` (same number as the kind).
- Kinds are still inferred from the equipment name; `componentKind` in the
  config overrides that.

### New and changed backend files

| File | Purpose |
| --- | --- |
| `circuit-validation/component-registry.ts` | Named terminals, branches, new kinds, legacy handle mapping |
| `circuit-validation/circuit-parser.ts` | One element per active branch; terminal-to-node table |
| `circuit-validation/topology.ts` | Tree nodes keep their endpoints; current direction; pair relations |
| `circuit-validation/circuit-analysis.ts` (new) | Graph analysis shared by grading, reference and debug |
| `circuit-validation/reference-compare.ts` (new) | Fingerprint, part mapping, pair diffs, partition fallback |
| `circuit-validation/circuit-debug.ts` (new) | Serialisable graph/tree/fingerprint for the debug panel |
| `circuit-validation/circuit-validator.ts` | New checks, partial credit, optional debug output |
| `circuit-validation/lab-circuit.adapter.ts` | `buildReferenceCircuit`, `describeTerminals` |
| `circuit-validation/legacy-validator.ts` | Deleted (basic grading) |
| `lab/lab-attempt.service.ts` | Loads the instructor wires, default rules for every lab, debug gating, no step grading |
| `lab/lab.service.ts`, `lab/lab.controller.ts` | Terminals on placements; `GET /labs/:id/reference` |
| `lab-equipment/lab-equipment.service.ts` | Terminals on equipment list responses |
| `ai/*` | Check Progress feedback endpoint and prompt; prompt updates |
| `prisma/seed.ts` | Test accounts and a demo lab |

## 3. API changes

| Endpoint | Change |
| --- | --- |
| `POST /labs/:id/validate` | Optional `debug: true` returns `result.debug` (graph, tree, fingerprints, comparison). Only for instructors/admins, or anyone when `CIRCUIT_DEBUG=true` |
| `GET /labs/:id/reference` (new) | Instructor only. Grades the saved instructor circuit: fingerprint, topology, Req, warnings, debug view |
| `POST /ai/progress-feedback` (new) | AI explanation of a Check Progress result (see section 5) |
| `GET /labs/:id`, `GET /lab-equipment` | Each equipment includes `terminals` |
| `GET /labs/:id/attempts/me` | Adds `latestSubmission` (`attemptId`, `submittedAt`, `passed`, `circuit`); older attempts' circuits are not returned |
| `PUT /labs/:id/rules` | New `compareToReference` rule. `null` now resets to the default rules (it no longer switches to basic grading) |
| `ValidationResult` | `mode` is always `"rules"`; checks may carry `partial` |

## 4. Debug tools

| Where | What it shows |
| --- | --- |
| Student lab, bug icon in the header | Live panel, refreshed as you wire: **Student** and **Instructor** tabs (fingerprint, node graph, oriented tree, node and element tables) and a **Compare** tab (match, part mapping, differing pairs, polarity) |
| Instructor editor, bug icon in the header | The saved reference circuit's graph, tree and fingerprint, plus problems that would make every student fail. Reloads after each save |
| Instructor Validation Rules dialog | Reference summary (fingerprint, topology, Req, warnings) with a **Graph & tree** toggle |

The bug icons appear only with `NEXT_PUBLIC_CIRCUIT_DEBUG=true` in the
frontend environment.

## 5. AI feedback on Check Progress

The message above the checks in the Progress Check Results dialog is not
produced by a help button. It works like this:

1. **Check Progress** sends the normal validation request and, at the same
   time, `POST /ai/progress-feedback` with the lab id, the selected step and
   the workspace (part identities and wires only).
2. The backend validates the circuit again itself, so the model only sees
   server-side evidence and never a result supplied by the browser.
3. One model call (no tools) uses the tutoring policy plus
   `PROGRESS_FEEDBACK_PROMPT` in `backend/src/ai/ai-prompt.ts`: a
   validated/not-yet-validated verdict, then the one or two most important
   problems with a concrete next action, as a hint rather than the full
   answer.
4. The dialog opens immediately with the checks; the AI card shows
   "Reviewing your circuit…" and fills in when the reply arrives. If the
   assistant is unavailable, the card says so and the checks still show.
   Only the latest check's feedback is displayed.

The model does not receive the instructor's reference wiring in this call.
It can only restate what the check messages already reveal.

## 6. Lab editor UI

### Both editors (student `/student/lab/[id]`, instructor `/labs/[id]`)

- Full width below the navbar; the page no longer overflows the window.
- Compact one-row header with a truncated lab title.
- Collapsible **Instructions** and **Equipment & Materials** sidebars. The
  choice is remembered per browser (`hooks/use-persistent-flag.ts`).
- Full-screen button in the canvas toolbar (`hooks/use-focus-mode.ts`); Esc
  exits.
- Slimmer canvas toolbar; minimap moved to the top right so the chat button
  does not cover it; canvas colours follow the theme actually shown.
- Labelled terminal handles on every part.

### Student editor

- Steps are a numbered, read-only list. Clicking a step highlights it (the
  AI uses the selected step). Mark Complete, the step progress bar and the
  bottom step bar are removed.
- Lab Summary shows Parts and Wires.
- Equipment items show a ✓ once placed on the canvas (✓×2 if used twice).
- Results show **Validated** / **Not validated yet** and the AI feedback.
- Returning to a lab shows the circuit from the student's latest submission
  (with a "Your last submission · date" note in the canvas toolbar). Parts
  whose placement the instructor has since removed are dropped. **Reset**
  clears the canvas to start again; submitted attempts are kept. A
  submission that loads late never overwrites work already started.
- The settings gear is hidden (students cannot change component values; the
  grader uses the instructor's values).

### Instructor editor

- Header: **Thresholds**, **Validation Rules**, **Discard**, **Save**, debug
  icon. The no-op **Run** button is removed; **Discard** now resets unsaved
  changes after a confirmation.
- Save feedback: "Unsaved changes", "Saved ✓" or the error message.
  **Ctrl/Cmd+S** saves. Leaving with unsaved changes asks first.
- The Validation Rules dialog and AI page context are restored (they were
  missing from the working copy after the merge).

### Other pages

- Navbar spans the full width. Dashboards, Modules, Lab Equipment and the
  footer widened from 1280px to 1536px. Landing and sign-in pages are
  unchanged.
- Student dashboard shows **Validated** / **Not validated yet** per lab.

## 7. Bug fixes

- Duplicate `id="right"` handle on equipment nodes.
- Instructor canvas: deleting a wire drawn in the same session did nothing.
- Instructor editor: after saving, wires still pointed at the old part ids
  and disappeared until reload.
- Student canvas: the settings gear did nothing; node action buttons are now
  `nodrag` so clicks never start a drag.
- Debug view and labs without rules: the panel now works for every lab.

## 8. Seed data (`npm run db:seed` in `backend/`)

| Role | Email | Password |
| --- | --- | --- |
| Instructor | `instructor+clerk_test@cognilab.dev` | `CogniLab-Test-2026!` (or `SEED_TEST_PASSWORD`) |
| Student | `student1+clerk_test@cognilab.dev` | same |
| Student | `student2+clerk_test@cognilab.dev` | same |

- Accounts are created in Clerk with onboarding complete and mirrored in the
  users table. The account step only runs with a development
  (`sk_test_`) Clerk key. Clerk test emails accept the verification code 424242.
- Re-running resets these accounts' passwords to the shared one.
- Also creates **Demo: LED with series-parallel resistors** (EE101): the
  worked example from the explainer, wired and with rules.

## 9. Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CIRCUIT_DEBUG=true` | frontend | Show the debug bug icons |
| `CIRCUIT_DEBUG=true` | backend | Return debug details to every user (local testing only; never in production) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | backend | Already used by the assistant; also used by Check Progress feedback |
| `CLERK_SECRET_KEY` | backend | Seed: creates the test accounts (development key only) |
| `SEED_TEST_PASSWORD` | backend | Seed: overrides the shared test password |

## 10. Testing

- `cd backend && npx jest src/circuit-validation src/lab src/ai`: 60 tests
  pass. New tests cover the explainer examples A–E, the bridge, the
  alternative 500 Ω circuit, legacy handles, shuffled wiring, meters,
  multimeter and potentiometer, debug gating, default rules for labs without
  rules, step grading removal and the AI feedback endpoint (mocked provider).
- `cd frontend && npx tsc --noEmit` passes apart from the existing
  `lib/schemas/onboarding.ts` error.
- UI changes were only reviewed through screenshots during development,
  not tested end to end. Run the manual flow below before merging.

Suggested manual check: seed, sign in as student1, open the demo lab, build
it wrong (LED reversed, R2 and R3 in series, voltmeter in series), press
Check Progress and confirm the AI feedback and checks; then build it right
and confirm **Validated**. Sign in as the instructor, open the lab, change
the wiring, save and open the bug icon.

## 11. Behaviour changes to review

- Labs that used basic grading are now validated with the default rules and
  compared with the instructor's wiring. Students on those labs may now see
  "Not validated yet" for circuits that passed before. An instructor should
  review the grading before rollout.
- Existing rule-based labs with saved wires gain the reference comparison by
  default (`compareToReference: true`).
- `TEST_PLAN_COMPLEX.md` Test 6 (multimeter across R1 instead of R4) no
  longer validates.
- Attempts stored before this change keep their old `validationMode` and
  score.

## 12. Known issues and follow-ups

- **Answer exposure in chat:** the chat assistant's `inspect_lab` tool still
  gives the model the instructor's full reference wiring. Consider removing
  `referenceConnections` from it on student pages.
- **AI cost:** every Check Progress click is one model request. Add a
  cooldown or an "Explain with AI" button if this becomes a cost or
  rate-limit problem.
- **AI formatting:** the free model sometimes ignores "no headings" in the
  feedback prompt.
- `frontend/lib/schemas/onboarding.ts` does not typecheck with the installed
  zod (`required_error`). This breaks `next build`.
- `student-lab-client.tsx` and `instructor-lab-help-dialog.tsx` are no
  longer rendered by any route and can be deleted.
- `lab-editor-client.tsx`: the staged copy still has merge conflict markers;
  `git add` the working copy before committing.
- Pre-existing: `auth.service.spec.ts` fails (missing `PrismaService` in its
  test module); a few `any` lint errors in the student editor; `footer.tsx`
  is not Prettier-formatted.
