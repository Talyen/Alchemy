# Localization

English is Alchemy's authoritative text. The shipped language registry is
`src/lib/localization/locales/languages.json`; it owns native names, locale IDs and
Steam export codes for English, German, Simplified Chinese, Russian, Spanish–Spain,
Brazilian Portuguese, Japanese and French. AI coding agents translate and review
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
switches preserve progress, RNG, purchases, modified cards and focus without
remounting the application or dispatching gameplay commands.

Resource amounts use `formatLargeAmount(amount, i18n.locale)` at presentation
boundaries. Separators and compact units follow the selected game language, with
compaction starting at 100,000 and expanded English using English formatting.

The startup splash shows the Alchemy name until catalogs and the selected language
are ready, then starts localized phrases. The Error Log localizes its controls,
source categories, plural counts and timestamps using the selected game language.
Raw exception messages, stack traces, context payloads and copied diagnostic exports
retain their original text for troubleshooting; do not run those through catalog
lookups, where a diagnostic such as `Battle` could collide with a game label.

Inspection sorts translated card titles with the selected language's collator;
equal titles keep a fixed tie-break order without changing saved card order.

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
player-facing text changes. Draft wording may evolve in the isolated task worktree without translating each experiment. Prepare one batch after the task's English wording settles, then translate and review its affected messages across all shipped locales. Reuse unchanged translations; there is no per-edit translation cycle. [CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) owns verification and completion requirements; stale catalogs remain blocked by the freshness gate.

1. Run `npm run i18n:prepare -- <task-file.json>` (default: `reports/localization/tasks.json`). This extracts current English, refreshes derived outputs, and writes one editable packet containing only pending canonical messages and result templates for affected locales. Reusing the same path refreshes pending messages while retaining matching draft translations. Source/glossary changes clear review for affected results. Metadata and missing plural slots are rebuilt; translation and semantic review remain agent work. Before a changed packet is replaced atomically, its prior contents are saved beside it as a timestamped `.bak`, including drafts for removed or already-applied messages.
2. Edit only `results`: ordinary messages are strings; plural messages have only a `forms` map (`text` is derived from `forms.other`). The prepared `messages` retain English, prior translations, source hashes and semantic context. The packet glossary contains only terms used by its pending messages. Review meaning in a separate pass: negation, actor, timing, conditions, quantities, permanence, alternatives, and glossary consistency. Preserve named parameters, semantic tags and Steam tokens.
3. After semantic review, run `npm run i18n:finish -- <task-file.json> --reviewed`. The flag attests that the agent completed that pass; it is not an automated quality assessment. The tool copies freshness metadata from the prepared context and records review for the batch. Every locale is validated before any catalog is written; stale hashes, invalid placeholders/tags/plurals and duplicate locales are rejected. It applies the batch, regenerates outputs once, and runs complete freshness, font and export checks.

An empty packet means no translations are pending; finishing it still checks freshness.
To resume, run `npm run i18n:status -- <task-file.json>` (the default packet is
used when omitted). This read-only status compares the packet with current English,
glossary and pending catalogs, then checks result structure. It cannot establish
semantic review or overall catalog freshness; finish still requires both.
Legacy packets with per-entry `sourceHash` and `reviewed` fields remain accepted
without the flag. Editable packets require `--reviewed`; a stale English or
glossary snapshot is rejected even with that flag. Context and templates are
working files, not committed catalogs; integration preserves them with reports.

The existing `i18n:extract`, `i18n:tasks`, `i18n:apply -- <file>` and `i18n:check`
commands remain available for diagnosis and partial work. `i18n:apply` accepts the
same batch format without demanding that all other pending work is finished.

The local check, locked integration, CI static gate and verified builds enforce
this check. They never call a model or modify translations. If integration
incorporates changed English, refresh the same packet and repair affected translations
in the task worktree before retrying; never translate inside the integration lock.
Machine checks protect structural validity and freshness, not native-speaker
quality; AI semantic review remains part of completing the task.

## Qualification and Steam

Expanded English is a developer-only layout tool. Chinese, Japanese and Russian use bundled
Noto Sans SC, Noto Sans JP and Noto Sans variable font subsets with their OFL licenses. The
subsets retain variable weights, hinting and layout features, Latin characters,
punctuation, symbols, abbreviations for large amounts, and every required
Chinese/Japanese/Cyrillic catalog glyph and the corresponding native language label. The offline gate reads the actual bundled character maps and
rejects missing glyphs; adding an uncovered character blocks integration
until the fonts are regenerated. Native
language names carry their own language tags and script font fallbacks even before
selecting those languages; the Japanese font need not cover simplified Chinese names.
Verified renderer packages also check a generated catalog manifest and SHA-256
digest, so omitted or corrupted bundled catalogs cannot pass packaging.
Font regeneration is an explicit authoring operation, separate from offline checks:

```sh
python3 -m venv .cache/font-tools
.cache/font-tools/bin/python -m pip install fonttools==4.60.1
ALCHEMY_FONT_PYTHON=.cache/font-tools/bin/python npm run i18n:fonts
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

For focused rendered review, run the acceptance suites at minimum viewport and
maximum sizing. Enable passing screenshots explicitly when visual evidence is needed:

```sh
ALCHEMY_LOCALIZATION_LAYOUT_REVIEW=1 ALCHEMY_LOCALIZATION_SCREENSHOTS=1 npm run test:e2e:dev -- tests/e2e/specs/localization.spec.ts tests/e2e/specs/localization-gameplay.spec.ts --workers=1
```

[The suites](../tests/e2e/specs/localization-gameplay.spec.ts) exercise translated
flows and cross-language resume, comparing acknowledged effects, description
marks, inventories, resources and RNG. The [E2E guide](../tests/e2e/README.md#tags)
owns smoke/QA tags, CI tiers and screenshot policy; [workflows](../.github/workflows/)
own scheduling. Expanded English is development-only QA, separate from production
catalog acceptance.

The [demo journeys](../tests/e2e/specs/localization-demo.spec.ts) include starter
play/save/resume and a seeded final-room checkpoint through recap, hero unlock,
marketing and menu. That checkpoint does not establish an unseeded full run.
The demo ending selects bundled promo artwork for every shipped language, with
English artwork for expanded-English QA. The original English master is retained;
localized variants edit its seven labels in the same panels. Accessible text and
surrounding controls use the text catalogs. The production journey checks the
selected image URL, loading, proportions and layout for every target language.
`scripts/assets/demo-promo-copy.json` records the reviewed artwork captions;
`i18n:check` rejects catalog changes that leave those captions stale. Regenerate
and visually review affected artwork before updating that record, then prepare
assets through the [asset workflow](./WORKFLOWS-ASSETS.md).

```sh
ALCHEMY_EDITION=demo npm run build:desktop
ALCHEMY_EDITION=demo ALCHEMY_LOCALIZATION_LAYOUT_REVIEW=1 npm run test:e2e -- tests/e2e/specs/steam-demo.spec.ts tests/e2e/specs/localization-demo.spec.ts
ALCHEMY_EDITION=demo PLAYWRIGHT_ELECTRON_FULL=1 npm run test:ship:desktop -- tests/electron/localization-demo.spec.ts
```

The [native demo journey](../tests/electron/localization-demo.spec.ts) relaunches
isolated profiles with normal motion and compares saved mechanics, full card
data and RNG across language changes. Actual startup and input gates remain active;
native timing and physical Steam qualification require their own evidence.

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

The shipped registry is the current selection. Steam-wide usage informed its
initial order; it is a provisional signal, not evidence of Alchemy sales or
player fluency. Use regional wishlists, traffic and community feedback when
available, following [Valve's guidance](https://partner.steamgames.com/doc/store/localization).

Keep candidate languages disabled until catalogs, AI semantic review, fonts,
save/resume and rendered layouts pass. Advertising support also requires the
real Steam/Windows qualification above. Spanish–Latin America and European
Portuguese are separate locales, not covered by Spanish–Spain and Brazilian catalogs.
