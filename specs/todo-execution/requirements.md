# Requirements

## Scope

Transform all items in `todo list.md` into production-ready changes with clear acceptance criteria, testing expectations, and rollout order.

## Functional Requirements

1. Pause behavior correctness

- Pause must freeze all active countdowns/timers: hold, between-rep rest, between-set rest, between-exercise rest.
- Resume must continue from exact remaining time and correct phase.

2. Rest timer increment control

- The `+` control beside rest timer must reliably increase rest duration by configured step size.
- Behavior must be deterministic across session transitions.

3. Sound and vibration cues

- Cues must trigger at intended phase-transition events.
- If cues are disabled in settings, no cue dispatch should occur.

4. Explicit start for timed exercise

- Timed exercise entry must not auto-start countdown.
- Countdown starts only on explicit user action.

5. Swipe to dismiss rest

- User can dismiss active rest via swipe gesture.
- Dismissal must always route to valid next phase and prevent duplicate transitions.

6. Restart current exercise

- Settings must expose restart-current-exercise action.
- Action resets current exercise state only (scoped reset).

7. Restart current set

- Settings must expose restart-current-set action.
- Action resets set-local progress only (scoped reset).

8. Between-exercise timer visibility

- Between-exercise rest must show an explicit countdown state.

9. Between-set timer visibility

- Between-set rest must show an explicit countdown state.

10. Timed-phase visibility rule

- Any active timed phase must render a visible timer.

11. Exercise-to-exercise transition animation

- Exercise transitions should include a page-swipe style animation.
- Reduced-motion accessibility preference must be respected.

12. README updates

- Add CI badges.
- Add current UI screenshots captured via Playwright.

## Non-Functional Requirements

- All production code changes must preserve >= 90% coverage in statements/branches/functions/lines.
- Add/update Playwright coverage for every user-visible behavior change.
- Preserve mobile-first performance and control responsiveness.
- Avoid introducing timer drift or lifecycle race regressions.

## Constraints

- Plan/spec artifacts in `specs/` are markdown-only and do not require lint/test/coverage/e2e gates unless explicitly requested.
- Implementation work must remain phase-ordered to reduce regression risk.

## Success Criteria

- Every todo item is mapped to an implemented feature/fix and a passing test path.
- No timed state exists without visible countdown feedback.
- Known pause/resume and timer-control regressions are eliminated.
