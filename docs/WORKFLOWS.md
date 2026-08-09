# Alchemy — Implementation Workflows

Step-by-step checklists for adding or changing game content and wiring.

For refactors and simplification passes on attached paths, use [docs/Audits](./Audits/README.md) when the user cites an audit.

**Docs:** [AGENTS.md](../AGENTS.md) (rules) · [ARCHITECTURE.md](./ARCHITECTURE.md) (run state) · [REFERENCE.md](./REFERENCE.md) (commands, glossary, battle) · [CONTRIBUTING.md](../CONTRIBUTING.md) (hooks & tests) · [Audits](./Audits/README.md) (code-quality audits)

**Import paths:** only `@/*` → `src/*` in `tsconfig.json`. Use **on-disk** capability paths under `src/features/alchemy/` (for example `@/features/alchemy/shared/stores/run-session-read-port`) — not legacy alias paths that skip `shared/`.

## Task index

| Task                                          | Section                                                                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw asset / art                               | [Assets](#assets)                                                                                                                                                                 |
| Save schema / migration                       | [Persisted save data](#change-persisted-save-data)                                                                                                                                |
| Mid-run resume                                | [Active run data](#change-mid-run-resume-activerundata)                                                                                                                           |
| Post-victory routing                          | [REWARD_ROUTES](#add-or-change-post-victory-routing-reward_routes)                                                                                                                |
| Run teardown / clear save                     | [Run teardown](#run-teardown)                                                                                                                                                     |
| Status effect                                 | [New status](#add-a-new-status-effect)                                                                                                                                            |
| Card / card effect kind                       | [New card](#add-a-new-card) · [New effect kind](#add-a-new-card-effect-kind)                                                                                                      |
| Character, enemy, trinket, companion, keyword | [Character](#add-a-new-character) · [Enemy](#add-a-new-enemy) · [Trinket](#add-a-new-trinket) · [Companion](#add-a-new-companion) · [Keyword](#add-a-new-keyword)                 |
| Permanent gear                                | [Gear](#add-permanent-gear)                                                                                                                                                       |
| Screen, destination, mystery                  | [New screen](#adding-a-new-screen) · [Destination](#adding-a-new-destination-map-node) · [Mystery effect](#adding-a-new-mystery-effect-kind)                                      |
| In-run materials, staggered enter             | [Grant materials during a run](#grant-materials-during-a-run) · [Staggered screen enter](#staggered-screen-enter-motion) · [Interactive buttons](#interactive-button-conventions) |
| Tooltips                                      | [Hover tooltips](#hover-tooltips)                                                                                                                                                 |
| Gameplay session mutation                     | [Gameplay command boundary](#gameplay-command-boundary)                                                                                                                           |

---

## Assets

**Add a new raw asset:** register it in `scripts/assets/` (core/content/card manifests) → `npm run assets:optimize` (or `node scripts/prepare-assets.mjs`) → import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`. `sync:assets` regenerates `assets.generated.ts` from the art manifest targets.

**Gear art:** place files in `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg` → `npm run assets:optimize` → `npm run sync:gear-art` (regenerates `src/lib/game-data/gear-art.ts`). `predev` / `prebuild` run the full pipeline via `scripts/prepare-assets.mjs`: the art, sound, and music optimizers run concurrently (disjoint output dirs), then `sync:assets` + `sync:gear-art` regenerate the barrels from the art manifest. Set `ALCHEMY_SKIP_ASSETS=1` to skip that prep (CI/Vercel/release use this; commit regenerated outputs when you change sources).

---

## Change persisted save data

See also [`src/features/alchemy/shared/storage/MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md).

1. Decide if a schema bump is needed (transform required vs safe additive default).
2. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
3. Add `migrateVNToVNPlus1` in a new `src/lib/validation/migration/steps.ts` or topical `steps-*.ts` file when the first real post-floor bump lands (today is stamp-only); chain it from `migrateSaveDataToCurrent`.
4. Update Zod schemas in `src/lib/validation/save-schemas/`, storage defaults, and fixtures in `tests/fixtures/legacy-saves.ts`.
5. CI enforces via `tests/architecture/save-migration-guard.test.ts`, `tests/architecture/save-migration-contract.test.ts`, and `npm run check:ship` — no manual release checklist.

---

## Change mid-run resume (`ActiveRunData`)

1. Extend `ActiveRunData` in `src/lib/active-run-session/types.ts` and Zod schema in `src/lib/validation/save-schemas/active-run.ts` (optional fields with defaults in `normalize-active-run-data.ts` often avoid a schema bump). Mid-combat wire shape goes through `PersistedBattleStateSchema` in `save-schemas/persisted-battle-state.ts`.
2. Add the field to `ActiveRunProgressFields` / hydration in `src/features/alchemy/shared/stores/run-state-init.ts` (mirror `runTalentXP` / `runMaterialsEarned` pattern) when it is active-run progression. Transient resume fields belong in the codec projection instead of the run-domain types. The flat `RunStateFields` patch type is test-only now — if a test needs it, add the key to `tests/helpers/run-domain-store-test.ts`.
3. Update `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()` in `src/features/alchemy/shared/stores/run-resume-codec.ts` — the codec is the sole `RunSession` → `ActiveRunData` translator. Progress fields spread from the aggregate via `pickActiveRunFields`; do not re-list them. `normalize-active-run-data.ts` keeps the decode-time content-system guards in sync.
4. Keep `snapshotRun()` and `restoreRun()` as thin lifecycle wrappers around `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()`. `restore-active-run-session.ts` should only apply the decoded session fields. Default trinket-manifest repair for mid-combat resume runs in `restoreRun` via `repairPersistedBattleTrinketManifest` (not Zod). Keep the operation inside `dispatchRunSessionCommand()` so boot/resume is published as one aggregate commit; defer navigation, audio, and presentation work with `afterCommit` or after the command returns.
5. Run `tests/features/alchemy/shared/storage/active-run.test.ts`, `tests/features/alchemy/shared/stores/run-domain.test.ts` (snapshot parity), the codec / pending-reward tests, plus storage/migration tests.

**Active-run helpers (do not confuse):**

| Function                 | Module                                                                       | When                                                         |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `normalizeActiveRunData` | `@/lib/validation`                                                           | Zod transform: health clamp + content-system field isolation |
| `parseActiveRun`         | `@/lib/active-run-session` or `@/features/alchemy/shared/storage/active-run` | Runtime validation before hydration                          |
| `toActiveRunData`        | `@/lib/active-run-session` (`parse.ts`)                                      | Card hydrate after Zod parse (also used by save IO)          |

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-write-port.ts`) so homestead inventory and `activeRun.runMaterialsEarned` stay aligned for the run-end summary.

| Step                                                       | File(s)                                                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Call `awardMaterialsDuringRun(materials)`               | Mystery handlers: `run-loop/navigation/use-mystery-flow.ts`; combat: `run-loop/run/run-flow-handlers.ts` (`finishRewards`, `commitVictoryRewards` via `addHomesteadMaterials` callback)             |
| 2. Apply homestead find bonus when appropriate             | `applyMaterialFindBonus()` from `@/lib/homestead/loot` before awarding (mystery/combat already do this)                                                                                             |
| 3. Run-end display (no change needed if step 1 is correct) | `run-flow-handlers.awardRunEndMaterials` in `run-loop/run/run-flow-handlers.ts` merges `runMaterialsEarned` + `applyEndOfRunHomesteadBonuses` into the aggregate session region's `runEndMaterials` |
| 4. Tests                                                   | `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts`; mystery/reward-flow tests if adding a new source                                                                                |

**Do not** call `addMaterials()` on the run profile store directly from run-loop or mystery code for player loot.

---

## Staggered screen enter (motion)

| Step                    | Guidance                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1. Panel wrapper        | `<StaggerGroup>` on the main content container; optional `swapKey` when content identity changes and enter should replay |
| 2. Child items          | `<StaggerItem index={n}>` wrapping each row/card — not on `Button` / `PressableSound` directly                           |
| 3. Nested grid          | Inner `<StaggerGroup animate={false}>` to avoid double panel enter (shops, pickers inside an already-entering panel)     |
| 4. Tab switch fade only | `state-fade` class instead of `state-swap` when restagger on tab change is undesirable (options tabs)                    |
| 5. Absolute / map nodes | Skip `StaggerItem` when the node uses `-translate-x/y` for centering; use panel-level enter only                         |

Motion tokens and keyframes live in `src/index.css`. Hover/tap rules: [Interactive button conventions](#interactive-button-conventions).

---

## Interactive button conventions

Tokens live in `src/features/alchemy/shared/config/button-tokens.ts`. Use shared components before hand-rolling styles.

| Concern         | Standard                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Shape           | `rounded-xl` rectangles (`BUTTON_SHAPE`)                                                                            |
| Primary CTA     | `Button variant="primary"` (gold fill) — Play, Continue, Confirm                                                    |
| Secondary CTA   | `Button variant="outline"` — Back, Cancel, Skip, alternate menu nav                                                 |
| Neutral surface | `bg-background` + `border-border/80` — outline, `ChoiceButton`, `TabBar`, talent filters (`BUTTON_SURFACE_NEUTRAL`) |
| Accent CTA      | `ShineAccentButton` — corruption forward actions with shine border                                                  |
| Paired footers  | `ActionButtonRow` — secondary left, primary right                                                                   |
| Equal choices   | `ChoiceButton` — destinations, neutral surface + accent text                                                        |
| Tabs            | `TabBar` — `h-11`, `rounded-xl`                                                                                     |
| Hover           | Sound + CSS brightness/background lift (no scale); see `src/lib/ui/button-hover.ts`                                 |
| Press           | CSS `active:brightness-95`                                                                                          |
| Width tiers     | `menu` → `w-56`, `dialog` → `w-40`, `action` → `min-w-40`, `full` → `w-full`                                        |

| Step               | Guidance                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| 1. Menu stack      | One `primary` at top (Play); all other items `outline` + `BUTTON_WIDTH_MENU` |
| 2. Back + Continue | `ActionButtonRow` with `width="dialog"`                                      |
| 3. Skip + confirm  | `ActionButtonRow` with `width="action"`; skip secondary, confirm primary     |
| 4. Destinations    | `ChoiceButton` via `DestinationChoices`; accent text only on neutral surface |
| 5. Shine           | Only on accent-intent forward actions — never Back/Cancel/Skip               |

---

## Hover tooltips

Clip bounds are `[data-testid="vr-stage"]` (fallback: `documentElement`), not the raw browser window. Prefer above; flip below when the tooltip would clip the stage top.

| Case                                                                                                 | Use                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Tall tooltips inside `overflow-hidden` scenes (battle enemies, armory gear/currency, bestiary tiles) | `PortaledTooltip` / `EnemyTooltip` / `GearTooltipPortal` — `createPortal` to `document.body` + `usePortaledTooltipPlacement` |
| Smaller in-DOM hover panels that already opt into flip                                               | `useTooltipFlip`, `useTooltipViewportClamp`, or `useTooltipSidePlacement` on `TooltipPanel`                                  |
| Tiny labels that never near an edge                                                                  | Plain `TooltipPanel` without measurement hooks                                                                               |

Placement helpers live in `src/features/alchemy/shared/ui/portaled-tooltip-placement.ts` and `tooltip-panel.tsx`.

---

## Add or change post-victory routing (`REWARD_ROUTES`)

| Step                           | File(s)                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add route constant          | `src/features/alchemy/shared/types.ts` → `REWARD_ROUTES`, exported via `CONSTANTS`                                                                       |
| 2. Compute route after rewards | `src/features/alchemy/run-loop/navigation/reward-flow.ts` (`finalizeRewardState` / related; import `@/features/alchemy/run-loop/navigation/reward-flow`) |
| 3. Handle transition           | `reward-flow.ts` (`executeRewardRouteTransition`) and/or `shell/use-run-flow-engine.ts`                                                                  |
| 4. Tests                       | `tests/features/alchemy/run-loop/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run                                                       |

---

## Run teardown

`src/features/alchemy/shared/stores/reset.ts` (import `@/features/alchemy/shared/stores/reset`):

- `teardownRun()` / `flushSaveAfterRunEnd()` in [`run-transitions.ts`](../src/features/alchemy/shared/stores/run-transitions.ts) — run teardown and immediate save flushes (navigation calls these on run end).
- `clearAllPersistentGameData()` — clears app options, permanent run/talent data, and homestead (Options “clear save”).

## Gameplay command boundary

Gameplay code mutates run state through `dispatchRunSessionCommand()` from `run-session-command.ts`.

1. Keep the command synchronous; do not cross an `await` while mutating run state.
2. Put audio, navigation, timers, and presentation cleanup in `afterCommit` so failed commands cannot leak non-rollbackable effects.
3. Pass the draft to every gameplay mutator. Use the object form when a result is needed by the post-commit effect:

   ```ts
   dispatchRunSessionCommand({
     execute: (draft) => {
       setRunGold(draft, (gold) => gold + price);
       return price;
     },
     afterCommit: (paid) => playPurchaseSound(paid),
   });
   ```

4. Run-flow concern factories receive only the explicit callbacks they need from already-created concerns (for example, destination handlers receive `advanceToNextDestination`). Keep this wiring at `createRunFlowHandlers`; do not introduce a mutable sibling-handler bag or a second dispatch/continuation layer.
5. Gameplay mutations enter through `dispatchRunSessionCommand()` and focused draft mutators. Do not call a command from inside another command or reach past that boundary into aggregate transaction internals.
6. `readBattle()` is data-only. Battle mutations use the focused commands exported from `run-session-write-port.ts`; do not spread aggregate battle actions into event-time stores.
7. If an async battle flow persists an intermediate state, commit `activeCombat.pendingBattleTransition` with it and add a boot resume path. Presentation timers alone are not a gameplay continuation.
8. `readActiveRun()`, `readRunProfile()`, and `readRunSession()` are data-only. Active-run and profile mutations use focused command-backed write ports; do not pass aggregate actions through React or imperative read ports.
9. Run RNG sources are command-backed and must be consumed inside the command that commits their resulting state. Gameplay code must not use `Math.random()` for run outcomes.

---

## Add a new status effect

1. Define the status type in `src/lib/game-data/types.ts` — extend `PlayerStatusId` or `EnemyStatusId` string unions (discriminated union pattern).
2. Add tick logic in `src/lib/battle/status-ticks.ts`
3. Add player-side application logic in `src/lib/battle/status-player.ts`; add damage-type status riders in `src/lib/battle/damage-status-riders.ts`
4. Add CC threshold logic in `src/lib/battle/status-cc.ts`
5. Add matching keyword in `src/lib/game-data/keywords.ts`
6. Cover through `tests/lib/battle/status-*.test.ts` tests

---

## Add a new card

| Step                                                                      | File(s)                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Define card in the appropriate library array                           | `src/lib/game-data/cards/library/{core-cards,specialty-cards,advanced-cards}.ts` |
| 2. Add effects (discriminated union on `kind`)                            | same card entry, `effects: [...]`                                                |
| 3. Add art reference                                                      | `src/lib/game-data/assets.ts` (or `placeholderCard` while WIP)                   |
| 4. (Optional) Register card sound                                         | `src/lib/sound-registry.ts` (`cardSounds` record)                                |
| 5. Update `descriptionLines` to match effects                             | same card entry                                                                  |
| 6. Cover through `tests/lib/game-data/descriptions-match-effects.test.ts` |                                                                                  |

Cards in `cardLibrary` are automatically included in merchant shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration (only `mixed-potion` is excluded).

---

## Add a new card effect `kind`

| Step                                                                                     | File(s)                                                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Add to `BattleCardEffect` union                                                       | `src/lib/game-data/types.ts`                                                              |
| 2. Create `effects/<kind>/definition.ts` (schema + `dispatchRoute`)                      | `src/lib/game-data/effects/`                                                              |
| 3. Register in `TEMPLATE_EFFECT_DEFINITIONS` (+ `ALL_EFFECT_REGISTRY_ENTRIES` if needed) | `src/lib/game-data/effects/template-definitions.ts`                                       |
| 4. Add `kind` to `BATTLE_CARD_EFFECT_KINDS`                                              | `src/lib/game-data/effects/kinds.ts`                                                      |
| 5. Implement handler (existing route module or new)                                      | `src/lib/battle/effect-handlers/` — see `src/lib/game-data/effects/BATTLE_HANDLERS.md`    |
| 6. Update `effect-metadata.ts` keywords                                                  | `src/lib/game-data/effect-metadata.ts`                                                    |
| 7. Tests                                                                                 | `tests/lib/battle/apply-effects*.test.ts`, `tests/lib/game-data/effects-registry.test.ts` |

---

## Add a new character

| Step                                                            | File(s)                           |
| --------------------------------------------------------------- | --------------------------------- |
| 1. Add character ID to `CharacterId` union                      | `src/lib/game-data/types.ts`      |
| 2. Define character in `characters` record                      | `src/lib/game-data/characters.ts` |
| 3. List card IDs in `startingDeck` (resolved via `resolveDeck`) | same file                         |

---

## Add a new enemy

| Step                                                  | File(s)                                           |
| ----------------------------------------------------- | ------------------------------------------------- |
| 1. Add enemy ID to `EnemyId` union                    | `src/lib/game-data/types.ts`                      |
| 2. Define entry in `enemyBestiary` array              | `src/lib/game-data/compendium/enemies.ts`         |
| 3. Set `enemyType` (`normal`/`elite`/`boss`)          | same file                                         |
| 4. Add traits as `{ id, title, description }` objects | same file (logic lives in battle system)          |
| 5. (Optional) Register attack sound                   | `src/lib/sound-registry.ts` (`enemyAttackSounds`) |

---

## Add a new trinket

| Step                                      | File(s)                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| 1. Define entry in `trinketLibrary` array | `src/lib/game-data/compendium/trinkets.ts`                                |
| 2. Implement effect logic                 | `src/lib/trinkets.ts` — extend `TrinketManifest` and apply in battle init |
| 3. Add art reference                      | `src/lib/game-data/assets.ts`                                             |

## Add permanent Gear

1. Add base item metadata in `src/lib/gear/base-items.ts` (slots, two-hand rule, affinity keywords, available rarities, salvage).
2. Register raw art as `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg`; run `npm run assets:optimize` then `npm run sync:gear-art` to emit `gear-{slug}-{rarity}.webp` mappings in `src/lib/game-data/gear-art.ts`.
3. Variant definitions are built automatically in `src/lib/gear/definitions.ts` as `{baseItemId}-{rarity}`.
4. Add new affixes in `src/lib/gear/affixes.ts` with stable `affixId` and `keywordId` for affinity weighting.
5. Reward generation rolls instances in `src/lib/gear/generation.ts`; rewards screen stores the exact `GearInstance` (never re-roll on accept). Mid-reward campaign/labyrinth progress is persisted in `activeRun.interruptedFlow` (`primary-reward` / `companion-reward` arms; gear stores full instances; cards/trinkets store choice ids).
6. Keep owned items as unique `GearInstance` records with `affixIds`; never put definition objects or art URLs into save data.
7. Battle applies aggregated `gearEffects` from `computeGearManifest()` during battle creation.
8. v1 affixes only cover the eight flat damage keywords; affinity tags like `archery` or `gold` are forward-looking for roll weighting until matching affixes ship.
9. Update Gear save schemas/defaults and migration fixtures when instance or loadout shapes change. Additive `interruptedFlow` reward fields and `gearBoardPositions` use schema defaults where safe (no bump required for pure additives).
10. Cover pure operations, generation, persistence, reward selection, Armory interaction, and battle snapshot behavior.

---

## Add a new companion

| Step                                                                                           | File(s)                                                                                                   |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1. Add companion ID to `CompanionId` union                                                     | `src/lib/game-data/types.ts`                                                                              |
| 2. Add optimized art and barrel export                                                         | `src/lib/game-data/assets.ts`                                                                             |
| 3. Define companion in `companionLibrary` record                                               | `src/lib/game-data/companions.ts`                                                                         |
| 4. Add summon card via `summonCompanionCard()` in `cardLibrary` (`src/lib/game-data/cards.ts`) | `src/lib/game-data/cards/card-builders.ts` — companion must have **exactly one** `turnStartEffects` entry |
| 5. Add summon card ID to `CardId` union                                                        | `src/lib/game-data/types.ts`                                                                              |
| 6. (Optional) Register card sound                                                              | `src/lib/sound-registry.ts`                                                                               |
| 7. Add bond level to talent defaults (`companionBondLevels`)                                   | `src/lib/game-data/talents/manifest-defaults.ts`                                                          |
| 8. Add bond level to homestead defaults                                                        | `src/lib/homestead/defaults.ts`                                                                           |
| 9. Update description lines + tests                                                            | `tests/lib/game-data/companions.test.ts` + `tests/lib/game-data/descriptions-match-effects.test.ts`       |

---

## Add a new keyword

| Step                                                  | File(s)                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Define keyword config (label, description, colors) | `src/lib/game-data/keywords.ts`                                     |
| 2. Add display config if needed                       | `src/features/alchemy/shared/config/keywords.ts`                    |
| 3. Add talent XP trigger                              | `src/lib/game-data/talents/progression.ts` (keyword-based XP logic) |

---

## Adding a new screen

| Step                                                                                                        | File(s)                                                                |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Add string to `Screen` union and `ROUTE_SCREENS`                                                         | `src/lib/routing/screens.ts`                                           |
| 2. Create component in `run-loop/screens/`, `run-setup/screens/`, or `meta/screens/` + barrel export        | `index.ts` (local screen index under that subdirectory)                |
| 3. Wire route handler in the matching phase table (`meta-routes`, `run-setup-routes`, `run-loop-routes`, …) | `src/app/screen-routes/`                                               |
| 4. Extend phase route ctx / `RenderAlchemyScreenProps` if new props needed                                  | `src/app/screen-routes/route-ctx.ts`, `src/app/render-screen-props.ts` |
| 5. Wire navigation trigger                                                                                  | caller of `goToScreen("<name>")`                                       |

---

## Adding a new destination (map node)

| Step                                      | File(s)                                       |
| ----------------------------------------- | --------------------------------------------- |
| 1. Add to `DESTINATIONS` const            | `src/lib/routing/destinations.ts`             |
| 2. Add to destination pool / availability | `src/lib/routing/destination-availability.ts` |

---

## Adding a new mystery effect kind

| Step                                              | File(s)                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1. Add `kind` string to `MysteryEffect` union     | `src/lib/mystery/types.ts`                                                                                                |
| 2. Add `case` in `applyMysteryEffect()` switch    | `src/features/alchemy/run-loop/navigation/mystery-flow.ts` (import `@/features/alchemy/run-loop/navigation/mystery-flow`) |
| 3. Add fields to `MysteryEffectContext` if needed | `mystery-flow.ts`                                                                                                         |
| 4. Wire React hook if needed                      | `run-loop/navigation/use-mystery-flow.ts`                                                                                 |
| 5. Wire follow-up UI in mystery screen            | `run-loop/screens/mystery/mystery-screen.tsx` (exported via screens barrel)                                               |
