# Implementation Plan

## Checklist

- [ ] Step 0: Tooling quality gate (`prettier`, `lint`, unit, e2e) is green
- [ ] Step 1: Introduce session state machine skeleton and phase model
- [ ] Step 2: Implement hold countdown with tenths precision
- [ ] Step 3: Add automatic rep loop and rep-rest configuration defaults
- [ ] Step 4: Add set progression with set-rest automation
- [ ] Step 5: Add exercise progression with exercise-rest automation
- [ ] Step 6: Implement pause/resume exact-state preservation
- [ ] Step 7: Add lifecycle suspension and wake-lock integration
- [ ] Step 8: Build options screen for sound/vibration toggles
- [ ] Step 9: Add bottom override button and modal actions
- [ ] Step 10: Final UI pass, acceptance validation, and regression tests

## Step 0: Tooling quality gate (`prettier`, `lint`, unit, e2e) is green

Objective:

- Ensure formatting and quality checks are stable before feature work.

Implementation guidance:

- Add and configure `prettier` for TypeScript/TSX/CSS/Markdown.
- Add package scripts for `prettier` check/write and include them in CI/local workflow.
- Confirm lint includes robust ignores for generated output paths.

Test requirements:

- `prettier --check` passes for the full repo.
- `lint`, `test`, and `test:e2e` baseline pass before Step 1 starts.

Integration notes:

- Run `prettier --write` before lint/test in each step implementation loop.

Demo description:

- Fresh clone can run formatting + lint + unit + e2e with all checks passing.

## Step 1: Introduce session state machine skeleton and phase model

Objective:

- Create deterministic phase orchestration for `idle | hold | repRest | setRest | exerciseRest | paused | complete`.

Implementation guidance:

- Add state machine module with explicit transition function.
- Add runtime state model (`exerciseIndex`, `setIndex`, `repIndex`, `remainingMs`, `previousPhase`).
- Wire `Start` to enter `hold` phase for first exercise/set/rep.

Test requirements:

- Unit tests for valid/invalid transitions.
- Unit tests confirming initial state and `Start` transition.

Integration notes:

- Keep existing UI rendering mostly unchanged; source timer/phase from new runtime state.

Demo description:

- Press `Start` and see session enter `hold` phase with visible active timer state.

## Step 2: Implement hold countdown with tenths precision

Objective:

- Render hold countdown from configured target duration in tenths (`x.x`).

Implementation guidance:

- Add countdown service with 100ms tick and monotonic timestamp reconciliation.
- Ensure display formatting rounds/truncates consistently to tenths.
- On completion, emit transition event (do not yet chain full loops).

Test requirements:

- Unit tests for countdown accuracy and display formatting.
- Unit tests for completion event at `0.0`.

Integration notes:

- Replace ad hoc timer logic with countdown service for hold phase.

Demo description:

- Start a hold; timer shows `N.N` down to `0.0` reliably.

## Step 3: Add automatic rep loop and rep-rest configuration defaults

Objective:

- Auto-transition hold -> repRest -> next hold within a set.

Implementation guidance:

- Extend exercise config with `repRestMs` default `30000`.
- On hold completion, enter rep rest automatically.
- On rep rest completion, advance rep and return to hold unless set boundary reached.

Test requirements:

- Unit tests for defaulting `repRestMs`.
- Integration test for multi-rep auto-loop with zero manual taps.

Integration notes:

- Preserve one-tap start behavior for entire exercise flow.

Demo description:

- Start once and observe repeated rep cycles with automatic rest in between.

## Step 4: Add set progression with set-rest automation

Objective:

- Automatically move between sets with configurable set rest.

Implementation guidance:

- Add `setRestMs` default `30000`, independently configurable from rep rest.
- Detect end-of-set boundary, transition into `setRest`, then next set hold.
- Remove dependency on explicit "next set" user action.

Test requirements:

- Unit tests for set-boundary detection.
- Integration test: final rep of set triggers set rest then next set hold.

Integration notes:

- Ensure set rest is displayed in tenths like all countdowns.

Demo description:

- Complete set 1 and see automatic set-rest countdown and set 2 start.

## Step 5: Add exercise progression with exercise-rest automation

Objective:

- Automatically move between exercises with configurable inter-exercise rest.

Implementation guidance:

- Add `exerciseRestMs` default `30000` in exercise configuration.
- On last set completion, transition to `exerciseRest`, then increment exercise index and continue.
- End session as `complete` after final exercise.

Test requirements:

- Unit tests for end-of-exercise and end-of-session transitions.
- Integration test spanning at least two exercises.

Integration notes:

- Keep start interaction as single action for full routine.

Demo description:

- Finish first exercise and watch automatic exercise-rest and next exercise start.

## Step 6: Implement pause/resume exact-state preservation

Objective:

- Allow precise freeze/resume in any active countdown phase.

Implementation guidance:

- Add `Pause` control in session UI during active phases.
- Persist exact `remainingMs` and `previousPhase` when paused.
- Add `Resume` control to re-enter prior phase from exact remaining time.

Test requirements:

- Unit tests verifying no time decrement while paused.
- Integration tests for pause/resume in hold and each rest phase.

Integration notes:

- Ensure pause does not reset rep/set/exercise indexes.

Demo description:

- Pause at e.g. `12.3`, wait, resume, and continue from `12.3`.

## Step 7: Add lifecycle suspension and wake-lock integration

Objective:

- Suspend on background/lock and attempt to prevent lock during active session.

Implementation guidance:

- Listen for lifecycle visibility events; on background/lock, force transition to `paused` and freeze timers.
- Add wake-lock adapter to acquire during active session and release on pause/complete.
- If wake lock unsupported/denied, continue silently.

Test requirements:

- Unit tests for lifecycle event handling.
- Integration tests for wake-lock adapter behavior (mocked support/non-support).

Integration notes:

- No unsupported wake lock warning UI.

Demo description:

- During active timer, app attempts wake lock; backgrounding pauses session immediately.

## Step 8: Build options screen for sound/vibration toggles

Objective:

- Add user controls for cues with default-enabled behavior.

Implementation guidance:

- Add options screen state for `soundEnabled` and `vibrationEnabled` defaults true.
- Connect effects manager to read toggles before emitting cues.
- Trigger cues on key transitions and optional final seconds countdown.

Test requirements:

- Unit tests for default option values.
- Integration tests validating cues suppressed when toggles off.

Integration notes:

- Keep options changes effective immediately for current session.

Demo description:

- Toggle sound/vibration off and confirm cues stop; toggle on and cues return.

## Step 9: Add bottom override button and modal actions

Objective:

- Provide minimal but available manual override controls.

Implementation guidance:

- Add small unobtrusive bottom button in session UI.
- Open modal with actions: `Skip rep`, `Skip rest`, `End set`, `End exercise`.
- Map each action to explicit state-machine transition handlers.

Test requirements:

- UI tests for button visibility and modal opening.
- Integration tests for each override action resulting state.

Integration notes:

- Modal should not obscure primary timer longer than necessary.

Demo description:

- Open modal and execute each action to verify immediate transition.

## Step 10: Final UI pass, acceptance validation, and regression tests

Objective:

- Align UI details with requirements and validate full behavior.

Implementation guidance:

- Remove `target:` and `active set:` text from session UI.
- Ensure all timers display tenths in all phases.
- Run full test suite and acceptance scenario checks (`prettier --check`, `lint`, unit, e2e).

Test requirements:

- End-to-end test from Start to full session complete with no manual progression taps.
- Regression checks for previous exercise-tracking behavior unaffected outside hold workflow.

Integration notes:

- Capture final acceptance checklist mapping test cases to design criteria.

Demo description:

- One-tap start runs entire routine with rests/advancement, pause/overrides, and no target/active-set labels.
