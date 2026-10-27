# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Use plain language and player-facing names; include code details when useful.

## Working style

- Inspect status and relevant diffs before editing. Start mixed checkouts with `npm --silent run review:status`, scope patches to task paths, and re-read concurrently edited files.
- Complete the requested behavior and small understood blockers. Reuse existing owners and libraries; preserve external contracts. Run [audits](./Docs/Audits/README.md) only on request and avoid unrelated cleanup.
- Work independently. Message another chat only for a concrete unresolved dependency or conflict that repository inspection cannot answer. Do not send routine messages, poll other chats or wake completed chats.
- Start unclear failures with a compact digest and a hypothesis under [failure-first triage](./scripts/VERIFICATION.md#failure-first-triage). Keep only unresolved recurring issues in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md).

## Task lifecycle

1. Reuse this chat's suitable isolated worktree or run `node scripts/agent-worktree.mjs create --task <slug>` from the original workspace. Start implementation from committed local `main`; dependencies are linked, so run `npm ci` only when they change.
2. Use `node scripts/agent-worktree.mjs status --task <slug>` to inspect or resume the task. Read current main in `.worktrees/integration`; the original workspace may intentionally lag on its workspace branch. Implement and check in the task checkout. [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) owns verification permissions, gate selection and completion requirements. Use the lightweight task gate by default; heavy local verification requires an explicit user request under that policy.
3. Review the final diff and commit only task-owned paths. Use Conventional Commits and the `User-Facing` trailer under [release policy](./Docs/RELEASE.md#changelog-release-time-only); do not edit `CHANGELOG.md`.
4. Run `node scripts/agent-worktree.mjs integrate --task <slug>` from the original workspace. The [integration tool](./scripts/README.md#integration-and-finish-phases) merges current main, checks the pinned combined result outside the shared lock, then advances main under the lock, retrying if main changes. Resolve understood conflicts in the task and retry; report ambiguous ones. Never bypass the tool.
5. Review integration, then run `node scripts/agent-worktree.mjs finish --task <slug>` from the original workspace. It preserves evidence, closes task browsers and removes the worktree while retaining its branch. Keep it open while further requested work or a preview needs it. Keep unintegrated work committed and recoverable.

Preserve unrelated work in every checkout. Never switch another checkout's branch,
overwrite dirty main, discard edits, force-remove worktrees or delete task branches.
The [Git safety guard](./scripts/README.md#worktree--git-safety) blocks unsafe commands
without changing files or stashes. Unrelated original-workspace edits do not block integration.
Task commits and local integration are authorized; pushes, PRs, publication and
destructive cleanup require a separate request. Run authorized pushes/releases in
the dedicated main checkout. [The worktree reference](./scripts/README.md#worktree--git-safety)
covers setup and recovery.

## Find the owner

Read affected contracts and consumers; update the canonical owner of changed invariants. Resolve disagreements from intent, then at most five relevant commits.

- [Run state/persistence](./Docs/RUN_STATE.md), [run/save workflows](./Docs/RUN_WORKFLOWS.md), [save compatibility](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- [Architecture/controllers/boot](./Docs/ARCHITECTURE.md), [screen workflows](./Docs/WORKFLOWS.md).
- [Content](./Docs/CONTENT_AUTHORING.md), [battle rules](./Docs/GAME_RULES.md), [effect handlers](./src/lib/game-data/effects/BATTLE_HANDLERS.md).
- [Assets](./Docs/WORKFLOWS-ASSETS.md), [Gear](./Docs/ARMORY.md), [unique items](./Docs/UNIQUE_ITEMS.md).
- [UI](./Docs/UI.md), [audio](./Docs/AUDIO.md), [performance](./Docs/PERFORMANCE.md).
- [Verification/tests](./CONTRIBUTING.md), [commands](./Docs/COMMANDS.md), [publishing](./Docs/RELEASE.md), [Steam demo](./Docs/STEAM_DEMO.md).
- Otherwise, use the [documentation map](./README.md#documentation).

Read known owners directly. Otherwise find filenames, scope searches, then read relevant sections/symbols and consumers. Reuse unchanged context; narrow truncated searches. [Agent discovery](./Docs/AGENT_DISCOVERY.md) provides owner ranges, batched topics and `review:diff -- --summary <paths>` for large patch sets.

## High-risk invariants

- Player-facing text changes must keep every shipped language current before integration. Settle draft wording in the task worktree, then use [localization](./.agents/skills/localization/SKILL.md) to translate and review the final wording.
- Visible changes use [frontend-design](./.agents/skills/frontend-design/SKILL.md) and its [visual review requirements](./Docs/UI_VISUAL_REVIEW.md). Preserve useful feedback, essential mechanics and accessible names; keep copy concise. Use `npm run agent:browser` for rendered review under [preview ownership](./CONTRIBUTING.md#agent-preview-ownership).
- Follow [UI copy conventions](./Docs/UI.md#show-dont-tell).
- For common mutation work, start with [the production examples](./Docs/RUN_STATE.md#common-implementation-paths). Outside `shared/stores/`, use capability ports. Feature adapters call intent commands; command owners compose `dispatchRunSessionCommand()` and `run-session-write-port.ts` operations.
- Pass run/battle controllers through route/shell props. Only `AppScreenChromeProvider` and `CardDescriptionProvider` are allowed providers; presentation state may use `ui-store`.
- `BattleState` is immutable. Gameplay uses seeded `world` RNG and `Math.round` for combat magnitudes. Shared tuning belongs in `src/lib/game-constants/`; content magnitudes stay with definitions.
- `descriptionLines` matches effects. Grant run materials through `awardMaterialsDuringRun()`.
- Change persistence schemas/defaults/hydration/fixtures together. Current-format resume must work; historical compatibility is not required before a supported release. Restart or exit incompatible battles.
- Screens are statically imported and art eager. Generated barrels are outputs: edit the manifest and regenerate.
- Import boundaries live in `oxlint.config.ts`, `lint/boundaries.js`, `lint/fragments.js`, and `dependency-cruiser.config.mjs`. Keep I/O, clocks and RNG at seams.
- UI uses typed plain function components, `cn()`, and [UI conventions](./Docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Review and handoff

Express behavior through names, types and tests. Comments explain non-obvious
reasons, ordering or compatibility; justify Oxlint suppressions.
Use [architect](./.agents/skills/architect/SKILL.md) for new or structurally revised
cross-boundary contracts; other [skills](./.agents/skills/README.md) apply only to
their workflows. Follow the [task lifecycle](#task-lifecycle) through integration review and finish.

Report completion, checks run, limitations, incidental fixes, material test retirements and unresolved decisions. Omit logs and diff dumps. Then stop.
