# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. This file routes work and records universal constraints; linked owners hold the details.

## Working style

- Inspect `git status --short` and relevant diffs before editing. Existing edits are user work: preserve their intent and make separable changes surgically. Re-read shared files before editing if another session may have changed them. Ask only when intent or a safe merge remains ambiguous.
- Fix the complete cause of the requested problem and blockers to its outcome, including outside the initial paths. Small, clearly understood adjacent repairs are allowed; report substantial independent findings instead of automatically implementing them. Do not turn incidental fixes into broad cleanup or an uncited [audit](./Docs/Audits/README.md). Make design and balance decisions within the user's requested scope; ask about consequential choices the request and evidence do not resolve.
- Choose the most maintainable complete solution for the demonstrated problem, even when larger than a workaround. Reuse existing owners and libraries before adding mechanisms; justify new dependencies or abstractions with concrete consumers. Preserve compatibility for saves, shipped behavior, and external contracts.
- When a failure is unclear, start with its diagnostic summary; open the most relevant evidence directly when you have a specific hypothesis. Keep output bounded. Consult relevant [knowledge](./.agents/knowledge/index.md) when historical context would help. Reassess assumptions when an approach stops producing useful evidence; ask only if evidence cannot resolve the decision.
- Record unresolved recurring friction and consequential lessons in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md). Put reusable prevention in the canonical owner. Corrected typos, one-off environment issues, and self-explanatory fixes need no historical record.
- Never use destructive Git commands to clear existing work. A guard may stash and block the command; inspect the reported backup, apply it, verify recovery, and only then drop that backup. Do not rely on the guard as authorization or protection.
- For parallel implementation use `node scripts/agent-worktree.mjs create --task <slug>` (`.worktrees/<slug>` on `agent/<slug>`); assign disjoint ownership and review integration before handoff.

## Communication

Write in plain language for someone who knows Alchemy as a game. Use established player-facing names; include code details when requested or needed to explain a decision, risk, or blocker.

## Documentation owners

Understand affected contracts and consumers, especially stores, ports, saves, constants, and routing. Read or search directly, or use `npm run context -- <paths>` / `--task <category>` for missing context; skip already-understood material. Resolve disagreements among docs, tests, and code by investigating intent. Update the canonical owner when changing its invariant.

- Run state, controllers, boundaries, boot: [ARCHITECTURE](./Docs/ARCHITECTURE.md).
- Saves, cards, screens, materials: [WORKFLOWS](./Docs/WORKFLOWS.md); save compatibility: [MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- Raw art, sound, generated barrels: [WORKFLOWS-ASSETS](./Docs/WORKFLOWS-ASSETS.md).
- Commands: [REFERENCE](./Docs/REFERENCE.md); battle rules and glossary: [GAME_RULES](./Docs/GAME_RULES.md).
- Verification, hooks, E2E and test policy: [CONTRIBUTING](./CONTRIBUTING.md).
- Gear: [ARMORY](./Docs/ARMORY.md), [UNIQUE_ITEMS](./Docs/UNIQUE_ITEMS.md); card handlers: [BATTLE_HANDLERS](./src/lib/game-data/effects/BATTLE_HANDLERS.md).
- Presentation: [UI](./Docs/UI.md), [AUDIO](./Docs/AUDIO.md), [PERFORMANCE](./Docs/PERFORMANCE.md); publishing: [RELEASE](./Docs/RELEASE.md) ([setup](./Docs/RELEASE_SETUP.md)).

Use optional [discovery tools](./Docs/REFERENCE.md#agent-discovery) for bounded searches and source excerpts. Exclude raw assets, reports, builds, changelog, lockfiles, archives, and generated files from broad searches; inspect them directly when relevant.

## Skills & knowledge

[Skill routing](./.agents/skills/README.md) identifies specialized workflows; ordinary edits need no skill.
[Knowledge](./.agents/knowledge/index.md) explains recurring failures and rejected approaches. Read it when that context is needed; implementation procedures stay in the canonical owners.

## High-risk invariants

- **Run state:** outside `shared/stores/` use capability ports; writes via `dispatchRunSessionCommand()` + `run-session-write-port.ts` ([ARCHITECTURE#run-state](./Docs/ARCHITECTURE.md#run-state)).
- **Controllers:** run/battle bindings travel through route/shell props, not context. Allowed providers are `AppScreenChromeProvider` and `CardDescriptionProvider`; presentation-only state may use `ui-store`.
- **Battle:** `BattleState` immutable, seeded `world` RNG, combat magnitudes use `Math.round`; shared combat tuning lives in `src/lib/game-constants/`, while content-owned magnitudes stay with their definitions ([GAME_RULES](./Docs/GAME_RULES.md#battle-implementation-rules)).
- **Content:** `descriptionLines` matches effects; run materials via `awardMaterialsDuringRun()` (lint- + award-guard-test-enforced).
- **Persistence:** change schemas/defaults/hydration/fixtures together ([MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md)).
- **Routes/assets:** screens statically imported; art eager; generated barrels are outputs — edit manifest, regenerate.
- **Imports/purity:** `eslint.config.js` + `eslint/boundaries.js` (+ `eslint/fragments.js`, double-checked by `dependency-cruiser.config.mjs`) own boundaries; keep I/O/clocks/RNG at seam.

## Change guards

- If docs + nearest tests leave rule ambiguous, inspect focused history (start with at most five relevant commits); record the resolved invariant.
- Post-edit: review the diff and enough surrounding code to check behavior and integration. Use names, types, and tests to express behavior. Add concise comments when they explain non-obvious reasons, ordering, or compatibility constraints; avoid narrating the code. ESLint suppressions must explain their reason (`alchemy/require-disable-reason`). New cross-boundary contract → `architect` skill.

## UI

Plain function components with typed props (no `React.FC`), `cn()` for classes. Motion, tooltips, interaction, placement, and accessibility: [UI](./Docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Verification & environment

After edits, use [verifier](./.agents/skills/verifier/SKILL.md) before handoff. [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) owns gate tiers and the [test value policy](./CONTRIBUTING.md#test-value-and-coverage-strategy), including permission to consolidate or retire low-value tests during related work. Preserve meaningful protection and report material retirements.

The command catalog is in [REFERENCE](./Docs/REFERENCE.md#environment--commands); Node/npm versions are in `package.json`.

## Branch and commits

Trunk-based: use the current checkout; default to `main` for commits. Commit, push, or create a branch/PR only when requested; do not switch away from an existing branch implicitly. Conventional Commits + `User-Facing` trailer (see [RELEASE.md](./Docs/RELEASE.md#changelog-release-time-only)). Do not edit `CHANGELOG.md`.

## Handoff

Check that the requested behavior is complete, not merely that checks pass. Briefly report the result, checks actually run, remaining limitations, incidental fixes, and unresolved decisions. Follow Communication for the level of detail. Do not paste logs or diff dumps.
