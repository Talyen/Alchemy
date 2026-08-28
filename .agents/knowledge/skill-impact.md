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

## Template for future entries

```
## YYYY-MM-DD — Short title
Pattern: <knowledge/patterns/...md or N/A>
Proposal: <what instruction/skill change was suggested>
Result: accepted | rejected | superseded
Evidence: <tests, lint, typecheck, eval task, commits>
Reason: <why>
```
