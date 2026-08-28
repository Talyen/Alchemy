# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Router + universal constraints; detail lives in linked owners and skills.

## Working style

- Dirty tree is in-flight user work: inspect, preserve intent, keep unrelated paths out.
- Smallest complete implementation; prefer libs. Compatibility only for concrete consumer (save, shipped behavior, external contract).
- Challenge weak requirements with evidence; after 3 failures reassess with docs/tests, ask.
- Run [Audits](./docs/Audits/README.md) only when cited. Zero findings is valid.
- Update canonical owner in same change when altering a documented invariant.

## Communication

For a collaborator who knows Alchemy as a game. Lead with what is now true, then files/symbols as needed. Match level, name a term once.

## Documentation owners

One owner per task; expand only across demonstrated boundary.

| Need                                          | Read                                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run state, controllers, boundaries, boot      | [ARCHITECTURE](./docs/ARCHITECTURE.md)                                                                                                                                                                              |
| Saves, cards, screens, materials, motion      | [WORKFLOWS](./docs/WORKFLOWS.md)                                                                                                                                                                                    |
| Raw art / sound / generated barrels           | [WORKFLOWS-ASSETS](./docs/WORKFLOWS-ASSETS.md)                                                                                                                                                                      |
| Commands, battle rules, glossary              | [REFERENCE](./docs/REFERENCE.md)                                                                                                                                                                                    |
| Hooks, verification, E2E policy               | [CONTRIBUTING](./CONTRIBUTING.md)                                                                                                                                                                                   |
| Save compatibility                            | [MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)                                                                                                                                                   |
| Armory / gear, card handlers, UI/perf/release | [ARMORY](./docs/ARMORY.md), [BATTLE_HANDLERS](./src/lib/game-data/effects/BATTLE_HANDLERS.md), [UI](./src/features/alchemy/shared/ui/README.md), [PERFORMANCE](./docs/PERFORMANCE.md), [RELEASE](./docs/RELEASE.md) |

Discovery: headings first, search touched path/symbol first, `git status --short` before diffs. Opt-in evidence only — `Raw Assets/`, `reports/`, `dist/`, `CHANGELOG.md`, lockfiles excluded.

## Skills & knowledge

Skills: [.agents/skills/](./.agents/skills/README.md) — short, task-oriented, auto-triggered. Routine edits need none.
Knowledge: [.agents/knowledge/](./.agents/knowledge/index.md) — **not auto-loaded**. Read on recurring failure or surprising behavior. Progression `one-off → pattern → skill (validate via evals) → enforcement (types/lint/tests)`.

## High-risk invariants

- **Run state:** outside `shared/stores/` use capability ports; writes via `dispatchRunSessionCommand()` + `run-session-write-port.ts` ([ARCHITECTURE#run-state](./docs/ARCHITECTURE.md#run-state)).
- **Controllers:** bindings via route/shell props, not context (allowed: `AppScreenChromeProvider`, `CardDescriptionProvider`, `ui-store`).
- **Battle:** `BattleState` immutable, seeded `world` RNG, `Math.round` only; tuning in `src/lib/game-constants/` ([REFERENCE#battle](./docs/REFERENCE.md#battle-implementation-rules)).
- **Content:** `descriptionLines` matches effects; run materials via `awardMaterialsDuringRun()` (lint-enforced).
- **Persistence:** change schemas/defaults/hydration/fixtures together ([MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)).
- **Routes/assets:** screens statically imported; art eager; generated barrels are outputs — edit manifest, regenerate.
- **Imports/purity:** `eslint.config.js` + `boundaries.js` own boundaries; keep I/O/clocks/RNG at seam.

## Change guards

- Before store/port/save/constant/routing change, search touched subsystem first; expand to public consumers only.
- If docs + nearest tests leave rule ambiguous, recover intent from tests + ≤5 commits; record invariant.
- Post-edit: review diff only (delete → reuse → simplify → parameterize → abstract). No comments — express intent via code, types, and tests; only `eslint`/`@ts-`/`prettier-ignore`/`c8` directives allowed (`eslint/no-comments.js:1`). New cross-boundary contract → `architect` skill.

## UI

Plain `function Props` (no `React.FC`), `cn()` for classes. Motion/tooltips/interaction in [WORKFLOWS#screen-fade-motion](./docs/WORKFLOWS.md#screen-fade-motion); cosmetic RNG via `useState(() => ...)` never `Math.random()` in render; a11y constrained — see [WORKFLOWS#accessibility-stance](./docs/WORKFLOWS.md#accessibility-stance).

## Verification & environment

After edits use `verifier` skill. Commands in [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) / [REFERENCE](./docs/REFERENCE.md#environment--commands); triage in [REFERENCE#failure-first-triage](./docs/REFERENCE.md#failure-first-triage). Close browser tabs after IDE use. Node/npm versions in `package.json`.

## Branch and commits

Trunk-based: commit to `main` / branch/PR only when asked. Conventional Commits (`feat`/`fix`/`balance`/`perf` player-facing). Do not edit `CHANGELOG.md`.

## Handoff

Game/workflow outcome first, exact verification + status, intentionally untouched. No log/diff dumps.
