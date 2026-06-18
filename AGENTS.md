# Alchemy - AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder: pick a **Character**, fight turn-based battles with cards (**Mana**, **Statuses**, **Block**, companions), earn rewards, and travel to **Destinations** (combat, **Campfire**, shops, **Mystery**, **Corruption**). Between runs, the **Homestead** and **Talent** trees provide permanent progression.

> **Docs:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [RELEASE.md](./docs/RELEASE.md) (Steam shipping) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks and tests) · [PROMPTS.md](./PROMPTS.md) (code-quality audits) · [README.md](./README.md) (human setup)

## Where to look

| If you are...                        | Read first                                                                                                                                      | Verify with                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Adding content (card, enemy, screen) | [WORKFLOWS task index](./docs/WORKFLOWS.md#task-index)                                                                                          | Targeted tests from [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) |
| Touching run state or stores         | [ARCHITECTURE](./docs/ARCHITECTURE.md)                                                                                                          | `tests/features/stores/` and related integration tests                            |
| Changing battle or card effects      | [REFERENCE battle rules](./docs/REFERENCE.md#battle-implementation-rules), [BATTLE_HANDLERS.md](./src/lib/game-data/effects/BATTLE_HANDLERS.md) | `tests/lib/battle` and `descriptions-match-effects`                               |
| Changing UI or motion                | [WORKFLOWS stagger guidance](./docs/WORKFLOWS.md#staggered-screen-enter-motion); stuck on interaction/layout UX → [PROMPTS UI audits](./PROMPTS.md#ui-interaction--feedback-audit) | Targeted UI tests and `npm run lint:ci`                                           |
| Changing saves or releases           | [WORKFLOWS persistence guidance](./docs/WORKFLOWS.md#change-persisted-save-data), [RELEASE](./docs/RELEASE.md)                                  | Ship checks from [CONTRIBUTING](./CONTRIBUTING.md)                                |
| Stuck after three attempts           | Relevant audit in [PROMPTS.md](./PROMPTS.md) — code quality or [UI interaction/layout](./PROMPTS.md#ui-interaction--feedback-audit) (or [WORKFLOWS](./docs/WORKFLOWS.md) for domain wiring) | Ask the user after the audit                                                      |

## Sources of truth

- `eslint.config.js` is authoritative for import boundaries and lint-enforced coding rules.
- `package.json` is authoritative for npm commands; [CONTRIBUTING.md](./CONTRIBUTING.md) maps changes to checks and documents the Lefthook sequence.
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) owns run-state design; [WORKFLOWS.md](./docs/WORKFLOWS.md) owns implementation checklists; [RELEASE.md](./docs/RELEASE.md) owns release procedure.
- Keep this file focused on durable agent policy. When a documented contract changes, update its owning document instead of copying implementation details here.
- If this file and an owner doc disagree, stop and ask unless `eslint.config.js` or `package.json` clearly resolves the conflict.

## Working safely

- Inspect `git status` before editing. Preserve unrelated changes and never alter another agent's in-progress files.
- Scope edits and verification to the task. In a dirty worktree, avoid repository-wide formatters or fix commands that could rewrite unrelated files.
- Never run `git reset`, `git checkout --`, `git restore`, `git clean`, `git rebase`, or `git merge`. Ask before `git stash`.
- Do not commit, push, tag, release, stash, create a PR, bump versions, change dependencies, or regenerate assets unless the user explicitly requests it.
- When publishing is requested without a branch or PR workflow, commit and push directly to `main` using a [Conventional Commit](https://www.conventionalcommits.org/) message.
- Never hand-edit `package-lock.json`; let npm update it only as part of an explicitly requested dependency change.
- In PowerShell, chain dependent commands with `; if ($?) { ... }`; do not use plain `;` when a later command depends on an earlier command succeeding.

## Verification ladder

1. During development, run the narrow tests listed for the changed area in [CONTRIBUTING.md](./CONTRIBUTING.md#what-to-run-when-you-change). After editing `.ts` or `.tsx`, run `npm run typecheck` (or `npm run lint:ci`, which includes it).
2. Add `npm run lint:ci`, broader tests, or a build when the change's blast radius warrants them.
3. Use `npm run check:push` as the normal comprehensive check before a requested push.
4. Before a requested push to `main`, run the main-gate checks from [CONTRIBUTING.md](./CONTRIBUTING.md#before-you-push) or report exactly which checks were skipped and why.
5. Use `npm run check:ship` for ship/save/desktop unit and build validation.
6. Run `npm run check:ship:full` before an explicitly requested release.

Tests commonly mirror source paths (`tests/lib/battle/foo.test.ts` for `src/lib/battle/foo.ts`), but integration, architecture, and workflow tests intentionally span modules. Follow the change-to-test mapping rather than assuming one-to-one coverage.

## Architectural invariants

- **Run state:** route `screen` belongs to the run domain. Feature code outside `shared/stores/` accesses run state through `run-session-facade` hooks/readers and transition APIs, not `run-domain-store` directly.
- **Battle:** treat `BattleState` as immutable; use `state.rng` rather than `Math.random()`; keep tuning in `game-constants.ts`; use `Math.round()` rather than `Math.floor()` in battle code.
- **Content:** card `descriptionLines` must match effects. Run-earned materials flow through `awardMaterialsDuringRun()`.
- **Persistence:** update schemas, migrations or normalization, defaults, hydration/snapshots, and legacy fixtures together as applicable.
- **Routes:** route screens are statically imported through `screen-routes/`; do not use `React.lazy()`. Game art is eagerly loaded at boot.
- **Imports:** use the established barrels for game data, battle, validation, shared screens, shared utilities, and shared storage. Validation schemas remain imported from `@/lib/validation`.

### Import boundary summary

This table is an orientation aid. If it differs from `eslint.config.js`, follow `eslint.config.js` and update this summary.

| Layer                             | Key constraint                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/**`                      | Must not import `@/features/**`                                                                  |
| `src/lib/game-data/**`            | Must not import battle runtime                                                                   |
| `src/lib/battle/**`               | Must remain framework-agnostic and must not import features                                      |
| Feature screens                   | Receive orchestration through props/controllers; do not import run-loop orchestration            |
| `features/alchemy/meta/**`        | Must not depend on run-loop or run-setup                                                         |
| `features/alchemy/shared/ui/**`   | Receive run/battle/session data through props; only `ui-store` is allowed for ephemeral UI state |
| Features outside `shared/stores/` | Use the run-session facade and public readers/transitions, not low-level stores                  |

Only `@/*` maps to `src/*` in `tsconfig.json`; use on-disk paths under `src/features/alchemy/`.

## UI conventions

- Use plain function components with explicit `Props` types, not `React.FC`.
- Build conditional Tailwind classes with `cn()` from `@/lib/utils`; do not use template literals in `className`.
- Keep reusable `shared/ui` components isolated from run, battle, and session stores; pass domain data through props.
- Use CSS `active:` for press feedback on buttons; no Framer hover scale. Hover uses background lift from `src/lib/ui/button-hover.ts` plus sound via `Button` or `PressableMotion`.
- Use `StaggerGroup` and `StaggerItem` according to [the motion workflow](./docs/WORKFLOWS.md#staggered-screen-enter-motion). Do not wrap translate-centered absolute map nodes with `StaggerItem`.
- Initialize cosmetic randomness lazily with `useState(() => ...)`, not `useMemo` plus `Math.random()` during render.

## Generated and heavy files

- Do not edit generated outputs directly. `src/lib/validation/metadata.generated.ts` comes from `npm run sync:version`; optimized assets come from the asset scripts documented in [WORKFLOWS](./docs/WORKFLOWS.md#assets).
- When raw assets or asset scripts change, follow [WORKFLOWS asset guidance](./docs/WORKFLOWS.md#assets) so generated outputs stay in sync.
- Never edit dependency, build, coverage, or report output directories: `node_modules/`, `dist/`, `.vite/`, `release-desktop/`, `coverage/`, and `reports/`.
- Treat `Raw Assets/`, `Music/`, `src/assets/optimized/`, `game-constants.ts`, `cards.ts`, `keywords.ts`, `assets.ts`, and `vite.config.ts` as read-on-demand; avoid repeated broad reads.

## Debugging

- DEV-only QA controls (Skip Combat, Unlock All, Error Log) are not available in production, and E2E specs must not target them. Use `winViaCombat()` or `playCardNamed()`.
- The startup bypass is `localStorage["alchemy-skip-loading-screen"]`; boot validation runs through `validate-startup.ts`.
- Battle warnings use the `[Enemy Turn]` prefix.
- After three failed attempts with the same approach, run the relevant audit in [PROMPTS.md](./PROMPTS.md) — code quality or [UI interaction/layout](./PROMPTS.md#ui-interaction--feedback-audit) (or [WORKFLOWS](./docs/WORKFLOWS.md) for domain wiring), then ask the user rather than continuing speculative changes.
