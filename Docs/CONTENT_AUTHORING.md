# Content authoring

## Add a new status effect

1. Define the status type in `src/lib/game-data/types.ts` — extend `PlayerStatusId` or `EnemyStatusId` string unions (discriminated union pattern).
2. If the status ticks or expires during turn processing, add that behavior in `src/lib/battle/status-ticks.ts`.
3. Add player-side application logic in `src/lib/battle/status-player.ts` when applicable; add riders in `src/lib/battle/damage-status-riders.ts` only when damage applies the status.
4. If the status provides crowd control, add its threshold logic in `src/lib/battle/status-cc.ts`.
5. If the status introduces a keyword, define it in `src/lib/game-data/keywords.ts`.

Persisted status changes follow the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md).

---

## Add a new card

1. Define card in the matching topical library — `src/lib/game-data/cards/library/` (`core.ts`, `archery.ts`, `consumables.ts`, `companions.ts`, or `defense.ts`); `cards.ts` assembles these groups
2. Add effects (discriminated union on `kind`) — same card entry, `effects: [...]`
3. Add art reference — `src/lib/game-data/assets.ts` (or `placeholderCard` while WIP)
4. Register a card sound in `src/lib/audio/sound-registry.ts` (`cardSounds`), or record an intentionally silent card in `SILENT_CARD_IDS` in `tests/lib/audio/sound-registry.test.ts`; follow the [audio checklist](./AUDIO.md#change-checklist). Companion summon cards require sounds.
5. Build the entry with `card-builders.ts` (`effectsCard` generates `descriptionLines` from effects; chance, delayed, conditional, and combined clauses are generated too; a bespoke `describe(effects)` template must take values from its typed effects; `effectsCard` with `consume: true` takes multiple effects; summon cards derive their title from the companion). Raw literals are reserved for genuinely special cards (`mixed-potion`)
6. Context-aware text — pure text `src/lib/game-data/card-description.ts` (only summon lines are recomputed with Bond/damage bonuses; `flatPhysicalDamage`/`potionPotency` are accepted but ignored), UI tokens `shared/ui/cards/card-description-ui.tsx`, homestead/talent context `shared/context/card-description-context.tsx` (wired in `App.tsx`)

Card IDs are stable strings on `BattleCard`, not a separate union. The assembled
`cardLibrary` rejects duplicate IDs. Removing or renaming IDs follows the
[save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).
Current-run upgrades, corruption, and Mixed Potions need their effects,
descriptions, and explicit Consume overrides restored together. `hydrateCard`
currently preserves complete saved content and refreshes title/art from the
catalog, so a catalog rebalance alone does not replace saved effects. This is
not a requirement to retain obsolete card mechanics; retire incompatible
development snapshots through the save owner when current rules require it.

Cards in `cardLibrary` are automatically included in card shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration. Exclude a card with `excludeFromOfferPool: true` (`mixed-potion` is the current example). Distillation-eligible Potions are the explicit `POTION_CARD_IDS` list in `cards/card-pools.ts` — a new brew must be added there deliberately; Mana Berries, Mana Crystals, Apple, and Bread are intentionally excluded.

Run `npm run content:audit` before handing off: card text must match effects (count + numeric parity in `src/lib/content-validation/card-parity/`, with shared line shapes in `line-classifiers.ts`) and prose must pass the typography rules (no em dashes; description lines stay period-free).

---

## Add a new card effect `kind`

Follow [Battle handlers § Adding a kind](../src/lib/game-data/effects/BATTLE_HANDLERS.md#adding-a-kind)
for the union, grouped schema, registry, runtime handler, description metadata,
and numeric-parity updates. That owner also documents recursive kinds,
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
`shared/run-flow/campaign-start.ts`; later battles use the normal encounter pool.

Follow the [repertoire requirements](#enemy-repertoire-requirements). Trait
descriptions must mention every distinct effect. For damage resistance and
vulnerability, the [parity validator](../src/lib/content-validation/card-parity/enemy-trait-parity.ts)
also checks each damage type and magnitude against the combat rules. Typography
checks enforce the remaining copy conventions. Run `npm run content:audit`
before handing off.

- **1. Define entry in `enemyBestiary` (`id` becomes `EnemyId`)** — `src/lib/game-data/compendium/enemies.ts`
- **2. Set `enemyType` (`normal`/`elite`/`boss`)** — same file
- **3. Add traits as `{ id, title, description }` objects** — same file (logic lives in battle system)
- **4. Register an attack sound or intentional silence** — `src/lib/audio/sound-registry.ts` (`enemyAttackSounds`), or `SILENT_ENEMY_IDS` in `tests/lib/audio/sound-registry.test.ts`; follow the [audio checklist](./AUDIO.md#change-checklist).
- **5. Wildwood gauntlet bosses must also be listed in `WILDWOOD_BOSS_IDS`** — `src/lib/content-systems/wildwood/bosses.ts`

---

## Add a new trinket

One definition powers a permanent Armory Trinket and a run-scoped **Boon**. Both reveal one Collection entry; Boons occupy no slot. `combineTrinketEffectIds` deduplicates matching forms.

1. Add data/art in `game-data/compendium/trinkets.ts` and `game-data/assets.ts`.
2. Reuse existing effects when they express the new Trinket. Only for a new effect, extend `TrinketManifest` and `defaultTrinketEffects` in `src/lib/game-data/trinket-manifest.ts` and wire its battle/run consumers; check Boon exclusions. Content validation derives effect field types from these defaults and requires at least one active effect.
3. Add a rule in `src/lib/content-validation/card-parity/trinket-parity.ts` covering the complete trigger and outcome, numeric captures in effect-key order, and required boolean effects. Keep the rule and regression tests in `tests/lib/content-validation/trinket-validation.test.ts` aligned with wording changes; numeric expectations come from authored effects. Run `npm run content:audit` before handing off.
4. Verify Gear-aggregate ownership/equip plus permanent and ephemeral UI/discovery.

## Add a new companion

Companion combat and descriptions share `getCompanionBondEffects()` in `src/lib/game-data/companions.ts`. Follow [Companion Bond rules](./GAME_RULES.md#companion-bond) for progression and displayed effects; Bond levels and costs retain their existing save representation.

`defaultCompanionBondLevels` derives zero values from `companionLibrary`; talent and Homestead defaults both copy that map, so new Companions need no separate default registration. If Bond behavior differs from the shared scaling, update `getCompanionBondEffects()` and its descriptions together; change Homestead tiers or costs only when intended.

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

Use `addEffect` for stackable numeric bonuses, including the same bonus written by two keywords. Use `setEffect` for flags, identity multipliers (defaults that are not zero, e.g. `healMultiplier`), and exclusive thresholds. Array fields (e.g. `healthThresholdArmor`) concatenate on `set`.

Put talent-owned magnitudes on the talent ops (not only in `game-constants`) so descriptions and combat stay in lockstep. Talent and keyword descriptions omit periods, as enforced by content typography validation.

1. If the talent needs a new battle bonus, add its default in `src/lib/game-data/talents/manifest-defaults.ts`; `TalentEffectManifest` derives from those defaults and `talent-effect-manifest.ts` re-exports it.
2. Define the talent (`id`, `keywordId`, name, description, effects, and Lucide `icon` name) in the matching keyword module under `src/lib/game-data/talents/pools/`; `talent-pool-definitions.ts` assembles `talentPool` in its historical order, with `talent-pool-selectors.ts` exposing the assembled pool. Register the icon in `src/features/alchemy/shared/config/talent-icons.ts`.
3. Keyword portrait art (new keyword or replacement art) — [Asset workflow § Add or replace game art](./WORKFLOWS-ASSETS.md#add-or-replace-game-art) (`scripts/assets/talent-assets.mjs` + `talentArt` in `src/lib/game-data/assets.ts`)
4. XP is keyword-based — `src/lib/game-data/talents/progression.ts` — no per-talent XP hook unless the keyword is new

Talent trees accept any count ≥ 1 in rows of 1/2/3/4, with overflow in its own row.

`talent-effect-invariants` must stay green: every manifest field is written by a talent or homestead key (or an explicit unused allowlist), every talent-written field is read in battle/meta code, and non-boolean `set` fields have a single writer unless they are arrays. Reader discovery uses typed property access, destructuring, and typed key registrations rather than receiver names. It checks wiring presence, not reachability or correct combat behavior; meaningful behavior tests remain necessary. Talent descriptions are free text with no numeric parity lint (typography lint still applies — run `npm run content:audit`) — keep them in lockstep with effects by hand.

Add a `talentArt` entry when art is ready; missing-art and keyboard behavior follow [UI component conventions](./UI.md#component-conventions).

New keywords still follow [Add a new keyword](./CONTENT_AUTHORING.md#add-a-new-keyword) first.

## Add a homestead upgrade

1. Add `BuildingId` / `FarmId` / `ResearchId` — `src/lib/homestead/types.ts`
2. Define the item with `defineBuilding` / `defineFarm` / `defineResearch` — `src/lib/homestead/data.ts` (four explicit authored tier costs; `stackingTiers` adds each tier’s incremental effects)
3. Add effect keys only when existing keys cannot express the upgrade — `HomesteadEffectManifest` + `HOMESTEAD_BATTLE_*_KEYS` in `types.ts`; defaults in `defaults.ts`
4. Companion bond tiers (if companion) — `src/lib/homestead/companions.ts` (`COMPANION_BOND_TIERS` + `companionTierItems`) + `src/lib/game-data/companions.ts`
5. Art & palette — Add `helpers.tsx:itemArt` entry in `src/features/alchemy/meta/screens/homestead/helpers.tsx` + art via the [asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-game-art)
6. Change layout constants only for an intended layout change — `HOMESTEAD_CONFIG` in `helpers.tsx` (companion page size, aspect ratios)
7. Check affected rules or interactions; saved-shape changes follow the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md).

Every building/farm/research node has four tiers. All numeric effects and each
room-production quantity strictly increase in cumulative tier totals. Companion
Bonds remain a separate three-tier progression. Recipes use fixed material costs;
production support affects authoring, not prices at runtime. Crystal Garden
produces Gems and Stone. Library, Agility Training, and Sanctuary intentionally
have no material production. A Companion card must be discovered during a Run
before its Bond can be purchased; the Homestead command checks this against the
card's summon effect. Resource labels use “per Room”; settlement remains
at run end. Wishing Well alternates Gold/Gems by room (odd rooms Gold) in every
mode. Tailoring also produces Gold. Capture the recap after these payouts so
the Gold and Material totals include them.

Homestead screens (like all screen directories) are excluded from `vitest` coverage thresholds — see the coverage `exclude` list in `vitest.config.ts` — and are covered by E2E `tests/e2e/specs/homestead-flow.spec.ts` plus the unit `homestead/*.test.tsx` suites. Use `npm run test -- tests/lib/homestead` for the lib contract and `npm run test:e2e:route -- homestead` when the change needs browser verification.

## Add a new keyword

- **1. Define keyword config (label, description, colors)** — `src/lib/game-data/keywords.ts`
- **2. Add display config if needed** — `src/features/alchemy/shared/config/keywords.ts`
- **3. Add talent XP trigger** — `src/lib/game-data/talents/progression.ts` (keyword-based XP logic)

Keyword labels and descriptions must pass the typography rules (no em dashes; descriptions stay period-free — see `src/lib/content-validation/validators-typography.ts`). Run `npm run content:audit` before handing off.

---

Generated card rules live in `effect-metadata.ts`. Extend that renderer when a
mechanic needs a new clause; do not duplicate its amounts in library prose.
Exact generated descriptions bypass English parity parsing. The parser remains
for custom templates and saved/Corrupted/Mixed Potion descriptions. Keep compact
combined phrases stable: Corruption still uses their displayed numeric positions
to preserve the established editable-value contract.
