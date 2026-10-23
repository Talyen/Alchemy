# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder. Use plain language and player-facing names; include code details when useful.

## Working style

- Inspect status and relevant diffs before editing. Start mixed checkouts with `npm --silent run review:status`, then scope patches to task paths. Preserve unrelated work; re-read concurrently edited files.
- Use one isolated worktree per implementation chat, starting from committed local `main`. Reuse this chat's suitable worktree or run `node scripts/agent-worktree.mjs create --task <slug>` from the original checkout. Dependencies are linked automatically; run `npm ci` only when dependencies change.
- Complete the requested behavior and small understood blockers. Avoid broad cleanup and run [audits](./Docs/Audits/README.md) only on request. Reuse existing owners and libraries; preserve external contracts.
- [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) is the sole owner of verification permissions, gate selection and completion requirements. Use its primary task, unit and broad-check commands; other guides link there rather than restating policy.
- Review the final diff, commit only task-owned paths, then run `node scripts/agent-worktree.mjs integrate --task <slug>` from the original checkout. Task commits and local integration are authorized; pushes, PRs, publication and destructive cleanup need a separate request. The [integration tool](./scripts/README.md#worktree--git-safety) serializes main snapshot/merge and advancement, verifying the pinned combined result outside the shared lock and retrying if main advances. Never bypass it or overwrite dirty work. Resolve understood conflicts in the task worktree and retry; report ambiguous conflicts or dirty-main blockers.
- Never discard work with destructive Git commands. The [Git safety guard](./scripts/README.md#worktree--git-safety) blocks unsafe commands without stashing or changing files.
- Work independently. Message another chat only for a concrete unresolved dependency or conflict that repository inspection cannot answer. Do not send routine messages, poll other chats or wake completed chats.
- Start unclear failures with a compact digest and a specific hypothesis under [failure-first triage](./Docs/REFERENCE.md#failure-first-triage). Keep only unresolved recurring issues in [.agents/FRICTION_LOG.md](./.agents/FRICTION_LOG.md); do not archive completed tasks or instruction decisions.

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

- Player-facing text changes must keep every shipped language current before integration. Settle draft wording in the task worktree, then use [localization](./.agents/skills/localization/SKILL.md) to translate and review the final wording.
- Visible changes use [frontend-design](./.agents/skills/frontend-design/SKILL.md) and its [visual review requirements](./Docs/UI_VISUAL_REVIEW.md). Preserve useful feedback, essential mechanics and accessible names; keep copy concise. Use `npm run agent:browser` for rendered review under [preview ownership](./CONTRIBUTING.md#agent-preview-ownership).
- For common mutation work, start with [the production examples](./Docs/RUN_STATE.md#common-implementation-paths). Outside `shared/stores/`, use capability ports. Feature adapters call intent commands; command owners compose `dispatchRunSessionCommand()` and `run-session-write-port.ts` operations.
- Pass run/battle controllers through route/shell props. Only `AppScreenChromeProvider` and `CardDescriptionProvider` are allowed providers; presentation state may use `ui-store`.
- `BattleState` is immutable. Gameplay uses seeded `world` RNG and `Math.round` for combat magnitudes. Shared tuning belongs in `src/lib/game-constants/`; content magnitudes stay with definitions.
- `descriptionLines` matches effects. Grant run materials through `awardMaterialsDuringRun()`.
- Change persistence schemas/defaults/hydration/fixtures together. Current-format resume must work; historical compatibility is not required before a supported release. Restart or exit incompatible battles.
- Screens are statically imported and art eager. Generated barrels are outputs: edit the manifest and regenerate.
- Import boundaries live in `oxlint.config.ts`, `lint/boundaries.js`, `lint/fragments.js`, and `dependency-cruiser.config.mjs`. Keep I/O, clocks and RNG at seams.
- UI uses typed plain function components, `cn()`, and [UI conventions](./Docs/UI.md). Cosmetic RNG uses `useState(() => ...)`, never `Math.random()` in render.

## Review and handoff

Review the final diff and integration. Express behavior through names/types/tests; comments explain non-obvious reasons, ordering or compatibility. Justify Oxlint suppressions.

Use [architect](./.agents/skills/architect/SKILL.md) for new or structurally revised cross-boundary contracts. Other [skills](./.agents/skills/README.md) apply only to their workflows; ordinary verification follows CONTRIBUTING directly.

Use the task worktree; do not switch another checkout's branch. Successful integration preserves selected review evidence, closes task browsers and removes the named task worktree under the [cleanup procedure](./scripts/README.md#worktree--git-safety), while retaining its task branch; add `--keep-worktree` while requested work, a preview or an experiment still needs the checkout. Keep unintegrated work committed and recoverable; never force-remove worktrees or delete branches. Pushes, PRs, publication, and destructive cleanup require separate authorization. Use Conventional Commits and the `User-Facing` trailer ([release policy](./Docs/RELEASE.md#changelog-release-time-only)); do not edit `CHANGELOG.md`.

Report completion, checks run, limitations, incidental fixes, material test retirements and unresolved decisions. Omit logs and diff dumps. Then stop.
