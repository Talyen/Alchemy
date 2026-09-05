# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. This file routes work and records universal constraints; linked owners hold the details.

## Working style

- Inspect `git status --short` and relevant diffs before editing. Existing edits are user work: preserve their intent and make separable changes surgically. Re-read shared files before editing if another session may have changed them. Ask only when intent or a safe merge remains ambiguous.
- Fix evidenced issues encountered during the task, including their cause outside the initial paths. Do not turn incidental fixes into broad cleanup or an uncited [audit](./docs/Audits/README.md). Make design and balance decisions within the user's requested scope; ask about consequential choices the request and evidence do not resolve.
- Choose the most maintainable complete solution for the demonstrated problem, even when larger than a workaround. Reuse existing owners and libraries before adding mechanisms; justify new dependencies or abstractions with concrete consumers. Preserve compatibility for saves, shipped behavior, and external contracts.
- Start with bounded diagnostics after a failure. For recurring failures or surprising behavior, consult the relevant lesson in [knowledge](./.agents/knowledge/index.md). After three unsuccessful approaches, reassess the assumption using docs, tests, and focused history; ask only if evidence cannot resolve the decision.
- Record misleading docs, surprising repository behavior, or repeated friction in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md). Put reusable prevention in the canonical owner; the log records evidence, not a second procedure manual.
- Never use destructive Git commands to clear existing work. A guard may stash and block the command; inspect the reported backup, apply it, verify recovery, and only then drop that backup. Do not rely on the guard as authorization or protection.
- For parallel implementation use `node scripts/agent-worktree.mjs create --task <slug>` (`.worktrees/<slug>` on `agent/<slug>`); assign disjoint ownership and review integration before handoff.

## Communication

Write for a product manager, designer, player, or user who knows Alchemy as a game, not its implementation. Use plain language and established player-facing names for features, screens, and behavior. Discuss code-level detail only when the user asks for it or when it is necessary to explain a decision, risk, or blocker.

## Documentation owners

Start with the relevant section of one owner document; expand when a dependency or unresolved question crosses its boundary. When docs, tests, and implementation disagree, investigate intent rather than treating any one as automatically correct. Update the canonical owner in the same change as its invariant.

| Need                                                | Read                                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run state, controllers, boundaries, boot            | [ARCHITECTURE](./docs/ARCHITECTURE.md)                                                                                                                                                                                                             |
| Saves, cards, screens, materials                    | [WORKFLOWS](./docs/WORKFLOWS.md)                                                                                                                                                                                                                   |
| Raw art / sound / generated barrels                 | [WORKFLOWS-ASSETS](./docs/WORKFLOWS-ASSETS.md)                                                                                                                                                                                                     |
| Commands, battle rules, glossary                    | [REFERENCE](./docs/REFERENCE.md) ([battle rules + glossary](./docs/GAME_RULES.md))                                                                                                                                                                 |
| Hooks, verification, E2E policy                     | [CONTRIBUTING](./CONTRIBUTING.md)                                                                                                                                                                                                                  |
| Save compatibility                                  | [MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)                                                                                                                                                                                  |
| Armory / gear, card handlers, UI/audio/perf/release | [ARMORY](./docs/ARMORY.md), [BATTLE_HANDLERS](./src/lib/game-data/effects/BATTLE_HANDLERS.md), [UI](./docs/UI.md), [AUDIO](./docs/AUDIO.md), [PERFORMANCE](./docs/PERFORMANCE.md), [RELEASE](./docs/RELEASE.md) ([setup](./docs/RELEASE_SETUP.md)) |

Discovery: headings and touched paths/symbols first. Exclude `Raw Assets/`, `reports/`, `dist/`, `CHANGELOG.md`, and lockfiles from broad searches; inspect them when the task or diagnostics specifically require them.

## Skills & knowledge

[Skill routing](./.agents/skills/README.md) identifies specialized pre-edit workflows; ordinary edits need no pre-edit skill. After edits, use `verifier`.
[Knowledge](./.agents/knowledge/index.md) explains recurring failures and rejected approaches. Read it when that context is needed; implementation procedures stay in the canonical owners.

## High-risk invariants

- **Run state:** outside `shared/stores/` use capability ports; writes via `dispatchRunSessionCommand()` + `run-session-write-port.ts` ([ARCHITECTURE#run-state](./docs/ARCHITECTURE.md#run-state)).
- **Controllers:** run/battle bindings travel through route/shell props, not context. Allowed providers are `AppScreenChromeProvider` and `CardDescriptionProvider`; presentation-only state may use `ui-store`.
- **Battle:** `BattleState` immutable, seeded `world` RNG, combat magnitudes use `Math.round`; shared combat tuning lives in `src/lib/game-constants/`, while content-owned magnitudes stay with their definitions ([GAME_RULES](./docs/GAME_RULES.md#battle-implementation-rules)).
- **Content:** `descriptionLines` matches effects; run materials via `awardMaterialsDuringRun()` (lint-enforced).
- **Persistence:** change schemas/defaults/hydration/fixtures together ([MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)).
- **Routes/assets:** screens statically imported; art eager; generated barrels are outputs — edit manifest, regenerate.
- **Imports/purity:** `eslint.config.js` + `eslint/boundaries.js` (+ `eslint/fragments.js`, double-checked by `dependency-cruiser.config.mjs`) own boundaries; keep I/O/clocks/RNG at seam.

## Change guards

- Before store/port/save/constant/routing change, search the touched subsystem and its consumers; follow further dependencies when evidence requires it.
- If docs + nearest tests leave rule ambiguous, inspect focused history (start with at most five relevant commits); record the resolved invariant.
- Post-edit: review the diff and enough surrounding code to check behavior and integration. Prefer removing redundancy and reusing owners before introducing abstractions. No comments — express intent via code, types, and tests; only tool directives allowed by `alchemy/no-comments`. New cross-boundary contract → `architect` skill.

## UI

Plain function components with typed props (no `React.FC`), `cn()` for classes. Motion, tooltips, interaction, placement, and accessibility: [UI](./docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Verification & environment

After edits use `verifier` skill. Tiers in [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change), command catalog in [REFERENCE](./docs/REFERENCE.md#environment--commands); triage in [REFERENCE#failure-first-triage](./docs/REFERENCE.md#failure-first-triage). Node/npm versions in `package.json`.

## Branch and commits

Trunk-based: use the current checkout; default to `main` for commits. Commit, push, or create a branch/PR only when requested; do not switch away from an existing branch implicitly. Conventional Commits (`feat`/`fix`/`balance`/`perf` player-facing, `User-Facing` trailer owned by [CONTRIBUTING](./CONTRIBUTING.md#changelog-and-patch-notes)). Do not edit `CHANGELOG.md`.

## Handoff

Check that the requested behavior is complete, not merely that checks pass. Briefly report the result, checks actually run, remaining limitations, incidental fixes, and unresolved decisions. Follow Communication for the level of detail. Do not paste logs or diff dumps.
