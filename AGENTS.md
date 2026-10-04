# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Use plain language and player-facing names; add code details when they explain a decision or risk.

## Working style

- Default to `npm run check -- <task-owned paths>`; documentation edits also run `npm run docs:check`. `npm test` is bounded Node smoke; focused, dependency-related and full unit suites (including DOM) may run without approval via `npm run test:full -- <paths>`. Browser/Electron, coverage, mutation, profiling, full static checks, builds, packaging, `check:full` and `verify:full` require an explicit local-execution request. [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) owns gate details.
- Add high-value tests by default and actively retire encountered low- and medium-value tests after checking their purpose and dependencies. Rare additions and borderline retention need a concrete reason; adding no test is valid. Follow [test value](./CONTRIBUTING.md#test-value-and-coverage-strategy) for selection, scoped retirement, and reporting.
- Inspect working-tree status and relevant diffs before editing. Preserve existing work; re-read shared files when another session may be editing them. Ask only when intent or a safe merge is ambiguous.
- For authorized interactive browser reviews, use `npm run agent:browser` from [preview ownership](./CONTRIBUTING.md#agent-preview-ownership) and reuse that session. Under Codex it tracks and cleans up task sessions automatically; other agents get the native passthrough, so close only sessions you opened and report any cleanup failure.
- Complete requested behavior and blockers. Fix small, understood adjacent issues; report substantial independent findings. Avoid broad cleanup; run [audits](./Docs/Audits/README.md) only on request. Decide routine details; ask about consequential unresolved choices.
- Reuse owners and libraries; justify new dependencies or abstractions with concrete consumers. Preserve behavior and external contracts.
- Start unclear failures with the compact run record or failure digest ([triage](./Docs/REFERENCE.md#failure-first-triage)) and a specific hypothesis. Reassess unproductive approaches; consult [knowledge](./.agents/knowledge/index.md) when history helps. Record unresolved recurring friction and consequential lessons in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md); reusable prevention belongs in its canonical owner. Routine fixes need no history entry.
- Never clear existing work with destructive Git commands. If the [Git safety guard](./scripts/README.md#worktree--git-safety) stashes and blocks a command, inspect and apply its backup, verify recovery, then drop the backup. The guard is not authorization.
- For parallel implementation use `node scripts/agent-worktree.mjs create --task <slug>`; assign disjoint ownership and review integration.

## Find the owner

Read affected contracts and consumers; update the canonical owner when changing an invariant. Resolve docs/code/test disagreements from intent, then at most five relevant commits if needed.

- [Run state/persistence](./Docs/RUN_STATE.md), [run/save workflows](./Docs/RUN_WORKFLOWS.md), [save compatibility](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- [Architecture/controllers/boot](./Docs/ARCHITECTURE.md), [screen workflows](./Docs/WORKFLOWS.md).
- [Content](./Docs/CONTENT_AUTHORING.md), [battle rules](./Docs/GAME_RULES.md), [effect handlers](./src/lib/game-data/effects/BATTLE_HANDLERS.md).
- [Assets](./Docs/WORKFLOWS-ASSETS.md), [Gear](./Docs/ARMORY.md), [unique items](./Docs/UNIQUE_ITEMS.md).
- [UI](./Docs/UI.md), [audio](./Docs/AUDIO.md), [performance](./Docs/PERFORMANCE.md).
- [Verification/tests](./CONTRIBUTING.md), [commands](./Docs/REFERENCE.md), [publishing](./Docs/RELEASE.md), [Steam demo](./Docs/STEAM_DEMO.md).
- Otherwise, use the [documentation map](./README.md#documentation).

Direct reads and scoped searches suffice. Optional discovery, bounded search and change-review commands live in [Agent discovery](./Docs/AGENT_DISCOVERY.md). Read surrounding code as needed; skip already-understood material and broad dumps.

## High-risk invariants

- Apply [Every player action receives feedback](./Docs/UI.md#every-player-action-receives-feedback) to UI, UX, and gameplay design, implementation, and review: supported actions need timely visible acknowledgment and clear outcomes; audio may reinforce them, and essential meaning survives mute.
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

Confirm completion. Report results, checks actually run, limitations, incidental fixes, material test retirements and unresolved decisions without logs or diff dumps.
