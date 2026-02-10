# Exercise Session Tracker

Mobile-first React app for running an exercise session from a JSON prescription.

## Stack

- `pnpm`
- `Vite` + React + TypeScript
- `Vitest` + Testing Library
- `Playwright` (mobile profile)

## Features

- Loads prescription data from `src/data/program.json`.
- Enforces ordered primary pass through exercises.
- Supports skipping exercises and automatic skipped-cycle revisit.
- Tracks reps per set (`x/target reps`) and supports undo.
- Supports hold-based exercises where a completed hold counts as one rep.
- Shows between-set rest timer and explicit `Start Next Set` transition.
- Persists in-progress session state in `localStorage`.
- Prompts `Resume` vs `Start New` on reload when an active session exists.
- Supports de-emphasized `End Session Early` with terminal summary.

## Accessibility and Hardening Notes

- Buttons use visible `:focus-visible` outlines for keyboard navigation.
- Hold timer toggle exposes `aria-pressed` state (`Start Hold` / `Pause Hold`).
- Touch targets use a minimum control height for mobile usability.
- Persistence uses a versioned envelope and safely discards invalid/corrupt payloads.

## Getting Started

1. Install dependencies:

```bash
corepack pnpm install
```

2. Start dev server:

```bash
corepack pnpm dev
```

## Scripts

- `corepack pnpm prettier --check .` (when Prettier is added/configured)
- `corepack pnpm prettier --write .` (when Prettier is added/configured)
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm test:e2e`

## Final Verification Pipeline

Run the full regression check:

```bash
mkdir -p test-results && corepack pnpm prettier --check . && corepack pnpm lint && corepack pnpm test && corepack pnpm build && corepack pnpm test:e2e
```

## Known Limitations

- The app assumes a single active local session in browser `localStorage` (no multi-user/session switching UI).
- No remote sync or account-backed persistence.
- Timer progression is client-driven; background tab throttling can affect perceived real-time cadence.
