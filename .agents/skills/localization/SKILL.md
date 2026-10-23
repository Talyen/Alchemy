---
name: localization
description: Keep Alchemy translations synchronized when changing player-facing UI, game content, generated descriptions, or Steam copy. Excludes developer-only diagnostics and prose documentation.
---

# AI localization

The active coding agent translates and separately reviews changed English using
its current session. Complete this work within the implementation task; no paid
service, API key, human translator or separate request is required.

1. Draft English in the task worktree until the wording settles.
2. Follow [runtime conventions](../../../Docs/LOCALIZATION.md#runtime-and-ownership)
   and the [prepare → translate → review → finish workflow](../../../Docs/LOCALIZATION.md#agent-workflow).
   Batch affected messages across every shipped locale and reuse unchanged translations.
3. Complete freshness checks before integration. If integration changes English,
   refresh the same packet and repair translations in the task worktree; never
   translate inside the integration lock or mark stale wording reviewed.

[Qualification](../../../Docs/LOCALIZATION.md#qualification-and-steam) and
[language rollout](../../../Docs/LOCALIZATION.md#language-rollout) govern fonts,
rendered layouts, save/resume and advertised support. Catalog completeness alone
does not authorize enabling another language. Execution and release permissions
remain in [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change).
