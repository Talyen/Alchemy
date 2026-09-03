# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Router + universal constraints; detail lives in linked owners and skills.

## Working style

- Dirty tree is user work: inspect the diff, preserve intent. Fix clear evidenced issues found during normal work—even outside scope—and their cause, with proportionate tests. Surgical edits may coexist; never revert, replace, or delete existing work. Ask if conflicting/ambiguous or subjective design/balance. No broad cleanup/uncited audit. Never `git reset --hard` / `clean -fd` / `checkout --` / `restore` with a dirty tree — the repo guard creates an `auto-backup pre-<cmd>` stash and blocks; inspect/apply/drop it after verification. For parallel work use `node scripts/agent-worktree.mjs create --task <slug>` (`.worktrees/<slug>` on `agent/<slug>`).
- Most pragmatic architectural solution — the best long-term shape, even when larger/harder than the minimal workaround; prefer libs over custom hacks. Compatibility only for concrete consumer (save, shipped behavior, external contract).
- Surface requirement conflicts with evidence. First failure: use bounded diagnostics; repeated failure class: consult the `When to read` entry in knowledge; after 3 unsuccessful approaches, reassess with docs/tests and ask only when evidence cannot resolve the decision.
- When docs mislead, behavior surprises, or friction repeats, append a brief row to [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md) (expanded template inside when needed). On resolve link a pattern or record `N/A (one-off)`; second same-area recurrence is a pattern candidate.
- Run [Audits](./docs/Audits/README.md) only when cited. Zero findings is valid.
- Update canonical owner in same change when altering a documented invariant.

## Communication

Write for a product manager, designer, player, or user who knows Alchemy as a game, not its implementation. Use plain language and established player-facing names for features, screens, and behavior. Discuss code-level detail only when the user asks for it or when it is necessary to explain a decision, risk, or blocker.

## Documentation owners

Start with one owner document; expand only across a demonstrated boundary.

| Need                                                | Read                                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run state, controllers, boundaries, boot            | [ARCHITECTURE](./docs/ARCHITECTURE.md)                                                                                                                                                                                                             |
| Saves, cards, screens, materials                    | [WORKFLOWS](./docs/WORKFLOWS.md)                                                                                                                                                                                                                   |
| Raw art / sound / generated barrels                 | [WORKFLOWS-ASSETS](./docs/WORKFLOWS-ASSETS.md)                                                                                                                                                                                                     |
| Commands, battle rules, glossary                    | [REFERENCE](./docs/REFERENCE.md) ([battle rules + glossary](./docs/GAME_RULES.md))                                                                                                                                                                 |
| Hooks, verification, E2E policy                     | [CONTRIBUTING](./CONTRIBUTING.md)                                                                                                                                                                                                                  |
| Save compatibility                                  | [MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)                                                                                                                                                                                  |
| Armory / gear, card handlers, UI/audio/perf/release | [ARMORY](./docs/ARMORY.md), [BATTLE_HANDLERS](./src/lib/game-data/effects/BATTLE_HANDLERS.md), [UI](./docs/UI.md), [AUDIO](./docs/AUDIO.md), [PERFORMANCE](./docs/PERFORMANCE.md), [RELEASE](./docs/RELEASE.md) ([setup](./docs/RELEASE_SETUP.md)) |

Discovery: headings first, search touched path/symbol first, `git status --short` before diffs. Opt-in evidence only — `Raw Assets/`, `reports/`, `dist/`, `CHANGELOG.md`, lockfiles excluded.

## Skills & knowledge

Skills: [.agents/skills/](./.agents/skills/README.md) — short, task-oriented, auto-triggered. Routine edits need none.
Knowledge: [.agents/knowledge/](./.agents/knowledge/index.md) — **not auto-loaded**. Read on recurring failure or surprising behavior. Progression `one-off → pattern → skill (validate via evals) → enforcement (types/lint/tests)`.
Friction log: [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md) — append when docs mislead, behavior surprises, or repeated friction appears. Not auto-loaded; one-line row is enough — move to Resolved with a fix link when addressed.

## High-risk invariants

- **Run state:** outside `shared/stores/` use capability ports; writes via `dispatchRunSessionCommand()` + `run-session-write-port.ts` ([ARCHITECTURE#run-state](./docs/ARCHITECTURE.md#run-state)).
- **Controllers:** run/battle bindings travel through route/shell props, not context. Allowed providers are `AppScreenChromeProvider` and `CardDescriptionProvider`; presentation-only state may use `ui-store`.
- **Battle:** `BattleState` immutable, seeded `world` RNG, `Math.round` only; shared combat tuning lives in `src/lib/game-constants/`, while content-owned magnitudes stay with their definitions ([GAME_RULES](./docs/GAME_RULES.md#battle-implementation-rules)).
- **Content:** `descriptionLines` matches effects; run materials via `awardMaterialsDuringRun()` (lint-enforced).
- **Persistence:** change schemas/defaults/hydration/fixtures together ([MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)).
- **Routes/assets:** screens statically imported; art eager; generated barrels are outputs — edit manifest, regenerate.
- **Imports/purity:** `eslint.config.js` + `eslint/boundaries.js` (+ `eslint/fragments.js`, double-checked by `dependency-cruiser.config.mjs`) own boundaries; keep I/O/clocks/RNG at seam.

## Change guards

- Before store/port/save/constant/routing change, search touched subsystem first; expand to public consumers only.
- If docs + nearest tests leave rule ambiguous, recover intent from tests + ≤5 commits; record invariant.
- Post-edit: review diff only — within the pragmatic solution, prefer delete → reuse → simplify → parameterize → abstract. No comments — express intent via code, types, and tests; only tool directives allowed by `alchemy/no-comments`. New cross-boundary contract → `architect` skill.

## UI

Plain `function Props` (no `React.FC`), `cn()` for classes. Motion, tooltips, interaction, placement, and accessibility: [UI](./docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Verification & environment

After edits use `verifier` skill. Tiers in [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change), command catalog in [REFERENCE](./docs/REFERENCE.md#environment--commands); triage in [REFERENCE#failure-first-triage](./docs/REFERENCE.md#failure-first-triage). Node/npm versions in `package.json`.

## Branch and commits

Trunk-based: commit to `main` / branch/PR only when asked. Conventional Commits (`feat`/`fix`/`balance`/`perf` player-facing, `User-Facing` trailer owned by [CONTRIBUTING](./CONTRIBUTING.md#changelog-and-patch-notes)). Do not edit `CHANGELOG.md`.

## Handoff

Briefly report the result, verification status, incidental fixes, and ambiguous findings. Follow Communication for the level of detail. Do not paste logs or diff dumps.
