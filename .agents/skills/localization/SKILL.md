---
name: localization
description: Keep Alchemy translations synchronized when changing player-facing UI, game content, generated descriptions, or Steam copy. Excludes developer-only diagnostics and prose documentation.
---

# AI localization

English is authoritative. The active coding agent performs translation and semantic review using its current session; do not require a paid service, API key, human translator, or a separate localization request.

Read [the localization owner](../../../Docs/LOCALIZATION.md) for contracts and command formats.

- Use stable, descriptive message IDs and whole sentences with named parameters. Preserve existing IDs when rewording. New React components subscribe through `useGameTranslation()`; localize visible and accessible text at render time. Keep IDs, comparisons, effects and saved mechanics in English/data form.
- After editing text, run `npm run i18n:extract`, then `npm run i18n:tasks`. Translate only the pending canonical entries into every requested locale. Reuse unchanged translations; do not stamp an outdated translation as reviewed to silence a gate.
- Review the draft against its English source in a separate pass: negation, actor, timing, conditions, quantities, percentages, alternatives, permanence, and glossary consistency. Inflect glossary terms naturally. Preserve all named parameters, semantic tags, Steam tokens, and required plural forms.
- Put the reviewed results in a task-local JSON file, apply with `npm run i18n:apply -- <file>`, then run `npm run i18n:check`. Repair failures before handoff. The apply command refuses stale source hashes and validates the complete input before writing.
- If wording changes during integration, regenerate the packets and repair affected translations in the task worktree. Do not bypass the integration check or translate inside its lock.
- Language switching must preserve progress, RNG, purchases, modified cards and focus. Keep source card magnitude identities and keyword IDs; translations never determine mechanics. Legacy unrecognized saved wording may fall back to English.

Do not enable additional shipped languages just because their catalogs are complete. Apply the existing browser/build policy and qualify their fonts, layout, accessibility and save/resume behavior. Steam publication still requires the existing release authorization.
