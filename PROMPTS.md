# Alchemy — Agent prompt stubs

Copy a section into your agent with the PR diff or target paths attached. Full rules live in **[AGENTS.md](./AGENTS.md)**; implementation steps in **[docs/WORKFLOWS.md](./docs/WORKFLOWS.md)**; run-state details in **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

**Pre-PR:** `npm run lint:ci && npm test` · **Full gate:** `npm run check:push` ([CONTRIBUTING.md](./CONTRIBUTING.md))

---

## Code reduction audit

Audit for dead code, duplication, and unnecessary abstraction. Run `npm run deadcode`. See [AGENTS.md — Large / Generated / Heavy Files](./AGENTS.md#large--generated--heavy-files).

**When done:** `npm run lint:ci && npm test`

---

## Type safety audit

Hunt `any`, `@ts-expect-error`, and unsafe casts in changed files. Prefer narrowing and Zod at persistence boundaries. See [AGENTS.md — Key Conventions](./AGENTS.md#key-conventions).

**When done:** `npm run lint:ci && npm test`

---

## Import boundary audit

Verify changed files respect layers in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md#import-boundaries). Run `npm run lint`.

**When done:** `npm run lint:ci`

---

## New card / effect audit

Follow [WORKFLOWS.md — task index](./docs/WORKFLOWS.md#task-index) and `src/lib/game-data/effects/BATTLE_HANDLERS.md`. One handler per effect kind in `lib/battle/effect-handlers/`.

**When done:** `npm test -- tests/lib/game-data/descriptions-match-effects.test.ts && npm test -- tests/lib/battle`

---

## Save / migration audit

Follow [WORKFLOWS.md — change persisted save data](./docs/WORKFLOWS.md#change-persisted-save-data). Update Zod schemas, `snapshotRun` / `restoreRun`, and storage tests.

**When done:** `npm test -- tests/features/storage`

---

## Screen / route audit

New screens: `run-loop/screens/` or `meta/screens/` → `shared/screens/index.ts` → `src/app/screen-routes/`. No `React.lazy` on routes. See [WORKFLOWS.md — adding a new screen](./docs/WORKFLOWS.md#adding-a-new-screen).

**When done:** `npm run lint:ci && npm test`
