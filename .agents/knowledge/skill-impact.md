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

## 2026-08-30 — Prefer pragmatic architectural solution over smallest workaround

Pattern: N/A
Proposal: Reframe “smallest complete change/remedy” guidance to “most pragmatic architectural solution — the best long-term shape, even when larger than the minimal workaround” in `AGENTS.md` (Working style + Change guards), `scripts/new-plan.mjs` plan template, `docs/Audits/README.md` Right size (plus relax structural-fix gate to prefer larger owner-restoring fix over local shim when shim leaves the problem class), `.agents/skills/architect/SKILL.md` (honest contract), and `.agents/evals/README.md` (diff signal).
Result: accepted
Evidence: `npm run docs:check` passes after ledger update; `AGENTS.md`, `scripts/new-plan.mjs`, `docs/Audits/README.md`, `.agents/skills/architect/SKILL.md`, `.agents/evals/README.md` diffs.
Reason: Previous “smallest” anchor biased agents toward hacky, minimal-diff workarounds; new anchor preserves lib/hack avoidance and audit guardrails while explicitly favoring the cleaner, larger change when it is the more maintainable long-term shape — avoids both under-engineering and speculative over-abstraction.

## 2026-08-31 — Align active skills and knowledge with enforced contracts

Pattern: `battle-immutability-rng`, `run-state-command-boundary`, `run-materials-ownership`, `gear-hp-sync`
Proposal: Align the architect skill with the enforced no-comments rule; teach `getBattleRng` as the normal engine seam; distinguish shared combat tuning from content-owned magnitudes; correct material-lint severity; remove brittle source line references; and add documentation contracts for current backticked file references and local-skill routing completeness.
Result: accepted
Evidence: User-approved documentation review; stale architecture filenames survived the prior link/path checks; ESLint configuration confirms direct battle RNG access and run-earned material enforcement.
Reason: Keep active instructions consistent with executable rules and make the demonstrated staleness class mechanically detectable without loading more routine context.

## 2026-09-01 — Consolidate documentation ownership

Pattern: `asset-barrels-are-outputs`, `battle-immutability-rng`, `run-materials-ownership`, `static-route-imports`
Proposal: Route UI and audio work to dedicated canonical docs; slim the Playwright skill and representative eval index to strategy plus links; reduce enforcement-complete knowledge patterns to rationale; collapse the shared-store README into Architecture; separate migration history from the live save contract.
Result: accepted
Evidence: User-approved full documentation review; duplicated skill/README procedures, state tables, UI contracts, and eval task definitions; executable changed-path routes lacked audio and CI owner documents.
Reason: Preserve non-obvious decisions while removing dual ownership and reducing routine agent context.

## 2026-09-02 — Allow safe incidental fixes

Pattern: N/A
Proposal: Replace blanket unrelated-path avoidance with permission to fix clear, evidence-backed issues encountered during normal work; allow surgical edits alongside existing work, follow the causal neighborhood for root-cause fixes, and retain approval boundaries for ambiguous remedies, subjective design or balance changes, broad cleanup, and uncited audits.
Result: accepted
Evidence: User-approved policy plan; aligned `AGENTS.md`, `CONTRIBUTING.md`, and `run-audits` guidance; changed-path documentation gate passes.
Reason: Scope wording discouraged agents from making safe incidental fixes even when the issue and remedy were clear; the revised policy protects existing intent without leaving known problems behind.

## 2026-09-02 — Slim remaining enforcement-heavy patterns to rationale-only

Pattern: `run-state-command-boundary`, `save-migration-contract`, `gear-hp-sync`
Proposal: Replace `Preferred pattern` / `Enforcement` checklists with a `Resolution` pointer to the owning doc plus the enforcing lint/test gate, matching the 2026-09-01 consolidation of the other four patterns.
Result: accepted
Evidence: User-approved documentation review; `ARCHITECTURE.md`, `MIGRATIONS.md`, `ARMORY.md` own the procedures; `DOMAIN_STORE_PATTERNS` / `AGGREGATE_NO_DIRECT_MUTATION` / `GEAR_NO_OUTER_DISPATCH` lint plus save-migration guard tests enforce mechanically; `npm run docs:check` passes.
Reason: Prose checklists duplicated executable gates — keep the why and the pointer, let lint/tests enforce.

## 2026-09-03 — Build cleanup updates asset pipeline reference

Pattern: `asset-barrels-are-outputs`
Proposal: Update pattern evidence from deleted `sync-assets.mjs` / `sync-gear-art.mjs` shims to canonical `sync-generated.mjs`; no instruction change.
Result: accepted
Evidence: `npm run docs:check` ledger gate; shim files removed in build-cleanup change.
Reason: Keep knowledge evidence honest after build simplification — pipeline ownership unchanged.

## 2026-09-03 — Fix knowledge feedback loop

Pattern: `run-state-command-boundary`, `battle-immutability-rng`, `save-migration-contract`, `run-materials-ownership`
Proposal: (1) Friction-log Resolved rows require pattern link or `N/A (one-off)` + reason; 2nd same-area recurrence is a pattern candidate. (2) Split knowledge index into Live (3) vs Enforced rationale (4); mark the 4 lint/test-enforced patterns `enforced-rationale`. (3) Replace generic 2nd-occurrence consult with per-area `When to read` entries in skills routing. (4) Evals required only when routine coding behavior changes; doc-only slimming notes `evals: skipped (doc-only)`. (5) Soften `skill-impact ledger` docs:check contract from hard gate to advisory warning.
Result: accepted
Evidence: evals: skipped (doc-only); `npm run docs:check` passes with advisory warning only.
Reason: Close the friction→pattern loop without adding routine context — live set stays small, enforced lessons survive as rationale, and the ledger stops punishing small doc fixes.

## 2026-09-03 — Balance local handoff coverage

Pattern: N/A
Proposal: Keep the three-command verification workflow while making executable-change handoff reuse the CI static aggregate, routing tooling changes through the complete tooling/architecture suite, and recording bounded evidence for failed check stages. Full Vitest and browser execution remain CI-owned.
Result: accepted
Evidence: User-approved process review; recent CI escapes from dead exports, documentation drift, and repository-reading tooling tests; focused verifier tests and documentation contracts.
Reason: Catch inexpensive, recurring CI failures locally without restoring the previous minutes-long handoff gate or duplicating CI browser coverage.

## 2026-09-05 — Reconcile agent instructions and discovery routes

Pattern: `run-state-command-boundary`, `battle-immutability-rng`, `save-migration-contract`, `run-materials-ownership`
Proposal: Route enforced rules to canonical owners instead of mandatory rationale reads; distinguish pre-edit skills from verification; clarify preservation, discovery, Git authorization, and task completion; put browser invocation lessons in the E2E owner and document task-scoped verification in a dirty checkout.
Result: accepted
Evidence: User-requested documentation review; contradictory routing and missing E2E invocation guidance checked against existing owner docs and Playwright configuration. Evals: skipped (doc-only reconciliation; no new coding skill or gameplay contract).
Reason: Remove competing instructions without weakening game invariants or verification gates. Remove the stale claim that the verifier test byte-ratchets the persistence instruction stack.

## 2026-09-05 — Keep skills focused on distinct workflows

Pattern: `asset-barrels-are-outputs`, `static-route-imports`, `gear-hp-sync`
Proposal: Retain four skills; remove duplicate purpose files and implementation routing; route directly to canonical owners; keep knowledge as optional rationale without automatic recurrence-to-skill promotion. Correct audit worktree guidance and limit browser cleanup to task-created tabs.
Result: accepted
Evidence: Routing links resolved from the wrong directory; asset and route notes already described themselves as rationale; audit README has no orchestration contract; purpose files repeated skill scope and gates. Evals: skipped (workflow consolidation, no new gameplay implementation strategy). Skill validation and the task-scoped documentation completion gate verify structure and references.
Reason: Reduce competing instructions and paperwork while retaining compatibility, ownership, verification, and useful failure history.

## Template for future entries

```
## YYYY-MM-DD — Short title
Pattern: <knowledge/patterns/...md or N/A>
Proposal: <what instruction/skill change was suggested>
Result: accepted | rejected | superseded
Evidence: <tests, lint, typecheck, eval task, commits>
Reason: <why>
```
