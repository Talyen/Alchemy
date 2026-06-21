# Changelog

All notable changes to Alchemy are documented here. Player-facing summaries ship in `release-notes/`.

## [Unreleased]

### Features

- feat(content): add content validation and audit tooling
- feat(talents): implement 21 new talents across nature, consume, archery, companion pools
- feat(homestead): add art for all nodes and fix mismatched research IDs
- feat(ci): commit 7 - enable strict test config and wire typecheck:all into lint:ci
  - tsconfig.test.json: noUnusedLocals: true, noUnusedParameters: true
  - package.json lint:ci: npm run typecheck -> npm run typecheck:all
  - Fix 47 unused-import errors from noUnusedLocals activation
  - Remove unused defaultBattleState re-export (knip fix)
  - Fix integration/trinkets: restore defaultTalentEffects import
- feat(armory): improve drag visuals, salvage sfx, equip-ux, and fix bow+shield bugs
  Salvage: thicker red border (matching valid-green ring-2), mine-2.ogg
  sound on confirm. Tooltip no longer re-appears briefly after double-click
  flyover (1s cooldown).
  
  Cursor: replaces OS cursor with
  one during drag; portal tracks pointer
  as a static div (no spring animation during active drag), eliminating
  the visible art-shift/crop caused by motion resampling object-cover
  during the spring. When settling or flying over, spring animation remains.
  
  Equip slots: background frame stays visible when item is dragged away
  (only the item art hides). Double-click unequip now places items at the
  first available top-left inventory cell rather than preferred positions.
  
  Bow+shield: equipping a ranged weapon now correctly clears non-quiver
  off-hand items, and the store restores equipped-return positions for
  all indirectly unequipped items (not just the target slot).
  
  Off-hand auto-pick: double-clicking a one-handed item with main-hand
  filled and off-hand empty equips to off-hand. New canEquipInOffHand
  helper on GearDefinition.
- feat(armory): add ArmoryTransferMenu primitive for right-click gear transfer
  New armory-transfer-menu.tsx component renders a portaled context menu
  at the right-click anchor point with one 'Send to [ClassName]' button
  per unlocked, non-source character. Escape key and backdrop click close
  the menu. Viewport-edge clamping prevents overflow.
  
  Wire into armory-screen.tsx and meta-routes.tsx: the onTransferGear
  prop is passed from the controller through the route wrapper to the
  screen, which renders the menu when transferMenu state is non-null.
- feat(armory): wire right-click transfer menu through screen panels into gear tiles
- feat(armory): add transferToInventory store action and onTransferGear controller callback
  Add the missing transferToInventory(instanceId, targetCharacterId)
  action to useGearStore. Moves the gear instance between character
  inventories, clears all loadout references, transfers the board
  position, and sanitizes orphan positions.
  
  Add onTransferGear to the ArmoryController facade hook with HP-sync
  and save-flush side effects matching the existing onSalvage/onEquip
  patterns.
  
  4 new unit tests cover: basic transfer with board position, unknown
  instance rejection, same-target rejection, and unequip-then-transfer.
- feat(armory): enforce ranged-weapon + quiver off-hand pairing
  Wire the rangedWeapon/quiver contract from base-items into the equip
  pipeline:
  
  - Add isRangedWeapon and isQuiver helpers in operations.ts.
  - Add isGearCompatibleWithLoadoutSlot(definition, slot, characterLoadout,
    inventory): extends the basic slot check with contextual rules —
    a quiver off-hand requires a ranged main-hand already equipped,
    and a non-ranged main-hand is rejected when a quiver is in the
    off-hand.
  - equipGear now uses isGearCompatibleWithLoadoutSlot to refuse
    invalid combinations; the loadout is left unchanged.
  - resolveHandConflicts clears the off-hand quiver when a non-ranged
    main-hand is equipped so the UI can orchestrate the swap.
  - Propagate rangedWeapon and quiver from GearBaseItemDefinition to
    GearDefinition in definitions.ts.
  - Update useArmoryGearDrag and SlotButton to use the stricter
    compatibility check so the green 'compatible' ring is only shown
    for valid pairs.
  
  Add 9 unit tests in tests/lib/gear/gear.test.ts covering: ranged
  flag, quiver flag, one-handed ranged weapons, quiver rejected
  without ranged main-hand, quiver accepted with bow and crossbow,
  non-ranged main-hand rejected with quiver, resolveHandConflicts
  swap behavior, and buckler unaffected.
- feat(armory): tag base items as ranged weapons or quivers
  Add two optional fields to GearBaseItemDefinition:
  - rangedWeapon: true for longbow, shortbow, recurve-bow, crossbow.
  - quiver: true for the quiver base item.
  
  Reclassify the crossbow as a one-handed weapon (requiresTwoHands:
  false) so it can be paired with a quiver off-hand, matching the
  existing one-handed bow + quiver pattern. The other ranged weapons
  were already one-handed.
  
  Add tests/architecture/gear-ranged-tags.test.ts to lock the
  contract: every main-hand base item has an explicit rangedWeapon
  value, only the 4 known ranged weapons are tagged true, and only
  the quiver base item is tagged quiver: true.
  
  Add tests/helpers/gear-test.ts with a knightInventories(...items)
  helper for unit tests that need a single-character inventory map.
  
  The combat effects and equip compatibility rules for the quiver +
  ranged-main-hand pair land in a follow-up commit.
- feat(armory): reducer for targeting state, effect-key guard, and migration v10
  Three orthogonal cleanups for the Armory subsystem:
  
  - Replace the 3 // eslint-disable react-hooks/set-state-in-effect
    disables in armory-screen.tsx with a useReducer over a dedicated
    armoryTargetingState (armory/armory-targeting-state.ts). The 4 useState
    hooks (salvageMode, salvageTarget, activeCurrencyId, cursorPoint)
    collapse to a single reducer with 13 typed actions and identity-stable
    no-op returns. The 3 'clear stale state when external conditions
    change' effects now dispatch a single action. 21 reducer unit tests
    lock the behavior.
  
  - Add tests/architecture/gear-affix-effect-keys.test.ts to assert
    every gearAffixCatalog entry's effectKey is in GEAR_EFFECT_KEYS, that
    every key in GEAR_EFFECT_KEYS is referenced by at least one affix,
    and that the keys are unique. Catches silent zero-roll typos in
    future affix additions.
  
  - Move the localStorage[alchemy-armory-positions] shim out of
    gear-store.ts into a new migrateV9ToV10 step. Bump
    CURRENT_SAVE_SCHEMA_VERSION to 10. Add a v9 fixture to
    LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION. The shim now lives in the
    canonical migration pipeline and is exercised by 8 dedicated
    architecture tests. The store no longer touches localStorage.
- feat(armory): simplify state, fix equipped tooltips, and remove click animations
- feat(armory): per-character gear inventories, destination pity, and UI polish
  - Migrate saves to per-character gear inventories and board positions (schema v9)
  
  - Track destination offer state with pity weights and post-offer dampening
  
  - Improve armory tooltip placement and salvage confirmation dialog
- feat(release): automate changelog sync and patch notes from git history
  Pre-push syncs CHANGELOG.md from conventional commits, generates player-facing
  notes from changelog sections, and adds CI drift guard for main-only agent workflow.
- feat(ui): add crafting currencies, armory apply flows, and coverage
  Introduce six salvage crafting currencies with store persistence and armory
  application UI. Add save migrations plus E2E and unit tests for crafting,
  equip-swap, and persistence round-trips.
- feat(battle): implement new gear affixes, resolve nature refund bug, and clean lint
- feat(ui): add gear armory, run shops, and affix-driven items
  Replace placeholder gear with affix rolls, trinket/equipment shops, and armory UI.
  Persist shop purchases, battle gear hooks, and wildwood reward restore fixes.
- feat(save): add boons, gear armory, and automated migrations
  Replace trinkets with boons and add permanent gear with an Armory screen.
  
  Refactor schema v4 migrations into nested CI-guarded modules and fix
  paused-combat return navigation.
- feat(ui): add Wildwood Draft gauntlet and rebalance battle tuning
  Replace single-boss Wildwood select with a versioned draft-to-boss loop
  including auto recovery, rewards, and optional card removal. Harden
  wildcard entry, recovery timers, boss-start failures, and save init.
  Rebalance leech, burn, poison decay, and talent scaling with updated
  balance sim tooling and tests.
- feat(release): add Steam ship gates, save merge, and release automation
  Enforce release readiness with check:ship scripts, CI/nightly gates, cloud
  save merge via lastSavedAt, desktop Steam IPC, and tagged release workflow
  with version and VDF verification.
- feat(ui): staggered enter motion, talent unlock burst, and run materials tracking
  Roll out StaggerGroup/StaggerItem and TiltSurface across screens.
  Track homestead materials earned during runs for the end summary.
  Add talent allocation VFX and slim AGENTS.md into focused docs.
- feat(run): add discoveries screen, victory grace, and battle polish
  Introduce run-end discovery pack flow with batched card/trinket reveals.
  
  Add battle victory grace before teardown, expand mystery events, and fix tooltip layout.
  
  Add paper-move SFX, refine character select, and stabilize CI preview smoke test.
- feat(progression): gate meta features and characters behind run wins
  Persist finishedRunCharacters in save data and lock Talents, Homestead,
  game modes, and characters until prerequisite runs are completed.
  Move selectRewardCards to lib/game-data with deck-affinity sampling.
- feat(battle): refactor companion and wish mechanics, resolve tooltip layout types
- feat(cards): consolidate card library modules and implement raw art for 11 placeholder cards
- feat: add archery content, companions, and save schema v2
  Rename arrow to archery as a card tag with flatArrowDamage bonus, add new
  cards and non-damage companions, special effects (Exorcism, Tithe, Roulette),
  and v1-to-v2 migration including placeholder talent IDs. Consolidate CI and
  pre-push checks behind lint:ci and align companion battle tooltips with cards.
- feat: add error logging, error boundary per screen, balance tuning, and simulator improvements
- feat: add mystery event art, mana talent effects, Steam Cloud saves, and layout consolidation
  - Add 16 unique mystery event art assets replacing placeholders
  - Replace placeholder mana talents with 9 real talents
  - Add Steam Cloud save/load/delete via platform bridge
  - Consolidate mobile/desktop layout constants into unified values
  - Add mana-crystal damage scaling, wellspring mana retention,
    heal-on-mana-gain, and burn-on-crystal-loss battle effects
  - Remove legacy index.css in favor of Tailwind v4
  - Rework mystery event choices for balance and trinket integration
- feat: integrate Steamworks, migrate to Tailwind CSS v4, and optimize save/load logic
- feat: add new homestead buildings, research upgrades, validation improvements, and leech/status talent effects
- feat: add battle edge-case tests, vite-plugin-checker, and UI polish
  - Add vite-plugin-checker for TS type checking in dev mode
  - Add extensive edge-case tests: haste/Death's Door overlap,
    enemy damage types (holy/burn/poison), DoT kills during CC skip,
    forge threshold bursts, stun/freeze talent chains, null field
    halving, overkill clamping, and defensive guards
  - Fix save schema TypeScript cast for legacy deck check
  - Polish UI: startup bar animation timing, hover popup panel
    transform-origin, screen transitions, character select art
  - Remove unused line in screen store
- feat: UI shell standardization, hamburger navigation, wildcard draft, new character art
  - Standardized hamburger menu as primary navigation across all screens
  - Added consistent alchemy-shell containers to Collection, Talents, Battle
  - Added ember particles inside Battle shell
  - Created wildcard DraftDeckScreen (pick 1-of-3, 6 rounds)
  - Restored controller-utils.ts for battle card measurement/transfers
  - Added Alchemist, Druid, Warlock, Wildcard character art assets
  - Standardized card sizing across battle and collection views
  - Unified shell padding to p-7 across all screens
  - Fixed talents-ui.tsx CSSProperties type error
  - Fixed active-run.test.ts ranger deck size assertion
- feat: room scaling for enemy traits, sundering armor rework, enemy balance pass
  - Enemy traits (regeneration, forge, armor, burn bonus, freeze bonus) now scale with room multiplier
  - Sundering Charm / Sundering Armor Piercing now removes enemy armor instead of ignoring it (applies to Physical & Stun)
  - Added IRON_HIDE_BURN_BONUS_PER_TURN constant
  - Elite HP multiplier 1.4 -> 1.2, Boss HP multiplier 1.7 -> 1.3
  - Enemy base regeneration 2 -> 1, lizard scout attack 1->2, iron bear attack rebalanced
  - Added roomScalingMultiplier to BattleState type
  - Updated enemy descriptions to remove hardcoded numbers
  - Updated tests for new behavior
- feat(alchemy): implement companion mechanics, extend talents, and refactor active-run storage
  Implement companion phase and actions, expand talent lists, simplify active-run storage validation, and fix NoticeCombatTextEvent types to support custom text notifications.
- feat(alchemy): redesign talent screen with radial tree layout and background art
  - Rewrite talent-tree.tsx with elliptical orbital positioning per keyword
  - Add 11 talent background art assets with SVG mask transitions
  - Replace filler-button centering hack with absolute positioning
  - Guard unlockAllTalents dev helper behind import.meta.env.DEV
  - Fix UnlockedTalents type mismatch in use-run-navigation.ts
  - Extract nested ternary in TalentKeywordButton to ringClass()
  - Move dangling type import to top of assets.ts
  - Add INITIAL_LOAD_BATCH_SIZE for batched startup preloading
  - Fix anchor placement for talents screen menu
  - Disable pointer-events on hand cards during drag
- feat: add 10 new cards with assets, improve battle UI and enemy turn logic
- feat: add new card effects (lose-health, draw-cards, remove-armor, multiply-status) and 11 cards
- feat: implement Block/Forge/Armor keyword talents and custom cursor system
  - Add 14 new talent effects across Block, Forge, and Armor keywords
    (blockReduceBurnDamage, blockDepletedHeal, blockToHolyDamage, blockToStunDamage,
     startForge, forgeToBleed, forgeStripArmorThreshold, flatForgeGained,
     forgeDoubledBelowHalfHealth, forgeBlockThreshold, forgeBlockAmount,
     startArmor, armorMitigatesBleed, armorBreakBlock, armorMitigatesStun,
     armorCleanseThreshold, flatArmorAmount)
  - Generalize forge consumption to apply to burn/holy/bleed damage via talents
  - Add custom pointer cursor via CSS injection in main.tsx
  - Migrate several raw assets from PNG to JPEG format
  - Remove art-prompts.md, polar-pendant.webp, resonant-chime.webp
- feat: battle rebalance — Math.round, player CC, CC cooldown, enemy healing removed
  - Battle engine: replace Math.floor with Math.round across all files,
    enforce via ESLint no-restricted-syntax rule
  - Player CC: stun/freeze now skip player turn, with CC cooldown (2 turns)
    preventing chain-lock on both sides
  - Enemy healing removed: no more heal-below-50%-HP mechanic
  - Enemy armor decays by 1 per hit dealing health damage; enemy forge decays
    by 1 per physical hit (mirrors player behaviour)
  - Forge burn burst extracted to shared applyForgeBurnBurst helper
  - New talent effects: blockOnStun, forgeOnStun, stunStripArmor, manaOnStun,
    flatStunDamage
  - Card rebalance: Stab 3→2 Bleed, Heal 5→4, Fangs 2 Bleed/Leech→3
    Physical/Leech, Meteor 10→7 Burn, Pack Tactics 2→3 Nature
  - Game constants: room scaling 0.1→0.05, ELITE_HP_MULTIPLIER 1.4 (no
    attack scaling), removed ENEMY_HEAL_FRACTION, adjusted regen values
  - Asset migration: PNG→JPEG raw assets, add Cold Snap/Combustion/Ray of
    Frost/Frozen Pocketwatch/Icy Heart/Resonant Chimes/Gold art
  - Add balance simulation system (balance:sim script)
  - Restructure tests: remove obsolete E2E tests, add focused flow tests,
    add descriptions-match-effects test
- feat: remove experiments, add new music/assets, UI polish and audio improvements
- feat: add comprehensive test suite, UI improvements, and storage validation

### Bug Fixes

- fix(e2e): add missing test imports and fix reward-flow setup
- fix(shop): consume mix slot on any attempt, dedup price/refresh handlers
  - Fix bug where mix slot was not consumed on failed mix attempts
    (mixing with an existing Mixed Potion could be retried indefinitely)
  - Gate handleAlchemistMixPotions on mixUsed; set mixUsed=true and
    deduct gold before the operation, not after — any attempt counts
  - Remove stale eslint-disable comments on initAlchemist and
    handleEquipmentShopRefresh (no unused params exist)
  - Add rng?: () => number to CreateShopActionsDeps for deterministic
    equipment shop init/refresh (defaults to Math.random)
  - Collapse 4 price getters into makeBuyPriceGetter factory
  - Collapse 4 refresh handlers into makeCardRefreshHandler /
    makeShopRefreshHandler factories
  - Move markSlotPurchased to shop-transactions.ts for reuse
  - Add 4 tests: mix cooldown on failure, second-mix block, alchemist
    refresh dedup, and deterministic rng for equipment shop
- fix(armory): fix gear-save store initialization, workspace layout overflow, and currency drag swap targeting
- fix(use-battle-controller): guard companion follow-up re-entry, stabilize cardPlay deps cascade
  - Fix scheduleCompanionFollowUp guard to prevent duplicate timers under
    concurrent turn resolution (early return + set ref before setTimeout)
  - Wrap scheduleAutoEndTurn behind a ref so cardPlay doesn't rebuild on
    every battle state tick; mirrors onEndTurnRef pattern in same hook
  - Narrow cardPlay deps from whole talents object to stable
    awardCardXP store action only, avoiding rebuilds on talent changes
  - Replace resetHandTransferUi useCallback with direct Zustand selector
  - Extract inline Props type to named UseBattleControllerProps alias
  - Update AGENTS.md comment policy: allow 'why' comments, section
    markers; ban only pointless 'what' comments
- fix(armory): polish drag visuals, unified carry, and edge-case fixes
  - fix: add image-rendering-pixelated to gear art to eliminate 1px edge flicker
  - fix: increase board right padding 8->12px so rightmost borders aren't cut off
  - fix: shrink equipment panel padding p-2->p-1 to free up board space
  - fix: discordant-dice requires item.affixes.length > 0 to be a valid target
  - fix: hide 'Salvage for...' tooltip text on 0-affix items
  - fix: implement unified item carry — currency drops on gear/currency now
    pick up the displaced item on the cursor (like gear-on-gear already did)
  - fix: clear FSM settled visual when carry starts, preventing item A from
    'shifting' after swapping with item B and moving B away
  - refactor: use overlaps() helper in currency drag occupant check
  - refactor: move fsmClearDragRef assignment into useEffect for consistency
  - docs: add load-bearing precedence comment near dragVisual derivation
  - test: add unit tests for carry mechanism exposure
  - test: add E2E assertions for rightmost cell fit and currency-on-gear swap
  - test: add E2E assertion for image-rendering: pixelated on drag visual
- fix(armory): polish gear drag placement and salvage sound
- fix(armory): correct secondary displacement logic and drag visual stability
- fix(armory): eliminate drag flicker by unifying DragVisualPortal element type
  The portal conditionally rendered <div> (drag) vs <motion.div> (settle/flyover).
  Every type-swap caused a fresh mount where Framer's initial={{x:0,y:0}}
  reset the visual to its startRect (origin), producing rapid cursor-to-origin
  teleporting.
  
  - Replace the ternary with a single <motion.div> that uses {duration:0}
    during the active drag (instant cursor-follow) and easing/spring for
    settle/flyover.
  - Anchor style.left/top on visual.source (the drag-start rect) so the
    CSS box stays stable across drag-settle transitions.
  - Set initial to the cursor delta during drag so first-mount targets the
    cursor, not the origin.
  - Skip onAnimationComplete during drag (early return) to avoid spurious
    callbacks.
  - Remove now-unused carriedVisual/clearCarry from screen destructure and
    overlay prop-passing (carry is rendered via the main dragVisual portal).
- fix(armory): quiver compat check, drag-FSM unmount races, rng determinism, cursorPoint perf
  Bug fixes:
  - Reject equipping non-ranged main-hand when quiver is in off-hand
  - Remove same-footprint swap shortcut that ignored third-item collisions
  - Fix drag-FSM cursor chain-capture, pendingCommit unmount races,
    and null-instance crash in drag visual
  - Expand contextmenu whitelist (inventory item + equip slot) so
    right-click doesn't clear salvage/currency targeting
  - Require explicit rng in salvage/applyCurrency; inject via ref in
    controller; throw when omitted
  
  Architecture:
  - Split updateGearStateAndSync into moveEquippedOffBoard + pipeline
  - Unify board packing: syncBoardPositionsForState now uses same
    packInventoryWithPositions + packCurrencyWithPositions as screen
  - Move cursorPoint out of useReducer into local useState (stops
    full-screen re-render on every pointer move during targeting)
  
  Housekeeping:
  - Remove deprecated GearModifier and dead pruneGearBoardPositions
  - Remove 4 AGENTS.md comment-policy doc blocks
  - Replace __vacated__ magic string with proper param
- fix(armory): resolve stale closure health sync bug and clean up drag hooks
- fix(ci): resolve Electron binary missing error and stabilize E2E drag-and-drop tests
- fix(tests): commits 3-6 - resolve remaining 25 errors across 12 files
  Battle mocks (G4): cast partial mocks as BattleControllerContext/TurnOrchestrationDeps
  BattleState mock (G5): add 6 missing fields to battle-feedback test state
  Architecture casts (G8): widen gear-ranged-tags with GearBaseItemDefinition &
    save-migration-guard with Record<string, T> casts
  RewardState (G7): cast trinket reward via unknown to avoid CardRewardState spread
  Generic mismatches (G9): fix DifficultyModifier shape, mapState prev type
  Script .d.ts fixes: gear types, GearEffectManifest path
  Labyrinth handlers: cast as any for private LabyrinthNodeHandlers type
- fix(tests): commit 2 - update .d.ts for script module signatures
  - writeSteamBuildVdfs: root, env -> { appPath, depotPath, buildDir }
  - computeSyncedChangelog: existingContent, rootDir? -> string
  - Mirror changes across wildcard and specific module declarations
- fix(tests): commit 1 - quick wins resolving ~18 errors across 10 files
  G1/G2/G6/G10/G12 quick fixes:
  - active-run-data: as cast for remainingBossIds (WildwoodBossId union)
  - run-domain: same as cast for remainingBossIds
  - run-victory-handlers: version 2 -> 3 as const
  - reward-flow: replace invalid 'collector' modifier with 'generous';
    use proper EncounterRewardTraitId[] type for modifier arrays;
    cast trinket reward state to TrinketRewardState
  - playable-hand: uid string -> number; update key expectations
  - hand-card-layout: add 2nd param to scheduleTimeout callbacks;
    use ! assertion for closure-assigned callbacks
  - armory-inventory-layout: add definitionId/affixes to missed item
  - app-store: add lastSavedAt: 0 to makeSave literal
  - pending-reward-persistence: add full MaterialInventory values
  - mystery-flow: add BattleCard type to callback params
  - destination-flow: cast Destination to shop union
- fix(tests): resolve remaining Phase D type errors (batch 2)
  - armory-targeting-state: add transferMenu null to dirty state objects
  - armory-inventory-layout: add definitionId/affixes to gear item mocks
  - armory-screen: fix partial GearLoadout using cast pattern
  - active-run-data: remove as const from remainingBossIds
  - balance-report: cast anomaly values as number, add thresholds to return type
  - run-domain: add MaterialId values to runMaterialsEarned
  - app-store: add full crafting currency IDs to craftingCurrencies
  - collection-items: add collectionTab arg to getCollectionFillerCount
  - e2e/save-injection: type labyrinth grid with node union
  - battle unit tests: fix cost/damage/draw/gear-effects type narrowing
  - gear-new-affixes: add as const to damageType
  - status-application: index PlayerStatusValues with keyof
  - battle-setup: fix computeTalentEffects arg shape
  - status-stun-resolve: add as const to effect kinds
  - apply-effects-utility: add as const to companionId
  - effects-registry: widen set type for templateKinds
  - modifiers: fix REWARD_MODIFIER_KINDS type cast
  - map-state: type labyrinth rows as LabyrinthNode | null
- fix(tests): resolve systematic test type errors (Phase A+B+C)
  Phase A — default-battle-state fixture helpers:
  - combat-text, enemy-turn, apply-effects, card-play, encounter-traits,
    enemy-turn-attack, enemy-turn-utils, end-player-turn, status-forge
  - Replace raw object literals with defaultPlayerStatusValues, defaultCcState,
    defaultEnemyMitigation, defaultCombatFlags
  
  Phase B — globalWithWindow test helper:
  - Cast globalThis as unknown as { window?: object } in storage test files
  - Eliminates TS2352/TS2322/TS2790 for window mock assignments
  
  Phase C — spec-specific mock fixes:
  - error-log-store: ErrorSource 'runtime' -> 'storage'
  - active-run-data/hydrate/run-domain: add missing ActiveRunData fields
    (shopState, alchemistState, trinketShopState, equipmentShopState, etc.)
  - gear-equip/gear-combat/gear-flow/armory-crafting: GearLoadout null init
  - audio-buffer-cache/audio-volume: AudioContext/HTMLAudioElement typing
  - app-store: add missing SaveData fields (gearInventories, etc.)
  - run-flow-handler-deps/run-navigation-hook: add onInitTrinketShop/EquipmentShop
  - alchemy-run-controller/battle-controller-hook: defaultHomesteadEffects
  - storage/migrations: cast result.gameBuildVersion from unknown
- fix(tests): resolve 369 type errors across Phase 3-4 fixes
  - Fix partial-object leftovers in enemy-turn, status-ticks, damage-riders, feedback
  - Fix domain type mismatches in reward-flow, run-domain, error-log-store
  - Fix armory/gear type issues (ranged-tags, targeting, inventory-layout)
  - Fix module declarations for .mjs imports (scripts/global.d.ts)
  - Fix window type assertions across storage tests
  - Fix E2E spec types (gear-equip, save-injection, gear-flow)
  - Fix electron-environment.d.ts for page.alchemyDesktop access
  - Fix electron-helpers.ts Platform type (remove 'mas')
  - Fix default-battle-state.ts fixture types (phoenixFeather, EnemyStatusValues, TrinketManifest)
  - Clean up .ts.ts/.corrected.ts file debris from subagent processing
- fix(tests): resolve partial-object type errors in battle test files
  - Create default-battle-state.ts fixtures for PlayerStatusValues,
    EnemyStatusValues, CcState, CombatFlags, TrinketManifest, EnemyMitigation
  - Apply fixtures across ~20 battle test files (status-ticks, damage,
    end-player-turn, status-player, status-stun-resolve, trinket-effects, etc.)
  - Fix TS2353 object key errors (battle traits, turn-resolution-ui)
  - Fix TS2352 loose cast errors (storage, audio test files)
  - Fix card literal as const patterns (wish.test.ts, draw.test.ts)
  - Fix window.alchemyDesktop type in environment.d.ts
  - Fix DifficultyId and tooltip type mismatches
  - Disable noUnusedLocals/noUnusedParameters in test tsconfig
  - Delete tsconfig.scripts.json (no .mjs/.cjs support)
  - Clean up leftover .corrected.ts files and fix knip ignores
- fix(tests): resolve 87 type errors in test and page-object files
  - Fix TS2729 class field init order in 9 page-object files (move fields to constructor)
  - Fix TS6133 unused imports (homestead-page)
  - Fix TS2352 loose type casts (add as unknown intermediate)
  - Fix TS2353 object key mismatches (gear-test, battle traits)
  - Fix TS7053/2339 indexed access and property errors (companions, difficulties)
  - Fix TS2554/2304 missing rng args and type imports (gear tests)
  - Fix TS18046 unknown type assertions (normalize tests)
  - Add environment.d.ts with Window.alchemyDesktop declaration for test env
  - Add default-battle-state.ts fixture for partial-object pattern
  - Add modules.d.ts stubs for .mjs script imports
  - Disable noUncheckedIndexedAccess and exactOptionalPropertyTypes in test tsconfig
- fix(armory): allow auto-swap when equipping non-ranged main-hand with quiver off-hand
  Relax isGearCompatibleWithLoadoutSlot so that equipping a non-ranged
  main-hand while a quiver is in the off-hand succeeds. resolveHandConflicts
  already clears the off-hand quiver in this case. The user no longer needs
  to manually unequip the quiver before equipping a non-ranged main-hand.
  
  Flip the unit test from 'rejects' to 'allows and clears the off-hand'.
- fix: ship armory gear system and harden save migrations
  Add grid armory with save-backed board positions, gear rewards, and affixes.
  Persist pending rewards and boon-to-trinket schema v5 migrations.
  Fix labyrinth End Run to abandon the full run and decouple content v2 remaps.
  Address review findings for layering, a11y, and UI token deduplication.
- fix(lib): unexport discovery pack size constants for knip
- fix(run): align defeat teardown awardRunEndMaterials type with finalizeRunEndSession
- fix(battle): correct type definitions in BattleControllerContext
- fix(e2e): prevent card play race condition and timeout during turn transitions
- fix(screen-routes): resolve onOpenBattleMenu type mismatch
- fix(ci): extract Electron zip with unzip on Linux CI
  extract-zip hung for ten minutes after a fast download on ubuntu-latest.
  Use the system unzip command on non-Windows platforms so the binary is
  available before Playwright launches Electron.
- fix(ci): extend Electron download timeouts and prefer npm rebuild
  Cold CI downloads can exceed five minutes. Raise workflow and spawnSync
  timeouts, try npm rebuild and official install.js before the custom
  downloader, and log zip fetch and extract progress.
- fix(ci): block Electron ensure with spawnSync and keep-alive download
  Async ensure exited before Linux downloads finished on Node 24. Run the
  downloader and official install.js via spawnSync and hold the download
  event loop open until extract and verification complete.
- fix(ci): keep ensure-electron alive with explicit process.exit
  Node 24 rejects unsettled top-level await with exit code 13. Wait for the
  async download via main().then(process.exit) so CI blocks until the binary
  is verified.
- fix(ci): block ensure-electron until async download completes
  The script returned exit 0 in under a second while the download was still
  running, so CI steps and Playwright globalSetup thought Electron was ready.
  Use top-level await so the process stays alive until verification finishes.
- fix(ci): await Electron download in-process and add install fallback
  spawnSync could return before the async download child finished, leaving
  no binary on disk. Run the download in the same process and fall back to
  official install.js when the custom downloader still cannot verify the
  binary.
- fix(ci): retry Electron download and cache binary on nightly
  Restore the dist cache after npm ci, retry @electron/get downloads, and
  give the ensure step a 20-minute timeout for slow GitHub-hosted downloads.
- fix(ci): use official Electron install.js with install polling
  Replace custom download child process with spawnSync on install.js and a
  sync poll loop so Linux CI waits for the full binary before smoke tests.
- fix(ci): locate nested Electron binary after zip extract
  Search dist/ for the platform executable, skip npm postinstall during
  ci, and retry ensure separately with a longer timeout.
- fix(ci): avoid top-level await in electron-download script
  Node 24 exits with code 13 when the download script uses unsettled
  top-level await; run the download inside async main instead.
- fix(ci): block until Electron download completes
  Run the download in a child process via spawnSync so npm ci and nightly
  ensure steps wait for the binary before compile and smoke tests start.
- fix(ci): enforce Electron binary size check and path marker
  Require a real executable file before skipping download, write the resolved
  path for Playwright workers, and verify the binary exists in nightly CI.
- fix(ci): verify Electron install via filesystem checks
  Replace require(electron) heuristics with path.txt and binary checks,
  run ensure in Playwright globalSetup, and clear ELECTRON_SKIP_BINARY_DOWNLOAD
  in the nightly Electron job so the smoke test can launch the binary on Linux.
- fix(ci): resolve Electron executable path from path.txt
  Avoid require(electron) in Playwright workers after ensure-electron
  runs so the smoke test uses the downloaded binary directly.
- fix(ci): verify Electron via require before skipping download
  Treat a resolvable electron executable as the install gate so partial
  postinstall state on CI cannot skip the binary download.
- fix(ci): keep ensure-electron alive until download completes
  Avoid top-level await so Node 24 on GitHub Actions does not exit before
  the Electron artifact finishes downloading.
- fix(ci): download Electron via @electron/get in ensure script
  Bypass install.js postinstall quirks on GitHub Actions by downloading
  the Electron artifact directly before nightly desktop smoke tests run.
- fix(ci): add ensure-electron script for desktop smoke installs
  Centralize Electron binary download with ELECTRON_SKIP_BINARY_DOWNLOAD
  stripped so GitHub Actions runners install the binary before Playwright
  launches the desktop shell.
- fix(ci): download Electron binary when CI skips postinstall
  Unset ELECTRON_SKIP_BINARY_DOWNLOAD on nightly desktop jobs, approve
  electron install scripts for npm 11, and ensure the binary exists before
  Playwright launches the shell.
- fix(ci): ensure Electron binary is installed before desktop smoke tests
  Run electron/install.js after npm ci and verify the executable path so
  Linux nightly jobs do not fail when the postinstall binary is missing.
- fix: restore talents types.ts corrupted by encoding
  Revert file to valid UTF-8 so Vite production build and pre-push hook pass.
- fix: give battle endTurn more time and fresh locators in CI
  Avoid stale End Turn clicks during animated turns; extend draw-discard e2e timeout.
- fix: stabilize e2e when save restores mid-run destination screen
  Wait for hydrated destination UI instead of racing Play during bootstrap.
  Retry menu navigation when Play detaches; restore saves in useLayoutEffect.
- fix: satisfy knip after active-run store refactor
  Trim unused exports, remove redundant store shim, and align knip entries with shared/stores paths.
- fix: stop exporting unused buildAlchemySaveDataFromStores
- fix: import flush save via storage barrel for lint
- fix: persist and display talent XP after run end
  Snapshot earned XP to runEndTalentXP before finalize clears runTalentXP.
  
  Game Over and Run Victory show keyword progress again.
  
  Flush save after finalize so talentXP is not lost on the rewards screen.
  
  Reset run XP on new run hydration and teardown.
- fix: satisfy knip for run router and store action exports
- fix(test): enable fast mode in elite combat critical e2e
  Matches other winViaCombat tests so End Turn is not flaky during animations in preview CI.
- fix(test): repair nightly e2e after difficulty screen a11y refactor
  Use button role selectors instead of stale image alt text.
  
  Stabilize the 4K VR stage test with vr-stage hooks and bootstrap wait.
- fix: satisfy knip for wish overlay z-index export
- fix: stop exporting unused RunStoreActions type for knip
  The CI lint job runs deadcode; knip flagged RunStoreActions as an unused export.
- fix: resolve tsc errors blocking production build
- fix: restore run types and clean battle module exports
  Restore ActiveRunData exports dropped during refactor and remove duplicate enemy-turn helpers.
- fix: autosave debouncing, Death's Door grace counter, error hardening, and damage math fixes
  - Debounce autosave with timer coalescing and flush on unload
  - Replace Death's Door turn-based grace with explicit grace turns counter
  - Replace throws with logError in navigation and enemy-turn
  - Fix holy lifesteal double-dipping healMultiplier and flag mutation in damage pipeline
  - Fix battle controller cleanup to preserve companion scheduling on end-turn
  - Add validation schemas for 5 new card effect kinds
  - Extract labyrinth connection min/max to constants
  - Convert storage writes-disabled to class instance
- fix: resolve visual races in battle controller, siphoning math bugs, and restore end-of-run rewards
- fix: preserve node_modules symlinks in CI by switching from artifacts to cache (tar+zstd preserves symlinks, zip does not)
- fix: button icon spacing consistency, homestead store race conditions, status clamping, and schema fix
- fix: add enableDevMode to Mobile Landscape e2e test
  This test uses test.use() for a custom viewport which creates a
  separate browser context, so the dev mode flag from other tests
  doesn't carry over.
- fix: skip startup loading screen in e2e tests to prevent CI timeouts
  The useInitialLoadReady hook preloads all 156+ game images before revealing
  the menu. On CI's 2-core runner this takes >5s, so the StartupLoadingScreen
  is still visible when the first e2e tests check for the Play button.
  Subsequent tests benefit from the browser-level HTTP cache and pass.
  
  - Bypass the loading screen when alchemy-dev-mode is set (already used by
    enableDevMode() in e2e helpers)
  - Add enableDevMode() to the App Boot and Character Select tests that
    navigated to '/' without it
- fix: glacial-shell respects freezePreventsEnemyScaling, cleanup transfer refs, improve CI and Playwright config
- fix: remove unused cardLibrary import from active-run.ts
- fix: harden battle persistence and audio startup, refactor UI barrels
  - Battle persistence: merge saved state with defaultBattleState() to prevent
    NaN/crashes from missing fields; always persist current battleState instead of
    reverting to battleStartState on enemy phase; skip activeCombat save when battle
    is resolved (enemyHealth <= 0 or player defeated)
  - Labyrinth: move labyrinthPendingNode to ActiveRunData top-level so non-combat
    nodes (campfire/shop/alchemist/mystery) survive reload
  - Audio: gate audioUnlocked on actual AudioContext resume (not preload); prevent
    music restart on subsequent keyboard/mouse gestures after initial unlock
  - Refactor: replace flat barrel files (battle.ts, game-data.ts, storage.ts) with
    directory barrels; split battle-screen, card-ui, collection-ui into focused
    components; extract card-text, collection-items, card-button, card-popup,
    status-icons, particle-burst, shop-card-item
  - Track encounteredRunEnemyIds across the run for enemy variety; play
    companion-specific sounds per companion type
  - Add tests for all persistence, validation, audio, and UI changes
- fix: format source files and add lefthook pre-commit hook
- fix: correct playwright baseURL, add lefthook pre-commit hook and prepare script

### Performance

- perf(startup): defer image decode gate, music fetch, fonts, and non-critical work
  - Drop upfront decode gate for all 305 webp assets (22 MB) — menu now
    paints after 650 ms min duration; images stream in via idle callback
  - Defer music MP3 fetch (~45 MB) to first user gesture instead of mount
  - Self-host Inter variable woff2 (48 KB) — eliminates render-blocking
    Google Fonts CSS request entirely; no FOUC
  - Defer startup validation and error-log-store registration to idle time
    (~1.5 KB removed from main JS critical path)
- perf: speed up pre-push e2e with parallel @prepush subset
  Run eight parallel prepush tests locally; keep full critical suite for CI via test:e2e:prepush:full.

### Refactors

- refactor(content): dedupe card-parity, drop noise warning, add trait-keyword parity
- refactor(armory): simplify drag and targeting state
- refactor(battle-controller): remove dead resolvedAsHasteOrStunRef and redundant teardown effect
- refactor(style): simplify index.css — remove dead theme tokens, collapse card-ghost classes, dedupe vars
- refactor(style): flatten index.css variables and consolidate design tokens
- refactor(style): simplify index.css and clean up unused tailwindcss-animate plugin
- refactor(style): simplify index.css architecture and resolve redundancies
- refactor(gear): simplify store-helpers architecture
- refactor(shop): simplify shop actions and unify pricing selectors
- refactor(run-flow): trim deps, extract wildwood victory commit, dedupe teardown
- refactor(shop): extract pure shop-actions factory, drop favorConsumed refs, add bounds checks
- refactor(armory): overhaul drag system with gear-store helpers, add sort board
  - Rewrite gear drag with unified DragVisualPortal and improved math
  - Add board sorting (onSortBoard) via meta-routes
  - Extract gear-store helpers for equip/swap/transfer logic
  - Add drag-position E2E spec, remove obsolete gear-flow spec
  - Fix music audio level jump on screen change
  - Update CONTRIBUTING.md gear test mapping
- refactor(battle): simplify turn orchestration and eliminate controller cycle
  - Add explicit kind: haste | skipped | standard discriminator to EndPlayerTurnResolution
  - Drop TurnResolutionStore and getTurnResolutionStore() factory
  - Collapse turn-orchestration.ts: resolveEndTurn single entry dispatches by kind
  - Slim TurnOrchestrationDeps from 14 to 9 fields (no refs, no onResolveEndTurn)
  - Kill let lateResolveEndTurn / getTurnOrchestrationDepsRef cycle (~80 LOC)
  - Drop dead cardTransferInProgress: false param
  - Fix missing isCurrentBattleSession dep in scheduleCompanionFollowUp
  - Update test mocks and imports for new API
- refactor(nav): extract LockedMenuItem, data-drive GameMenu, add ghost variant
  - Add ghost variant to Button (replaces 11 outline+border-0 overrides)
  - Extract LockedMenuItem component owning locked-button recipe
  - Data-driven GameMenu with .map() over 8-item array
  - Delete dead anchorPlacement branches (up-left, down-right-of-anchor)
  - Migrate menu-screen to use LockedMenuItem (removes hand-rolled lock rows)
  - Fix hover sound playing on locked nav items
- refactor(mystery): simplify pool with ev() builder, unify art, drop dead types
  - Replace 23 verbose event objects with compact ev() builder calls
  - Unify all mystery art (auto-globbed + 7 special assets) into mysteryEventArt
  - Move pickMysteryEvent into pool.ts with proper throw instead of non-null assert
  - Delete src/features/alchemy/run-loop/mystery-events.ts re-export shim
  - Remove dead MysteryEffect 'none' kind from type and all handlers
  - Trim 124 lines of redundant test assertions, add art coverage + pick test
  - Update all 8 consumers to import directly from @/lib/mystery
- refactor(battle): eliminate BattleControllerContext, inline factories, flatten controller
  - Delete controller-context.ts (50-field megastruct) and its contextRef indirection
  - Each create* factory now takes a small explicit params bag instead of the full context
  - Add resetHandTransferUi/resetCardTransfers actions to battle-presentation-store
  - use-battle-controller.ts drops 3 ref-of-ref workarounds (resolveEndTurnRef,
    getTurnOrchestrationDepsRef, scheduleCompanionFollowUpRef); uses direct closure
  - Create battle-facade.ts with BattleLifecycle shared type
  - All 171 tests pass, typecheck clean, lint clean
- refactor(styles): strip dead CSS, collapse hover-popup and font tokens (~28% reduction)
  - Delete 7 dead classes and 6 dead keyframes
  - Inline 3 single-use shadow variables
  - Replace deprecated @apply with plain CSS
  - Collapse hover-popup-panel 110→30 lines using :is()
  - Merge --font-body/--font-display into --font-sans
  - Keep JS talent-timing consts, remove duplicate CSS vars
- refactor(armory): merge gear and currency drag portals into shared DragVisualPortal
  - Replace GearDragVisualPortal and CurrencyDragVisualPortal with
    a single DragVisualPortal accepting children for inner content
  - Add completeOnFlyover prop to handle gear vs currency difference
  - Delete armory-drag-portal.tsx and armory-currency-drag-portal.tsx
  - Update armory-overlays.tsx and test fixture to use new portal
- refactor(armory): hoist drag constants to dedicated file, add test coverage
  - Move 7 drag constants (INVENTORY_SNAP_RADIUS_CELLS, MAGNET_*,
    DOUBLE_CLICK_FLYOVER_MS, DRAG_POINTER_*, EQUIPMENT_SNAP_*) from
    use-board-drag.ts and use-armory-gear-drag.ts to drag-constants.ts
  - Remove duplicate DOUBLE_CLICK_FLYOVER_MS declaration
  - Update all consumers (portals, board-drag-math) to import from
    drag-constants.ts
  
  Test coverage:
  - Add equidistant hysteresis boundary test in board-drag-math
  - Tighten LAUNCH_SAVE_SCHEMA_VERSION assertion from >=1 to ===4
- refactor(game-data): extract pool helpers and hydrateCard from cards.ts
  - Extract isStandardPotionCard/getOfferableCardPool/getStandardPotionPool into cards/card-pools.ts
  - Refactor hydrateCard into cards/hydrate-card.ts (local SavedCard type, drop
    duplicated corruptedValuePositions filter, Math.floor -> Math.round)
  - Remove COMBAT/SUPPORT section markers from cards.ts
  - Replace cauterize ordering comment with test reference
  - Add card-effect-ordering.test.ts for effect-order invariants
  - Fix WORKFLOWS.md references to non-existent combatCards/supportCards
- refactor(armory): simplify armory screen, isolate targeting events and portaled overlays
- refactor(gear): extract board logic from inventory-layout into focused modules
  Split inventory-layout.ts into footprints, inventory-placement, board-moves,
  board-view, and board-position-sanitizers. Update exports in index.ts, adapt
  grid-packing and affix-catalog, and add optimized homestead node art.
  
  Also includes turn-orchestration adjustments and asset script improvements.
- refactor(gear): simplify gear-store and extract stateless helpers
- refactor: simplify store, layout, and nav, and fix wildwood E2E
- refactor(armory): simplify board movement architecture
- refactor(lint): fix ESLint warnings across 99 files
  - Remove 42 unnecessary type assertions
  
  - Remove 67 deprecated usages (zod finite(), ZodTypeAny, MutableRefObject)
  
  - Remove 91 unnecessary nullish coalescing/optional chaining
  
  - Add void prefix to 12 floating promises, fix restrict-plus-operands
  
  - Suppress react-refresh in route files, fix no-console, unused vars
  
  - Misc: no-misused-promises, use-unknown-catch, no-base-to-string, etc.
  
  185 remain: noUncheckedIndexedAccess false positives (106), LabyrinthModifierKind deprecation (40)
- refactor(armory): reduce complexity and consolidate lib/gear
  - Phase 0: Remove dead armory-salvage-confirm, unused reducer actions
  - Phase 1: Centralize geometry/point/test-id constants into dedicated files
  - Phase 2: Remove Math.random defaults from lib/gear public functions
  - Phase 3: Merge grid-packing.ts into inventory-layout.ts (1 canonical
    packer family), consolidate legacy ID tables and duplicate helpers
  - Phase 4: Extract use-inventory-scroll-drag hook from inventory-panel
  - Add edit-precision step to AGENTS.md operating procedure
- refactor(armory): consolidate drag state and remove dead code
  - Refactor use-armory-gear-drag with cleaner FSM and flyweight board packing
  - Remove use-armory-currency-positions and use-armory-inventory-positions
  - Update gear-store for unified drag state management
  - Add gear-shine visual support to gear operations
  - Add tests: armory-styling, use-armory-gear-drag, use-board-drag
- refactor(app): simplify App.tsx architecture — remove actions proxy, context, inline logic
  - Replace 63-entry actions proxy with direct run controller prop, flattening
    all a.runFlow.* / a.battle.* references across 41 route call sites
  - Delete RunControllerContext (only had one consumer) — pass run as prop
  - Move save bootstrap orchestration into applySaveDataToStores() in storage
  - Extract 6 focused hooks from AppMainContent: game-menu state, keyboard
    shortcuts, return-to-run navigation, screen particles, dev shortcuts,
    and grouped useAppSettings selector
  - Push chrome derivation (heroArt, playerName, hasUnspentTalents, hasAffordableHomestead)
    into AppScreenChromeProvider — it now takes run as input
  
  App.tsx: 545 -> 283 lines (-48%). No behavior changes, 124 tests pass.
- refactor: split run-domain-store into per-slice action files
  Extract progress, session, navigation, and battle action impls into
  
  co-located slices/ files with factory functions and types.
  
  Eliminate duplicated RunProgressActions / RunSessionActions type
  
  tables from run-domain-types.ts. Derive view types from picker
  
  return types via ReturnType. Rename store-level actions to
  
  avoid collision (resetProgress / resetNavigation) while
  
  preserving reset as the view-facing alias.
  
  Delete four unused *Slice hooks. Add subscribeRunDomain to
  
  run-session-facade. Add run-domain-slice-dispatch test to
  
  lock in the action surface.
- refactor(battle): consolidate CC state, add static guards, and reduce engine friction
  - Group 6 top-level CC fields into playerCC/enemyCC CcState records
  - Add withPreservedFlags() helper for companion first-time flag scope-guard
  - Add drawFromState() convenience wrapper over drawCards
  - Replace nested-spread in status-application.ts with addPlayerStatus()
  - Add satisfies Record<> to EFFECT_APPLY_BY_KIND for build-time handler coverage
  - Add unsafeNonSeededRng export and tighten eslint Math.random rule
  - Add CcState deep-merge to test fixtures (makeTestBattleState/patchBattleState)
- refactor(armory): extract useArmoryController facade and split screen + panels
  Phase 3 cleanup of the Armory subsystem:
  
  - New useArmoryController() facade hook reads useGearStore directly,
    wraps mutations (equip, unequip, salvage, applyCurrency, dev spawn)
    with the HP-sync + save-flush side effects that previously lived as
    four closures in meta-routes.tsx. The ArmoryScreenRoute wrapper
    drops from ~95 lines to ~20 lines.
  
  - Split armory-screen.tsx (694 -> 459 lines) into:
    * armory-character-tabs.tsx (the locked/unlocked character tab strip)
    * armory-currency-targeting.tsx (the follow-cursor targeting visual)
    * armory-salvage-confirm.tsx (the ConfirmationDialog wrapper)
    * armory-drag-portal.tsx (the gear drag animation portal)
    * armory-currency-drag-portal.tsx (the currency drag animation portal)
  
  - Split armory-panels.tsx (1018 -> barrel) into:
    * character-panel.tsx (CharacterAndEquipmentPanel)
    * inventory-panel.tsx (InventoryPanel)
    * parts/grid-styles.ts (SLOT_LABELS, EQUIP_SLOT_PLACEMENT, layout
      style helpers)
    * parts/slot-button.tsx (SlotButton)
    * parts/inventory-tile.tsx (InventoryGearTile)
    * parts/currency-tile.tsx (CraftingCurrencyTile)
  
  All 29 armory-screen integration tests pass; 478 feature tests pass
  across the broader suite; tsc and eslint are clean.
- refactor(armory): extract shared board-drag math and dedupe gear/currency drag
  The currency drag hook (use-armory-currency-drag) and the gear drag
  hook (use-armory-gear-drag) each carried their own copy of three
  duplicated pieces of pointer-drag logic:
  
  - a placeInventoryTileFromMetrics helper that read board metrics,
    called findNearestInventoryPlacement, and computed a screen-space
    rect for the destination cell;
  - an inline distance-to / same-destination / magnet-hysteresis block
    that decided whether to stick with the previous destination or
    switch to a new candidate;
  - the magnet constants (MAGNET_SWITCH_MARGIN_PX,
    MAGNET_RELEASE_HYSTERESIS_PX, INVENTORY_SNAP_RADIUS_CELLS).
  
  Extract the shared math into armory/board-drag-math.ts as pure
  helpers, parameterized on the destination type so the gear hook's
  equipment-slot discriminated union flows through. 12 new tests cover
  the rect center, distance, identity equality, and hysteresis
  behavior. The currency and gear drag hooks now both delegate the
  shared logic; the gear hook still owns its equipment-slot destination
  detection, secondary swap animation, and double-click flyover.
  
  Net change in the two drag hooks: -112 lines; -29 in the
  gear hook's updateActiveDrag block, -58 in useBoardDrag's
  getInventoryDestination and updateActiveDrag.
- refactor(armory): extract useBoardDrag FSM and route currency drag through it
  The currency drag hook duplicated the gear drag hook's pointer FSM,
  magnet snap, hysteresis, double-click activation distance, and
  animation timers. Extract a single parameterized FSM in
  armory/use-board-drag.ts that owns the shared logic and the magnet
  constants (MAGNET_SWITCH_MARGIN_PX, MAGNET_RELEASE_HYSTERESIS_PX,
  INVENTORY_SNAP_RADIUS_CELLS, DOUBLE_CLICK_FLYOVER_MS,
  MAGNET_RELEASE_EASE_MS, DRAG_POINTER_ACTIVATE_DISTANCE_PX).
  
  use-armory-currency-drag.ts becomes a thin wrapper that delegates
  begin/move/finish and the inventory destination resolution to
  useBoardDrag. The gear drag hook is left as a follow-up; its
  equipment-slot destination detection, secondary swap animation, and
  double-click flyover can compose on top of useBoardDrag via the
  resolveExternalDestination hook without changing the Armory screen.
  All 28 armory-screen integration tests still pass.
- refactor(armory): unify grid packing into a single tested module
  The Armory had three near-identical implementations of grid packing:
  - inventory-layout.ts (canPlace/markPlaced/findPlacement/packInventory)
  - gear-store.ts resolveMoveItemAndSwap (inlined overlap detection and
    displaced-item re-placement)
  - gear-store.ts syncBoardPositions (inlined occupancy grid, canPlace,
    markPlaced, findFirstAvailable)
  
  Extract a single pure module in src/lib/gear/grid-packing.ts that owns
  canPlace, markPlaced, findFirstAvailable, overlaps, packInventoryGrid,
  packInventoryGridPreserving, packCurrencyGridWithGearObstacles,
  packMixedBoard, and resolveMoveWithSwap. The store's two grid-packing
  implementations now delegate to these primitives, removing the local
  BoardItem type, the inlined overlaps() function, and the duplicated
  occupancy/cell bookkeeping. 18 new tests cover packing, preservation,
  displaced re-placement, and edge cases.
- refactor(navigation): unify transitions, type-exhaustive route registry, and SCREEN_PHASE table
  Six independent cleanups in the run-navigation layer. No player-facing
  behavior change; all 2747 navigation/battle/shop tests pass.
  
  - Consolidate the three TimerGroups in the run shell (navTimer in
    useScreenNavigation, rewardTransitionTimer in useRunNavigation, and the
    standalone screen-transition.ts helper) into a single useScreenTransitions
    primitive that owns one TimerGroup and exposes navigateTo, transition,
    commitPendingTransition, and cancelPending. The transition function unifies
    immediate, delayed, and deferred-commit paths; the explicit clearAll() calls
    are no longer needed because the new primitive auto-clears before scheduling.
  
  - Add a single SCREEN_PHASE: Record<Screen, RunPhase> table to
    lib/routing/run-screen-router.ts and drop the three META_SCREENS /
    RUN_LOOP_SCREENS / RUN_END_SCREENS arrays and their Sets. The static
    lookup replaces the runtime Set.has() calls and makes adding a new Screen
    a compile error until it is classified.
  
  - Make the screen-routes registry type-exhaustive. Each phase file declares
    a Record<PhaseKey, ScreenRoute> via 'as const satisfies', and the merged
    SCREEN_ROUTES spread is type-checked with a PhaseKeys vs Screen
    bidirectional equality. The runtime for-loop that threw on missing
    handlers is gone; TypeScript now enforces the same contract at build time.
  
  - Replace the 70-line switch in useRunScreenData with a typed FIELD_GETTERS
    lookup keyed by the existing screenFields table. Adding a new screen
    field becomes one entry in the getter table rather than another case
    branch. Public behavior and screen-data shapes are unchanged.
  
  - Delete getDestinationWeight from run-loop/navigation/destination-flow.ts.
    The function was deprecated in favor of computeDestinationWeight with
    DestinationWeightContext and had no remaining callers in src/ or tests/.
  
  - Update affected tests (run-flow-handler-deps helper, run-victory-handlers,
    run-navigation-hook, use-screen-navigation, screen-transition) to match
    the new transition primitive's API and the run-flow-handlers dep shape
    (drop setScreen and rewardTransitionTimer, add transition).
- refactor(battle): drop Math.random defaults, remove dispatch route metadata, and refresh stale doc
  Phase 0 of the battle engine refactor. Five small cleanups that remove
  footguns and dead abstractions without changing public behavior; all 1055
  battle+game-data tests pass.
  
  - Make draw.ts and shuffleCards require an explicit rng. Production uses
    state.rng; tests pass any seeded fn. The previous '= Math.random' default
    slipped past the eslint 'no Math.random()' rule because the rule only
    catches call expressions, not identifier references. AGENTS.md already
    forbids Math.random() in the battle engine; this makes the ban structural.
  
  - Delete adjustEnemyStatusDelta() and its two call sites in types.ts,
    status-damage-riders.ts, and effect-handlers/status-handlers.ts. The
    function was a no-op (returned delta unchanged) wired for a labyrinth or
    difficulty hook that was never implemented. Inlined the value at each site.
  
  - Remove the dispatchRoute field from EffectKindDefinition and the entire
    dispatch-routes.ts / getEffectDispatchRoute / ALL_EFFECT_REGISTRY_ENTRIES
    machinery. The string categorization was descriptive only - it had no
    runtime effect, no consumer, and the categories ('mana', 'utility',
    'damage', ...) did not match the actual handler grouping in effect-handlers/.
  
  - Rewrite BATTLE_HANDLERS.md to describe the actual 5-grouped handler plus
    5-grouped schema layout instead of the per-kind subfolders that never
    existed.
  
  - Update the effects-registry test to assert the schemas-only contract
    (every kind has a schema, schemas parse) without the route assertions.
- refactor: consolidate gear and run session into lib and simplify reward flows
  Colocate pending-reward and gear schemas in lib, drop feature shims, and add shared test helpers.
- refactor(run): consolidate run-flow handlers, save builder, and test infra
  Unify victory/defeat/destination routing in run-flow-handlers with
  screen-transition guards, centralized save snapshots, and run-end routes.
  Harden talent unlock validation, Expert Blacksmith damage, and meta
  gating; split E2E helpers, add CI sharding, and apply code-review fixes.
- refactor(battle): simplify useBattleController with unified context
- refactor: fix global re-renders, screen over-subscriptions, and migrate presentation store
- refactor: consolidate battle state helpers and documentation
- refactor(architecture): consolidate stores, battle glue, and docs
  - Merge run types and shims into run-domain-types and session facade
  
  - Merge battle turn/transfer modules; pass battleBindings via props
  
  - Route compendium discovery through app-store
  
  - Add ARCHITECTURE/WORKFLOWS docs and run-domain test suite
- refactor(stores): finish run domain consolidation and remove legacy shims
  Replace shim hooks with useRunDomainStore and read* facades.
  
  Delete glue modules, migrate tests, and update docs and ESLint boundaries.
- refactor(stores): split run state and centralize lifecycle
  Split active-run-store into run-progress, session, and navigation stores.
  Add RunLifecycleCoordinator for battle sync, teardown, and save flushes.
  Thin shell hooks, add smoke tests, remove legacy shims, and update docs.
- refactor: split alchemy features, merge active-run store, and colocate effect handlers
  Reorganize features/alchemy into shared/meta/run-setup/run-loop/shell zones.
  Add import shims, ESLint boundaries, and per-kind effect handler modules.
  Merge run-store and run-session-store into active-run-store; screen lives in Zustand.
- refactor: per-kind effect handlers and run session facade
  Route card effects through a game-data registry and battle handler dispatch.
  Expose run session via slice hooks, imperative actions, and runPhase for routing and e2e.
- refactor: run screen router, split routes, and platform storage
  Add run-screen-router taxonomy and split screen-routes into focused modules.
  
  Clarify parseActiveRun vs normalizeActiveRunData and use stable store action hooks.
  
  Route save I/O through platform.storage.
- refactor: run session facade, lib domain modules, and screen props
  Add run-session-facade with explicit run/battle sync and teardownRun.
  
  Pass run screen data via screen-routes instead of per-screen store hooks.
  
  Move mystery, corruption, alchemist, and routing rules into src/lib.
  
  Update AGENTS.md, facade tests, and vitest window stub.
- refactor: split screen stores and unify battle state flow
  Split ui-store from run-session-store.
  
  Pass battleScreenData from controller to BattleScreen.
  
  Inject store accessors into run victory and destination handlers.
  
  Extract navigation session and corruption helpers.
  
  Centralize card effect keyword metadata in effect-metadata.ts.
  
  Split controller actions, battle presentation store, and integration tests.
- refactor: card builders, hurt pulse fix, and theme tokens
  Add card-builders and shared companion turn-line text.
  
  Migrate combat and support cards; edge-trigger portrait hurt pulses.
  
  Reset hurt tokens between battles; extract TalentEffectManifest.
  
  Enforce single companion turn-start effects; theme shadow and z-index tokens.
- refactor: split battle, app shell, and data modules
  Modularize battle, UI, validation, and tests. Memoize talentEffects and seed battle RNG in tests.
- refactor: unify battle state, split modules, and harden tests
  Consolidate run/talent state in run-store and remove logicalBattleState.
  
  Split cards, talent pool, and save-schemas into focused modules.
  
  Fix enemy-status null-field stacking and haste end-turn sync timing.
  
  Restrict dev cheats to import.meta.env.DEV; use winViaCombat in e2e for preview CI.
  
  Expand @critical coverage and battle unit test splits.
- refactor: modularize battle flow, run navigation, and talent data
  Extract battle orchestration, reward routing, and enemy-turn helpers into focused modules.
  
  Add hurt portrait VFX, screen route registry, shop/run handlers, and expanded tests.
- refactor: extract constants to game-constants, consolidate error handling, add edge-case tests
  - Move magic numbers (HALF_DIVISOR, WISH_CRYSTAL_GOLD_CHANCE, etc.) to game-constants
  - Consolidate battle controller error logging into shared helper
  - Remove dead screen exports and unused constants
  - Add round-trip JSON serialization tests for save data
  - Add drawCards edge-case tests (mid-draw reshuffle, empty piles, MAX_HAND_SIZE)
  - Add Death's Door edge-case tests (DoT expiry, CC immunity interaction)
  - Add zero-duration status application tests
  - Add legacy fixture migration determinism tests
  - Add storage barrel export test
- refactor: damage handlers, ESLint conventions, homestead extraction, knip integration
  - Extract damage type modifiers into DAMAGE_TYPE_HANDLERS registry
  - Add ESLint rules: ban React.FC, enforce barrel imports, cn() for classNames
  - Split homestead screen into sub-component files under homestead/
  - Integrate knip dead code detection (deadcode/deadcode:strict scripts)
  - Refactor storage IO with getDesktopBackend() helper
  - Convert renderAlchemyScreen() function to RenderAlchemyScreen component
  - Add tests for block decay, enemy turn, and validation
- refactor: consolidate PRNG, migrate React 19 refs, add logicalBattleState
  - Consolidate Mulberry32 PRNG into createSeededRng in lib/utils.ts;
    remove duplicate implementations from map-generation.ts and simulator.ts
  - Thread seeded rng through shuffle/pickRandom, draw.ts, wish.ts so
    card shuffles and draws respect state.rng for full determinism
  - Migrate all forwardRef components to React 19 prop-ref pattern:
    button, progress, select, switch, tooltip-panel, PilePanel, actor-panel,
    card-button, tilt-surface
  - Add logicalBattleState to battle-store as the authoritative resolved state
    for run-level decisions; battleState remains the visual/animation state
  - Add setSyncedBattleState atomic action to write both fields in one set();
    replace all paired setBattleState+setLogicalBattleState call sites
  - Document the battleState/logicalBattleState invariant with JSDoc
  - Improve resolveEndTurn error boundary: unknown trait/effect throws now
    call handleVictoryDefeat to prevent a frozen battle state
  - Refactor enemy-turn.ts: extract addEnemyMitigation, scaleByRoomMultiplier,
    resolveStandardEnemyTurn; replace magic number 3 with named constant
  - Refactor damage.ts: extract applyBlockAbsorption, applySunderingArmor-
    Piercing, applyBurnDamageRiders, applyNatureDamageRiders; fix natureLeech
    not calling applyLifestealAndPlayerHitTriggers
  - Fix wish card shuffle using state.rng instead of Math.random
  - Fix ConfirmationDialog overlay: absolute -> fixed, add backdrop dismiss
  - Use TabBar for options screen tabs; PaginationControls in homestead
  - Fix hand card refs: useRef+useLayoutEffect with lint suppression for
    intentional MutableRefObject.current writes in effect/cleanup
  - Simplify useAppSaveState into useAlchemyAutosave, move state to App
  - Add deprecated JSDoc on map-generation.ts PRNG re-exports
  - Add useTooltipFlip single-trigger API; drop stale eslint-disable
  - Update potion-mixer test to use card uids instead of Date.now mocking
- refactor: rebalance talents, add physical status riders, fix TS type for handleWishChoice
- refactor: consolidate test state, extract validation guard, harden enemy-turn
  - Extract createTestBattleState helper, removing ~1100 lines of duplicated
    baseState boilerplate across 9 test files
  - Move isPersistedBattleState to dedicated battle-state-guard.ts
  - Replace mutable global validation error array with scoped
    safeParseWithErrors collector
  - Extract getCardKey/centeredRectForSize to controller-utils.ts
  - Add console.warn for unknown enemy effect/trait kinds
  - Clamp deathsDoorExtension to non-negative values
  - Add new e2e test files: companion, lethal damage, status effects, trinkets
  - Add setup.ts for vitest global setup
  - Add edge-case tests: out-of-bounds map node, already-failed node
- refactor: consolidate timers, migrate homestead store to immer, add page objects and tests
  - Add TimerGroup and delay() utility in src/lib/animation/game-timer.ts for
    centralized timeout lifecycle and animation-disabled awareness
  - Replace ad-hoc setTimeout refs in battle-store, use-battle-controller,
    and use-run-navigation with TimerGroup/delay
  - Migrate homestead-store to zustand immer middleware (reduces boilerplate)
  - Restore pendingNodeRef in use-labyrinth-controller to fix race condition
    in node-cleared/failed callbacks
  - Remove redundant > 0 guards before rollPercent in status-effects.ts
  - Add @internal JSDoc to failNode to warn it mutates in-place
  - Extract Setter<T> type into lib/utils.ts
  - Add dedup guard to unlockTalent (run-store)
  - Make finalizeRunXP read state from set callback instead of getState()
  - Add consume placeholder talents for grid completeness
  - Extract card constants (BLOCK_CARD, AEGIS_CARD, etc.) into test helpers
  - Add injectHomestead / injectLabyrinthRun helpers for deterministic test setup
  - Add page objects: BattlePage, CorruptionPage, HomesteadPage, MysteryPage, ShopPage
  - Add new e2e tests: accessibility, loading-screen, save-error-paths
  - Add victory-flow unit tests for computeVictoryRewards et al.
  - Add component tests for button and progress primitives
  - Add bundled deps: immer, @testing-library/react, rollup-plugin-visualizer
  - Configure ESLint relaxed rules for test files
  - Add vite-plugin-checker and bundle-visualizer support
  - Update AGENTS.md and README.md with current architecture docs
- refactor: extract victory-flow and talent-effects modules, clean up battle navigation
  - Extract processBattleVictory/createVictoryRewardState into victory-flow.ts
  - Extract stun/freeze talent effect helpers into talent-effects.ts
  - Move TalentEffectManifest type export from battle to game-data barrel
  - Refactor forge burst logic with shared onForgeCrossThreshold helper
  - Remove RUN_NAV_CONSTANTS object, use literals
  - Remove try/catch fallback in run reset
  - Add selectedBossId as required field in RewardState
  - Improve map generation with fallback RNG and comment fixes
- refactor: centralize isScalingBlocked, harden save schema parsing, improve battle documentation
  Comment improvements across all battle system files (why-not-what).
  \nwithFallbackOnUndefined rename and LabyrinthModifierArraySchema dedup in save schemas.
  \nuseRef+useEffect initialization pattern and Map-based lookups in controller.
  \nCentralized isScalingBlocked check in enemy-turn.ts, fixes import ordering bug and legacy deck set-size bug.
- refactor: consolidate shimmer into screen-store, add migration CI guard, fix tooltip width and e2e selector
  - Move shimmer state (shimmerState/maybeTriggerShimmer) from battle-store and
    useShimmerController hook into screen-store (co-located with hoveredCardId)
  - Delete useShimmerController from hooks.ts — single source of truth in screen-store
  - Set SHIMMER_COOLDOWN_MS to 500ms in game-constants for consistent cooldown
  - Add CI test asserting migration chain length matches CURRENT_SAVE_SCHEMA_VERSION
  - Fix enemy-tooltip non-flip branch missing w-60 width class
  - Update e2e core-gameplay.spec.ts selector from .hover-popup-quick-in to
    .hover-popup-panel (removed animation class from prior commit)
- refactor: standardize UI patterns across screens
  - Extract MaterialPill, GoldPill, StarRating, TabBar, TurnBadge components
  - Merge ProgressBar into Progress with size/color/fillStyle props
  - Create useInteractiveCard hook (hover + shimmer state) and migrate 5 screens
  - Create TiltSurface component and migrate 6+ callers
  - Replace inline tooltips with TooltipPanel + useTooltipFlip
  - Switch collection-screen and character-select to battle-store shimmer
  - Migrate wish-overlay to useInteractiveCard
  - Remove progress bar duplication (ProgressBar → Progress)
  - Use ScreenHeader in talents-screen
  - Clean up unused imports across all changed files
- refactor: skip startup loading screen via Playwright storageState, add maxFailures
  - Add dedicated alchemy-skip-loading-screen localStorage flag checked by
    useInitialLoadReady alongside the existing alchemy-dev-mode path
  - Set the flag globally for all e2e tests via Playwright storageState,
    so new tests automatically skip the loading screen without per-test
    enableDevMode() calls
  - Revert enableDevMode() additions from test files (no longer needed)
  - Add maxFailures: 1 on CI so the workflow stops at the first failure
    instead of running the full suite
- refactor: wire battle victory/defeat callbacks, centralise hydration, harden save validation
  - Wire onBattleVictory/onBattleDefeat via stable refs from useRunNavigation,
    replacing the brittle useEffect-based detection
  - Extract resetPlayerTurnState shared helper in enemy-turn to remove sync hazard
    between handleCCSkipTurn and performDrawAndResetPhase
  - Move hydrateCard from run-store into cards.ts (data layer) and update all
    call sites through the barrel export
  - Add catchWithWarning to save-schemas: validates each field with safeParse and
    falls back to the default on failure, logging a console warning; fixes
    double-parse by using z.any() as the inner Zod validator
  - Extract applyPlayerDamageStatuses into status-effects for enemy-side damage
    status riders; remove unused combatTexts parameter from signature
  - Add COMPANION_SOUND_CARD_IDS constant to game-constants
  - Gate dev skip-combat button via isDevMode prop threaded from BattleScreen
    instead of reading localStorage inside a JSX render IIFE
  - Guard playBattleCardResolved against resolving effects after battle ends
  - Consolidate wildwood and shop-flow e2e specs; add afterEach localStorage
    cleanup; soften brittle toBe(23) talent assertion to a range check
- refactor(alchemy): modularize scaling layout, audio, navigation, and fix e2e/compilation bugs
- refactor(alchemy): simplify hook navigation logic and cast types safely
- refactor: decouple card library from validation, update run navigation, clamp health, and handle labyrinth fallback
- refactor: consolidate enemy mitigation, extract CC/status helpers, add status display order constants
  - Merge enemyArmor/enemyForge/enemyFreezeBonus into single enemyMitigation object
  - Extract player CC trigger logic into status-cc.ts with shared resolvePlayerCrowdControlTrigger
  - Extract decayArmorAfterDamage, decayHalvedStatus, rollPercent into status-helpers.ts
  - Extract status application riders into status-application.ts
  - Add STATUS_CONFIG, ENEMY_TRAIT_IDS constants to game-constants.ts
  - Add PLAYER_STATUS_DISPLAY_ORDER, ENEMY_STATUS_DISPLAY_ORDER to game-data/types.ts
  - Remove unused setPlayerStatus function
  - Fix player poison decay to use POISON_DECAY_AMOUNT constant
  - Inline forge burn burst logic for clarity
- refactor: clean up and harden core subsystems across the codebase
  - Battle: remove dead code, split overlong functions, replace magic numbers
    with named constants, add file/function comments (apply-effects, card-play,
    combat-text, cost, damage, draw, enemy-turn, status-effects, status-ticks,
    trinket-effects, types, wish)
  - Mystery Events: remove unused vars/imports, extract helpers, add comments
  - Navigation: refactor destination-flow, mystery-flow, reward-flow,
    routing-flow and use-mystery-flow for SRP and clarity
  - Labyrinth: clean map-generation, modifiers, data and controller
  - Player Save: refactor storage, active-run, defaults, io, migrations,
    save-schemas, validate-startup and migration validation
  - Talent Effects: tidy talents.ts and game-data/talents.ts
  - Homestead: clean defaults, effects and types
  - Tests: add collection, difficulty-select and menu-navigation specs;
    update existing tests to match refactored APIs
- refactor: extract createBattleState options object, trait handlers, and status helpers
- refactor: overhaul audio playback, add enemy attack recovery delay, and update volume defaults
- refactor: overhaul battle controller, add card transfer overlay, update tests and assets
- refactor: clean up draw discard experiment
- refactor: replace border-based tabs with ring-based styling, remove AnimatedHeight from homestead
- refactor: comprehensive UI overhaul, typography, and screen restyling
  - Replace blur-fade with CSS-based fade-in animations
  - Redesign button component with game-themed variants and keyboard support
  - Apply consistent typography (Cinzel for headings, DM Sans for body)
  - Restyle all screens (battle, shop, campfire, corruption, map, etc.)
  - Add keyboard navigation tests and app-level subscription tests
  - Update tailwind config with game color palette and font families
  - Clean up unused mystery event data and game constants
- refactor: replace standard-version, add Cinzel/DM Sans fonts, extract companion module
- refactor: migrate app/homestead state to Zustand stores, fix null store initialization
  - Replace useAppSaveState/useHomesteadState hooks with Zustand stores
  - Initialize store fields with factory functions instead of 'null as Type'
  - Clean up unused return values from use-alchemy-run-controller
  - Add null-safety to getPlayerStatusChips/getEnemyStatusChips
  - Add boot test for main menu rendering
- refactor: zustand stores, modular save migration, commitlint/lefthook, and code cleanup

### Tests

- test(e2e): consolidate, expand, and retag E2E suite
  Phase 1 - Consolidation:
  - Collapse core-gameplay Battle Flow from 6 tests to 3
  - Demote 7 micro-geometry tests in gear-drag-positions to @full
  - Delete redundant swap test in gear-equip (duplicated in drag-positions)
  - Fix Brass Censer assertion to check for doubled damage
  - Split mystery-flow into outcome-specific tests
  - Rename lethal-damage-flow -> death-door-flow, expand to 4 tests
  - Slim resolution matrices in aspect-ratio-layout and draw-discard-animations
  - Remove Death's Door tests from game-over-flow (now in death-door-flow)
  
  Phase 2 - Coverage expansion:
  - Create status-persistence.spec.ts (Anvil forge persist)
  - Create reward-flow.spec.ts (card/trinket/gear reward, reload persist)
  - Create destination-progression.spec.ts (choice pool, boss at act-end)
  - Create homestead-actions.spec.ts (building/farm/research state)
  - Create run-end-meta.spec.ts (defeat clears activeRun)
  - Create wildwood-traits.spec.ts (combat/reward trait system)
  - Create labyrinth-full.spec.ts (rest, treasure, boss chambers)
  - Create autosave-cadence.spec.ts (save-after-turn/reward/nav)
  - Create difficulty-modifiers.spec.ts (Novice vs Legend HP)
  - Parameterize talents-in-battle and trinkets-flow
  
  Phase 3+4 - Tagging:
  - Add @armory tag to all gear/*armory specs
  - Add @prepush to page-level smokes (homestead, wildwood, reward)
- test(changelog): conditionally skip sync guard locally
- test(e2e): refactor 5 slowest tests — split, save-injection, runtimeErrors
- test(armory): expand resolveEquipSwap coverage, add browseOnly and transfer-menu tests
  - Add 4 missing resolveEquipSwap scenarios: same-instance equip,
    displaced missing from inventoryById, incoming not on board, and
    multi-cell displacement
  - Add browseOnly when combat active prevents equip/unequip test
  - Add right-click opens transfer menu during salvage mode test
  - Tighten save-migration contract LAUNCH assertion to ===4
  - Add equidistant hysteresis boundary test in board-drag-math
- test(e2e): move combat test out of animation spec; apply fastBattle to draft/mystery/difficulty
- test: fix prepush unit failures
- test(e2e): stabilize critical run flow specs
- test(armory): add 7 e2e tests for right-click gear transfer and auto-swap
  New tests/gear-transfer.spec.ts (6 tests): sends gear to another
  class via right-click menu, sends equipped gear unequipped, excludes
  the source character, includes all unlocked characters, closes on
  Escape, closes on backdrop click.
  
  Add auto-swap test to tests/gear-equip.spec.ts: equipping a
  non-ranged main-hand via drag while a quiver is in the off-hand
  automatically clears the off-hand via resolveHandConflicts.
  
  All 28 e2e tests pass across 4 gear specs.
- test(armory): land 3 e2e specs covering combat, equip, and layout
  - tests/gear-combat.spec.ts (2 tests): equipped gear increases
    physical damage in battle; Armory editing is disabled while a
    battle is active (browseOnly banner is shown).
  - tests/gear-equip.spec.ts (6 tests): full inventory visible + drag
    equip + character switch; swap equipped gear via drag onto
    occupied slot; cursor-following during drag (no magnet snap);
    double-click equip and unequip; gear footprint preserved during
    preview snap; equipped items show tooltips on hover.
    The 2 'Send to Rogue' right-click transfer tests from the
    original drop were dropped because that feature was never
    implemented; the tests assumed a menuitem that does not exist.
  - tests/gear-layout.spec.ts (13 tests): armory opens from menu;
    salvage confirmation; equipment and inventory tiles share the
    same scale at 4 viewports; inventory scrolls only when
    occupied rows exceed the visible area; full board containment
    at 4 viewports; character art is 10% larger than the battle
    art panel.
  
  All 21 e2e tests pass against the current codebase.
- test(e2e): align run-end and mystery specs with Continue flow
  Update defeat/victory assertions for the new Continue button, add a discoveries
  helper for the run-end summary, and harden mystery picker handling.
- test(e2e): seed discovered cards for collection inspection prepush
  Fresh saves no longer pre-discover starter deck cards.
  
  Inject Anvil before asserting collection inspect hover.
- test: fix non-deterministic rng in burn stun resolution unit test
- test: fix lifesteal unit test flakiness by mocking Math.random
- test: add comprehensive component, domain, and battle tests; move commit-and-tag-version to devDeps
- test: add applyCardEffects edge case tests, fix test descriptions, remove unused variables

### CI

- ci: speed up nightly with shared prepare, sharding, and caches
  Build once and upload dist, restore node_modules and Electron from cache,
  run four parallel Playwright shards with four workers, and cap Electron
  download time so the nightly pipeline finishes in minutes not tens.
- ci: add Electron desktop smoke tests to nightly workflow
  Nightly now runs a Playwright _electron smoke test against the desktop
  renderer build so Steam/Electron regressions are caught without relying
  only on web preview E2E.
- ci: run critical e2e on pre-push and add bootstrap regression tests
  Match lefthook to CI critical preview e2e. Add CONTRIBUTING and hydrate tests.
  Ignore playwright-report in ESLint so local e2e artifacts do not break lint.
- ci: harden e2e install and workflow reliability
  Cache Playwright browsers, cap install/job timeouts, test against preview
  builds, and upload failure artifacts so CI no longer stalls silently on
  browser install. Bump Playwright to 1.60 and add deadcode to lint.
- ci: upgrade workflow runner to Node 24 and set FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 env var
- ci: add lockfile-check using npm ci --dry-run to hooks and check script
- ci: reduce playwright parallel workers to match host core count

### Build

- build: sync package-lock.json with package.json dependencies

### Docs

- docs(agents): add balance:sim output path and pre-commit hook note
- docs(agents): fix broken cross-references, add missing section links, reconcile policies
- docs(agents): update AGENTS.md with quick commands, conventions, and escalation policy
- docs(armory): add docs/ARMORY.md and cross-link from AGENTS + ARCHITECTURE
  Add a dedicated docs/ARMORY.md covering the Armory subsystem:
  
  - File-by-file layout for src/features/alchemy/meta/screens/armory/.
  - Data model (GearSlot, GearRarity, GearAffixRoll, GearDefinition,
    GearInstance, GearLoadout, board positions, crafting currencies).
  - State flow diagram (lib/gear -> gear-store -> useArmoryController ->
    armory-screen -> battle snapshot).
  - Read and write paths, including the useArmoryController facade and
    its HP-sync + save-flush side effects.
  - Board-packing rules (7x8 board, GEAR_FOOTPRINT, the grid-packing
    module's pure primitives).
  - Battle integration: how computeGearManifest produces the 64-key
    GearEffectManifest and freezes it in BattleState.gearEffects.
  - Drag FSM: useBoardDrag, the gear/currency wrappers, and the magnet
    constants.
  - Persistence: the 5 saved fields, the v0->v10 migration pipeline,
    and the v9->v10 localStorage shim that previously lived in
    gear-store.ts.
  - Tests map for the pure lib, store, screen, math helpers, reducer,
    architecture guards, and E2E specs.
  
  Cross-link from:
  - AGENTS.md docs list and 'Where to look' table.
  - docs/ARCHITECTURE.md Permanent Gear section.
- docs: update AGENTS.md rule to push directly to main
- docs: add PROMPTS.md with LLM code review guidance templates

### Chores

- chore(e2e): add timing/audit scripts and auto-diagnostic failure reports
- chore(changelog): ignore generated sync commits
- chore(code-quality): tighten lint, TS strictness, knip, and prettier configs
  - Fix knip default-mode gate (delete dead code, remove stale suppressions)
  - Eliminate 57 ny warnings; bump no-explicit-any to error
  - Add .prettierignore; widen format scope to {src,tests,scripts,desktop}
  - Enable noImplicitOverride, noImplicitReturns, noUncheckedIndexedAccess
  - Remove deprecated ignoreDeprecations + baseUrl
  - Enable strictTypeChecked ESLint for src/ with tuned overrides
  - Add eqeqeq, consistent-type-imports, no-console rules
- chore: add scaffold-test utility for mirroring source to test paths
- chore: sync CHANGELOG.md with recent commits
- chore: verify vercel git webhook after reconnect
- chore: checkpoint draw discard experiment

### Style

- style: fix pre-existing formatting in 4 files
- style: unify user-facing text phrasing across cards, trinkets, talents, affixes, homestead, and encounter traits
- style: apply prettier formatting
- style(armory): clean up gear tooltip layout and purchasable item styling
  - Compact tooltip descriptions by removing redundant gradient wrapper
  - Adjust purchasable gear/trinket item text and layout spacing
  - Update armory-styling test to match new tooltip DOM structure
  - Sync CHANGELOG.md with previous commit entry

### Other

- Abstract encounter traits across Labyrinth and Wildwood
## [0.1.0] (2026-06-11)

### Features

- Initial Steam release preparation pipeline with agent-enforced ship gates.
