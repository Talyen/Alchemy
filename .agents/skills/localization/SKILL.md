---
name: localization
description: Keep Alchemy translations synchronized when changing player-facing UI, game content, generated descriptions, or Steam copy. Excludes developer-only diagnostics and prose documentation.
---

# AI localization

English is authoritative. The active coding agent performs translation and semantic review using its current session; do not require a paid service, API key, human translator, or a separate localization request.

Draft and compare English wording in the isolated task worktree first. Batch translation and semantic review after the wording settles, before final verification and integration; no translation cycle is required for each experiment. Do not bypass freshness checks or integrate stale catalogs.

Read [the localization owner](../../../Docs/LOCALIZATION.md) for contracts and command formats.

- Use stable, descriptive message IDs and whole sentences with named parameters. Preserve existing IDs when rewording. React components use `const i18n = useGameTranslation()` and its `text`/`displayText` methods. Wrap localization-reading helpers in `i18n.read(() => helper(...))` and include `i18n` in explicit memo dependencies so React Compiler updates cached text. Global readers belong in non-React helpers. Localize visible and accessible text at render time. Keep IDs, comparisons, effects and saved mechanics in English/data form.
- Follow the [agent workflow](../../../Docs/LOCALIZATION.md#agent-workflow): `npm run i18n:prepare -- <task-file.json>`, translate and separately review the generated results, then `npm run i18n:finish -- <task-file.json>`. Reuse unchanged translations and never mark stale wording reviewed to silence a gate.
- If source changes during integration, refresh the same packet with `i18n:prepare` and repair affected translations in the task worktree before retrying; never translate inside the integration lock.
- Language switching must preserve progress, RNG, purchases, modified cards and focus. Keep source card magnitude identities and keyword IDs; translations never determine mechanics. Legacy unrecognized saved wording may fall back to English.

Do not enable additional shipped languages just because their catalogs are complete. Follow [execution permissions](../../../CONTRIBUTING.md#what-to-run-when-you-change) and qualify their fonts, layout, accessibility and save/resume behavior. Steam publication still requires the existing release authorization.
