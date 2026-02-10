# Objective
Implement a mobile-optimized React exercise-session tracker using `pnpm`, `Vite`, `Vitest`, and `Playwright`, based on specs in `specs/exercise-tracker/`.

# Scope Reference
Use these source artifacts as the contract:
- `specs/exercise-tracker/design.md`
- `specs/exercise-tracker/plan.md`
- `specs/exercise-tracker/requirements.md`
- `specs/exercise-tracker/research/`

# Key Requirements
- Load exercise prescriptions from a JSON file.
- Follow strict exercise order during primary pass.
- Allow skipping exercises; automatically revisit skipped exercises after primary pass.
- Continue skipped-cycle until all exercises complete or user ends early.
- Show target sets/reps/hold duration for each exercise.
- Track completed reps as fraction (e.g., `0/12 reps`).
- Hold completion counts as one rep for hold-based exercises.
- Show sets and mark set completion.
- Show incrementing rest timer between sets.
- Persist in-progress session state in localStorage.
- On reload with active session, prompt user to `Resume` or `Start New`.
- Include `End Session Early` as a de-emphasized action.
- Mobile-first layout and touch-friendly controls.
- Add automated tests with both Vitest and Playwright.

# Acceptance Criteria (Given-When-Then)
1. Ordered progression
Given valid exercise JSON
When user starts a new session
Then first exercise is the earliest ordered item and progression follows order.

2. Skip and revisit
Given one or more skipped exercises in primary pass
When primary pass ends
Then app automatically cycles through skipped exercises until queue is empty (unless ended early).

3. Rep tracking display
Given a rep-based exercise
When user taps `+1 Rep`
Then rep display updates as `x/target reps` for active set.

4. Hold-as-rep behavior
Given a hold-based exercise with target hold duration
When hold completes successfully
Then completed reps increments by 1.

5. Between-set rest timer
Given a non-final set is completed
When app transitions between sets
Then a rest timer is shown and increments until next set starts.

6. Resume vs new
Given an in-progress session exists in localStorage
When app is reopened
Then user is prompted to resume or start new.

7. Early end flow
Given an active session
When user chooses `End Session Early`
Then session ends with `ended_early` status and summary view.

8. JSON-driven updates
Given JSON prescription values change
When a new session starts
Then targets displayed in UI match updated JSON.

9. Full completion
Given all required exercises are completed and skip queue is empty
When final exercise completes
Then session status is `completed` and completion summary is shown.

10. Test coverage
Given the implemented app
When test suites run
Then Vitest covers domain/persistence logic and Playwright verifies mobile E2E flows.

# Execution Notes
- Implement incrementally using `specs/exercise-tracker/plan.md` steps.
- Keep app functional at each step; avoid orphaned code.
- Prefer deterministic timer testing (mocked clock in unit tests).
- Ensure Playwright tests run against a mobile viewport profile.
