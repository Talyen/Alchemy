# Localization

English is Alchemy's authoritative text. The shipped language registry is
`src/lib/localization/locales/languages.json`; it owns native names, locale IDs and
Steam export codes for English, German, Simplified Chinese, Russian, Spanish–Spain
and Brazilian Portuguese. AI coding agents translate and review
changed messages as part of their normal development task. There is no translation
service, AI API key, or runtime translation request. This uses the existing agent
allowance; deterministic scripts cannot generate new translations by themselves.

## Runtime and ownership

`src/lib/localization/runtime.ts` owns the framework-free i18next core.
`src/components/localization.tsx` supplies React hooks and movable UI slots. Initialize
bundled catalogs before rendering; language selection follows an explicit local
override, Steam's per-game language, system/browser preferences when Steam is
unavailable, then English. The override is stored separately from progress and
Steam Cloud. Reset Options returns it to Automatic; Clear Save Data preserves it.

React presentation uses `const i18n = useGameTranslation()`. Call `i18n.text`
and `i18n.displayText` in components; use `i18n.read(() => helper(...))` for
presentation helpers that read localization. Include `i18n` in explicit memo
dependencies. This makes language changes visible to React Compiler caches.
Global readers belong in non-React helpers; the offline gate rejects their use
inside component bodies. Use `text(id, English,
values)` for complete messages and `GameMessage` for sentences containing movable
React slots. `displayText` resolves canonical catalog strings at rendering
boundaries. Translate catalog names before supplying message parameters; `text`
interpolates those values verbatim. Generic controls pass already translated props
and children through, so a German `Stab` (staff) cannot be translated a second
time as the English attack name. It never changes catalog data, gameplay IDs or comparisons. Language
switches do not remount the application or dispatch gameplay commands.

English messages are extracted from explicit UI calls, content fields, and the
registered card/Gear catalogs. Existing content text has source-derived lookup
keys; use descriptive explicit IDs for new UI messages and preserve them when
rewording. Content-only changes still require extraction. Generated card templates
are enumerated with representative magnitude forms without using gameplay RNG.

Structured card descriptions retain effect references and stable magnitude IDs.
Their additive `message` cache records the English template and semantic slots;
rendering and hydration regenerate it from the saved description/effects. Keyword
tags carry IDs independently of translated words. Reordering a translated slot
preserves corruption/distillation marks. Unrecognized legacy wording falls back
to English without replacing modified effects or discarding the run.

Catalog metadata stays in the repository. A generated runtime JSON asset contains
only display strings and is packaged beside the renderer. Both editions load it
locally before mounting React. The packaged CSP permits same-origin `alchemy://app`
requests for these assets and continues to block external connections. English defaults remain usable if that asset fails
to load. No translation server is contacted.

English metadata and canonical translations use one JSON message record per line,
formatted by `i18n:extract` and checked by `i18n:check`. Translation files store only
canonical entries with their source hashes, review status and plural forms.
Identical-message and numeric aliases are expanded during compilation and validation;
they never duplicate translations or review metadata in the authored locale files.
The generated runtime asset stores each canonical message and shared alias only
once, with a fixed language order and exact English overrides where keyword
canonicalization changes case. `catalog-format.mjs` validates and expands this
versioned data before installing resources. The offline check compares every expanded
message against the authoritative compiler output, including plurals and slots.
Build and package gates validate all shipped languages and the asset digest.

## Agent workflow

The [localization skill](../.agents/skills/localization/SKILL.md) applies whenever
player-facing text changes.

1. Run `npm run i18n:extract` to refresh English, remove obsolete entries, and
   regenerate runtime/Steam exports.
2. Run `npm run i18n:tasks` for JSON packets containing only missing, stale, or
   unreviewed canonical entries. Packets include context, source hashes, relevant
   terminology, and prior translations. Repeated wording and exact-number catalog
   aliases reuse canonical translations mechanically.
3. The current agent drafts translations, then reviews their meaning separately.
   Preserve negation, actors, conditions, timing, quantities, semantic tags and
   placeholders. There is no manual translation or human-review requirement.
4. Apply a JSON result using `npm run i18n:apply -- <file>`. Its shape is
   `{ "locale": "de", "results": { "message.id": { "text": "…", "sourceHash": "…", "reviewed": true } } }`.
   Plural messages also require `forms` for every category in the target locale's
   `Intl.PluralRules`; the default text equals `forms.other`.
5. Run `npm run i18n:check`. Source/context changes, relevant glossary changes,
   missing review, invalid placeholders/tags/plurals, orphan entries, stale runtime
   assets and stale Steam exports fail the check.

The local check, locked integration, CI static gate and verified builds enforce
this check. They never call a model or modify translations. If integration
incorporates changed English, the agent updates its translations and retries.
Machine checks protect structural validity and freshness, not native-speaker
quality; AI semantic review remains part of completing the task.

## Qualification and Steam

Expanded English is a developer-only layout tool. Chinese and Russian use bundled
Noto Sans SC and Noto Sans variable font subsets with their OFL licenses. The
subsets retain variable weights, hinting and layout features, Latin characters,
punctuation, symbols, and every required Chinese/Cyrillic catalog glyph and native
language label. The offline gate reads the actual bundled character maps and
rejects missing glyphs; adding an uncovered character blocks integration
until the fonts are regenerated. Native
language names use the same fallbacks even before selecting those languages.
Verified renderer packages also check a generated catalog manifest and SHA-256
digest, so omitted or corrupted bundled catalogs cannot pass packaging.
Font regeneration is an explicit authoring operation, separate from offline checks:

```sh
python3 -m venv reports/font-tools
reports/font-tools/bin/python -m pip install fonttools==4.60.1
ALCHEMY_FONT_PYTHON=reports/font-tools/bin/python npm run i18n:fonts
npm run i18n:check
```

The generator uses commit-pinned Google Fonts URLs and verifies source SHA-256
digests before subsetting. `--source-dir <directory>` accepts those original TTF
files for offline regeneration; ordinary checks and builds require neither Python
nor network access. Outputs are deterministic. Keep the source notices and OFL
licenses with the subsets. The tool and options follow the
[fontTools subset documentation](https://fonttools.readthedocs.io/en/latest/subset/index.html).

Use the browser acceptance scenarios to check live switching, focus, clipping,
keyword interactions, and saved combat. Browser/Electron and builds follow the
execution policy in [CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change).

The opt-in localization layout review runs the existing acceptance journeys at 1280×720
with the current maximum Game Size and Tooltip Size settings. It checks popup and
control bounds and captures Options tabs, combat, shops and confirmations under
`reports/localization-layout/` for visual review:

```sh
ALCHEMY_LOCALIZATION_LAYOUT_REVIEW=1 npm run test:e2e:dev -- tests/e2e/specs/localization.spec.ts --workers=1
```

The deeper gameplay review covers mixed/distilled Potions, transmutation previews
and generated names, corruption, Homestead purchases, Gear crafting, Labyrinth
discovery and reward claims. It checks acknowledged checkpoints after closing the
seeded page, then resumes in a different language and compares saved effects,
description marks, inventories, resources and RNG. The Homestead journey also
checks complete translated benefit lines and the edge placement of long tooltips.

```sh
ALCHEMY_LOCALIZATION_LAYOUT_REVIEW=1 npm run test:e2e:dev -- tests/e2e/specs/localization-gameplay.spec.ts --workers=1
```

Review the packaged Electron Options tabs, including desktop display controls,
at the same settings with (choose a shipped locale ID):

```sh
npm run build:desktop
ALCHEMY_LOCALIZATION_LAYOUT_REVIEW=1 ALCHEMY_LOCALIZATION_REVIEW_LOCALE=zh-Hans npm run test:ship:desktop
```

Real Steam install/update and per-game language qualification require an approved
Steamworks partner account and registered full/demo App IDs. Development App ID
480 and isolated Electron profiles cannot qualify those behaviors. Complete that
gate on Windows after account verification and app registration.

`steam/store-copy.source.json` owns draft full-game/demo listing text. Extraction
produces `steam/localized-store-copy.json` and `steam/rich-presence.vdf`. Presence
uses Steam localization tokens, including a localized hero token, so friends see
text in their own Steam language. Keep these exports synchronized through the same
AI workflow. They are prepared assets; generating them does not publish anything.

Before advertising a language, qualify the build and configure interface-language
support, base game languages and localized store copy separately for both Steam
App IDs. Upload presence localization in Steamworks. Text catalogs remain in the
existing depots. [Valve's localization guide](https://partner.steamgames.com/doc/store/localization)
and [Rich Presence guide](https://partner.steamgames.com/doc/api/ISteamFriends#richpresencelocalization)
own the external setup; release authorization remains unchanged.

## Language rollout

Until Alchemy has its own audience data, use Steam-wide language usage as a
provisional prioritization signal. The combined-platform
[September 2026 Steam survey](https://store.steampowered.com/hwsurvey/Steam-Hardware-Software-Survey-Welcome-to-Steam)
reports the following interface-language shares:

| Bundled language     | Survey share |
| -------------------- | -----------: |
| English              |       34.20% |
| Simplified Chinese   |       31.39% |
| Russian              |        9.05% |
| Spanish–Spain        |        4.08% |
| Brazilian Portuguese |        3.70% |
| German               |        2.48% |

These shares sum to 84.90% of survey respondents' selected interface languages;
they do not estimate Alchemy sales, incremental reach or player language fluency.
Participation is optional and anonymous, and monthly shares fluctuate. Recheck the
survey before committing the launch scope.

The rollout after German follows Simplified Chinese, Russian, Spanish–Spain, then
Brazilian Portuguese. Japanese (2.41%) and French (2.08%) remain the next candidates,
bringing the selected shares to 89.39%. This ordering is our
inference from the survey, not a claim about deckbuilder purchasing behavior.
Spanish–Latin America and European Portuguese are separate locales; do not count
them as qualified by the Spanish–Spain and Brazilian catalogs.

Keep future candidate languages disabled until their complete catalogs, AI semantic
review, fonts, save/resume and rendered layouts pass. Each bundled language still
requires the real Steam/Windows release gate above before its Steam support is
advertised. Once a store page exists, use regional wishlists,
traffic and community feedback to revise this order, as recommended by
[Valve's localization guidance](https://partner.steamgames.com/doc/store/localization).
