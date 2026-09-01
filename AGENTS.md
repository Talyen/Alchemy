# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Router + universal constraints; detail lives in linked owners and skills.

## Working style

- Dirty tree is in-flight user work: inspect, preserve intent, keep unrelated paths out. Never `git reset --hard` / `clean -fd` / `checkout --` / `restore` with a dirty tree — the repo guard will stash to `auto-backup pre-<cmd>` and block; recover via `git stash list` / `git reflog`. If another agent has dirty work, use `node scripts/agent-worktree.mjs create --task <slug>` for an isolated checkout under `.worktrees/`.
- Most pragmatic architectural solution — the best long-term shape, even when larger/harder than the minimal workaround; prefer libs over custom hacks. Compatibility only for concrete consumer (save, shipped behavior, external contract).
- Surface requirement conflicts with evidence. First failure: use bounded diagnostics; repeated failure class: consult knowledge; after 3 unsuccessful approaches, reassess with docs/tests and ask only when evidence cannot resolve the decision.
- Run [Audits](./docs/Audits/README.md) only when cited. Zero findings is valid.
- Update canonical owner in same change when altering a documented invariant.

## Communication

For a collaborator who knows Alchemy as a game. Lead with what is now true.

Prefer product, design, and player language — what the player sees, does, and feels — over implementation detail. Game-domain terms (Battle, Homestead, Armory, Boon, Gear, Talent, etc.) are encouraged and preferred over engineering terms.

Avoid file paths, function/method names, line numbers, stack traces, and code excerpts in user-facing messages unless the user asks for them; keep that detail in diffs, tests, and commit messages.

Match level, name a term once.

## Documentation owners

Start with one owner document; expand only across a demonstrated boundary.

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
- **Controllers:** run/battle bindings travel through route/shell props, not context. Allowed providers are `AppScreenChromeProvider` and `CardDescriptionProvider`; presentation-only state may use `ui-store`.
- **Battle:** `BattleState` immutable, seeded `world` RNG, `Math.round` only; shared combat tuning lives in `src/lib/game-constants/`, while content-owned magnitudes stay with their definitions ([REFERENCE#battle](./docs/REFERENCE.md#battle-implementation-rules)).
- **Content:** `descriptionLines` matches effects; run materials via `awardMaterialsDuringRun()` (lint-enforced).
- **Persistence:** change schemas/defaults/hydration/fixtures together ([MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)).
- **Routes/assets:** screens statically imported; art eager; generated barrels are outputs — edit manifest, regenerate.
- **Imports/purity:** `eslint.config.js` + `eslint/boundaries.js` (+ `eslint/fragments.js`, double-checked by `dependency-cruiser.config.mjs`) own boundaries; keep I/O/clocks/RNG at seam.

## Change guards

- Before store/port/save/constant/routing change, search touched subsystem first; expand to public consumers only.
- If docs + nearest tests leave rule ambiguous, recover intent from tests + ≤5 commits; record invariant.
- Post-edit: review diff only — within the pragmatic solution, prefer delete → reuse → simplify → parameterize → abstract. No comments — express intent via code, types, and tests; only tool directives allowed by `alchemy/no-comments`. New cross-boundary contract → `architect` skill.

## UI

Plain `function Props` (no `React.FC`), `cn()` for classes. Motion/tooltips/interaction in [WORKFLOWS#screen-fade-motion](./docs/WORKFLOWS.md#screen-fade-motion); cosmetic RNG via `useState(() => ...)` never `Math.random()` in render; a11y constrained — see [WORKFLOWS#accessibility-stance](./docs/WORKFLOWS.md#accessibility-stance).

## Verification & environment

After edits use `verifier` skill. Commands in [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) / [REFERENCE](./docs/REFERENCE.md#environment--commands); triage in [REFERENCE#failure-first-triage](./docs/REFERENCE.md#failure-first-triage). Node/npm versions in `package.json`.

## Branch and commits

Trunk-based: commit to `main` / branch/PR only when asked. Conventional Commits (`feat`/`fix`/`balance`/`perf` player-facing). Do not edit `CHANGELOG.md`.

## Handoff

Game/workflow outcome first in player/design terms (using game vocabulary), then concise verification status. Avoid code/engineering detail unless requested. Name relevant scope intentionally left unchanged. No log/diff dumps.
