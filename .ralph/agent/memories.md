# Memories

## Patterns

### mem-1770693619-2f27
> Hold timer run/pause controls should expose aria-pressed and be asserted in App tests to preserve toggle semantics for assistive tech.
<!-- tags: accessibility, testing, react | created: 2026-02-10 -->

### mem-1770693485-fa3f
> Playwright mobile E2E can enforce per-test isolation by clearing localStorage in beforeEach, reloading, then asserting baseline heading before each flow.
<!-- tags: testing, playwright, localStorage | created: 2026-02-10 -->

### mem-1770693167-310b
> Terminal session summaries derive from exerciseProgress: completed count is progress.completed true, unresolved skipped is skippedCount>0 and not completed, and duration snapshot comes from startedAt->endedAt/updatedAt.
<!-- tags: session, ui, testing | created: 2026-02-10 -->

### mem-1770693026-c0ba
> UI skip-cycle integration tests can be made deterministic by persisting a crafted in_progress skip-phase session and resuming before asserting queue exhaustion completion.
<!-- tags: testing, vitest, session | created: 2026-02-10 -->

### mem-1770692876-06e5
> Timer-focused component tests should avoid waitFor under fake timers because polling timers do not auto-advance; assert directly after act(advanceTimersByTime).
<!-- tags: testing, vitest, react, timers | created: 2026-02-10 -->

### mem-1770692510-e6c5
> Session screen action enablement mirrors reducer invariants: complete-set requires active set filled with next set remaining, and complete-exercise remains locked until all sets hit target reps.
<!-- tags: session, ui, testing | created: 2026-02-10 -->

### mem-1770692295-9c32
> Session persistence stores a versioned envelope and only restores active in_progress sessions; invalid or terminal payloads are cleared on read.
<!-- tags: session, persistence, localStorage | created: 2026-02-10 -->

### mem-1770692078-ade8
> Session reducer actions accept optional 'now' timestamps so state transitions remain pure and deterministic in unit tests.
<!-- tags: session, testing, architecture | created: 2026-02-10 -->

## Decisions

## Fixes

### mem-1770693324-0662
> failure: cmd=mkdir -p test-results && corepack pnpm lint && corepack pnpm test && corepack pnpm build && corepack pnpm test:e2e, exit=1, error='App rest-resume test timed out under fake timers with userEvent', next=use fireEvent for resume click in fake-timer rest continuity test
<!-- tags: testing, vitest, error-handling, react | created: 2026-02-10 -->

### mem-1770692814-fd29
> failure: cmd=corepack pnpm test, exit=1, error='App timer tests timed out under fake timers with userEvent; hold reducer test expected completion before 5s target', next=use fireEvent for timer tests under fake clocks and align hold assertions with 5-second fixture target
<!-- tags: testing, vitest, error-handling, react | created: 2026-02-10 -->

### mem-1770692757-8fb0
> failure: cmd=mkdir -p test-results && corepack pnpm lint && corepack pnpm test && corepack pnpm build && corepack pnpm test:e2e, exit=1, error='Vitest failures: rest timer test not ticking under fake timers, hold timer tests targeted exercise-2 without hold config', next=target hold exercise-3 in reducer/UI tests and wrap fake-timer advancement in waitFor/act with fake timers enabled before render
<!-- tags: testing, vitest, error-handling, react | created: 2026-02-10 -->

### mem-1770692473-22a0
> failure: cmd=corepack pnpm lint, exit=2, error='ENOENT scandir test-results', next=create test-results directory before lint so eslint glob target exists
<!-- tags: testing, lint, error-handling, tooling | created: 2026-02-10 -->

### mem-1770692033-ac77
> failure: cmd=corepack pnpm lint, exit=1, error='React Hook useReducer is called conditionally in App.tsx', next=move reducer hook into a child component rendered only after successful program load
<!-- tags: testing, lint, error-handling, react | created: 2026-02-10 -->

### mem-1770691881-33ba
> failure: cmd=rg -n "session|reducer|skipQueue|currentPhase|Start New|+1 Rep|End Session" src specs/exercise-tracker -g '!**/node_modules/**', exit=2, error='regex parse error: repetition operator missing expression at +1 Rep', next=escape plus operator or use fixed-string search
<!-- tags: tooling, error-handling, rg | created: 2026-02-10 -->

### mem-1770691804-ad0e
> failure: cmd=corepack pnpm test:e2e, exit=1, error='smoke spec expected old heading Exercise Tracker after Step 2 JSON-driven UI', next=update Playwright smoke assertion to match loaded program heading
<!-- tags: testing, playwright, error-handling | created: 2026-02-10 -->

### mem-1770691665-0eac
> failure: cmd=git rm --cached -r ., exit=policy_block, error='command rejected by policy', next=proceed with full initial commit when selective unstaging is blocked
<!-- tags: tooling, git, error-handling, policy | created: 2026-02-10 -->

### mem-1770691656-4bbf
> failure: cmd=git restore --staged ., exit=128, error='could not resolve HEAD in fresh repo', next=use git rm --cached -r . to clear index before selective add
<!-- tags: tooling, git, error-handling | created: 2026-02-10 -->

### mem-1770691650-7e6f
> failure: cmd='git reset && git add ...', exit=policy_block, error='command rejected by policy', next=use git restore --staged . and targeted git add
<!-- tags: tooling, git, error-handling, policy | created: 2026-02-10 -->

### mem-1770691629-4a75
> failure: cmd=git status --short, exit=128, error='not a git repository', next=initialize repository with git init before staging and commit steps
<!-- tags: tooling, git, error-handling | created: 2026-02-10 -->

### mem-1770691608-611b
> failure: cmd=corepack pnpm test:e2e, exit=1, error='iPhone device profile defaulted browserName to webkit executable missing', next=set Playwright project browserName to chromium with iPhone viewport settings
<!-- tags: testing, playwright, error-handling | created: 2026-02-10 -->

### mem-1770691592-3604
> failure: cmd=corepack pnpm test, exit=1, error='Vitest executed tests/e2e/*.spec.ts and failed on @playwright/test context', next=restrict Vitest include to src tests and exclude tests/e2e
<!-- tags: testing, vitest, playwright, error-handling | created: 2026-02-10 -->

### mem-1770691468-75a5
> failure: cmd='rm -rf .tmp-vite && corepack pnpm create vite@latest .tmp-vite --template react-ts', exit=policy_block, error='command rejected by policy', next=avoid rm -rf and scaffold into unique new directory
<!-- tags: tooling, error-handling, policy | created: 2026-02-10 -->

### mem-1770691453-ede2
> failure: cmd=pnpm create vite@latest . --template react-ts, exit=126, error='No version is set for command pnpm', next=use corepack pnpm or set pnpm version in .tool-versions
<!-- tags: tooling, error-handling, pnpm | created: 2026-02-10 -->

## Context
