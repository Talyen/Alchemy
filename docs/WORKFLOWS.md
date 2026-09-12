# Alchemy — Implementation Workflows

Step-by-step checklists for adding or changing game content and wiring.

For refactors and simplification passes on attached paths, use [docs/Audits](./Audits/README.md) when the user cites an audit.

**Import paths:** only `@/*` → `src/*` in `tsconfig.json`. Use **on-disk** capability paths under `src/features/alchemy/` (for example `@/features/alchemy/shared/stores/run-reads`) — not legacy alias paths that skip `shared/`.

**Read scope:** use the task index and open one workflow section at a time. Expand
only when a checklist crosses that boundary. Generated asset barrels are
outputs; use the [asset workflow](./WORKFLOWS-ASSETS.md) for their sources and
regeneration. Each checklist's tests are selected by the changed-path route
([CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change)); only
catalog-external tests are named inline. Named suites are verification entry points. Apply the [test value policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) throughout; section-specific save-compatibility and browser-timing requirements still apply.

## Task index

| Task                                          | Section                                                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw asset / art                               | [Asset workflow](./WORKFLOWS-ASSETS.md)                                                                                                                                                        |
| Save schema / migration                       | [Persisted save data](#change-persisted-save-data)                                                                                                                                             |
| Mid-run resume                                | [Active run data](#change-mid-run-resume-activerundata)                                                                                                                                        |
| Post-victory routing                          | [REWARD_ROUTES](#add-or-change-post-victory-routing-reward_routes)                                                                                                                             |
| Run teardown / clear save                     | [Run teardown](#run-teardown)                                                                                                                                                                  |
| Status effect                                 | [New status](#add-a-new-status-effect)                                                                                                                                                         |
| Card / card effect kind                       | [New card](#add-a-new-card) · [New effect kind](#add-a-new-card-effect-kind)                                                                                                                   |
| Character, enemy, trinket, companion, keyword | [Character](#add-a-new-character) · [Enemy](#add-a-new-enemy) · [Trinket](#add-a-new-trinket) · [Companion](#add-a-new-companion) · [Keyword](#add-a-new-keyword)                              |
| Talent / homestead upgrade                    | [Talent](#add-a-new-talent) · [Homestead upgrade](#add-a-homestead-upgrade)                                                                                                                    |
| Permanent gear                                | [Gear](#add-permanent-gear)                                                                                                                                                                    |
| Shop                                          | [Change a shop](#change-a-shop)                                                                                                                                                                |
| Content system / starter draft                | [Content system behavior](#content-system-behavior)                                                                                                                                            |
| Battle playback                               | [Change battle playback](#change-battle-playback)                                                                                                                                              |
| Screen, destination, mystery, corruption      | [New screen](#adding-a-new-screen) · [Destination](#adding-a-new-destination-map-node) · [Mystery effect](#adding-a-new-mystery-effect-kind) · [Corruption](#adding--changing-corruption-flow) |
| In-run materials                              | [Grant materials during a run](#grant-materials-during-a-run)                                                                                                                                  |
| UI placement, motion, buttons, tooltips       | [UI system](./UI.md)                                                                                                                                                                           |
| Gameplay session mutation                     | [Gameplay command boundary](#gameplay-command-boundary)                                                                                                                                        |

---

## Change persisted save data

Policy (when to bump, stamp-only floor, migrate steps, public save contract): [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md).

1. Decide bump vs safe additive default using that contract — do not add a `migrateVNToVNPlus1` step for stamp-only or defaulted additive fields.
2. Follow the Required pattern in `MIGRATIONS.md` (version stamp, transform step only when needed, Zod/defaults/fixtures, CI guards).
3. Use the [task-scoped gate](../CONTRIBUTING.md#what-to-run-when-you-change), which selects the complete save/persistence unit suite, including the migration guards. The save contract owns required compatibility scenarios.

---

## Change mid-run resume (`ActiveRunData`)

1. Classify the field as active-run progression or transient resume state. Keep the aggregate shape and the wire shape owned by their existing modules; mid-combat fields still use `PersistedBattleStateSchema`.
2. Update the active-run type/schema and, for progression fields, `ActiveRunProgressFields` / hydration in `run-state-init.ts`. Use defaults and normalization before adding a migration step; the save contract is in [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md).
3. Update `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()` in `run-resume-codec.ts`. This codec is the sole `RunSession` ↔ `ActiveRunData` translation boundary; shops and interrupted flow keep their focused codec helpers.
4. Keep `snapshotRun()` / `restoreRun()` as thin lifecycle wrappers and publish boot/resume through one `dispatchRunSessionCommand()`. Defer navigation, audio, and presentation work until after commit.
5. Run the active-run snapshot/codec tests plus the storage/migration tests named by the save contract. Use the changed-path route for the final selection.

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-write-port.ts`) so homestead inventory and `activeRun.runMaterialsEarned` stay aligned for the run-end summary.

1. Apply the Homestead find bonus when appropriate with `applyMaterialFindBonus()` from `@/lib/homestead/loot`; existing mystery and combat grants already do this.
2. Call `awardMaterialsDuringRun(draft, materials)` inside the owning command: `gainMysteryMaterial` / `mysteryApplyHandlers` in `run-loop/navigation/mystery-flow.ts`, `commitVictoryRewards` in `run-loop/run/victory-commands.ts`, or `claimRunReward` in `run-loop/run/reward-commands.ts`.
3. Reuse the run-end display: `awardRunEndMaterials` in `run-loop/run/run-flow-defeat.ts`, used by both defeat and victory flows, merges `runMaterialsEarned` and `applyEndOfRunHomesteadBonuses` into `session.runEndMaterials`.
4. Check `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts` and the affected mystery/reward-flow tests when adding a new source.

**Do not** call `addMaterials()` on the run profile store directly from run-loop or mystery code for player loot.

Permanent Gear and Armory Trinkets use `recordRunObtainedItem()` at each grant site (reward Gear/Trinket picks, equipment shop, trinket shop, mystery generated Gear). `finalizeRunEndSession` copies `activeRun.runObtainedItems` into `session.runEndItems` for the run-end recap. Do not record Boons or cards.

---

## Add or change post-victory routing (`REWARD_ROUTES`)

The Alchemist encounter bonus grants one Potion after the final reward choice or skip, including encounters with a follow-up bonus card choice.

Follow-up choices include Companion cards, Archery cards from Fletched, Wish cards from Wishkeeper, and Nature cards from Kindred Spoils. The saved `companionChoiceIds` field carries all of these bonus choices. Primary and bonus choices restore against the full card catalog in their saved order, dropping only missing IDs; loading never rerolls choices or reapplies offer-pool or theme eligibility.

An interrupted bonus handoff resumes only the bonus choices: the primary reward and its materials have already committed. Unclaimed rewards whose choices no longer resolve stay on Rewards with Skip available, retaining materials and routing metadata across repeated saves until finalized. Loading never awards materials.

Destination eligibility uses health and maximum health after victory bonuses and the upcoming location’s loot depth. Combat and Wildwood exclude exhausted Boon and permanent-Trinket pools before sampling through the [shared loot policy](./ARMORY.md#loot-tuning). Pass progression from `resolveDraftLootProgress()` when generating new loot; loading pending rewards or shop offers must not reapply progression eligibility.

| Step                           | File(s)                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add route constant          | `src/lib/routing/reward-routes.ts` → `REWARD_ROUTES`, re-exported from `@/lib/routing`                                                                   |
| 2. Compute route after rewards | `src/features/alchemy/run-loop/navigation/reward-flow.ts` (`finalizeRewardState` / related; import `@/features/alchemy/run-loop/navigation/reward-flow`) |
| 3. Handle transition           | `run-loop/run/run-flow-rewards.ts` (`executeRewardRouteTransition`) and/or `shell/use-run-flow-engine.ts`                                                |
| 4. Tests                       | `tests/features/alchemy/run-loop/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run                                                       |

---

## Run teardown

Feature code uses [`run-session-lifecycle-port.ts`](../src/features/alchemy/shared/stores/run-session-lifecycle-port.ts):

- `teardownRun()` — clear the active run session after victory, defeat, or abandon.
- `finalizeRunEndSession()` — run-end bookkeeping plus persist (navigation calls this on run end).
- `flushSaveAfterGearMutation()` — immediate persist after Armory gear mutations (bypasses autosave debounce).

[`reset.ts`](../src/features/alchemy/shared/stores/reset.ts) owns test/teardown and Options wipe:

- `resetTransientRunUi()` — UI hover/shimmer plus transient session fields.
- `clearAllPersistentGameData()` — clears app options, permanent run/talent data, and homestead (Options “clear save”).

## Gameplay command boundary

Ownership and anti-patterns: [ARCHITECTURE.md § Run state](./ARCHITECTURE.md#run-state). Keep the command synchronous; put audio, navigation, timers, and presentation cleanup in `afterCommit`. Pass the draft to every gameplay mutator. This outer-boundary example awards an already bonus-adjusted material amount and passes it to presentation feedback after commit:

```ts
import type { MaterialInventory } from "@/lib/homestead/types";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";

export function awardMaterialReward(
  materials: MaterialInventory,
  onAwarded: (awarded: MaterialInventory) => void,
): void {
  dispatchRunSessionCommand(
    (draft) => {
      awardMaterialsDuringRun(draft, materials);
      return materials;
    },
    { afterCommit: onAwarded },
  );
}
```

Inside an existing reward, shop, or mystery command, call the mutator with that command's draft instead of dispatching another command. Keep the existing claim guard and reward finalization in the owning flow.

Resolve battle gameplay and commit its RNG/XP before starting presentation. Return detached frames for playback; never commit gameplay from a draw or animation callback. `activeCombat.pendingBattleTransition` is retained only for consuming older saves, not for authoring new animation flows.

---

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
4. (Optional) Register card sound — `src/lib/audio/sound-registry.ts` (`cardSounds` record)
5. Update `descriptionLines` to match effects; context-aware text — same entry; pure text `src/lib/game-data/card-description.ts`, UI tokens `shared/ui/card-description-ui.tsx`, homestead/talent context `shared/context/card-description-context.tsx` (wired in `App.tsx`)

Card IDs are stable strings on `BattleCard`, not a separate union. The assembled
`cardLibrary` rejects duplicate IDs; preserve save compatibility when removing
or renaming one through the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md).

Cards in `cardLibrary` are automatically included in card shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration. Exclude a card with `excludeFromOfferPool: true` (`mixed-potion` is the current example).

---

## Add a new card effect `kind`

Follow [Battle handlers § Adding a kind](../src/lib/game-data/effects/BATTLE_HANDLERS.md#adding-a-kind)
for the union, grouped schema, registry, runtime handler, description metadata,
and numeric-parity updates. That owner also documents recursive kinds,
effect ordering, and the focused schema/handler/description tests.

---

## Add a new character

| Step                                                            | File(s)                           |
| --------------------------------------------------------------- | --------------------------------- |
| 1. Add character ID to `CharacterId` union                      | `src/lib/game-data/characters.ts` |
| 2. Define character in `characters` record                      | `src/lib/game-data/characters.ts` |
| 3. List card IDs in `startingDeck` (resolved via `resolveDeck`) | same file                         |

---

## Add a new enemy

Assign three distinct canonical card IDs in `abilityIds`. Each card must satisfy
the supported enemy subset in [enemy abilities](./GAME_RULES.md#enemy-abilities-and-traits);
[content validation](../src/lib/content-validation/validators.ts) checks the
references and supported effects, and [the enemy schema](../src/lib/content-validation/schemas.ts)
checks count and uniqueness.

| Step                                                                   | File(s)                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Define entry in `enemyBestiary` (`id` becomes `EnemyId`)            | `src/lib/game-data/compendium/enemies.ts`               |
| 2. Set `enemyType` (`normal`/`elite`/`boss`)                           | same file                                               |
| 3. Add traits as `{ id, title, description }` objects                  | same file (logic lives in battle system)                |
| 4. (Optional) Register attack sound                                    | `src/lib/audio/sound-registry.ts` (`enemyAttackSounds`) |
| 5. Wildwood gauntlet bosses must also be listed in `WILDWOOD_BOSS_IDS` | `src/lib/content-systems/wildwood/bosses.ts`            |

---

## Add a new trinket

One definition powers a permanent Armory Trinket and a run-scoped **Boon**. Both reveal one Collection entry; Boons occupy no slot. `combineTrinketEffectIds` deduplicates matching forms.

1. Add data/art in `game-data/compendium/trinkets.ts` and `game-data/assets.ts`.
2. Reuse existing effects when they express the new Trinket. Only for a new effect, extend `TrinketManifest` and `defaultTrinketEffects` in `src/lib/game-data/trinket-manifest.ts` and wire its battle/run consumers; check Boon exclusions. Content validation derives effect field types from these defaults and requires at least one active effect.
3. Add a rule in `src/lib/content-validation/card-parity/trinket-parity.ts` covering the complete trigger and outcome, numeric captures in effect-key order, and required boolean effects. Keep the rule and regression tests in `tests/lib/content-validation/trinket-validation.test.ts` aligned with wording changes; numeric expectations come from authored effects.
4. Verify Gear-aggregate ownership/equip plus permanent and ephemeral UI/discovery.

## Add permanent Gear

1. Add base item metadata in `src/lib/gear/base-items.ts` (slots, two-hand rule, affinity keywords, available rarities, thematic homestead `salvageByRarity`). Salvage consumes `salvageValue` on the generated definition.
2. Register Gear art via the [asset workflow § Add or replace Gear art](./WORKFLOWS-ASSETS.md#add-or-replace-gear-art) (naming/slot violations throw during sync).
3. Register the base item's Unique in `src/lib/gear/unique-catalog.ts`, with one exclusive fixed signature and three fixed standard supporting affixes. Every base item needs one Unique; ordinary variant generation does not create it. Follow [Unique affix and combat contracts](./UNIQUE_ITEMS.md) for signature implementation and interaction documentation.
4. For new affixes, add definitions in `src/lib/gear/affix-catalog.ts` with stable IDs, `keywordId`, effect keys, value ranges, and eligible slots. Keep `keywordId` aligned with affinity weighting and `effectKey` aligned with `GEAR_EFFECT_KEYS`; wire new effects into the manifest and their consumers. Display/roll helpers live in `affixes.ts`.
5. Update Gear save schemas/defaults and migration fixtures when instance or loadout shapes change.
6. Check affected Gear behavior, including existing Unique catalog coverage and save compatibility for instance or loadout shape changes. HP-sync write paths: [ARMORY.md § Write paths](./ARMORY.md#write-paths).

Existing generation builds Basic/Astral definitions in `src/lib/gear/definitions.ts` as `{baseItemId}-{rarity}`. Reward generation rolls instances in `src/lib/gear/generation.ts`; rewards store the exact `GearInstance` and never re-roll on acceptance. Every mode, including Wildwood, persists mid-reward progress in `activeRun.interruptedFlow` (`primary-reward` / `companion-reward` arms; Gear stores full instances, cards/Trinkets store choice IDs).

Owned items remain unique `GearInstance` records with `affixes: GearAffixRoll[]`; never put definition objects or art URLs into saves. Battle creation already applies aggregated `gearEffects` through `computeGearManifest()`.

---

## Add a new companion

Companion combat and descriptions share `getCompanionBondEffects()` in `src/lib/game-data/companions.ts`. Follow [Companion Bond rules](./GAME_RULES.md#companion-bond) for progression and displayed effects; Bond levels and costs retain their existing save representation.

`defaultCompanionBondLevels` derives zero values from `companionLibrary`; talent and Homestead defaults both copy that map, so new Companions need no separate default registration. If Bond behavior differs from the shared scaling, update `getCompanionBondEffects()` and its descriptions together; change Homestead tiers or costs only when intended.

| Step                                                                                                              | File(s)                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1. Add companion ID to `CompanionId` union                                                                        | `src/lib/game-data/types.ts`                                                                               |
| 2. Add art via the [asset workflow § Add or replace game art](./WORKFLOWS-ASSETS.md#add-or-replace-game-art)      | `src/lib/game-data/assets.ts`                                                                              |
| 3. Define companion in `companionLibrary` record                                                                  | `src/lib/game-data/companions.ts`                                                                          |
| 4. Add summon card via `summonCompanionCard()` in `cardLibrary` (`src/lib/game-data/cards/library/companions.ts`) | `src/lib/game-data/cards/card-builders.ts` — companion must have **at least one** `turnStartEffects` entry |
| 5. Give the summon card a stable, unique string ID                                                                | `src/lib/game-data/cards/library/companions.ts`; the assembled `cardLibrary` checks uniqueness             |
| 6. (Optional) Register card sound                                                                                 | `src/lib/audio/sound-registry.ts`                                                                          |
| 7. Update description lines                                                                                       | `tests/lib/game-data/companions.test.ts` guards companion copy                                             |

---

## Add a new talent

Use `addEffect` for stackable numeric bonuses, including the same bonus written by two keywords. Use `setEffect` for flags, identity multipliers (defaults that are not zero, e.g. `healMultiplier`), and exclusive thresholds. Array fields (e.g. `healthThresholdArmor`) concatenate on `set`.

Homestead battle keys in `HOMESTEAD_BATTLE_*_KEYS` are **added** onto talent values at battle start (`mergeIntoManifest`). Keep identity defaults (`potionPotency: 1`, `healMultiplier: 1`) off those key lists; homestead defaults are zero-based bonuses. Shop, campfire, victory, and collection UI do **not** receive the battle merge — if they need homestead, pass both ports or merge at that consumer. Do not assume `useTalentEffects()` includes homestead.

Put talent-owned magnitudes on the talent ops (not only in `game-constants`) so descriptions and combat stay in lockstep. Talent and keyword descriptions omit periods, as enforced by content typography validation.

Incoming `receiveHalf*` resist talents use `scaleReceivedPlayerDamage` in `src/lib/battle/types/state-helpers.ts`. Enemy attacks scale once in `computeMitigatedDamage`; player DoTs scale once in `status-ticks.ts`. Do not also scale in `applyPlayerCombatDamage`.

1. Add effect field if the talent needs a new battle bonus — `src/lib/game-data/talent-effect-manifest.ts` + default in `talents/manifest-defaults.ts`
2. Define the talent (`id`, `keywordId`, name, description, effects, and Lucide `icon` name) in `src/lib/game-data/talents/talent-pool-definitions.ts`; its keyword-grouped table builds `talentPool`, with `pool/index.ts` re-exporting for compatibility. Register the icon in `src/features/alchemy/shared/config/talent-icons.ts`.
3. Keyword portrait art (new keyword or replacement art) — [Asset workflow § Add or replace game art](./WORKFLOWS-ASSETS.md#add-or-replace-game-art) (`scripts/assets/talent-assets.mjs` + `talentArt` in `src/lib/game-data/assets.ts`)
4. XP is keyword-based — `src/lib/game-data/talents/progression.ts` — no per-talent XP hook unless the keyword is new

Talent trees accept any count ≥ 1 in rows of 1/2/3/4, with overflow in its own row.

`talent-effect-invariants` must stay green: every manifest field is written by a talent or homestead key (or an explicit unused allowlist), every talent-written field is read in battle/meta code, and non-boolean `set` fields have a single writer unless they are arrays. Talent descriptions are free text with no numeric parity lint (typography lint still applies) — keep them in lockstep with effects by hand.

Run-end keyword cards intentionally show level + XP bar only; the Talents screens own the unspent-point indicator. Dodge earns 1 XP per successful hero Dodge through `awardBattleDodgeXP`, using the battle counter delta in the same command that persists the resolved enemy turn. Ordinary card keyword XP and run-end multipliers still apply. Random damage grants the Physical keyword; a damage-type pool grants every possible type rather than its placeholder type. Never count combat text or award XP again while resuming a pending transition.

Add a `talentArt` entry when art is ready; missing-art and keyboard behavior follow [UI component conventions](./UI.md#component-conventions).

New keywords still follow [Add a new keyword](#add-a-new-keyword) first.

## Add a homestead upgrade

1. Add `BuildingId` / `FarmId` / `ResearchId` — `src/lib/homestead/types.ts`
2. Define the item with `defineBuilding` / `defineFarm` / `defineResearch` — `src/lib/homestead/data.ts` (costs via `data-builders.ts` / `costs.ts`; stacking helpers `stackingTiers` + `single/dualMaterialCosts`)
3. Add effect keys only when existing keys cannot express the upgrade — `HomesteadEffectManifest` + `HOMESTEAD_BATTLE_*_KEYS` in `types.ts`; defaults in `defaults.ts`
4. Companion bond tiers (if companion) — `src/lib/homestead/companions.ts` (`COMPANION_BOND_TIERS` + `companionTierItems`) + `src/lib/game-data/companions.ts`
5. Art & palette — Add `helpers.tsx:itemArt` entry in `src/features/alchemy/meta/screens/homestead/helpers.tsx` + art via the [asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-game-art)
6. Change layout constants only for an intended layout change — `HOMESTEAD_CONFIG` in `helpers.tsx` (companion page size, aspect ratios)
7. Check affected rules or interactions; saved-shape changes follow the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md).

Homestead screens (like all screen directories) are excluded from `vitest` coverage thresholds — see the coverage `exclude` list in `vitest.config.ts` — and are covered by E2E `tests/e2e/specs/homestead-flow.spec.ts` plus the unit `homestead/*.test.tsx` suites. Use `npm run test -- tests/lib/homestead` for the lib contract and `npm run test:e2e:homestead` when the change needs browser verification.

## Add a new keyword

| Step                                                  | File(s)                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Define keyword config (label, description, colors) | `src/lib/game-data/keywords.ts`                                     |
| 2. Add display config if needed                       | `src/features/alchemy/shared/config/keywords.ts`                    |
| 3. Add talent XP trigger                              | `src/lib/game-data/talents/progression.ts` (keyword-based XP logic) |

---

## Change a shop

Ownership: [ARCHITECTURE.md § Shop commands](./ARCHITECTURE.md#shop-commands).

1. Locate the shop's command module, sampler, and draft recipe using the ownership map above; keep slot identity helpers separate from command/audio modules.
2. Dispatch purchases/refreshes through the existing shop transaction seam; play SFX only when its result confirms success. Equipment purchases resolve price and acquired contents from the live shelf item by instance ID.
3. Preserve the per-visit `firstPurchaseUsed` reset and use `mutateGearWithRunHealthSync` inside an open command draft; use the dispatching gear wrapper only at the outer boundary ([ARMORY.md § Write paths](./ARMORY.md#write-paths)).
4. Route every refresh through `refreshShopOfferings` with a sampler from `shop-state-init.ts` and an explicit typed shelf assignment. Apply potency or other offering modifiers inside the sampler so returned items match the committed shelf. The recipe clears purchased slots and consumes a refresh only on success; rejected refreshes never sample. Refreshes avoid the current offering set when enough eligible alternatives exist. Equipment refreshes compare base items across rarities and preserve room themes. When a pool is nearly exhausted, keep the shelf full while maximizing novel offerings.
5. Potion mixing scales amounts inside every chance branch while preserving probabilities; descriptions must reflect every alternative outcome. Same-ID ingredients combine through doubling only when their effects match; different-potency copies preserve both effect lists so ingredient order cannot create or destroy potency.

## Content system behavior

[Game rules](./GAME_RULES.md#content-systems) own mode resume, shared progression,
Labyrinth exploration, and room modifiers. Read
[run-setup ownership](./ARCHITECTURE.md#run-setup-ownership) before changing their
navigation. Keep persisted drafts and resume paths in their existing owners.

- Labyrinth maps persist on `activeRun.labyrinthMap` as Open Field `floors` and
  `nodes`. Generate floor 1 with seeded world RNG in the same command as the
  starting deck, including after a Wildcard starter draft. Core columns are 0–3;
  side rooms use columns -1 and 4. `currentNodeId` records the last completed room.
- Add modifiers in `content-systems/labyrinth/trait-catalog.ts`;
  `labyrinth/modifiers.ts` owns node eligibility, incompatible pairs, and exclusion
  of superseded modifiers from new rolls. Preserve existing saved IDs. Write
  descriptions of at most ten words, omit periods, use one theme, and never call
  a theme a “keyword.”
- Pass support-room modifiers through the existing active reward-modifier list
  before destination initialization. Apply offering modifiers before storing the
  shelf or event choices; see [shop changes](#change-a-shop),
  [Mystery effects](#adding-a-new-mystery-effect-kind), and
  [Corruption flow](#adding--changing-corruption-flow).
- Preserve saved geography and in-flight encounters. Historical
  [grid recovery](../src/features/alchemy/shared/storage/MIGRATION_HISTORY.md#schema-14--labyrinth-hex-floors),
  [hex retirement](../src/features/alchemy/shared/storage/MIGRATION_HISTORY.md#schema-17--labyrinth-open-field),
  and [side-room expansion](../src/features/alchemy/shared/storage/MIGRATION_HISTORY.md#schema-18--labyrinth-side-rooms)
  belong to their migration steps, not new navigation logic.
- Cover the changed setup/resume route with the dependency-related tests selected
  by `verify`.

## Change battle playback

Layout and ownership: [ARCHITECTURE.md § Battle path](./ARCHITECTURE.md#battle-path).
Visible behavior: [UI battle feedback](./UI.md#battle-feedback) and [battle motion](./UI.md#battle-motion).

- Keep playback ticks on the battle route and session autoplay preferences in the controller so route remounts do not lose the setting.
- Presentation updates may wake autoplay readiness/retry waits, but cannot shorten the post-play pause. Measure that pause from the start of the successful play, counting transfer time toward it; longer transfers add no extra pause. Teardown cancels either wait, and autoplay rechecks current playback gates before the next play.
- Manual card plays commit immediately and remain available during other card draws and hand reflow; only the incoming hidden cards and actual turn transitions are unavailable. Resolve clicked cards by hand identity so reflow cannot invalidate their old slot. Autoplay, auto-end-turn, and End Turn retain the presentation gate. Send each resolved action to the existing burst owner under the [battle feedback contract](./UI.md#battle-feedback). Concurrent draws preserve each other’s hidden cards and transfers; settlement checks the current battle state. Schedule auto-end explicitly after draws/resume; do not rely on React battle-state ticks. Opening the game menu cancels the auto-end countdown; closing it starts a fresh normal countdown only when eligible. Recheck the latest playback gates and hand playability when the countdown expires.
- Defer defeat teardown until the delayed screen transition commits; preserve the death and survival behavior in [UI battle motion](./UI.md#battle-motion).
- Wish choices open after active card transfers finish. Cards with both Draw and Wish show their draws first; queued Wishes also wait for the previous chosen card to reach the hand. Use the existing transfer-in-progress presentation signal without delaying gameplay commits.
- Preserve immutable hidden-hand keys, callback binding, post-death navigation timing, and the rule that mid-enemy-turn reload skips presentation replay.
- Nest the presentation-only attacker lunge outside shake so both effects compose; do not retime playback delays for it. Keep [battle timing](../src/lib/game-constants/battle-timing.ts) aligned with `combatant-attack-lunge` in [keyframes](../src/styles/keyframes.css) and the shake delay in [theme styles](../src/styles/theme.css). These owners define the exact phases and durations.
- Run the focused battle playback tests and the selection from `verify`; use the raw Playwright path for animation coverage.

## Adding a new screen

1. Add the screen to `Screen` and `ROUTE_SCREENS` in `src/lib/routing/screens.ts`.
2. Classify it in `src/lib/routing/run-screen-router.ts` (`SCREEN_PHASE`) and add every legal interactive edge in `src/lib/routing/screen-transition-policy.ts`. Run-loop lists derive from `SCREEN_PHASE`; `use-screen-transitions.ts` owns delay/immediate/commit timing, not taxonomy.
3. Create the component under `run-loop/screens/`, `run-setup/screens/`, or `meta/screens/`, and export it from that directory's `index.ts`.
4. Use `TitledScreenShell` from `shared/ui/layout-components.tsx`; `ScreenShell` is transparent and layout-only. `TitledScreenShell` owns the full-stage overflow wrapper so plasma shows through, and the app stage owns the background. Reserve `alchemy-shell` for contained panels. Main Menu and Battle are exceptions; choosers use widths from `shared/config/layout.ts`. The global menu button lives in `App.tsx`, so screens wire no menu props.
5. Wire the route in the matching phase table under `src/app/screen-routes/` (`meta-routes`, `run-setup-routes`, or `run-loop-routes`).
6. For resumable screens that can lose visit data during a fade, use a thin route wrapper with `useHeldWhile` and a shell fallback, following `app/screen-routes/mystery-screen-route.tsx`.
7. If new props are needed, extend the phase route context and `RenderAlchemyScreenProps` in `src/app/screen-routes/route-ctx.ts` and `src/app/screen-routes/index.tsx`.
8. Wire the navigation trigger at the caller of `goToScreen("<name>")`.

Boot restore/hydration sets a validated saved screen directly and intentionally bypasses the interactive transition table. Screen components subscribing to Zustand stores should select narrow slices or use `useShallow` to prevent render churn during high-frequency combat ticks.

---

## Adding a new destination (map node)

| Step                                      | File(s)                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add to `DESTINATIONS` const            | `src/lib/routing/destinations.ts`                                                                                                  |
| 2. Add to destination pool / availability | `src/lib/routing/destination-availability.ts`                                                                                      |
| 3. Offer construction (pure)              | `shared/run-flow/destination-flow.ts` — campaign start and run-loop progression pass offer history, boss ID, and command-bound RNG |

---

## Adding a new mystery effect kind

Mystery Boon choices prefer distinct unowned Boons across alternatives, but an unchosen alternative cannot exhaust the pool: reuse an available Boon across mutually exclusive choices before falling back to Astral Gear. Multiple grants within one choice remain distinct.

The committed `mysteryChosenChoice` records Material amounts actually awarded, including Homestead find bonuses, for the reward summary and save/resume. Keep the offered event's base amounts unchanged and apply bonuses only at the grant. `applyMysteryEffect` returns the actual Material award in `MysteryEffectResult`; navigation records that result without reconstructing it from inventory differences.

Live pool events are authored in `src/lib/mystery/pool.ts`; other `MysteryEffect` kinds stay on the union and handlers for authoring even when no live event uses them.

| Step                                                          | File(s)                                                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add `kind` string to `MysteryEffect` union                 | `src/lib/mystery/types.ts`                                                                                                          |
| 2. Add a `mysteryApplyHandlers` entry                         | `src/features/alchemy/run-loop/navigation/mystery-flow.ts`                                                                          |
| 3. Add fields to `MysteryEffectContext` if needed             | `mystery-flow.ts`                                                                                                                   |
| 4. Wire event commands if needed                              | `run-loop/navigation/mystery-event-navigation.ts`                                                                                   |
| 5. Wire follow-up UI in mystery screen                        | `run-loop/screens/mystery/mystery-screen.tsx` (exported via screens barrel)                                                         |
| 6. Route-held fade / empty-visit continue                     | `app/screen-routes/mystery-screen-route.tsx`                                                                                        |
| 7. Persist new visit fields if the kind stores rolled results | Mystery visit schema in `src/lib/validation/save-schemas/active-run.ts` + `src/lib/active-run-session/mystery-visit-persistence.ts` |
| 8. Author choice `effects` in display order                   | `src/lib/mystery/pool.ts`: XP → gold → materials → portrait reward per choice                                                       |

---

## Adding / changing corruption flow

Numeric corruption also updates matching delayed repeats of the changed effect, so the later turn agrees with the card description. A shared damage number, such as Stab's Physical-or-Bleed amount, updates both alternatives without consuming the numeric target for a separately described effect. Tithe's Gold percentage is editable and capped at 100%; Powerful Wish uses the same numeric mapping. Unrelated repeated effects retain their values.

| Step                                               | File(s)                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Card mutation rules                             | `src/lib/corruption/`                                                                          |
| 2. Destination handlers (corrupt / exit / abandon) | `run-loop/navigation/run-navigation-corruption.ts`                                             |
| 2b. Shell wiring                                   | `createCorruptionFlowHandlers()` in `shell/use-run-flow-engine.ts`                             |
| 3. Screen                                          | `run-loop/screens/corruption-screen.tsx`                                                       |
| 4. Resume                                          | `session.corruptionResult` via `run-resume-codec.ts` (`encodeCorruptionResult`, screen-scoped) |
| 5. Tests                                           | `tests/features/alchemy/run-loop/corruption.test.ts`, destination E2E Mystery/Corruption cases |
