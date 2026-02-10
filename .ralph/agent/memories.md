# Memories

## Patterns

## Decisions

## Fixes

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
