# Todo Execution Plan

## Goal

Ship all listed UX and timer-flow improvements with clear sequencing, acceptance criteria, and quality gates.

## Global Quality Gates

- [ ] Run `npm run lint` before and after each completed phase.
- [ ] Run `npm run test` after each completed phase.
- [ ] Run `npm run test:coverage` after each completed phase and keep statements/branches/functions/lines >= 90%.
- [ ] Add or update Playwright tests for every user-visible behavior change.
- [ ] Run `npm run test:e2e` at the end of each phase.
- [ ] Run `npm run format` (or Prettier equivalent) before finalizing each phase.

## Phase 1: Timer Correctness and Session Control (P0)

### 1. Pause must freeze all timers

- [ ] Ensure pause affects hold, rest-between-reps, rest-between-sets, and between-exercise timers.
- [ ] Fix regression where progression is paused but rest timer continues counting.
- [ ] Add unit tests for pause/resume across every timer phase.
- [ ] Add Playwright flow that pauses mid-rest, waits, resumes, and verifies unchanged remaining time.

Acceptance criteria:

- [ ] No timer value changes while paused.
- [ ] Resume continues from exact remaining time and correct phase.

### 2. Fix `+` button next to rest timer

- [ ] Reproduce the broken behavior and document expected increment behavior.
- [ ] Fix the handler/state update path.
- [ ] Add unit tests for increment control boundaries.
- [ ] Add Playwright assertion that tapping `+` updates visible rest duration correctly.

Acceptance criteria:

- [ ] `+` reliably increases rest timer according to configured step size.
- [ ] Change persists through active session transitions where applicable.

### 3. Investigate sound/vibration cues

- [ ] Verify whether cues are implemented for phase start/end and key transitions.
- [ ] If implemented, fix trigger timing or platform wiring.
- [ ] If missing, implement minimal reliable cue pipeline with settings-aware behavior.
- [ ] Add unit tests for cue dispatch by event type.
- [ ] Add Playwright coverage for cue settings flow (UI state and dispatch stubs/mocks).

Acceptance criteria:

- [ ] Cues fire at intended transition points.
- [ ] Disabled settings suppress cue dispatch.

## Phase 2: Flow and Interaction Improvements (P1)

### 4. Require explicit start for timed exercise

- [ ] Prevent timed exercises from auto-starting on entry.
- [ ] Add a clear CTA to begin timing.
- [ ] Ensure state machine does not start countdown until explicit user action.
- [ ] Add unit tests for no-auto-start invariant.
- [ ] Add Playwright flow verifying timer stays idle until user starts.

Acceptance criteria:

- [ ] Timer remains idle on entry.
- [ ] Countdown begins only from explicit user action.

### 5. Add swipe to dismiss rest period

- [ ] Implement gesture to skip/dismiss current rest phase.
- [ ] Confirm behavior with pause state and edge cases (e.g., near-zero remaining time).
- [ ] Add unit tests for transition safety when rest is dismissed.
- [ ] Add Playwright mobile-flow test for swipe gesture.

Acceptance criteria:

- [ ] Swipe dismiss always transitions to the correct next phase.
- [ ] No duplicate transitions or skipped indexes.

### 6. Add restart current exercise option

- [ ] Add control in Settings to restart current exercise.
- [ ] Reset rep/set counters and timer state for current exercise only.
- [ ] Add confirmation UX if destructive.
- [ ] Add unit tests for scoped reset behavior.
- [ ] Add Playwright flow for restart current exercise path.

Acceptance criteria:

- [ ] Current exercise restarts cleanly without affecting prior/future exercise definitions.

### 7. Add restart current set option

- [ ] Add control to restart current set.
- [ ] Reset rep index and set-local timers only.
- [ ] Add unit tests verifying set-local reset boundaries.
- [ ] Add Playwright flow for restart current set path.

Acceptance criteria:

- [ ] Set restarts cleanly and remains within same exercise/set context.

## Phase 3: Timer Visibility and UX Consistency (P1)

### 8. Add clear between-exercise timer indication

- [ ] Implement explicit between-exercise timer UI component/state.
- [ ] Ensure formatting matches other timers.
- [ ] Add unit tests for rendering and phase mapping.
- [ ] Add Playwright assertion for between-exercise timer visibility.

Acceptance criteria:

- [ ] Users can always identify when they are in between-exercise rest and see remaining time.

### 9. Add visible timer between sets

- [ ] Ensure set-rest timer is always visible when active.
- [ ] Remove ambiguous/hidden states.
- [ ] Add unit tests for set-rest display lifecycle.
- [ ] Add Playwright assertion for set-rest timer visibility.

Acceptance criteria:

- [ ] Active timed set-rest phase always shows a countdown.

### 10. Enforce UX rule: timed state must show timer

- [ ] Audit all timed states and map UI coverage.
- [ ] Add shared guard/component contract so timed phases cannot render without countdown.
- [ ] Add regression tests for each timed phase.
- [ ] Add Playwright end-to-end assertion matrix for timer visibility in every phase.

Acceptance criteria:

- [ ] No timed phase exists without a visible timer.

## Phase 4: Motion and Presentation (P2)

### 11. Add animated page-swipe transition between exercises

- [ ] Implement transition animation when progressing to next exercise.
- [ ] Keep animation performance stable on mobile.
- [ ] Respect reduced-motion preferences.
- [ ] Add Playwright visual/behavior assertion for transition trigger.

Acceptance criteria:

- [ ] Exercise-to-exercise transition animates reliably without blocking controls.

### 12. README polish

- [ ] Add CI badges to `README.md`.
- [ ] Capture and add screenshots using Playwright.
- [ ] Verify screenshots and text reflect current product behavior.

Acceptance criteria:

- [ ] README contains working badges and current UI screenshots.

## Delivery Sequence

- [ ] Complete Phase 1 fully before starting Phase 2.
- [ ] Complete Phase 2 fully before starting Phase 3.
- [ ] Complete Phase 3 fully before starting Phase 4.
- [ ] After each phase: run lint, unit tests, coverage, e2e, and formatting.
- [ ] Commit after each completed feature/task.

## Risks and Watchpoints

- [ ] Phase transition race conditions when dismissing rest near timer completion.
- [ ] Timer drift under pause/resume and browser lifecycle events.
- [ ] Cross-device gesture behavior differences for swipe dismiss.
- [ ] Cue APIs varying by platform/browser permissions.

## Final Exit Criteria

- [ ] All tasks completed and checked.
- [ ] All tests/lint/coverage/e2e passing.
- [ ] Coverage remains >= 90% for statements, branches, functions, lines.
- [ ] Documentation updated and accurate.
