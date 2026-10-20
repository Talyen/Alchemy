# Content authoring

## Add a new status effect

1. Extend `PlayerStatusId` or `EnemyStatusId` in `src/lib/game-data/types.ts`. Classify the status in the applicable harmful/beneficial lists and display order there.
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

1. Define card in the matching topical library — `src/lib/game-data/cards/library/` (`core.ts`, `archery.ts`, `consumables.ts`, `companions.ts`, or `defense.ts`); `cards.ts` assembles these groups
2. Add effects (discriminated union on `kind`) — same card entry, `effects: [...]`
3. Add art reference — `src/lib/game-data/assets.ts` (or `placeholderCard` while WIP)
4. Register a nonempty card sound in `src/lib/audio/sound-registry.ts` (`cardSounds`), including for Companion summon cards; follow the [audio checklist](./AUDIO.md#change-checklist). `tests/lib/audio/sound-registry.test.ts` enforces complete focal coverage; intentional silence applies only to the UI/service registrations documented by the audio owner.
5. Build the entry with `card-builders.ts` (`effectsCard` generates a structured `description` and rendered `descriptionLines` from effects; chance, delayed, conditional, and combined clauses are generated too; a bespoke `describe(effects)` returns typed description lines with explicit magnitude references; `effectsCard` with `consume: true` takes multiple effects; summon cards derive their title from the companion). Raw literals are reserved for genuinely special cards (`mixed-potion`)
6. Context-aware text — pure text `src/lib/game-data/card-description.ts` (summon lines use Bond levels and the shared `CompanionDamageModifiers`; other amounts stay authored), UI tokens `shared/ui/cards/card-description-ui.tsx`, homestead/talent context `shared/context/card-description-context.tsx` (wired in `App.tsx`). Universal reactions such as Shatter, Wildfire, Thunderclap, Frostfire, Consecration, Bloodboil, and Venomflash are not card effects: never include their rules or previews in card descriptions or card keyword explanations.

Card IDs are stable strings on `BattleCard`, not a separate union. The assembled
`cardLibrary` rejects duplicate IDs. Removing or renaming IDs follows the
[save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).
Current-run upgrades, corruption, and Mixed Potions need their effects,
descriptions, and explicit Consume overrides restored together. `hydrateCard`
currently preserves complete saved content and refreshes title/art from the
catalog, so a catalog rebalance alone does not replace saved effects. This is
not a requirement to retain obsolete card mechanics; retire incompatible
development snapshots through the save owner when current rules require it.
Strong Spirits and Alchemist mixing render their scaled Potion effects through
`createEffectDescription` through `effect-metadata.ts`; add Potion wording in
`effect-description.ts` rather than changing numeric text in the mixer.

Player-facing text changes follow [Localization](./LOCALIZATION.md), including generated content wording and AI translation review. Keep mechanics and semantic magnitude/keyword bindings independent from translated text.

Structured descriptions live in `card-description-model.ts`. Each line declares
its `effect`, `keyword`, or `consume` role. Numeric parts use `cardMagnitude`
with an effect index, optional nested path, kind, and numeric field; shared values
explicitly list all references, including derived multipliers. Magnitudes retain
their identities when effects move; mixing and added effects scope new identities
to prevent collisions. For example, a
custom Gold line uses `{ role: "effect", parts: ["Steal ",
cardMagnitude({ effectIndex: 1, kind: "gain-gold", field: "amount" }), " Gold"] }`.
Plain text is display-only and cannot create an editable magnitude. Corruption
and Powerful Wish consume these references, never English wording or equal-value
matching. Update cards through `withCardDescription` so strings render from the
same model; highlights belong to magnitude identities, never character offsets.
Localization messages are derived at display/extraction time and are not saved
inside the structured description. Do not edit numeric prose independently.

Cards in `cardLibrary` are automatically included in card shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration. Exclude a card with `excludeFromOfferPool: true` (`mixed-potion` is the current example).

Standard Potions are the explicit `POTION_CARD_IDS` list in `cards/card-pools.ts`;
`getStandardPotionPool()` supplies shop stock and new Campfire offers.
`isPotionCard` also recognizes Mixed Potions for brewing and the Distillation
talent's combat potency. Add a new standard Potion to the list deliberately;
Mana Berries, Mana Crystals, Apple, and Bread are intentionally excluded.

Run `npm run content:audit` before handing off: card text must match effects (canonical description diff in `src/lib/content-validation/card-parity/`) and prose must pass the typography rules (no em dashes; description lines stay period-free).

---

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

`resolveDeck` throws on unknown card IDs so a typo fails loudly instead of
shortening the deck. Every badge must appear in at least one starting-deck
card (enforced by the hero badge coverage test in
`tests/lib/game-data/characters.test.ts`). Tooltips on Choose Your Hero and
Collection render the deck titles and badges live from this record.

---

## Enemy repertoire requirements

Each enemy has three distinct canonical card IDs in `abilityIds` and 1–3 unique native Traits. Ability cards must satisfy `isEnemyAbilityCard`: no Consume or hero-only resource effects; every branch must be supported. Content validation checks these requirements. For selection, scaling, targeting and reactions, read [enemy combat rules](./GAME_RULES.md#enemy-abilities-and-traits) when changing their behavior.

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

Homestead screens (like all screen directories) are excluded from `vitest` coverage thresholds — see the coverage `exclude` list in `vitest.config.ts` — and are covered by E2E `tests/e2e/specs/homestead-flow.spec.ts` plus the unit `homestead/*.test.tsx` suites. Use `npm run test:full -- tests/lib/homestead` for the lib contract. Browser verification uses `npm run test:e2e:route -- homestead` under the [local execution policy](../CONTRIBUTING.md#what-to-run-when-you-change).

## Add a new keyword

1. Extend `KeywordId` in `src/lib/game-data/types.ts`, then add the label, description, and colors to `keywordDefinitions` in `src/lib/game-data/keywords.ts`.
2. Add the keyword's icon to `keywordIcons` in `src/features/alchemy/shared/config/metadata.ts`. Register its display wording and inflections in `src/lib/keyword-text.ts` so descriptions, item shine, and tooltips recognize it.
3. Make `getCardKeywords` report it through effect metadata in `src/lib/game-data/effect-metadata.ts` or an explicit card tag. This same classification drives card display and ordinary card-play XP.
   `cardHasKeyword` shares that cache for single-keyword queries; use it when no keyword array is needed.
4. Ordinary XP already flows through `awardCardXP` in `src/features/alchemy/shared/stores/write/run-progress.ts`; add a separate trigger there only when the mechanic needs one, as Dodge does. `src/lib/game-data/talents/progression.ts` owns point math, not event triggering. Add its talent tree through [Add a new talent](#add-a-new-talent).
5. Update Transmutation in `src/lib/game-constants/transmutation.ts`: assign the keyword to `TRANSMUTATION_KEYWORD_GROUPS` and add its title prefix to `TRANSMUTATION_PREFIXES`. Implement compatible conversions or additions in `getTransmutationVariants` in `src/lib/alchemist/transmutation.ts`; listing a keyword alone does not make it offerable. Verify a useful alteration and its saved preview under the [Transmutation contract](#transmutation-keywords-and-potion-brewing).

Keyword labels and descriptions must pass the typography rules (no em dashes; tooltip sentences may use periods — see `src/lib/content-validation/validators-typography.ts`). Run `npm run content:audit` before handing off.

---

Canonical card descriptions render through `effect-metadata.ts`. Extend that
renderer when a mechanic needs a new clause; do not duplicate its amounts in
library prose. The [parity checker](../src/lib/content-validation/card-parity/index.ts)
compares authored mechanic lines with `describeCardEffects()`, allowing the
Steal/Gain Gold alias and the Mixed Potion placeholder. Summon summaries and
any additional effects are checked together against their generated descriptions.
Corruption and Powerful Wish use [structured magnitude references](#add-a-new-card);
rendered numeric positions identify highlights, never the effect to mutate.

### Transmutation keywords and Potion brewing

Transmutation derives compatible alterations from the run deck, independent of class affinities and offerable replacement-card pools. `game-constants/transmutation.ts` owns the three keyword groups and title prefixes. Each visit rolls up to three useful keywords per card: one per compatible group, with unique fallback choices if a group is unavailable. The visit can contain more than three distinct keywords across the deck, but selecting a card shows only its saved compatible choices. Each card's randomly chosen conversions are saved for the visit. All occurrences of the selected source keyword convert without changing existing numeric fields. Unsupported conditions and scaling exclude conversions; additions use native effects, and added effect lines respect Corruption's four-effect-line limit. Keep recursive effects, structured descriptions, distilled marks, and keyword detection consistent when adding new mechanics. Back and reload must preserve exact previews. Transmuted cards carry `transmuted`, `baseTitle`, generated descriptions, and any added tags through hydration; they cannot receive further Transmutation or Corruption.

Preserve transformed effects and generated descriptions together. Mixed and strengthened Potions remain eligible for later brewing visits; [brewing rules](./GAME_RULES.md#brewing-transmutation-and-elemental-reactions) own Campfire selection and once-per-visit service limits. Strengthened standard Potions can be Transmutation sources; Mixed Potions cannot. The Distill service adds 1 to supported magnitudes, including Wishes, and preserves probabilities, percentage effects, durations, and draw counts. Full-cleanse Potions without healing gain Restore 1 Health. Persist `distilled` marks on description magnitudes so increased values remain green after hydration and mixing. The Distillation talent separately scales eligible Potion benefits during combat under the [Potion potency rules](./TALENT_RULES.md#distinct-talent-and-card-effects).

The former Shatter and Wildfire talents are displayed as Brittle Ice and Flash Fire to distinguish them from the universal reactions. Their saved IDs and effects remain unchanged.
