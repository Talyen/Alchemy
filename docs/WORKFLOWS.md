# Alchemy — Implementation Workflows

Step-by-step checklists for adding or changing game content and wiring.

For refactors and simplification passes on attached paths, use [docs/Audits](./Audits/README.md) when the user cites an audit.

**Import paths:** only `@/*` → `src/*` in `tsconfig.json`. Use **on-disk** capability paths under `src/features/alchemy/` (for example `@/features/alchemy/shared/stores/run-session-read-port`) — not legacy alias paths that skip `shared/`.

**Read scope:** use the task index and open one workflow section at a time. Expand
only when a checklist crosses that boundary. Generated asset barrels are
outputs; use the [asset workflow](./WORKFLOWS-ASSETS.md) for their sources and
regeneration. Each checklist's tests are selected by the changed-path route
([CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change)); only
catalog-external tests are named inline.

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
3. Verify with the save-migration tests named there. `npm run check:ship` covers the production parse path; `npm run test:ship:unit` is the inner unit slice of that gate.

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

| Step                                                       | File(s)                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Call `awardMaterialsDuringRun(materials)`               | Mystery: `run-loop/navigation/mystery-flow.ts` (`gainMysteryMaterial` / `mysteryApplyHandlers`); combat gems: `run-loop/run/run-flow-victory.ts` (`commitVictoryRewards`); reward-screen materials: `run-loop/run/run-flow-rewards.ts` (`finishRewards`) |
| 2. Apply homestead find bonus when appropriate             | `applyMaterialFindBonus()` from `@/lib/homestead/loot` before awarding (mystery/combat already do this)                                                                                                                                                  |
| 3. Run-end display (no change needed if step 1 is correct) | `awardRunEndMaterials` in `run-loop/run/run-flow-session-helpers.ts` (used by `run-flow-defeat.ts`) merges `runMaterialsEarned` + `applyEndOfRunHomesteadBonuses` into `session.runEndMaterials`                                                         |
| 4. Tests                                                   | `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts`; mystery/reward-flow tests if adding a new source                                                                                                                                     |

**Do not** call `addMaterials()` on the run profile store directly from run-loop or mystery code for player loot.

Permanent Gear and Armory Trinkets use `recordRunObtainedItem()` at each grant site (reward Gear/Trinket picks, equipment shop, trinket shop, mystery generated Gear). `finalizeRunEndSession` copies `activeRun.runObtainedItems` into `session.runEndItems` for the run-end recap. Do not record Boons or cards.

---

## Add or change post-victory routing (`REWARD_ROUTES`)

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

Ownership and anti-patterns: [ARCHITECTURE.md § Run state](./ARCHITECTURE.md#run-state). Keep the command synchronous; put audio, navigation, timers, and presentation cleanup in `afterCommit`. Pass the draft to every gameplay mutator. Use the two-argument form when a result is needed by the post-commit effect:

```ts
dispatchRunSessionCommand(
  (draft) => {
    setRunGold(draft, (gold) => gold + price);
    return price;
  },
  { afterCommit: (paid) => playPurchaseSound(paid) },
);
```

If an async battle flow persists an intermediate state, commit `activeCombat.pendingBattleTransition` with it and add a boot resume path. Presentation timers alone are not a gameplay continuation.

---

## Add a new status effect

1. Define the status type in `src/lib/game-data/types.ts` — extend `PlayerStatusId` or `EnemyStatusId` string unions (discriminated union pattern).
2. Add tick logic in `src/lib/battle/status-ticks.ts`
3. Add player-side application logic in `src/lib/battle/status-player.ts`; add damage-type status riders in `src/lib/battle/damage-status-riders.ts`
4. Add CC threshold logic in `src/lib/battle/status-cc.ts`
5. Add matching keyword in `src/lib/game-data/keywords.ts`

---

## Add a new card

| Step                                                              | File(s)                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Define card in the card library                                | `src/lib/game-data/cards/library/cards.ts`                                                                                                                                                                |
| 2. Add effects (discriminated union on `kind`)                    | same card entry, `effects: [...]`                                                                                                                                                                         |
| 3. Add art reference                                              | `src/lib/game-data/assets.ts` (or `placeholderCard` while WIP)                                                                                                                                            |
| 4. (Optional) Register card sound                                 | `src/lib/sound-registry.ts` (`cardSounds` record)                                                                                                                                                         |
| 5. Update `descriptionLines` to match effects; context-aware text | same entry; pure text `src/lib/game-data/card-description.ts`, UI tokens `shared/ui/card-description-ui.tsx`, homestead/talent context `shared/context/card-description-context.tsx` (wired in `App.tsx`) |

Cards in `cardLibrary` are automatically included in card shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration. Exclude a card with `excludeFromOfferPool: true` (`mixed-potion` is the current example).

---

## Add a new card effect `kind`

| Step                                                                         | File(s)                                                                                |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Add to `BattleCardEffect` union                                           | `src/lib/game-data/types.ts`                                                           |
| 2. Add an `EffectKindDefinition` to the matching grouped `*-schemas.ts` file | `src/lib/game-data/effects/`                                                           |
| 3. Register non-recursive kinds in `TEMPLATE_EFFECT_DEFINITIONS`             | `src/lib/game-data/effects/registry.ts`                                                |
| 4. `BATTLE_CARD_EFFECT_KINDS` derives from the registry                      | `src/lib/game-data/effects/registry.ts`                                                |
| 5. Register the runtime handler in `EFFECT_APPLY_BY_KIND`                    | `src/lib/battle/effect-handlers/` — see `src/lib/game-data/effects/BATTLE_HANDLERS.md` |
| 6. Update effect metadata used for descriptions/keywords                     | `src/lib/game-data/effect-metadata.ts`                                                 |
| 7. Schema-registry guard                                                     | `tests/lib/game-data/effects-registry.test.ts`                                         |

`chance` and `repeat-over-turns` are the recursive exceptions: their schema factories live in `registry.ts` and dispatch handles them before the non-recursive registry.

---

## Add a new character

| Step                                                            | File(s)                           |
| --------------------------------------------------------------- | --------------------------------- |
| 1. Add character ID to `CharacterId` union                      | `src/lib/game-data/types.ts`      |
| 2. Define character in `characters` record                      | `src/lib/game-data/characters.ts` |
| 3. List card IDs in `startingDeck` (resolved via `resolveDeck`) | same file                         |

---

## Add a new enemy

| Step                                                                   | File(s)                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| 1. Define entry in `enemyBestiary` (`id` becomes `EnemyId`)            | `src/lib/game-data/compendium/enemies.ts`         |
| 2. Set `enemyType` (`normal`/`elite`/`boss`)                           | same file                                         |
| 3. Add traits as `{ id, title, description }` objects                  | same file (logic lives in battle system)          |
| 4. (Optional) Register attack sound                                    | `src/lib/sound-registry.ts` (`enemyAttackSounds`) |
| 5. Wildwood gauntlet bosses must also be listed in `WILDWOOD_BOSS_IDS` | `src/lib/content-systems/wildwood/bosses.ts`      |

---

## Add a new trinket

One definition powers a permanent Armory Trinket and a run-scoped **Boon**. Both reveal one Collection entry; Boons occupy no slot. `combineTrinketEffectIds` deduplicates matching forms.

1. Add data/art in `game-data/compendium/trinkets.ts` and `game-data/assets.ts`.
2. Extend `TrinketManifest` in `lib/trinkets.ts`; check battle/run consumers and Boon exclusions.
3. Verify Gear-aggregate ownership/equip plus permanent and ephemeral UI/discovery.

## Add permanent Gear

1. Add base item metadata in `src/lib/gear/base-items.ts` (slots, two-hand rule, affinity keywords, available rarities, thematic homestead `salvageByRarity`). Salvage consumes `salvageValue` on the generated definition.
2. Register raw art as `Raw Assets/Gear/<Name> - <Basic|Astral>.jpeg` (exact `-` separator, `.jpeg` extension), then run `npm run assets:optimize` and `npm run sync:gear-art` to emit `gear-<slug>-<rarity>.webp` mappings in `src/lib/game-data/gear-art.ts`. Naming or slot violations throw during sync.
3. Variant definitions are built automatically in `src/lib/gear/definitions.ts` as `{baseItemId}-{rarity}`.
4. Add new affix definitions in `src/lib/gear/affix-catalog.ts` with a stable ID, `keywordId`, effect key, value range, and eligible slots. Display/roll helpers live in `affixes.ts`.
5. Reward generation rolls instances in `src/lib/gear/generation.ts`; rewards screen stores the exact `GearInstance` (never re-roll on accept). Mid-reward progress for every content system, including Wildwood, is persisted in `activeRun.interruptedFlow` (`primary-reward` / `companion-reward` arms; gear stores full instances; cards/trinkets store choice ids).
6. Keep owned items as unique `GearInstance` records with `affixes: GearAffixRoll[]`; never put definition objects or art URLs into save data.
7. Battle applies aggregated `gearEffects` from `computeGearManifest()` during battle creation.
8. Keep each affix's `keywordId` aligned with affinity weighting and its `effectKey` aligned with `GEAR_EFFECT_KEYS`; architecture tests enforce registry coverage.
9. Update Gear save schemas/defaults and migration fixtures when instance or loadout shapes change.
10. Cover pure operations, generation, persistence, reward selection, Armory interaction, and battle snapshot behavior. HP-sync write paths: [ARMORY.md § Write paths](./ARMORY.md#write-paths).

---

## Add a new companion

| Step                                                                                                              | File(s)                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1. Add companion ID to `CompanionId` union                                                                        | `src/lib/game-data/types.ts`                                                                              |
| 2. Add optimized art and barrel export                                                                            | `src/lib/game-data/assets.ts`                                                                             |
| 3. Define companion in `companionLibrary` record                                                                  | `src/lib/game-data/companions.ts`                                                                         |
| 4. Add summon card via `summonCompanionCard()` in `cardLibrary` (`src/lib/game-data/cards/library/companions.ts`) | `src/lib/game-data/cards/card-builders.ts` — companion must have **exactly one** `turnStartEffects` entry |
| 5. Add summon card ID to `CardId` union                                                                           | `src/lib/game-data/types.ts`                                                                              |
| 6. (Optional) Register card sound                                                                                 | `src/lib/sound-registry.ts`                                                                               |
| 7. Add bond level to talent defaults (`companionBondLevels`)                                                      | `src/lib/game-data/talents/manifest-defaults.ts`                                                          |
| 8. Add bond level to homestead defaults                                                                           | `src/lib/homestead/defaults.ts`                                                                           |
| 9. Update description lines                                                                                       | `tests/lib/game-data/companions.test.ts` guards companion copy                                            |

---

## Add a new talent

Use `addEffect` for stackable numeric bonuses, including the same bonus written by two keywords. Use `setEffect` for flags, identity multipliers (defaults that are not zero, e.g. `healMultiplier`), and exclusive thresholds. Array fields (e.g. `healthThresholdArmor`) concatenate on `set`.

Homestead battle keys in `HOMESTEAD_BATTLE_*_KEYS` are **added** onto talent values at battle start (`mergeIntoManifest`). Keep identity defaults (`potionPotency: 1`, `healMultiplier: 1`) off those key lists; homestead defaults are zero-based bonuses. Shop, campfire, victory, and collection UI do **not** receive the battle merge — if they need homestead, pass both ports or merge at that consumer. Do not assume `useTalentEffects()` includes homestead.

Put talent-owned magnitudes on the talent ops (not only in `game-constants`) so descriptions and combat stay in lockstep.

Incoming `receiveHalf*` resist talents use `scaleReceivedPlayerDamage` in `src/lib/battle/types/state-helpers.ts`. Enemy attacks scale once in `computeMitigatedDamage`; player DoTs scale once in `status-ticks.ts`. Do not also scale in `applyPlayerCombatDamage`.

| Step                                                                                            | File(s)                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add effect field if the talent needs a new battle bonus                                      | `src/lib/game-data/talent-effect-manifest.ts` + default in `talents/manifest-defaults.ts`                                                                                                                                 |
| 2. Define the talent (`id`, `keywordId`, name, description, effects, `icon` Lucide export name) | `src/lib/game-data/talents/talent-pool-definitions.ts` (keyword-grouped table that builds `talentPool`; `pool/index.ts` re-exports for compat). Register the icon in `src/features/alchemy/shared/config/talent-icons.ts` |
| 3. Keyword portrait art (new keyword or replacement art)                                        | `scripts/assets/talent-assets.mjs` + `talentArt` in `src/lib/game-data/assets.ts`                                                                                                                                         |
| 4. XP is keyword-based                                                                          | `src/lib/game-data/talents/progression.ts` — no per-talent XP hook unless the keyword is new                                                                                                                              |

`talent-effect-invariants` must stay green: every manifest field is written by a talent or homestead key (or an explicit unused allowlist), every talent-written field is read in battle/meta code, and non-boolean `set` fields have a single writer unless they are arrays.

New keywords still follow [Add a new keyword](#add-a-new-keyword) first.

## Add a homestead upgrade

| Step                                                                       | File(s)                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add `BuildingId` / `FarmId` / `ResearchId`                              | `src/lib/homestead/types.ts`                                                                                                                                                                                                                                           |
| 2. Define the item with `defineBuilding` / `defineFarm` / `defineResearch` | `src/lib/homestead/data.ts` (costs via `data-builders.ts` / `costs.ts`; stacking helpers `stackingTiers` + `single/dualMaterialCosts`)                                                                                                                                 |
| 3. New battle or meta effect keys                                          | `HomesteadEffectManifest` + `HOMESTEAD_BATTLE_*_KEYS` in `types.ts`; defaults in `defaults.ts`                                                                                                                                                                         |
| 4. Companion bond tiers (if companion)                                     | `src/lib/homestead/companions.ts` (`COMPANION_BOND_TIERS` + `companionTierItems`) + `src/lib/game-data/companions.ts`                                                                                                                                                  |
| 5. Art & palette                                                           | Add `helpers.tsx:itemArt` entry in `src/features/alchemy/meta/screens/homestead/helpers.tsx` + webp via `WORKFLOWS-ASSETS.md`                                                                                                                                          |
| 6. Pagination / constants                                                  | `HOMESTEAD_CONFIG` in `helpers.tsx` (companion page size, aspect ratios)                                                                                                                                                                                               |
| 7. Tests                                                                   | `tests/lib/homestead.test.ts`, `tests/lib/homestead/tiers.test.ts`, `tests/features/alchemy/meta/screens/homestead-screen.test.tsx`, `tests/features/alchemy/meta/screens/homestead-tile-tooltip.test.tsx`, `tests/features/alchemy/meta/screens/homestead/*.test.tsx` |

Homestead screens (like all screen directories) are excluded from `vitest` coverage thresholds — see the coverage `exclude` list in `vitest.config.ts` — and are covered by E2E `tests/homestead-flow.spec.ts` plus the unit `homestead/*.test.tsx` suites. Use `npm run test:e2e:homestead` for the focused Playwright flow and `npm run test -- tests/lib/homestead` for the lib contract.

## Add a new keyword

| Step                                                  | File(s)                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Define keyword config (label, description, colors) | `src/lib/game-data/keywords.ts`                                     |
| 2. Add display config if needed                       | `src/features/alchemy/shared/config/keywords.ts`                    |
| 3. Add talent XP trigger                              | `src/lib/game-data/talents/progression.ts` (keyword-based XP logic) |

---

## Change a shop

Ownership: [ARCHITECTURE.md § Shop commands](./ARCHITECTURE.md#shop-commands).

Kind `"merchant"` maps to the player-facing **Card Shop**. Persist only the active shop screen through `encodePersistedShops`.

1. Keep `create-shop-actions.ts` as composition; put shop behavior in the matching `*-shop-commands.ts` module and draft recipes in `shop-transactions.ts`.
2. Dispatch purchases/refreshes through the existing shop command seam so paid effects and SFX run after a successful commit. Keep slot identity helpers separate from command/audio modules.
3. Preserve the per-visit `firstPurchaseUsed` reset and use `mutateGearWithRunHealthSync` inside an open command draft; use the dispatching gear wrapper only at the outer boundary ([ARMORY.md § Write paths](./ARMORY.md#write-paths)).
4. Refreshes avoid the current offering set when enough eligible alternatives exist. When a pool is nearly exhausted, keep the shelf full while maximizing novel offerings.

## Content system behavior

Campaign, labyrinth, and Wildwood differ at setup and resume. Read the
[run-setup ownership](./ARCHITECTURE.md#run-setup-ownership) section before
changing the navigation seam. Keep each content system’s persisted draft and
resume path in its existing owner, then cover the changed setup/resume route
with the dependency-related tests selected by `verify`.

Labyrinth maps persist on `activeRun.labyrinthMap` as hex floors (`floors` +
`nodes`). Resume still returns to `labyrinth-map`. Historical grid-map recovery
is recorded in [MIGRATION_HISTORY.md](../src/features/alchemy/shared/storage/MIGRATION_HISTORY.md#schema-14--labyrinth-hex-floors).

## Change battle playback

Layout and ownership: [ARCHITECTURE.md § Battle path](./ARCHITECTURE.md#battle-path).

- Keep playback ticks on the battle route and session autoplay preferences in the controller so route remounts do not lose the setting.
- Reuse the presentation gate and idle-input predicate for autoplay, auto-end-turn, manual card play, and End Turn. Schedule auto-end explicitly after draws/resume; do not rely on React battle-state ticks.
- Preserve immutable hidden-hand keys, callback binding, post-death navigation timing, and the rule that mid-enemy-turn reload skips presentation replay.
- Attacker lunge is presentation-only: nest it outside shake so hit VFX still compose; do not retime playback delays for it. Player lunge fires only for cards with a damage effect and moves the portrait, not the HP/status column.
- Run the focused battle playback tests and the selection from `verify`; use the raw Playwright path for animation coverage.

## Adding a new screen

| Step                                                                                                                                                                                                        | File(s)                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add string to `Screen` union and `ROUTE_SCREENS`                                                                                                                                                         | `src/lib/routing/screens.ts`                                                                                                                                                                                                                                                                 |
| 2. Classify the screen and add every legal interactive edge                                                                                                                                                 | `src/lib/routing/run-screen-router.ts` (`SCREEN_PHASE`), `src/lib/routing/screen-transition-policy.ts` (allowed edges; run-loop lists are derived from `SCREEN_PHASE`). Do not put taxonomy in `use-screen-transitions.ts` — that hook only owns delay / immediate / commit timing.          |
| 3. Create component in `run-loop/screens/`, `run-setup/screens/`, or `meta/screens/` + barrel export                                                                                                        | `index.ts` (local screen index under that subdirectory)                                                                                                                                                                                                                                      |
| 4. Wrap in `TitledScreenShell` and pass route `onOpenMenu`; `ScreenShell` is transparent/layout-only                                                                                                        | `shared/ui/layout-components.tsx`; `TitledScreenShell` owns the full-stage overflow wrapper so plasma shows through. The app stage owns the background. Use `alchemy-shell` only for contained panels. Exceptions: Main Menu and Battle. Choosers use widths from `shared/config/layout.ts`. |
| 5. Wire route handler in the matching phase table (`meta-routes`, `run-setup-routes`, `run-loop-routes`, …)                                                                                                 | `src/app/screen-routes/`                                                                                                                                                                                                                                                                     |
| 6. Resumable / anti-flash screens — add a thin route wrapper (see `app/screen-routes/mystery-screen-route.tsx`) that holds visit state with `useHeldWhile` and falls back to a shell while data is clearing |                                                                                                                                                                                                                                                                                              |
| 7. Extend phase route ctx / `RenderAlchemyScreenProps` if new props are needed                                                                                                                              | `src/app/screen-routes/route-ctx.ts`, `src/app/screen-routes/index.tsx`                                                                                                                                                                                                                      |
| 8. Wire navigation trigger                                                                                                                                                                                  | caller of `goToScreen("<name>")`                                                                                                                                                                                                                                                             |

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

Live pool events are authored in `src/lib/mystery/pool.ts`; other `MysteryEffect` kinds stay on the union and handlers for authoring even when no live event uses them.

| Step                                                          | File(s)                                                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add `kind` string to `MysteryEffect` union                 | `src/lib/mystery/types.ts`                                                                                                          |
| 2. Add a `mysteryApplyHandlers` entry                         | `src/features/alchemy/run-loop/navigation/mystery-flow.ts`                                                                          |
| 3. Add fields to `MysteryEffectContext` if needed             | `mystery-flow.ts`                                                                                                                   |
| 4. Wire React hook if needed                                  | `shell/use-mystery-event-navigation.ts`                                                                                             |
| 5. Wire follow-up UI in mystery screen                        | `run-loop/screens/mystery/mystery-screen.tsx` (exported via screens barrel)                                                         |
| 6. Route-held fade / empty-visit continue                     | `app/screen-routes/mystery-screen-route.tsx`                                                                                        |
| 7. Persist new visit fields if the kind stores rolled results | Mystery visit schema in `src/lib/validation/save-schemas/active-run.ts` + `src/lib/active-run-session/mystery-visit-persistence.ts` |
| 8. Author choice `effects` in display order                   | `src/lib/mystery/pool.ts`: XP → gold → materials → portrait reward per choice                                                       |

---

## Adding / changing corruption flow

| Step                                               | File(s)                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Card mutation rules                             | `src/lib/corruption/`                                                                          |
| 2. Destination handlers (corrupt / exit / abandon) | `run-loop/navigation/run-navigation-corruption.ts`                                             |
| 2b. Shell wiring                                   | `createCorruptionFlowHandlers()` in `shell/use-run-flow-engine.ts`                             |
| 3. Screen                                          | `run-loop/screens/corruption-screen.tsx`                                                       |
| 4. Resume                                          | `session.corruptionResult` via `run-resume-codec.ts` (`encodeCorruptionResult`, screen-scoped) |
| 5. Tests                                           | `tests/features/alchemy/run-loop/corruption.test.ts`, destination E2E Mystery/Corruption cases |
