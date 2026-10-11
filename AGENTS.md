# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Use plain language and player-facing names; include code details when useful.

## Working style

- Run `npm run check -- <task-owned paths>` before handoff; docs also need `npm run docs:check`. Unit suites (including DOM) may run without approval via `npm run test:full -- <paths>`; `npm test` is bounded Node smoke. Browser/Electron, coverage, mutation, profiling, full static checks, builds, packaging, `check:full` and `verify:full` require an explicit local-execution request. [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) owns gates.
- Follow [test value](./CONTRIBUTING.md#test-value-and-coverage-strategy): add high-value tests by default; actively retire encountered low/medium-value tests after checking purpose and dependencies. Justify rare additions and borderline retention; adding no test is valid.
- Inspect status and relevant diffs before editing. Start mixed checkouts with `npm --silent run review:status`, then scope patches to task paths; whole-checkout work requires the complete inventory. Preserve existing work and re-read concurrently edited files. Ask only about ambiguous intent, unsafe merges, or consequential unresolved choices.
- For authorized browser reviews, reuse `npm run agent:browser` ([preview ownership](./CONTRIBUTING.md#agent-preview-ownership)). Codex tracks and cleans up task sessions; other agents must close only sessions they opened. Report cleanup failures.
- Complete requested behavior and blockers; fix small understood adjacent issues, report substantial independent findings. Avoid broad cleanup; run [audits](./Docs/Audits/README.md) only on request. Reuse owners/libraries; justify new dependencies or abstractions with concrete consumers. Preserve behavior and external contracts.
- Start unclear failures with a compact digest and specific hypothesis ([triage](./Docs/REFERENCE.md#failure-first-triage)); reassess unproductive approaches and consult owners/history. Keep only unresolved recurring issues in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md); move prevention to its owner and delete resolved entries. Do not archive completed tasks, reports, conversations, or instruction decisions.
- Never discard work with destructive Git commands. If the [Git safety guard](./scripts/README.md#worktree--git-safety) stashes and blocks, inspect/apply its backup, verify recovery, then drop it. The guard grants no authorization.
- For parallel implementation use `node scripts/agent-worktree.mjs create --task <slug>`; assign disjoint ownership and review integration.

## Find the owner

Read affected contracts and consumers; update the canonical owner of changed invariants. Resolve disagreements from intent, then at most five relevant commits.

- [Run state/persistence](./Docs/RUN_STATE.md), [run/save workflows](./Docs/RUN_WORKFLOWS.md), [save compatibility](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- [Architecture/controllers/boot](./Docs/ARCHITECTURE.md), [screen workflows](./Docs/WORKFLOWS.md).
- [Content](./Docs/CONTENT_AUTHORING.md), [battle rules](./Docs/GAME_RULES.md), [effect handlers](./src/lib/game-data/effects/BATTLE_HANDLERS.md).
- [Assets](./Docs/WORKFLOWS-ASSETS.md), [Gear](./Docs/ARMORY.md), [unique items](./Docs/UNIQUE_ITEMS.md).
- [UI](./Docs/UI.md), [audio](./Docs/AUDIO.md), [performance](./Docs/PERFORMANCE.md).
- [Verification/tests](./CONTRIBUTING.md), [commands](./Docs/REFERENCE.md), [publishing](./Docs/RELEASE.md), [Steam demo](./Docs/STEAM_DEMO.md).
- Otherwise, use the [documentation map](./README.md#documentation).

Read known owners directly. Otherwise find filenames, scope searches, then read relevant sections/symbols and consumers. Reuse unchanged context; narrow truncated searches. [Agent discovery](./Docs/AGENT_DISCOVERY.md) provides owner ranges, batched topics and `review:diff -- --summary <paths>` for large patch sets.

## High-risk invariants

- [Show, don’t tell](./Docs/UI.md#show-dont-tell): concise labels and visible state/outcomes; avoid routine instructions, paragraphs, or redundant success copy. Preserve mechanics, accessible names, and concise errors.
- [Every player action receives feedback](./Docs/UI.md#every-player-action-receives-feedback): supported actions need timely visible acknowledgment and clear outcomes in UI/UX/gameplay design, implementation, and review. Essential meaning survives mute.
- Outside `shared/stores/`, use capability ports. Writes go through `dispatchRunSessionCommand()` and `run-session-write-port.ts`.
- Pass run/battle controllers through route/shell props. Only `AppScreenChromeProvider` and `CardDescriptionProvider` are allowed providers; presentation state may use `ui-store`.
- `BattleState` is immutable. Gameplay uses seeded `world` RNG and `Math.round` for combat magnitudes. Shared tuning belongs in `src/lib/game-constants/`; content magnitudes stay with definitions.
- `descriptionLines` matches effects. Grant run materials through `awardMaterialsDuringRun()`.
- Change persistence schemas/defaults/hydration/fixtures together. Current-format resume must work; historical compatibility is not required before a supported release. Restart or exit incompatible battles.
- Screens are statically imported and art eager. Generated barrels are outputs: edit the manifest and regenerate.
- Import boundaries live in `oxlint.config.ts`, `lint/boundaries.js`, `lint/fragments.js`, and `dependency-cruiser.config.mjs`. Keep I/O, clocks and RNG at seams.
- UI uses typed plain function components, `cn()`, and [UI conventions](./Docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Review and handoff

Review the final diff and integration. Express behavior through names/types/tests; comments explain non-obvious reasons, ordering or compatibility. Justify Oxlint suppressions.

Use [architect](./.agents/skills/architect/SKILL.md) for new/structurally revised cross-boundary contracts and [verifier](./.agents/skills/verifier/SKILL.md) after edits and before handoff. Other [skills](./.agents/skills/README.md) apply only to their workflows.

Use the current checkout; commit/push/branch/PR only when requested. Never switch branches implicitly. Use Conventional Commits and the `User-Facing` trailer ([release policy](./Docs/RELEASE.md#changelog-release-time-only)); do not edit `CHANGELOG.md`.

Report completion, checks run, limitations, incidental fixes, material test retirements and unresolved decisions. Omit logs and diff dumps.
