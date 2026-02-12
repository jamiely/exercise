# Objective

Implement the full todo backlog using the spec package in `specs/todo-execution/`.

Reference documents:

- `specs/todo-execution/requirements.md`
- `specs/todo-execution/design.md`
- `specs/todo-execution/plan.md`

## Scope

Deliver all planned items in phased order:

1. Timer correctness and pause consistency
2. Rest timer `+` control and cue reliability
3. Explicit start and swipe-to-dismiss rest
4. Restart current exercise and restart current set
5. Timer visibility across all timed phases
6. Exercise transition animation polish
7. README badges and screenshots

## Key Requirements

- Pause freezes all timed phases and resume continues from exact remaining value.
- Timed exercise does not auto-start; explicit user action is required.
- Rest dismissal via swipe is safe and idempotent near phase boundaries.
- Restart actions are scope-safe (set-only vs exercise-only).
- Any timed state must render a visible countdown.
- Cue dispatch is settings-aware.
- Transition animation respects reduced-motion preference.

## Acceptance Criteria (Given-When-Then)

1. Given an active timed phase, when paused, then timer value does not change.
2. Given paused state at value X, when resumed, then same phase continues from X.
3. Given rest controls visible, when `+` is tapped, then rest duration increases by configured step.
4. Given timed exercise entry, when user has not started, then countdown remains idle.
5. Given active rest phase, when user swipes dismiss, then exactly one valid next-phase transition occurs.
6. Given progress in current exercise, when restart exercise is used, then only current exercise resets.
7. Given progress in current set, when restart set is used, then only current set resets.
8. Given any timed phase, when UI renders, then a visible timer is shown.
9. Given exercise progression, when moving to next exercise, then transition animation appears unless reduced motion is enabled.
10. Given updated README, when viewed, then CI badges and screenshots are valid and current.

## Engineering Constraints

- Add/update unit tests for domain and transition logic changes.
- Add/update Playwright tests for every user-visible behavior change.
- Keep test coverage >= 90% for statements, branches, functions, and lines.
- Run and pass lint, unit tests, coverage, and e2e for code changes.
- Implement incrementally following `specs/todo-execution/plan.md`.

## Deliverables

- Production code changes implementing all scoped features/fixes.
- Updated and passing unit and Playwright suites.
- Updated `README.md` with CI badges and screenshots.
