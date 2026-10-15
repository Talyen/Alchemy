# Localization

English is Alchemy's authoritative text. AI coding agents translate and review
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

React presentation subscribes with `useGameTranslation()`. Use `text(id, English,
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
locally before mounting React. English defaults remain usable if that asset fails
to load. No translation server is contacted.

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

German is the complete pilot. Expanded English and a partial Simplified Chinese
font sample are developer tools, not additional advertised language support. The
Chinese font is a licensed subset covering the sample, not a production CJK font.
The offline gate reads its font character map and rejects missing sample glyphs.
Verified renderer packages also check a generated catalog manifest and SHA-256
digest, so omitted or corrupted bundled catalogs cannot pass packaging.
Use the browser acceptance scenarios to check live switching, focus, clipping,
keyword interactions, and saved combat. Browser/Electron and builds follow the
execution policy in [CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change).

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
