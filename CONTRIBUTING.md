# Contributing

## Before you push

GitHub branch protection is not available on this repo, so **local hooks are the main gate**.

`lefthook` `pre-push` runs sequentially (`piped: true`):

1. `npm ci --dry-run`
2. `npm run lint:ci` (format, ESLint, knip)
3. `npm test` (Vitest)
4. `npm run build`
5. `npm run test:e2e:prepush` — fast **@prepush** subset (9 tests, parallel preview build; includes one animation canary)

**Before pushing to `main`**, also run `npm run test:e2e:prepush:full` (`@critical`, preview + CI flags). The pre-push hook only runs `@prepush`; CI on `main` runs the broader `@critical` suite (~40 tests). If using a PR branch, run the same before opening the PR.

Manual full gate before **`main`**: `npm run test:e2e:main-gate` (full suite, same as CI `e2e-full`). Lighter checks: `npm run check:push` or `npm run test:e2e:prepush:full` (`@critical` only).

Install hooks once: `npm run prepare` (runs on `npm install`).

First-time Playwright: `npx playwright install chromium`.

**PowerShell command chaining:** use `; if ($?) { next-command }` — `;` alone ignores exit codes on Windows ([AGENTS.md](../AGENTS.md)).

## What to run when you change…

| Area | Paths (examples) | Run locally |
|------|------------------|-------------|
| Active run / screen / bootstrap | `run-domain-store.ts`, `run-transitions.ts`, `shell/use-alchemy-run-controller.ts`, `hydrate.ts` | `npm test -- tests/features/stores/ tests/features/shell/ tests/lib/active-run-session/hydrate.test.ts tests/architecture/active-run-bootstrap.test.ts` then `npm run test:e2e:prepush` |
| Save / persistence | `storage/`, `save-schemas/`, `active-run.ts` | `npm test -- tests/features/storage` + `tests/save-persistence.spec.ts` + `npm run test:e2e:prepush` |
| Battle / cards | `src/lib/battle/`, `src/lib/game-data/` | `npm test -- tests/lib/battle` + `tests/lib/game-data/descriptions-match-effects.test.ts` |
| Integration-style unit tests | `run-domain.test.ts`, `storage.test.ts`, `reward-flow*.test.ts`, `shell/*-hook.test.ts` | `npm test -- tests/features/stores/run-domain.test.ts tests/features/storage tests/features/navigation/reward-flow tests/features/shell` |
| Battle E2E helpers | `tests/pages/battle-page.ts`, `tests/helpers.ts` (`enableFastMode`) | `npm run test:e2e:prepush` (animation canary) + `npm run test:e2e:main-gate` before pushing to `main` |
| UI flows | `screens/`, controllers | Relevant `tests/*.spec.ts` + `npm run test:e2e:prepush` |
| Any push to `main` | — | Pre-push hook + `npm run test:e2e:main-gate` when battle/helpers change |

## E2E helpers

- **`openGameModeSelect`** — retries Play if the menu unmounts during bootstrap.
- **`resumeCampaignRun`** — use for campaign resume; waits for destination when `currentScreen` was saved as `destination` instead of clicking Play during hydrate.
- **`enableFastMode`** — disables animations; safe for most battle tests. Do **not** use in `battle-end-turn-canary.spec.ts` or animation-focused specs.
- **`BattlePage.endTurn`** — must work with animations off (fast tests) and on (canary + full suite). Changing it requires the prepush canary to pass.
- **Do not** use `skipCombatToVictory()`, `skipCombatBtn`, or target Skip Combat / Unlock All strings in e2e specs — hidden in preview/production; use `winViaCombat()` or `playCardNamed()`.

## CI parity

| Job | Local equivalent |
|-----|------------------|
| CI `e2e` | `npm run build && npm run test:e2e:prepush:full` |
| Pre-push hook | `npm run build && npm run test:e2e:prepush` |
| CI `e2e-full` (push to `main` only, 4 shards) | `npm run test:e2e:main-gate` |

On `main` push, CI skips the redundant `e2e` (`@critical`) job because `e2e-full` is a superset.

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [docs/REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [PROMPTS.md](./PROMPTS.md) (audits)
