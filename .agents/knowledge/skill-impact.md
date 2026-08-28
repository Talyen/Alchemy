# Skill Change History

Lightweight ledger to prevent re-proposing failed instruction changes. Document only accepted, rejected, or superseded skill/doc promotions.

## 2026-08-28 — Establish persistent knowledge system

Pattern: N/A (bootstrap)
Proposal: Add `.agents/knowledge/` (index + 6 patterns + skill-impact) and `.agents/evals/` scaffold; slim `AGENTS.md` 87→~62 lines to router + universal constraints.
Result: accepted
Evidence: `AGENTS.md` diff; `measure:agent-context` preread reduction; `docs:check` passes.
Reason: Separate router / active procedure / institutional memory per WikiSkill layers without bloating normal context.

## 2026-08-28 — AGENTS.md slimming

Pattern: `run-state-command-boundary`, `save-migration-contract`, `static-route-imports`
Proposal: Remove verbose `Bounded discovery`, `Change guards`, `Environment and failures`, and `UI` detail from `AGENTS.md`; keep one-line invariants with links to owners.
Result: accepted
Evidence: All removed text already owned by `ARCHITECTURE.md`, `WORKFLOWS.md`, `REFERENCE.md`, `CONTRIBUTING.md`, and lint/boundary config.
Reason: Token efficiency — progressive disclosure over duplication.

## 2026-08-28 — Polish pass: gear HP-sync + eval scaffolding + index check

Pattern: `gear-hp-sync`
Proposal: Add `gear-hp-sync` pattern; materialize `.agents/evals/tasks/` (3 file-backed tasks); fix `PURPOSE.md` relative links; add `knowledge index completeness` to `docs:check`; slim `AGENTS.md` 80→68 lines via merged owners/skills table.
Result: accepted
Evidence: `docs:check` 7 checks pass; `lint`/`typecheck`/`boundaries` green; `verify:changed --plan` routes knowledge/evals to `docs-check`.
Reason: Hard-enforce index honesty + gear write-path lesson; evals become file-backed per scaffold; further token reduction without losing invariants.

## 2026-08-28 — Enforce knowledge routing + gear HP-sync lint + ledger gate

Pattern: `gear-hp-sync`, `run-state-command-boundary`
Proposal: (1) Surface `knowledge/index.md` on 2nd occurrence for boundary changes in `.agents/skills/README.md` routing table; (2) add `GEAR_NO_OUTER_DISPATCH` lint (`no-restricted-syntax` on `dispatchGearMutationWithRunHealthSync`/`dispatchGearSalvageWithMaterialGrant` in `src/features/alchemy/run-loop/**` + `shell/**`) per pattern Enforcement opportunity; (3) add `skill-impact ledger` 8th `docs:check` contract requiring `skill-impact.md` when `.agents/skills/` or `.agents/knowledge/` is touched.
Result: accepted
Evidence: `npm run docs:check` 8 checks pass (ledger now git-diff aware, no-op when no diff); `npm run lint` green; `src/features/alchemy/run-loop/shop/trinket-shop-commands.ts` + `src/features/alchemy/run-loop/navigation/mystery-flow.ts` correctly use `mutateGearWithRunHealthSync` (no regression); `src/features/alchemy/meta/screens/armory/use-armory-controller.ts` still allowed outer dispatch outside gated globs; `verify:changed --plan` routes `.agents/**` → `docs-check`.
Reason: Make dormant knowledge actionable without bloat — routing makes 2nd-occurrence consult discoverable, lint hardens the one pattern with demonstrated nested-dispatch risk, ledger prevents silent instruction drift per audit.

## 2026-08-28 — Enforce aggregate direct-mutation lint (Phase B)

Pattern: `run-state-command-boundary`
Proposal: Add `AGGREGATE_NO_DIRECT_MUTATION` (`no-restricted-syntax` on `useGameplayStateStore.getState`/`setState` in `src/**` excluding `src/features/alchemy/shared/stores/**`) per pattern Enforcement section; promote pattern from `Enforcement opportunity (deferred)` to `Enforcement` with boundary lint + aggregate lint allowlist (`src/features/alchemy/shared/stores/run-session-command.ts`, `src/features/alchemy/shared/stores/gameplay-state-store.ts` + `tests/**` helpers).
Result: accepted
Evidence: `npm run lint` green (no existing `useGameplayStateStore.getState`/`setState` outside `shared/stores/**` — `eslint/fragments.js:70`, `eslint.config.js:372`); `npm run lint:boundaries` pass (951 modules); `src/features/alchemy/shared/stores/run-session-command.ts` + `src/features/alchemy/shared/stores/gameplay-state-store.ts` correctly exempted via `ignores`; `tests/helpers/gameplay-store-test.ts` allowed via `tests/**` exclusion (src glob); `npm run docs:check` 8 checks pass; `verify:changed --plan` for aggregate paths routes to `docs-check + typecheck`.
Reason: Make dormant run-state boundary mechanically enforced — evaluated as low invasiveness (only 3 call sites in `shared/stores/**`, 0 in feature code), so error is safe; completes Phase B audit recommendation without speculative pattern growth.

## 2026-08-28 — Hygiene: demote gear-hp-sync + validate evals baseline

Pattern: `gear-hp-sync`
Proposal: Demote `gear-hp-sync` `high→medium` (single occurrence at introduction) and update `Enforcement opportunity (deferred)` → `Enforcement` (now linted via `GEAR_NO_OUTER_DISPATCH`); validate 3 eval stubs baseline (`battle-card-effect` → `src/lib/battle/damage-calc.ts` routes to `unit-battle`, `save-additive-field` → `save` routes, `shop-price-refresh` → `src/features/alchemy/run-loop/shop/trinket-shop-commands.ts` routes to `unit-shop`) — all `typecheck` + `lint` + `lint:boundaries` green, `verify:changed --plan` routes correctly to file-level paths; fix task `Run:` shorthands (`src/lib/battle` → `src/lib/battle/**` / file, etc.) so bare dirs do not hit `unknown` route (`scripts/lib/change-routes.mjs`).
Result: accepted
Evidence: `npm run typecheck` pass; `npm run lint` green; `npm run lint:boundaries` 951 modules; `src/lib/battle/damage-calc.ts` + `src/lib/game-data/effects/damage-schemas.ts` --plan → `unit-battle`; `src/features/alchemy/run-loop/shop/trinket-shop-commands.ts` --plan → `unit-shop`; `npm run docs:check` 8 checks pass after demotion; `.agents/knowledge/index.md:20` now `medium`.
Reason: Complete audit signal-quality hygiene — keep confidence honest until second recurrence, remove stale `deferred` wording now that lint is live, and prove evals are runnable ground truth for future skill promotions per `evals/README.md:9` progression.

## Template for future entries

```
## YYYY-MM-DD — Short title
Pattern: <knowledge/patterns/...md or N/A>
Proposal: <what instruction/skill change was suggested>
Result: accepted | rejected | superseded
Evidence: <tests, lint, typecheck, eval task, commits>
Reason: <why>
```
