# Implementation Plan: Todo Execution

Source: `todo list.md`

## Checklist

- [ ] Step 0: Enforce global quality gates for every phase
- [ ] Step 1: Timer correctness and pause consistency
- [ ] Step 2: Rest timer controls and cue reliability
- [ ] Step 3: Explicit start and gesture-based rest dismissal
- [ ] Step 4: Restart controls for current exercise and set
- [ ] Step 5: Timer visibility consistency across all timed phases
- [ ] Step 6: Exercise transition motion polish
- [ ] Step 7: README polish with CI badges and screenshots
- [ ] Step 8: Final regression and release readiness

## Step 0: Enforce global quality gates for every phase

Objective:

- Keep quality stable while delivering each todo item.

Implementation guidance:

- For each completed phase, run `npm run lint`, `npm run test`, `npm run test:coverage`, `npm run test:e2e`, and formatting.
- Keep coverage in statements/branches/functions/lines at or above 90%.
- Add or update Playwright tests for every user-visible behavior change.

Test requirements:

- All quality gate commands pass at each phase boundary.

Integration notes:

- Do not advance phases with failing checks.

Demo description:

- At any checkpoint, repository is in a releasable state.

## Step 1: Timer correctness and pause consistency

Objective:

- Ensure pause freezes all active timers and progression correctly.

Implementation guidance:

- Fix pause behavior for hold, rest-between-reps, rest-between-sets, and between-exercise timers.
- Resolve regression where rest countdown continues while paused.

Test requirements:

- Add unit tests for pause/resume for each phase.
- Add Playwright scenario pausing mid-rest, waiting, and resuming from unchanged remaining time.

Integration notes:

- Preserve exact remaining time and active phase on resume.

Demo description:

- Pause at a visible value, wait, resume, and continue from same value.

## Step 2: Rest timer controls and cue reliability

Objective:

- Fix broken rest increment control and make sound/vibration cues reliable.

Implementation guidance:

- Fix the `+` control near rest timer and validate update path and boundaries.
- Verify cue implementation for phase transitions; fix trigger timing/wiring or implement missing event dispatch.
- Ensure settings can suppress cue dispatch.

Test requirements:

- Unit tests for rest increment boundaries.
- Unit tests for cue dispatch by transition type.
- Playwright checks for rest `+` behavior and cue settings flow.

Integration notes:

- Ensure rest control changes persist through session transitions where expected.

Demo description:

- User can adjust rest as expected and cues reflect transition + settings behavior.

## Step 3: Explicit start and gesture-based rest dismissal

Objective:

- Improve user control at exercise entry and during rest.

Implementation guidance:

- Prevent timed exercises from auto-starting on entry.
- Add clear start CTA for timed exercise.
- Implement swipe-to-dismiss for active rest phases with safe transitions.

Test requirements:

- Unit tests for no-auto-start invariant.
- Unit tests for safe transition when dismissing rest near completion.
- Playwright mobile tests for explicit start and swipe dismissal.

Integration notes:

- Prevent duplicate or race-condition transitions.

Demo description:

- Timer remains idle until explicit start; swipe dismiss moves cleanly to next phase.

## Step 4: Restart controls for current exercise and set

Objective:

- Add targeted restart controls without global session corruption.

Implementation guidance:

- Add settings option to restart current exercise.
- Add option to restart current set.
- Scope resets to proper boundaries (exercise-level vs set-level) with confirmation if destructive.

Test requirements:

- Unit tests for reset scoping rules.
- Playwright flows for both restart paths.

Integration notes:

- Do not mutate unrelated progress state.

Demo description:

- Restarting exercise/set cleanly resets intended scope only.

## Step 5: Timer visibility consistency across all timed phases

Objective:

- Ensure every timed phase has clear countdown visibility.

Implementation guidance:

- Add/confirm visible between-exercise timer indication.
- Add/confirm visible between-set timer indication.
- Enforce invariant: timed state must render timer display.

Test requirements:

- Unit tests for phase-to-UI mapping.
- Playwright assertion matrix verifying visible timer for each timed phase.

Integration notes:

- Reuse shared timer presentation where possible to reduce drift.

Demo description:

- User always sees countdown whenever time is actively tracked.

## Step 6: Exercise transition motion polish

Objective:

- Add animated page-swipe transition between exercises.

Implementation guidance:

- Implement transition animation on exercise change.
- Keep performance stable on mobile and support reduced-motion preferences.

Test requirements:

- Playwright behavior checks for transition trigger and interaction continuity.

Integration notes:

- Animation must not block controls or timing logic.

Demo description:

- Exercise changes feel deliberate with smooth, non-blocking motion.

## Step 7: README polish with CI badges and screenshots

Objective:

- Update project documentation to match shipped behavior.

Implementation guidance:

- Add CI badges to `README.md`.
- Capture and insert current screenshots via Playwright.

Test requirements:

- Verify referenced badges and screenshots resolve correctly.

Integration notes:

- Keep README aligned to current UX and controls.

Demo description:

- README includes trustworthy status badges and representative UI visuals.

## Step 8: Final regression and release readiness

Objective:

- Close the plan with full-system confidence.

Implementation guidance:

- Run full lint/unit/coverage/e2e/format pass.
- Re-verify coverage remains >= 90% across all categories.
- Confirm all checklist items and acceptance criteria are complete.

Test requirements:

- Full suite passes with no failing checks.

Integration notes:

- Address flaky behavior before marking complete.

Demo description:

- End-to-end workflow operates correctly with all planned enhancements.
