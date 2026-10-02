# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Use plain language and player-facing names; add code details when they explain a decision or risk.

## Working style

- Default to `npm run check -- <task-owned paths>`. `npm test` is bounded Node smoke; focused, dependency-related and full unit suites (including DOM) may run without approval via `npm run test:full -- <paths>`. Browser/Electron, coverage, mutation, profiling, full static checks, builds, packaging, `check:full` and `verify:full` require an explicit local-execution request. [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) owns gate details.
- Inspect working-tree status and relevant diffs before editing. Preserve existing work; re-read shared files when another session may be editing them. Ask only when intent or a safe merge is ambiguous.
- Complete requested behavior and blockers. Fix small, understood adjacent issues; report substantial independent findings. Avoid broad cleanup or an uncited [audit](./Docs/Audits/README.md). Decide routine details; ask about consequential unresolved choices.
- Reuse owners and libraries; justify new dependencies or abstractions with concrete consumers. Preserve behavior and external contracts.
- Start unclear failures with the diagnostic summary and a specific hypothesis. Reassess unproductive approaches; consult [knowledge](./.agents/knowledge/index.md) when history helps. Record unresolved recurring friction and consequential lessons in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md); reusable prevention belongs in its canonical owner. Routine fixes need no history entry.
- Never clear existing work with destructive Git commands. If a guard stashes and blocks a command, inspect and apply its backup, verify recovery, then drop the backup. The guard is not authorization.
- For parallel implementation use `node scripts/agent-worktree.mjs create --task <slug>`; assign disjoint ownership and review integration.

## Find the owner

Read affected contracts and consumers; update the canonical owner when changing an invariant. Resolve docs/code/test disagreements from intent, then at most five relevant commits if needed.

- [Run state/persistence](./Docs/RUN_STATE.md), [run/save workflows](./Docs/RUN_WORKFLOWS.md), [save compatibility](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- [Architecture/controllers/boot](./Docs/ARCHITECTURE.md), [screen workflows](./Docs/WORKFLOWS.md).
- [Content](./Docs/CONTENT_AUTHORING.md), [battle rules](./Docs/GAME_RULES.md), [effect handlers](./src/lib/game-data/effects/BATTLE_HANDLERS.md).
- [Assets](./Docs/WORKFLOWS-ASSETS.md), [Gear](./Docs/ARMORY.md), [unique items](./Docs/UNIQUE_ITEMS.md).
- [UI](./Docs/UI.md), [audio](./Docs/AUDIO.md), [performance](./Docs/PERFORMANCE.md).
- [Verification/tests](./CONTRIBUTING.md), [commands](./Docs/REFERENCE.md), [publishing](./Docs/RELEASE.md).

Direct reads and scoped searches suffice. Optional discovery, bounded search and change-review commands live in [Agent discovery](./Docs/AGENT_DISCOVERY.md). Read surrounding code as needed; skip already-understood material and broad dumps.

## High-risk invariants

- Outside `shared/stores/`, use capability ports. Writes go through `dispatchRunSessionCommand()` and `run-session-write-port.ts`.
- Run/battle controllers travel through route/shell props. Only `AppScreenChromeProvider` and `CardDescriptionProvider` are allowed providers; presentation state may use `ui-store`.
- `BattleState` is immutable. Gameplay uses seeded `world` RNG and `Math.round` for combat magnitudes. Shared tuning belongs in `src/lib/game-constants/`; content magnitudes stay with definitions.
- `descriptionLines` matches effects. Grant run materials through `awardMaterialsDuringRun()`.
- Change persistence schemas, defaults, hydration and fixtures together. Current-format resume must work; historical compatibility is not required before a supported release; restart or exit incompatible battles.
- Screens are statically imported and art eager. Generated barrels are outputs: edit the manifest and regenerate.
- Import boundaries live in `eslint.config.js`, `eslint/boundaries.js`, `eslint/fragments.js`, and `dependency-cruiser.config.mjs`. Keep I/O, clocks and RNG at seams.
- UI uses typed plain function components, `cn()`, and [UI conventions](./Docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Review and handoff

Review the final diff and surrounding integration. Names, types and meaningful tests express behavior; comments explain non-obvious reasons, ordering or compatibility. ESLint suppressions require a reason.

Use [architect](./.agents/skills/architect/SKILL.md) for new or structurally revised cross-boundary contracts and [verifier](./.agents/skills/verifier/SKILL.md) after edits and before handoff. Other [skills](./.agents/skills/README.md) apply only to their workflows. CONTRIBUTING owns gates and test value, including consolidation or retirement while preserving meaningful protection.

Use the current checkout. Commit, push, branch or open a PR only when requested; never switch branches implicitly. Commits use Conventional Commits and the `User-Facing` trailer ([release policy](./Docs/RELEASE.md#changelog-release-time-only)); do not edit `CHANGELOG.md`.

Confirm completion. Report results, checks actually run, limitations, incidental fixes, material test retirements and unresolved decisions without logs or diff dumps. Node/npm versions are in `package.json`.
