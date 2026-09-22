# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Write in plain language using player-facing names; include code details when they explain a decision or risk.

## Working style

- Inspect `git status --short` and relevant diffs before editing. Preserve existing work and re-read shared files before edits when another session may be active. Ask only when intent or a safe merge remains ambiguous.
- Complete the requested behavior and its blockers. Fix small, understood adjacent issues; report substantial independent findings. Avoid broad cleanup or an uncited [audit](./Docs/Audits/README.md). Make routine design decisions within scope; ask about unresolved consequential choices.
- Reuse existing owners and libraries. Justify new dependencies or abstractions with concrete consumers. Preserve current behavior and external contracts. There are no historical player saves to support; do not retain obsolete mechanics solely for old saves or saved battles. Use current gameplay rules, restarting or exiting incompatible battles when needed.
- Start unclear failures with the diagnostic summary; inspect focused evidence for a specific hypothesis. Reassess unproductive approaches. Use [knowledge](./.agents/knowledge/index.md) when historical context helps.
- Record unresolved recurring friction and consequential lessons in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md); reusable prevention belongs in its canonical owner. Routine fixes need no history entry.
- Never use destructive Git commands to clear existing work. If a guard stashes and blocks a command, inspect and apply its backup, verify recovery, then drop the backup. The guard is not authorization.
- For parallel implementation use `node scripts/agent-worktree.mjs create --task <slug>`; assign disjoint ownership and review integration.

## Find the owner

Read affected contracts and consumers; update the canonical owner when changing an invariant. Resolve docs/code/test disagreements from intent and, if still ambiguous, at most five relevant commits initially.

- [Run state and persistence](./Docs/RUN_STATE.md), [run/save workflows](./Docs/RUN_WORKFLOWS.md), [save compatibility](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- [Architecture, controllers, boundaries, boot](./Docs/ARCHITECTURE.md); [screen workflows](./Docs/WORKFLOWS.md).
- [Content authoring](./Docs/CONTENT_AUTHORING.md), [battle rules](./Docs/GAME_RULES.md), [effect handlers](./src/lib/game-data/effects/BATTLE_HANDLERS.md).
- [Assets](./Docs/WORKFLOWS-ASSETS.md), [Gear](./Docs/ARMORY.md), [unique items](./Docs/UNIQUE_ITEMS.md).
- [UI](./Docs/UI.md), [audio](./Docs/AUDIO.md), [performance](./Docs/PERFORMANCE.md).
- [Verification/test policy](./CONTRIBUTING.md), [commands](./Docs/REFERENCE.md), [publishing](./Docs/RELEASE.md).

Direct reads and scoped searches are sufficient. Optional `npm run context -- <paths>` locates owner sections; `npm run search -- <literal> <paths>` bounds search results; `npm run review:diff` bounds diff output and retains a complete inventory. Read surrounding code when needed, skip already-understood material, and avoid broad dumps. Search exclusions and explicit access are documented in [Agent discovery](./Docs/AGENT_DISCOVERY.md).

## High-risk invariants

- Outside `shared/stores/`, use capability ports; writes go through `dispatchRunSessionCommand()` and `run-session-write-port.ts` ([run state](./Docs/RUN_STATE.md#run-state)).
- Run/battle controllers travel through route/shell props. Only `AppScreenChromeProvider` and `CardDescriptionProvider` are allowed providers; presentation state may use `ui-store`.
- `BattleState` is immutable; gameplay uses seeded `world` RNG and `Math.round` for combat magnitudes. Shared tuning belongs in `src/lib/game-constants/`; content-owned magnitudes stay with definitions.
- `descriptionLines` matches effects. Grant run materials through `awardMaterialsDuringRun()`.
- Change persistence schemas, defaults, hydration and fixtures together. Current-format resume must work; historical save compatibility is not required before a supported release.
- Screens are statically imported and art eager. Generated barrels are outputs: edit the manifest and regenerate.
- Import boundaries live in `eslint.config.js`, `eslint/boundaries.js`, `eslint/fragments.js`, and `dependency-cruiser.config.mjs`. Keep I/O, clocks and RNG at seams.
- UI uses typed plain function components, `cn()`, and [UI conventions](./Docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Review and handoff

Review the final diff and surrounding integration. Use names, types and meaningful tests to express behavior; comments explain non-obvious reasons, ordering or compatibility. ESLint suppressions require a reason.

Use [architect](./.agents/skills/architect/SKILL.md) for new or structurally revised cross-boundary contracts and [verifier](./.agents/skills/verifier/SKILL.md) after edits and before handoff. Other [skills](./.agents/skills/README.md) apply only to their workflows. [CONTRIBUTING](./CONTRIBUTING.md) owns gates and test value, including consolidation or retirement of low-value tests while preserving meaningful protection.

Use the current checkout. Commit, push, branch or open a PR only when requested; never switch branches implicitly. Commits use Conventional Commits and the `User-Facing` trailer ([release policy](./Docs/RELEASE.md#changelog-release-time-only)); do not edit `CHANGELOG.md`.

Confirm the requested behavior is complete. Report the result, checks actually run, limitations, incidental fixes, material test retirements and unresolved decisions without logs or diff dumps. Node/npm versions are in `package.json`.
