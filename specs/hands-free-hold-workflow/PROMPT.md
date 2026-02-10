# Objective

Implement the hands-free hold workflow defined in `specs/hands-free-hold-workflow/`.

## Scope

Build a deterministic timer-driven session flow for hold exercises that minimizes user interaction during workouts.

## Key Requirements

1. Hold phase counts down from per-exercise configured hold duration.
2. Automatic progression:

- hold -> rep rest -> next rep
- set complete -> set rest -> next set
- exercise complete -> exercise rest -> next exercise

3. `Start` runs the full routine flow (not single rep only).
4. Add `Pause`/`Resume` preserving exact remaining time.
5. Rep rest and set rest are independent settings; both default 30s.
6. Exercise rest is configurable and defaults to 30s.
7. Show tenths of seconds for all countdown phases.
8. Remove `target:` and `active set:` text labels from session UI.
9. Add options screen toggles for sound and vibration, both enabled by default.
10. Suspend timers when app is backgrounded or screen locks.
11. Attempt wake lock during active sessions when supported; no unsupported-warning UI.
12. Add small bottom button opening a modal with overrides:

- Skip rep
- Skip rest
- End set
- End exercise

## Acceptance Criteria (Given-When-Then)

1. Given a hold exercise with 20s target, when Start is pressed, then timer counts down from `20.0` to `0.0` in tenths.
2. Given hold reaches `0.0`, when completion occurs, then rep rest starts automatically.
3. Given rep/set rest not specified, when exercise is created, then both default to `30s` and are independently editable.
4. Given final rep of a set finishes, when transitions resolve, then set rest runs and next set starts automatically.
5. Given final set of an exercise finishes, when transitions resolve, then exercise rest runs and next exercise starts automatically.
6. Given Pause is tapped during active countdown, when paused, then remaining time is preserved exactly.
7. Given Resume is tapped, when resumed, then countdown continues from preserved remaining time.
8. Given session UI is visible, when rendering labels, then `target:` and `active set:` are not shown.
9. Given options screen first load, when values are read, then sound and vibration are both enabled.
10. Given app background/lock event during active timer, when lifecycle event is handled, then timer suspends.
11. Given wake lock is supported, when active session starts, then wake lock is requested during active phases.
12. Given wake lock is unsupported, when active session starts, then session continues with no warning message.
13. Given override modal action is selected, when action executes, then state transitions correctly.

## Testing Expectations

- Add and enforce Prettier formatting checks as part of the quality gate.
- Add/extend unit tests for state transitions, defaults, pause/resume, lifecycle suspension.
- Add integration/E2E tests for full auto progression across reps, sets, exercises.
- Validate tenths rendering in all phases.

## Quality Gate

- Before and after each implementation step, run:
  - `corepack pnpm prettier --write` (or equivalent format command)
  - `corepack pnpm prettier --check .`
  - `corepack pnpm lint`
  - `corepack pnpm test`
  - `corepack pnpm test:e2e`

## References

- `specs/hands-free-hold-workflow/requirements.md`
- `specs/hands-free-hold-workflow/design.md`
- `specs/hands-free-hold-workflow/plan.md`
