# Content authoring

[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change) owns verification
requirements and execution permissions. Coverage references below identify the
contracts to preserve.

## Shared tuning

Shared knobs live in topical files under `src/lib/game-constants/`, exported
through its `index.ts`. Content-owned magnitudes stay with their card, talent,
difficulty or other authored definition. Use `_FRACTION` for 0–1 values,
`_PERCENT` / `_PCT` for 0–100 values, `_MULTIPLIER` for factors, `_MS` / `_SEC`
for time, and `_PX` for pixels. `_CHANCE` is deprecated for new tuning; use
fraction helpers.

## Content wording

Use “Deal N [type] damage”, “Gain N Mana”, “Gain/Lose N Mana Crystals”, “Restore N Health”, “Cleanse”, “buildup”, and “Draw a card”. Distinguish hits, natural ticks, detonations, damage bonuses, and separate typed hits. Health loss remains distinct from typed self-damage. Valid saved effects and descriptions remain paired.

## Add a new status effect

1. Extend `PlayerStatusId` or the enemy status list in `src/lib/game-data/types.ts`. Add eligible enemy damage statuses to `ENEMY_STATUS_DAMAGE_IDS`. Classify the status in the applicable harmful/beneficial lists and display order there.
2. Add its initial value to `defaultBattleState()` in `src/lib/battle/battle-setup-defaults.ts`. Saved status records normalize against these defaults in `normalize-persisted-battle-state.ts`; an undeclared key is dropped during load.
3. If cards can apply, remove, or multiply the status, update the relevant allowlists in `src/lib/game-data/effects/shared-schemas.ts` and `status-schemas.ts`, plus description metadata in `effect-metadata.ts`. Extending the status union alone does not make it a valid card effect. Keep each operation limited to the statuses it supports.
4. Route status assignment through `src/lib/battle/status-state.ts`. Add player-side grant/reaction logic in `status-player.ts` when applicable, and damage riders in `damage-status-riders.ts` only when damage applies the status.
5. Add tick/expiry behavior in `src/lib/battle/status-ticks.ts` and, for crowd control, threshold logic in `status-cc.ts`.
6. Wire visible state through `shared/utils/battle.ts` and `run-loop/battle/presentation/ui/status-icons.tsx` under `src/features/alchemy/`. Reuse keyword metadata when appropriate; non-keyword statuses need their own display metadata. A new keyword follows [Add a new keyword](#add-a-new-keyword).

Verify the status's consequential application, expiry/removal, and current-format
save/resume behavior. Persisted changes follow the
[save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md);
card effects also follow [Battle handlers](../src/lib/game-data/effects/BATTLE_HANDLERS.md#adding-a-kind).

---

## Add a new card

1. Add the entry to the matching topical library under `src/lib/game-data/cards/library/`;
   `cards.ts` assembles the groups. Use `effectsCard` from `card-builders.ts` with its
   effects; ordinary descriptions derive from those effects.
2. Register art in `src/lib/game-data/assets.ts` through the
   [asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-game-art); `placeholderCard`
   is available while drafting.
3. Register a nonempty focal sound under the [audio checklist](./AUDIO.md#change-checklist),
   including Companion summons.
4. Check description/effect parity and typography with `npm run content:audit`,
   complete [localization](./LOCALIZATION.md#agent-workflow), then use the
   [task gate](../CONTRIBUTING.md#what-to-run-when-you-change).

For a new effect kind, follow [handler authoring](../src/lib/game-data/effects/BATTLE_HANDLERS.md#adding-a-kind).
Use [card descriptions](#card-descriptions) for custom wording, editable magnitudes,
parity and contextual display. Summon builders derive titles from Companions;
`consume: true` cards may have multiple effects.

Card IDs are stable strings on `BattleCard`, not a separate union. The assembled
`cardLibrary` rejects duplicate IDs. Removing or renaming IDs follows the
[save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).
Current-run modifications follow [card recovery](../src/features/alchemy/shared/storage/MIGRATIONS.md#implementation-rules):
saved effects and descriptions stay paired while catalog identity metadata refreshes.

Cards in `cardLibrary` are automatically included in card shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration. Exclude a card with `excludeFromOfferPool: true` (`mixed-potion` is the current example).

Standard Potions are the explicit `POTION_CARD_IDS` list in `cards/card-pools.ts`;
`getStandardPotionPool()` supplies shop stock and new Campfire offers.
`isPotionCard` also recognizes Mixed Potions for brewing and the Distillation
talent's combat potency. Add a new standard Potion to the list deliberately;
Mana Berries, Mana Crystals, Apple, and Bread are intentionally excluded.

## Card descriptions

`effect-metadata.ts` and `effect-description.ts` render effects into prose and
magnitude bindings together. Use `effectsCard` for ordinary wording or
`describe(effects)` for bespoke lines; raw literals are reserved for special
cards such as Mixed Potion. Add new clauses to these renderers, never numeric
text replacement in a caller. Strong Spirits and Potion mixing use the same
`createEffectDescription` / `describeCardEffects` path.

`card-description-model.ts` owns serializable lines, typed effect references,
formatting and derived highlights. Lines declare an `effect`, `keyword` or
`consume` role. Numeric parts use `cardMagnitude` with an effect index, optional
nested path, kind and numeric field. Shared values explicitly list every
reference and derived multiplier. A custom Gold line can use:

```ts
const goldLine = {
  role: "effect",
  parts: ["Steal ", cardMagnitude({ effectIndex: 1, kind: "gain-gold", field: "amount" }), " Gold"],
};
```

Plain text cannot create an editable magnitude. Identities survive effect moves;
mixing and added effects scope new identities to avoid collisions. Update cards
through `withCardDescription` so strings and highlights derive from that model.
Corruption and Distill marks belong to magnitude identities, never character
offsets. Localization messages derive at display/extraction time; template IDs
and translated wording are not saved in this model.

### Numeric editing

Corruption and Powerful Wish share `updateCardNumericValue` in
`lib/corruption/numeric.ts`. Target discovery in `corruption/numeric-targets.ts`
reads bindings and captures exact effect addresses, expected values and
multipliers. It never parses wording or matches equal numbers. A stale reference
or expected value rejects the entire edit; accepted edits render strings and
highlights again. Targets are transient; descriptions and marks persist.

Nested paths index success effects followed by failure effects. Independently
authored delayed values have independent references; one magnitude may instead
bind immediate and matching delayed hits. “Deal N damage twice” binds both hits.
Custom single-valued Random damage binds both bounds explicitly. Powerful Wish
identifies costs from every referenced effect kind, preserving shared damage/cost
values. Probabilities, schedule durations, fixed Block costs and die faces are
not editable. “Draw a card” binds one draw. Keep catalog effects and descriptions
immutable.

### Parity and contextual display

[Description parity](../src/lib/content-validation/card-parity/index.ts) compares
authored mechanic lines with `describeCardEffects`, including summon summaries
and added effects. Steal/Gain Gold and Mixed Potion placeholders have narrow
exceptions. Missing keyword/Consume lines warn; unrenderable effects fail.
Typography rejects em dashes and terminal periods in description lines; keyword
tooltip sentences may use periods. The formatter cannot be its own test oracle.

`card-description.ts` owns pure descriptions, `shared/ui/cards/card-description-ui.tsx`
owns UI tokens, and `shared/context/card-description-context.tsx` supplies
Homestead/Talent context from App. Outside battle, amounts remain authored except
summon lines recomputed with Bond and shared Companion bonuses. Battle projection
follows [inspection ownership](../src/lib/game-data/effects/BATTLE_HANDLERS.md#battle-inspection-ownership).
Universal reactions stay in [game rules](./GAME_RULES.md#universal-reactions),
never card effects, descriptions or keyword explanations.

Keep semantic magnitude/keyword bindings independent of translated text;
[localization](./LOCALIZATION.md#runtime-and-ownership) owns display messages and
[save recovery](../src/features/alchemy/shared/storage/MIGRATIONS.md#implementation-rules)
owns validation and hydration.

## Add a new card effect `kind`

Follow [Battle handlers § Adding a kind](../src/lib/game-data/effects/BATTLE_HANDLERS.md#adding-a-kind)
for the union, grouped schema, registry, runtime handler, description metadata,
and description parity updates. That owner also documents recursive kinds,
effect ordering, and the focused schema/handler/description tests.

---

## Add a new character

- **1. Add character ID to `CharacterId` union** — `src/lib/game-data/characters.ts`
- **2. Define character in `characters` record** — `src/lib/game-data/characters.ts`
- **3. List card IDs in `startingDeck` (resolved via `resolveDeck`)** — same file
- **4. Set the hero's `keywords` badges (3 per hero; wildcard drafts and uses none)** — same file
- **5. Keep every badge covered by the starting deck (see below)** — same file + characters test
- **6. Add the unlock prerequisite** — `src/lib/game-data/character-unlocks.ts` (`CHARACTER_REQUIREMENTS`); an omitted entry leaves the hero permanently locked
- **7. Add the difficulty header title** — `src/lib/game-data/difficulties.ts` (`CHARACTER_HEADER_TITLES`); extract localization with `npm run i18n:extract`
- **8. Add Armory tab metadata** — `src/features/alchemy/meta/screens/armory/armory-character-tabs.tsx` (`CHARACTER_ICONS` and `CHARACTER_KEYWORDS`)
- **9. Register the portrait** — `characterArt` in `src/lib/game-data/assets.ts`, source art in `scripts/assets/core-assets.mjs`, then regenerate barrels and optimized outputs with the [asset workflow](./WORKFLOWS-ASSETS.md)
- **10. Cover the hero** — update character unlock, Armory tab, and asset-manifest tests. CI typechecking checks completeness of `Record<CharacterId, …>` owners.

`resolveDeck` throws on unknown card IDs so a typo fails loudly instead of
shortening the deck. Every badge must appear in at least one starting-deck
card (enforced by the hero badge coverage test in
`tests/lib/game-data/characters.test.ts`). Tooltips on Choose Your Hero and
Collection render the deck titles and badges live from this record.

---

## Enemy repertoire requirements

Each enemy has three distinct canonical card IDs in `abilityIds` and exactly two distinct native Traits, one positive followed by one negative. Ability cards must satisfy `isEnemyAbilityCard`: no Consume or hero-only resource effects; every branch must be supported. Content validation checks these requirements. For selection, scaling, targeting and reactions, read [enemy combat rules](./GAME_RULES.md#enemy-abilities-and-traits) when changing their behavior.

## Add a new enemy

All Bestiary enemies, including Skeleton, can appear in random encounters. The
first novice Campaign battle chooses Skeleton explicitly in
`run-setup/run/new-run-initialization.ts`; later battles use the normal encounter pool.

Follow the [repertoire requirements](#enemy-repertoire-requirements). Trait
descriptions must mention every distinct effect. For damage resistance and
vulnerability, the [parity validator](../src/lib/content-validation/card-parity/enemy-trait-parity.ts)
also checks each damage type and magnitude against the combat rules. Typography
checks enforce the remaining copy conventions. Run `npm run content:audit`
before handing off.

- **1. Define entry in `enemyBestiary` (`id` becomes `EnemyId`)** — `src/lib/game-data/compendium/enemies.ts`
- **2. Set `enemyType` (`normal`/`elite`/`boss`)** — same file
- **3. Add traits as `{ id, title, description }` objects** — same file (logic lives in battle system)
- **4. Use registered ability cards** — enemy turns use each ability card's focal cue; enemies have no separate sound mapping. Follow the [audio checklist](./AUDIO.md#change-checklist).
- **5. Wildwood gauntlet bosses must also be listed in `WILDWOOD_BOSS_IDS`** — `src/lib/content-systems/wildwood/bosses.ts`

---

## Add a new trinket

One definition powers a permanent Armory Trinket and a run-scoped **Boon**. Both reveal one Collection entry; Boons occupy no slot. `combineTrinketEffectIds` deduplicates matching forms.

1. Add data/art in `game-data/compendium/trinkets.ts` and `game-data/assets.ts`. Use `defineTrinket` with its effects and a description formatter. Interpolate numeric amounts from the formatter's typed effects; do not repeat balance values in prose.
2. Reuse existing effects when they express the new Trinket. Only for a new effect, add its default to `defaultTrinketEffects` in `src/lib/game-data/trinket-manifest.ts` and wire its battle/run consumers; check Boon exclusions. `TrinketManifest` and content validation derive effect field types from these defaults and requires at least one active effect.
3. Content validation uses that same description definition to check the complete trigger and outcome, required effect keys, and boolean mechanics. No separate parity rule is needed. Keep meaningful regressions in `tests/lib/content-validation/trinket-validation.test.ts`; run `npm run content:audit` before handing off.
4. Verify Gear-aggregate ownership/equip plus permanent and ephemeral UI/discovery.

## Add a new companion

Companion combat and descriptions share `getModifiedCompanionEffects()` in `src/lib/game-data/companions.ts`, which applies Bond and the supplied damage modifiers together. Follow [Companion Bond rules](./GAME_RULES.md#companion-bond) for progression and displayed effects; Bond levels and costs retain their existing save representation.

Summon cards omit `consume`; their summon effect routes them to the battle-removed pile after play. Companion utility cards retain ordinary discard behavior unless explicitly authored with Consume. Do not add Companion exceptions to Consume tooltips.

`defaultCompanionBondLevels` derives zero values from `companionLibrary`; talent and Homestead defaults both copy that map, so new Companions need no separate default registration. If Bond behavior differs from the shared scaling, update `getModifiedCompanionEffects()` and its descriptions together; change Homestead tiers or costs only when intended.

- **1. Add companion ID to `CompanionId` union** — `src/lib/game-data/types.ts`
- **2. Add art via the [asset workflow § Add or replace game art](./WORKFLOWS-ASSETS.md#add-or-replace-game-art)** — `src/lib/game-data/assets.ts`
- **3. Define companion in `companionLibrary` record** — `src/lib/game-data/companions.ts`
- **4. Add summon card via `summonCompanionCard()` in `cardLibrary` (`src/lib/game-data/cards/library/companions.ts`)** — `src/lib/game-data/cards/card-builders.ts` — companion must have **at least one** `turnStartEffects` entry
- **5. Give the summon card a stable, unique string ID** — `src/lib/game-data/cards/library/companions.ts`; the assembled `cardLibrary` checks uniqueness
- **6. Register the summon-card sound and verify the battle Companion mapping** — `src/lib/audio/sound-registry.ts` and `COMPANION_SOUND_CARD_IDS` in `src/lib/game-constants/audio.ts`; both are required by the [audio contract](./AUDIO.md#runtime-contract).
- **7. Update description lines** — `tests/lib/game-data/companions.test.ts` guards companion copy

Run `npm run content:audit` before handing off (companion record checks, summon-card parity, typography).

---

## Add a new talent

Behavioral contracts: [Talent manifests and progression](./TALENT_RULES.md#talent-manifests-and-progression). Read the applicable combat rule when adding a new mechanic.

Define talents in the ordered `src/lib/game-data/talents/talent-rows.ts` catalog. Each keyword builder fixes the keyword; the first call declares saved ID and name, and the second supplies icon, description, and typed bonus fields. Preserve row order because offers and progression use it.

Numeric and boolean fields set their authored values; arrays concatenate. Wrap a stackable numeric bonus in `add(amount)`, including when two keywords write the same bonus. Keep talent-owned magnitudes beside their descriptions. Talent descriptions omit periods, as enforced by content typography validation. Keyword tooltips may use full sentences with periods.

1. Ordinary bonus field types and neutral manifest defaults derive from the catalog. Register only Homestead-only fields and nonzero defaults (such as `healMultiplier: 1`) in `talents/manifest-defaults.ts`. Numeric fields start at zero, flags at false, arrays and dictionaries empty, and threshold rewards at null. `talent-effect-manifest.ts` re-exports the derived type.
2. Add the talent row and register its Lucide icon in `src/features/alchemy/shared/config/talent-icons.ts`. `talent-pool-definitions.ts` owns the derived ID and keyword indexes; the talent barrel exposes the catalog.
3. Keyword portrait art (new keyword or replacement art) — [Asset workflow § Add or replace game art](./WORKFLOWS-ASSETS.md#add-or-replace-game-art) (`scripts/assets/talent-assets.mjs` + `talentArt` in `src/lib/game-data/assets.ts`)
4. XP is keyword-based — `src/lib/game-data/talents/progression.ts` — no per-talent XP hook unless the keyword is new

Talent trees accept any count ≥ 1 in rows of 1/2/3/4, with overflow in its own row.

`tests/lib/game-data/talent-effect-invariants.test.ts` must stay green: every manifest field is written by a talent or homestead key (or an explicit unused allowlist), and exclusive non-boolean fields have a single writer unless they are arrays. New talent mechanics need focused gameplay tests that demonstrate their conditions and player-facing outcomes. There is no automatic scan proving that every authored field has a consumer; catalog wiring checks do not establish reachability or correct combat behavior. Talent descriptions are free text with no numeric parity lint (typography lint still applies — run `npm run content:audit`) — keep them in lockstep with effects by hand.

Add a `talentArt` entry when art is ready; missing-art and keyboard behavior follow [UI component conventions](./UI.md#component-conventions).

New keywords still follow [Add a new keyword](./CONTENT_AUTHORING.md#add-a-new-keyword) first.

## Add a homestead upgrade

1. Add `BuildingId` / `FarmId` / `ResearchId` — `src/lib/homestead/types.ts`
2. Define the item in `src/lib/homestead/data.ts` with `stackingUpgrade` from `data-builders.ts`. Supply four authored tier costs, reusing a matching cost ladder when appropriate, plus per-tier incremental effects and cumulative description callbacks. Upgrades with unequal tier increments pass a per-tier effect builder `(tierOneBased) => effects` instead of a flat object, as Detect Magic does for its Astral chance.
3. Add effect keys only when existing keys cannot express the upgrade — `HomesteadEffectManifest` + `HOMESTEAD_BATTLE_*_KEYS` in `types.ts`. Battle numeric defaults derive from that key list; meta and record defaults live in `defaults.ts`
4. Companion bond tiers (if companion) — `src/lib/homestead/companions.ts` (`COMPANION_BOND_TIERS` + `companionTierItems`) + `src/lib/game-data/companions.ts`
5. Art & palette — Add `helpers.tsx:itemArt` entry in `src/features/alchemy/meta/screens/homestead/helpers.tsx` + art via the [asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-game-art)
6. Change layout constants only for an intended layout change — `HOMESTEAD_CONFIG` in `helpers.tsx` (page capacities and landscape node width). Artwork retains its native aspect ratio under the [gallery contract](./UI_BROWSING.md#homestead-gallery).
7. Check affected rules or interactions; saved-shape changes follow the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md).

Follow the [Homestead gameplay rules](./GAME_RULES.md#hit-resolution-and-pacing)
and [manifest/progression contract](./TALENT_RULES.md#talent-manifests-and-progression)
for tier scaling and combat effects. The catalog in `src/lib/homestead/data.ts`
owns each node's costs and resource bonuses; the [material reward policy](./ARMORY.md#materials-tuning)
owns eligible sources and modifier order. Keep cumulative descriptions derived
from the authored effects, using short clauses, capitalized keywords, and no
terminal periods. Companion descriptions remain card-owned; the summon card must
be discovered before bonding is permitted.

Homestead coverage lives in `tests/lib/homestead/`, the screen unit suites, and
`tests/e2e/specs/homestead-flow.spec.ts`. Screen directories are excluded from
Vitest coverage thresholds in `vitest.config.ts`; behavioral coverage remains
subject to the shared test value policy.

## Add a new keyword

1. Extend `KeywordId` in `src/lib/game-data/types.ts`, then add the label, description, and colors to `keywordDefinitions` in `src/lib/game-data/keywords.ts`.
2. Add the keyword's icon to `keywordIcons` in `src/features/alchemy/shared/config/metadata.ts`. Register its display wording and inflections in `src/lib/keyword-text.ts` so descriptions, item shine, and tooltips recognize it.
3. Make `getCardKeywords` report it through effect metadata in `src/lib/game-data/effect-metadata.ts` or an explicit card tag. This same classification drives card display and ordinary card-play XP.
   `cardHasKeyword` shares that cache for single-keyword queries; use it when no keyword array is needed.
4. Ordinary XP already flows through `awardCardXP` in `src/features/alchemy/shared/stores/commands/write/run-progress.ts`; add a separate trigger there only when the mechanic needs one, as Dodge does. `src/lib/game-data/talents/progression.ts` owns point math, not event triggering. Add its talent tree through [Add a new talent](#add-a-new-talent).
5. Update Transmutation in `src/lib/game-constants/transmutation.ts`: assign the keyword to `TRANSMUTATION_KEYWORD_GROUPS` and add its title prefix to `TRANSMUTATION_PREFIXES`. Implement compatible conversions or additions in `getTransmutationVariants` in `src/lib/alchemist/transmutation.ts`; listing a keyword alone does not make it offerable. Verify a useful alteration and its saved preview under the [Transmutation contract](#transmutation-keywords-and-potion-brewing).

Keyword labels and descriptions must pass the typography rules (no em dashes; tooltip sentences may use periods — see `src/lib/content-validation/validators-typography.ts`). Run `npm run content:audit` before handing off.

---

### Transmutation keywords and Potion brewing

[Brewing and Transmutation rules](./GAME_RULES.md#brewing-and-transmutation)
own eligibility, fixed offers, conversion limits and service behavior. To extend them:

- Register keyword groups and title prefixes in `game-constants/transmutation.ts`,
  and implement useful variants in `lib/alchemist/transmutation.ts`.
- Keep recursive effects, keyword detection and structured magnitude bindings aligned.
  Preserve effects, descriptions, `transmuted`, `baseTitle`, added tags and `distilled`
  marks together through preview, mixing and hydration.
- Follow the [visit workflow](./RUN_WORKFLOWS.md#campfire-brewing-and-transmutation-visits)
  for commands and resume. Verify Back/reload retains the exact preview and completed
  visits cannot reroll or regrant a result.

The Distillation talent's combat scaling is separate from the Distill service;
see [Potion potency](./TALENT_RULES.md#potion-potency).
Brittle Ice and Flash Fire retain the saved IDs and effects of the former Shatter
and Wildfire talents, distinguishing them from universal reactions.
