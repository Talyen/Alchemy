# Contributing

## Before you push

GitHub branch protection is not available on this repo, so **local hooks are the main gate**.

`lefthook` `pre-push` runs sequentially (`piped: true`):

1. `npm ci --dry-run`
2. `npm run lint:ci` (format, ESLint, knip)
3. `npm test` (Vitest)
4. `npm run build`
5. `npm run test:e2e:prepush` — same **@critical** Playwright suite as CI, against the **preview** build

Manual full gate (optional): `npm run check:push` (= `check` + critical e2e).

Install hooks once: `npm run prepare` (runs on `npm install`).

First-time Playwright: `npx playwright install chromium`.

## What to run when you change…

| Area | Paths (examples) | Run locally |
|------|------------------|-------------|
| Active run / screen / bootstrap | `active-run-store.ts`, `use-alchemy-run-controller.ts`, `hydrate.ts`, `run-session-facade.ts` | `npm test -- tests/features/stores/run-session-facade.test.ts tests/lib/active-run-session/hydrate.test.ts tests/architecture/active-run-bootstrap.test.ts` then `npm run test:e2e:prepush` |
| Save / persistence | `storage/`, `save-schemas/`, `active-run.ts` | `npm test -- tests/features/storage` + `tests/save-persistence.spec.ts` + `npm run test:e2e:prepush` |
| Battle / cards | `src/lib/battle/`, `src/lib/game-data/` | `npm test -- tests/lib/battle` + `tests/lib/game-data/descriptions-match-effects.test.ts` |
| UI flows | `screens/`, controllers | Relevant `tests/*.spec.ts` + `npm run test:e2e:prepush` |
| Any push to `main` | — | Rely on pre-push or `npm run check:push` |

## E2E helpers

- **`openGameModeSelect`** — retries Play if the menu unmounts during bootstrap.
- **`resumeCampaignRun`** — use for campaign resume; waits for destination when `currentScreen` was saved as `destination` instead of clicking Play during hydrate.

## CI parity

| Job | Local equivalent |
|-----|------------------|
| CI `e2e` | `npm run build && npm run test:e2e:prepush` |
| CI `e2e-full` (nightly / full) | `npm run test:e2e:preview` |

See [AGENTS.md](./AGENTS.md) for architecture and command reference.
