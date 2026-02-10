# Implementation Plan

## Checklist

- [ ] Step 1: Initialize project and test foundations
- [ ] Step 2: Add program JSON schema and loader
- [ ] Step 3: Implement session domain model and reducer
- [ ] Step 4: Add localStorage persistence and resume prompt
- [ ] Step 5: Build core mobile session screen (rep/set tracking)
- [ ] Step 6: Add hold timer and rest timer behaviors
- [ ] Step 7: Implement skip queue cycle and completion logic
- [ ] Step 8: Add end-early flow and session summaries
- [ ] Step 9: Expand Vitest coverage for domain and UI integration
- [ ] Step 10: Add Playwright E2E coverage on mobile viewport
- [ ] Step 11: Hardening, accessibility checks, and final verification

## Step 1: Initialize project and test foundations

Objective:
Create the React + Vite baseline with pnpm, Vitest, and Playwright configured and runnable.

Implementation guidance:

- Scaffold Vite React app.
- Configure Vitest with jsdom and testing-library setup.
- Configure Playwright project with a mobile profile baseline.
- Add scripts for dev, build, unit tests, and E2E tests.

Test requirements:

- Add a smoke Vitest test that renders app shell.
- Add a smoke Playwright test asserting app home loads.

Integration notes:

- Keep initial app minimal but fully runnable so every next step integrates into a working baseline.

Demo description:
Run one command sequence showing app boot and both test suites executing basic smoke tests.

## Step 2: Add program JSON schema and loader

Objective:
Introduce JSON-driven exercise data with validation and deterministic ordering.

Implementation guidance:

- Create exercise JSON fixture based on the knee program.
- Build parser/validator for required fields and type checks.
- Sort/normalize exercises by `order` at load time.

Test requirements:

- Unit tests for valid load, missing field failure, duplicate id/order rejection.

Integration notes:

- Wire loader into app startup and show blocking error state on invalid data.

Demo description:
App displays first exercise from JSON and shows clear error if JSON is intentionally malformed.

## Step 3: Implement session domain model and reducer

Objective:
Implement the deterministic session state machine and action reducer.

Implementation guidance:

- Define session states/phases, cursors, and skip queue behavior.
- Add actions for start, increment rep, complete set, complete exercise, skip, end early, finish session.
- Keep reducer pure and side effects outside reducer.

Test requirements:

- Comprehensive reducer tests for ordered progression, skip enqueue/dequeue, and final completion.

Integration notes:

- Integrate reducer into app state provider/hook while preserving current UI behavior.

Demo description:
Trigger reducer actions via temporary debug controls and verify expected state transitions.

## Step 4: Add localStorage persistence and resume prompt

Objective:
Persist in-progress sessions and implement startup resume/new decision flow.

Implementation guidance:

- Implement persistence adapter with version key and safe parsing.
- Persist after each meaningful state mutation.
- On boot, detect active session and show resume prompt modal/screen.

Test requirements:

- Unit tests for read/write/clear plus corrupt-data fallback.
- Integration test for prompt visibility when active session exists.

Integration notes:

- Ensure start-new path replaces stale active session cleanly.

Demo description:
Make progress, reload app, and show resume/start-new prompt functioning as specified.

## Step 5: Build core mobile session screen (rep/set tracking)

Objective:
Deliver the primary in-session UI for rep and set tracking in mobile-first layout.

Implementation guidance:

- Implement active exercise card, set tracker, rep display `x/target`, and `+1 Rep`/undo controls.
- Highlight active set and lock complete-exercise action until criteria met.
- Ensure responsive layout for common phone viewport widths.

Test requirements:

- Component tests for rep increment/decrement, set display updates, active set highlighting.

Integration notes:

- Use real reducer state and persistence hooks; avoid parallel temporary state.

Demo description:
Track reps through one exercise and visually confirm set progression behavior.

## Step 6: Add hold timer and rest timer behaviors

Objective:
Implement hold-based rep completion and between-set incrementing rest timer.

Implementation guidance:

- Add hold timer controls and target/elapsed UI for hold exercises.
- On successful hold completion, increment rep for active set.
- Add rest timer that starts after non-final set completion and increments until next set starts.

Test requirements:

- Timer utility tests with mocked time.
- UI tests for timer visibility and reset behavior per set transition.

Integration notes:

- Timer state must survive rerender and persist snapshots for session resume.

Demo description:
Complete hold exercise reps and show rest timer incrementing between sets.

## Step 7: Implement skip queue cycle and completion logic

Objective:
Enable skipping in primary pass and automatic revisit loop for skipped exercises.

Implementation guidance:

- Add skip action on session screen.
- During primary pass, enqueue skipped exercises and continue ordered progression.
- After end of primary list, auto-enter skip pass and process queue until empty.

Test requirements:

- Reducer and integration tests for skip/re-skip behavior and queue exhaustion completion.

Integration notes:

- Preserve clear phase indicators (`Primary` vs `Skipped`) in UI.

Demo description:
Skip multiple exercises in first pass and verify automatic return to skipped set at end.

## Step 8: Add end-early flow and session summaries

Objective:
Provide non-primary early-end action and clear terminal summaries.

Implementation guidance:

- Add de-emphasized `End Session Early` action.
- Implement ended-early summary and completed summary screens.
- Include totals (completed exercises, skipped unresolved, duration snapshot).

Test requirements:

- Integration tests for ended-early and completed outcomes.
- Assert early-end control is present but visually secondary.

Integration notes:

- Terminal transitions should stop active timers and finalize persistence state.

Demo description:
End a session early and show ended-early summary; separately complete full session and show completion summary.

## Step 9: Expand Vitest coverage for domain and UI integration

Objective:
Raise confidence with robust unit/integration coverage across critical logic paths.

Implementation guidance:

- Add full reducer matrix tests.
- Add persistence/recovery edge-case tests.
- Add UI integration tests around resume prompt and state continuity.

Test requirements:

- Coverage includes all acceptance criteria branches at unit/integration level.

Integration notes:

- Keep test fixtures stable and deterministic for maintainability.

Demo description:
Run Vitest suite and show all core acceptance scenarios passing.

## Step 10: Add Playwright E2E coverage on mobile viewport

Objective:
Validate real-browser functional behavior for critical user journeys.

Implementation guidance:

- Add mobile-emulated E2E specs for:
  - start session and ordered progression
  - rep/set updates
  - hold timer path
  - skip/revisit cycle
  - resume prompt path
  - end-early path
- Use isolated storage state per test.

Test requirements:

- E2E tests assert visible outputs and state continuity after reload.

Integration notes:

- Keep E2E data fixture controlled to avoid flaky assertions.

Demo description:
Execute Playwright suite and show full in-session behavior verified on mobile viewport.

## Step 11: Hardening, accessibility checks, and final verification

Objective:
Finalize reliability and polish before handoff.

Implementation guidance:

- Run final lint/test/build pipeline.
- Verify touch targets, contrast, and keyboard/focus behavior for essential controls.
- Confirm localStorage schema/version handling and migration fallback behavior.

Test requirements:

- Final regression run: Vitest + Playwright green.
- Manual QA pass for mobile usability and timer behavior.

Integration notes:

- Update docs/readme with run/test instructions and known limitations.

Demo description:
Provide final walkthrough from start session to completion/early-end with successful automated test runs.
