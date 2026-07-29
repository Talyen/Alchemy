# Changelog

All notable changes to Alchemy are documented here. Player-facing summaries ship in `release-notes/`.

## [Unreleased]

### Features

- feat(battle): surface enemy armor/forge/burnBonus/freezeBonus as status chips with combat text
  Move burnBonus/freezeBonus from EnemyMitigation into EnemyStatusId so they
  render alongside existing enemy status chips (burn, poison, bleed, freeze, stun).
  
  - Extend EnemyStatusId with burnBonus/freezeBonus; add EnemyStatusDamageId
    for card-effect contexts that exclude augment ids
  - EnemyMitigation shrinks to { armor, forge, block }
  - New augment-definitions.ts for non-keyword status effect icons/tooltips
  - StatusIcon checks augment map first, then falls back to keyword map
  - getEnemyStatusChips reads both enemyMitigation (block/armor/forge)
    and enemyStatuses for the full chip row
  - Iron Bear's +1 Burn Dmg notice replaced with a proper status event
    (+1 with Burn icon and color)
  - Rusting Carapace (Forge Golem) and Glacial Shell (Frostwarden) now
    emit combat text (were previously silent)
  - Starting enemy armor/block emits floating +N text at battle start
  - update tests and test fixtures for the field relocation
- feat(audio): 2x boss music volume boost and Iron Bear 6s intro skip
- feat(characters): keyword-colored tooltip descriptions for all classes
- feat(armory): gear borders, astral shine, drag aliasing fix, cursor show, tab ring removal
- feat(armory): increase inventory grid to 8 columns and tighten left panel
  - INVENTORY_COLS: 7 -> 8 (source of truth in gear/constants.ts)
  - Replace hardcoded 7 in CSS with --armory-inventory-cols custom property
  - Round --armory-cell-size to nearest 1px to eliminate fractional sub-pixel drift
  - Drop aspect-[6/7] from equipment board (redundant with explicit width/height calc)
  - Reduce left panel padding (p-5 -> p-3), gap (gap-6 -> gap-4), character art padding (px-4 -> px-2)
  - Shift workspace grid ratio from 3fr:2fr to 2.4fr:2fr for more inventory space
  - Update tests and docs to match 8-column layout
- feat(homestead): add 5 farm plot definitions with effects and card bonuses
  - restore wheat-field, chicken-coop, pasture, orchard, crystal-garden as real farms
  - wheat-field: Bread heal bonus (+2/4/6) + end-of-run Food yield
  - chicken-coop: Max health bonus (+5/10/15) + end-of-run Food yield
  - pasture: Freeze DR (-1/2/3) + end-of-run Food yield
  - orchard: Apple heal bonus (+2/4/6) + end-of-run Food yield
  - crystal-garden: 3-tier: Crystal yield / +startMana / +1 Mana Crystal
  - herb-garden: replaced herbFind with Poison+Nature DR
  - add runMaxHealthBonus, runMaxManaBonus, cardHealBonus, poisonDamageReduction to manifests
  - wire bread/apple bonuses through applyHealEffect
  - wire max health bonus through run-start snapshot
  - add poison DR to applyPlayerCombatDamage
  - fix slot-button.tsx react-compiler false positive by removing dead containerRef
  - type safety audit: remove non-null assertions in enemy.ts, fix as unknown as casts,
    add line-scoped reasons to 9 react-refresh disables, replace as Extract with switches
- feat(assets): update Gambler's Shot art and add music element cache for battle track resume
  - Replace Gambler's Shot raw JPEG with compressed version
  - Rebuild optimized gamblers-shot.webp via asset pipeline
  - Add music element cache so re-entering a battle resumes the track
    from its saved position instead of starting over
  - Add invalidateCacheForKey to force a fresh track on new battle
  - Add talent-positions.ts with elliptical layout helpers
- feat(talents): add per-node lucide icons to talent tree
- feat(audio): add per-boss battle music tracks
  Wire up four new boss-specific MP3s (Forge Golem, Frostwarden, Blight
  Treant, Iron Bear) so each boss fight plays its own theme. Normal and
  elite encounters continue using the generic Battle playlist.
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
- feat: Zustand integration, save validation overhaul, asset cleanup, and CI setup
- feat: game mode select screen, labyrinth overhaul (entrance node, larger map, encounter/reward modifiers), new enemy traits (iron-hide, forge-regeneration, thick-hide), combat text stun/freeze notices, and test helper refactor
- feat: add Labyrinth and Wildwood content systems, new enemy Iron Bear, battle modifiers, and menu rework
  - Add Labyrinth content system with map generation, node navigation, modifiers (sturdy, null-field, burning-ground, leeching)
  - Add Wildwood boss-select screen with Iron Bear boss enemy
  - Add content-systems library with shared types and labyrinth/wildwood modules
  - Add new enemy traits: iron-hide, forge-regeneration, thick-hide
  - Refactor menu: replace Play with Campaign/Labyrinth/Wildwood buttons with Resume support
  - Add labyrinth-null-field modifier that halves enemy status applications
  - Add e2e and unit tests for all new systems
- feat: homestead tier system, companion assets, card descriptions, and battle/homestead refinements
- feat: add art assets for potions, nature cards, and trinkets
- feat: aspect ratio system, nature cards, companion buffs, Wildkeeper deck, and Homestead optimization
  - Replace resolution options with aspect ratio selector (standard/narrow/ultrawide)
  - Block tooltips during screen transitions to prevent jarring popups
  - Add Nature damage type with new cards (Bloodthorn, Cinderbloom, Grasping Vines, Briar Shield, Thorn Mail, Pack Tactics)
  - Add companion damage buff mechanic and buff-companion card effect
  - Add potion cards (Stoneskin, Acid, Luck, Wishing)
  - Update Wildkeeper starting deck with new nature/companion cards
  - Optimize Homestead screen with pre-computed items and pre-rendered tabs
  - Rebalance cards: Slash 6 dmg, Stab Bleed 3 dmg, Poison Dagger pure poison, Blessed Aegis equalToBlock, equalToArmor support
- feat: add Living Armor enemy asset, update Wishing Well Coin trinket, improve battle status effects and UI
- feat: add self-damage effect, new cards (Shield Bash, Burning Blade, Cauterize, etc.), fix enemy status attacks; refactor: remove CardTemplate type
- feat: add homestead buildings, new enemy assets, and update compendium/metadata
  - Add 5 homestead buildings (Alchemy Lab, Crystal Garden, Hunter's Lodge, Orchard, Wheat Field) with optimized webp assets
  - Add 3 new enemies (Blight Treant, Forge Golem, Frostwarden) with optimized webp assets
  - Update compendium and asset registry for new content
  - Polish homestead screen, collection UI, and corruption screen
- feat: add difficulty select screen with talent scaling, improve draw logic, expand test coverage
- feat: add corruption mechanic, background particles, card selection grid; polish battle system and UI across screens
  New features:
  - Corruption system with dedicated screen and state management
  - Background particles (react component + lib animation module)
  - Card selection grid component and tests
  
  Refinements:
  - Battle system updates: effects, turns, draw logic, types
  - UI polish across act-complete, alchemist-shop, battle, campfire, character-select, merchant, mystery, rewards screens
  - Shared UI components updated (card-ui, actor-panel, animated-height, button, blur-fade)
  - Updated navigation/destination-flow and run controller/battle controller
  
  Tests:
  - New tests for corruption, card-selection-grid, shared-ui
  - Updated existing e2e and unit tests
  
  Config:
  - Updated game constants, compendium, game data types
- feat: Death's Door mechanic, Armor/Forge consume on interaction, homestead overhaul, and system refactors
  - Add Death's Door: one-time grace window at 0 HP, must heal before next enemy turn
  - Armor now degrades by 1 per tick of player damage (burn/poison/bleed/stun/freeze) and enemy attacks
  - Forge degrades by 1 per Physical/Stun damage dealt
  - Homestead rework: new buildings with combat effects, farms with potion mana bonus, removed old buildings
  - Apply player healing centralized into applyPlayerHealing function
  - Add horror-sting sound for Death's Door activation
  - Update keyword descriptions for Armor and Forge
  - Add potionManaBonus to talent effect manifest
  - Farm yields reset to 0 (replaced by benefit descriptions)
- feat: boss title shine animation, player name in battle, trait line splitting, and test coverage expansion
  - Add boss title shine animation on destination screen with keyword-colored gradient
  - Pass player name to BattleScreen based on selected character
  - Split multi-effect enemy trait descriptions across lines in tooltips
  - Remove conditional formatting in formatEnemyAttackLines, one line per effect
  - Add injectSaveState test helper for precise save state setup
  - Add natural death test, shop card removal/refresh tests, boss/run tests
  - Fix talent XP text assertion in core gameplay test
- feat: redesign bosses with unique traits and mechanics; split stat multiplier into HP/attack
- feat: enemy tooltip, compendium data restructure, and card text cleanup
- feat: startup loading screen, talent tree layout, and build optimizations
- feat: persistent run save/restore with full state; replace CSS combat text animations with framer-motion
- feat: combat text animation variants with aurora color cycling; refactor boss act flow into destination choices; restore-mana overflow fix; consolidate tests
- feat: alchemist shop, trinket art assets, mystery effect badges, mana overflow fix, and UI refinements
- feat: mystery event UI improvements, homestead layout refinements, and particle burst effects
- feat: homestead, mystery events, collection UI, and battle layout refinements
- feat: add material-icons component, homestead art assets, and UI/storage refinements
- feat: free-order homestead unlocking, new farm plots (orchard, crystal garden), and herb garden art with UI refinements
- feat: homestead screen, gender-neutral character assets, and UI/tests refinements
- feat: batched updates — test helpers/refactors, companion & enemy trait system, new screens (act-complete, run-victory), reward utils, cost module, and expanded test coverage
- feat: rewards screen overhaul, run controller updates, companion assets, and test improvements
- feat: UI fixes, run controller updates, and test additions
- feat: UI improvements, talent pool enhancements, and cleanup of unused raw audio assets
- feat: companions system, ranger characters, UI improvements, and audio enhancements
- feat: add image preloader, UI polish pass, audio tweaks, and talent pool refactor
- feat: add trinkets system, battle engine improvements, UI refinements, and expanded compendium
- feat: overhaul SFX pipeline, add sound registry, and reorganize raw assets
  - Add optimize-sounds.mjs script and src/lib/sound-registry.ts for centralized SFX management
  - Replace and remap card/enemy SFX with new raw asset sounds (buff-pickup, swish-hit, strong-punch, energy-noise, gut-kick, bonus-regen-rate, sword-impact-hit-2)
  - Remove button click sound and playUIClick API
  - Temporarily wire Collection screen tile clicks to play card/enemy SFX for testing
  - Reorganize raw assets from Raw Art Assets/ to Raw Assets/
  - Update UI components, battle logic, and tests to align with latest changes
  - Add ffmpeg-static dependency for sound conversion pipeline

### Bug Fixes

- fix(desktop): retain Sentry frame debug IDs
- fix(desktop): preserve Sentry source map metadata
- fix(desktop): install browser V8 snapshot
- fix(desktop): verify packaged Sentry transport
- fix(shop): thread injected RNG through all shop refresh paths
  Equipment already honored deps.rng; merchant, alchemist, and trinket
  init/refresh still fell back to Math.random.
- fix(persistence): guard finalizeRunEndSession against double material grant
  Re-entry on run end could award homestead materials twice; return early
  when hasActiveRun is already cleared.
- fix(test): use interfaces for CI summarize script types
- fix(test): declare types for CI summarize script imports
- fix(test): raise ESLint stacking lintFiles timeout for CI
  Cold ESLint lintFiles on meta screens can exceed the default 5s under
  CI load; allow 30s for that coverage check.
- fix(test): include restore-active-run-session in snapshot parity
  Restore helpers moved out of run-transitions; scan both modules for
  ActiveRunData field coverage.
- fix(lint): drop unused run-flow and shop persistence exports
  Trim knip-flagged barrel re-exports and internal progress key constants
  so deadcode checks pass after the progress split.
- fix(lint): restack run-loop screen bans and save via facade
  Keep SCREENS_NO_ORCHESTRATION on screens only so shop can import
  deck-mutations, and read permanent progress through the session facade.
- fix(lint): drop unused shop empty-state re-exports
- fix(lint): satisfy barrel imports after ESLint boundary stacking
  Route deep imports through barrels, allow bootstrap storage names, and
  exclude rng.ts from the Math.random member ban.
- fix(test): skip Death's Door in lethal defeat e2e
- fix(ui): align battle menu lock tooltips with main menu
- fix(test): silence unused session param in draw-sequence test
- fix(test): restore e2e decks and harden battle auto-end
  Keep non-tombstoned custom deck cards on save load so E2E fixtures
  remain drawable, disable auto-end in injected saves, and avoid ending
  the turn during hand transfers. Also null-safe the change-amplification
  audit on shallow checkouts and fetch full history in the CI test job.
- fix(test): hoist end-turn mock for vitest factory
- fix(app): drop unused escape-stack exports for knip
  Remove popEscapeHandler and EscapePriority; callers unsubscribe via
  pushEscapeHandler's return value.
- fix(lint): sync escape refs in effects and strip hydrate flags
  Move callback ref updates out of render for the Escape stack helpers,
  and discard save-only validity flags without unused bindings.
- fix(test): unblock typecheck:all for pre-push lint gate
  Make prepush tags mutable, align BattleCard fixtures and screen enums,
  and fix quit/mock typing so lint:ci passes.
- fix(test): raise change-amplification audit timeout
  The audit script routinely exceeds the default 5s Vitest timeout under
  load, which blocked pre-push even when the suite was otherwise green.
- fix(ui): revise options text, locked tooltips, dropdown accent color
  - Update clear save data dialog title and description
  - Remove Error Log from options UI (code-only now)
  - Change dropdown highlight to muted warm gray with light text
  - Add lock icon to locked feature tooltips (Talents/Homestead/Armory)
  - Update locked tooltip messages for clarity
- fix(game-data): revert arbitrary data-file splits, restore single-file cards/affixes/items
  The refactor in 7279ad86 split three pure-data files into
  card-library-part-1..6, affix-rows-1..4, and base-item-group-1..3.
  These were purely size-driven with no semantic boundary: the part-N
  names encode no meaning, and the affix split broke a natural group
  (resist-freeze in rows-3, resist-nature in rows-4).
  
  Reverting them to single files (678, 644, 359 lines respectively)
  eliminates the navigational indirection for a reader looking up a
  card/affix/item. The codebase tolerates much larger files
  (e.g. status-damage-riders 11k, gear-art 11k) without issue.
  
  Also fixes a barrel regression: card-parity.ts split dropped
  re-exports of hasKind and hasLifesteal that the test suite
  depends on.
- fix(audit): harden module boundaries, fix 7 pre-existing test failures, update agent safety docs
  - S1: implement applyDestinationChoices on run-domain store, wire resume seam
  - S2: short-circuit sampleDestinationChoices when pool <= DESTINATION_CHOICES
  - S3: guard resolveEndTurn/resolveNormalEnemyTurn with isCurrentBattleSession
  - S4: skip duplicate beginPointer for same item within activation distance
  - S5: add cleanup symmetry in animateDiscardedHand on session loss
  - S6: stabilize useArmoryTargetingEvents deps with ref pattern
  - Fix readInventoryBoardMetrics to accept plain style objects (jsdom compat)
  - Fix formatEnemyAttackLines multi-status attack line splitting
  - Restore wheat-field as visible farm plot
  - Update AGENTS.md: strengthen foreign-file recovery rules, add parallel agent worktree guidance
- fix(armory): match flyover visual content to slot structure for pixel-perfect landing
  Three changes that together eliminate the 1-2px perceived offset:
  
  1. Extract GearSlotArt to shared component (parts/gear-slot-art.tsx).
     Use it in the drag visual portal for equipment-destination flyovers,
     so the portal's children are structurally identical to the slot's
     children (including the slot-specific textured background image).
  
  2. Animate position via transform:translate() instead of left/top.
     The element's CSS left/top is always the dest position; the
     animation interpolates a transform offset to identity. This
     eliminates the style-vs-animate prop conflict that caused
     re-render position snaps.
  
  3. Use raw (unrounded) dest.left/top from getBoundingClientRect()
     so the flyover lands at the slot's exact fractional pixel
     position, matching the slot's rendered position even under
     fractional ancestor layouts.
  
  Also update the gear-drag-positions integer-pixel test (left/top
  are now intentionally fractional for flyover matching) and the
  gear-layout scroll test (57 items no longer overflows 8 visible rows).
- fix(armory): animate drag flyover via transform for pixel-perfect landing
  Animate transform: translate() instead of left/top for double-click
  flyover and magnet settle/release animations. The element's CSS
  left/top is always set to the final dest position (integer), while
  the animation interpolates a transform offset to identity. This
  eliminates sub-pixel left/top interpolation and style-vs-animate
  prop conflicts that caused the flyover visual to land 1-3px off.
  
  Add E2E test (armory-flyover.spec.ts) asserting the flyover lands
  within 0.5px of the equipment slot position after animation completes.
- fix(homestead): trim companion name padding and stabilize shell height across tabs
  Reduce companion art-card padding and name gap isolated to the
  Companions tab. Pin outer shell min-height to match the Companions
  tab so all four tabs share one container height with no visible
  resize on switch. Add a regression test. Also mark the unreleased
  Wheat Field farm plot as hidden.
- fix(ui): constrain hamburger trigger to centered column on run-loop screens
- fix(shops): gear tooltip parity, per-slot aspect ratio, armory gating, dedupe, label cleanup
  - Equipment Shop tooltips now use Armory's GearTooltipContent (shine on
    titles, shine on max-rolled astral affixes, affix entries)
  - Equipment Shop and Boss Reward gear tiles use per-slot aspect ratio
    matching the Armory inventory grid (1:1 for rings/boots, 2:3 for
    mains/offs/body, etc.)
  - Equipment Shop destination hidden from pool until Armory is unlocked
    (player must own at least one gear piece)
  - generateGearRewardChoices deduplicates by baseItemId across offerings
  - Title labels removed beneath all shop items (shown only in tooltips)
  - Trinket Shop changed from 6:7 to 1:1 aspect ratio
- fix(mystery): reuse merchant RemoveCardPanel for Fairy Ring card removal
  Replace the separate RemoveCardPicker in mystery-deck-pickers with the
  shared RemoveCardPanel (extracted from the merchant shop's remove-mode),
  so the Fairy Ring (and any removeCard + choose mystery) reuses the
  merchant's exact card-removal UI. Only the gold display and Cancel
  button are omitted for mystery events.
- fix(destination): restore combat pity push, guarantee 3 choices, soften repeat penalty
  Three interacting changes:
  
  1. Restore the dropped choices.push(pickedCombat) in sampleDestinationChoices
     — the refactor in fb7b2f4a silently discarded the combat selected by
     pickCombatPity, causing the destination count to drop to 2 or 1.
  2. Add top-up logic to always fill to DESTINATION_CHOICES (3) for normal
     acts, preventing weighted-picking early-exit from showing fewer than 3.
  3. Raise LAST_OFFERED_DESTINATION_WEIGHT from 1 to 3 so recently-offered
     destinations aren't aggressively starved (0.3 multiplier instead of 0.1).
  
  Also added 3 regression tests: length invariant, combat-included after
  pity, and shop-cap-still-respected during top-up.
- fix(battle): trigger player CC immediately on enemy damage, fix enemy block decay timing
  - Player stun/freeze now resolves on damage (not deferred to tick phase)
  - Enemy block decays at start of enemy phase (not end)
  - Armor mitigates Stun damage by default (no longer talent-gated)
  - Rework Steadfast talent to grant Armor at low health instead
  - Update keyword and reference docs to match new timing rules
- fix(battle): unify stun and freeze buildup damage
- fix(armory): harden drag and crafting mutations
- fix: type error in injectLabyrinthRun Object.assign call
- fix(e2e): correct destination and labyrinth test navigation timing
- fix: revert incorrect cardPlayInProgressRef change in battle test
- fix: resolve pre-existing typecheck and E2E test errors
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
- fix: card selection visuals, difficulty select screen polish, mystery intro layout, screen header styling
- fix: holy damage calc, poison talent scaling, sound alias cleanup, and test infra

### Balance

- balance: reduce early enemy damage, select bg tweak, remove screenshot eslint block

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

- refactor: consolidate run lifecycle, streamline CI, and add asset caches
  Move run init/teardown into shared modules, restructure run-loop controller
  bindings, add path-filtered CI jobs with a composite setup action, cache
  optimized asset hashes, and refresh audits, tooling, and docs.
- refactor(run): collapse battle cost/effects shims and share run gold
  Retarget callers to effect-handlers and card-play, extract spendRunGold,
  tighten labyrinth encounter trait types, and add dual-path audits.
- refactor(desktop): simplify Sentry reporting
- refactor(save): compose domain persistence codecs
- refactor(run): persist deterministic rng streams
- refactor(state): separate runtime ownership by lifetime
- refactor(shell): scope commands by route phase
- refactor(run-flow): scope transition claims to run state
- refactor(persistence): dedupe ProgressSnapshot and drop unused re-export
  Share one ProgressSnapshot type across save flush/build and remove the
  facade re-export of readPermanentProgressForSave.
- refactor(imports): break save and utils circular dependency cycles
  Extract run-save-readers for persistence snapshots and move
  useDevShortcuts to the app layer so madge reports zero cycles.
- refactor(ui): share ScreenHeaderRow and RunEndScreen shells
  Collapse six meta header twins and the victory/defeat run-end markup
  into shared primitives while keeping thin route wrappers.
- refactor(ui): extract ScreenShell and tokenize armory transfer menu
  Collapse duplicated meta-screen shell chrome into a shared primitive
  and replace stone color literals with theme tokens.
- refactor(types): remove hot-path casts on shop, save, and enemy turn
  Generic shop refresh, explicit save progress branching, and a
  discriminated EndPlayerTurnResolution replace unsafe escapes.
- refactor(architecture): nest progress lifetimes and extract shared/run-flow
  Split progress into run vs permanent subtrees, move destination/campaign
  helpers to shared/run-flow, and enforce run-setup/run-loop boundaries.
- refactor(architecture): harden import boundaries and deepen run-session facade
  Stack ESLint restricted-import layers correctly, move shop/reward session
  types into lib, route via phase ctx, and document the progress-lifetime split
  proposal.
- refactor: share shop UI and escape stack, relocate audits, harden saves
  Consolidate shop/choice surfaces and overlay Escape handling, move quality
  audits under docs/Audits, tighten agent docs, and clean dead code while
  expanding focused regression coverage.
- refactor(prompts): simplify to focused prompt list, cut bottom-third audits
- refactor(agents): streamline AGENTS.md and update Dark Pact, Hemorrhage, Kindling, Tithe card artwork
- refactor(game-data): split cards and compendium into per-entry modules, extract styles and asset manifest
- refactor(imports): remove coupling cycles
- refactor(ui): remove redundant Battle header from battle screen
- refactor: split oversized modules, add farm plots, armory polish, and type-safety fixes
  - Split large files into focused sub-modules: game-constants/, battle/types/,
    battle/damage-calc/, gear/affix-catalog/, gear/base-items/, cards/card-library-*,
    cards/card-builders/, content-validation/card-parity/, balance/simulator-*,
    armory/board-drag-*, armory/armory-screen-*, shop/shop-*, navigation/*-types
  - feat(homestead): add 5 farm plot definitions (wheat-field, chicken-coop, pasture,
    orchard, crystal-garden) with tier effects, card heal bonuses, and DR wiring
  - feat(armory): 8-column inventory grid, gear borders, astral shine, drag aliasing fix
  - fix(armory): animate drag flyover via transform:translate() for pixel-perfect landing
  - fix(armory): match flyover visual content to slot structure
  - chore(types): remove non-null assertions, fix unsafe casts, scope react-refresh disables
- refactor(types): reduce unsafe typing escapes
- refactor(imports): eliminate all 23 circular dependencies, tighten efferent coupling
- refactor(armory): split slot-button and inventory-tile into content sub-components, bundle drag-end effects
- refactor(readability): extract armory reset effects, haste/enemy draw continuations, external dest match
- refactor(complexity): reduce cyclomatic complexity of 12 functions to ≤ 10
- refactor(armory): bundle drag-helper params, inline wrappers, tighten props
  - use-board-drag: bundle 10 refs/callbacks into FsmDragRefs
  - use-armory-gear-drag: collate shared callbacks into GearCommitEnv,
    inline createGearOnCommit factory
  - use-armory-currency-drag: drop useCallback wrappers for
    movePointer/finishPointer
  - armory-screen: replace raw setSalvageMode/setActiveCurrencyId
    with onToggleSalvageMode callback
  - armory-drag-visual-portal: extract buildDragPortalMotionProps
  - armory-overlays: extract SalvageDialog + renderDragVisualPortal
  - use-armory-targeting-events: extract isTargetingElement +
    setupTargetingEventListeners
  - add tests/use-armory-targeting-events.test.ts (6 tests)
- refactor: rename PressableMotion to PressableSound
  The component is a plain span that plays a hover sound — it has nothing
  to do with Framer Motion. Rename to avoid confusion with AGENTS.md's
  'no Framer hover scale' rule.
- refactor(stores): fold homestead store into run domain store
  - Merge useHomesteadStore into useRunDomainStore.progress slice
  - Remove homesteadEffectsRef pattern; useHomesteadAdapter() instead
  - Add pickActions helper to replace hand-rolled picker functions
  - Unify save/reset/bootstrap paths under single domain store
  - Add createEmptyTalentEffectManifest factory, reuse in homestead defaults
  - Simplify useTalentChoices hook
  - Clean up 3 test files and delete dead store + test
- refactor(homestead): make mergeIntoManifest generic, eliminate type duplication
  - HOMESTEAD_BATTLE_*_KEYS arrays (numeric/boolean/record) are the single
    source of truth for which TalentEffectManifest fields homestead can affect.
  - HomesteadEffectManifest = Pick<TalentEffectManifest, battle keys> &
    HomesteadMetaEffects (5 run-level fields) — no type duplication.
  - mergeIntoManifest now iterates the key arrays: numbers add, booleans OR,
    Records merge-by-key. Adding a key to the arrays automatically makes it
    mergeable; no per-field listing to maintain.
  - applyTierEffects handles Records additively, eliminating the cardHealBonus
    special-case and collectCards block (~20 lines removed).
  - defaults.ts unchanged (same values, type-checked against the Pick).
- refactor(assets): remove placeholder art stubs and expand audit
  - Delete boss-combat.webp stub (98 B) and source JPEG (343 B), replace fallback with normalEnemyBg
  
  - Remove 5 hidden placeholderFarm entries and the factory
  
  - Delete orphan placeholder-boon.webp (no source PNG)
  
  - Expand content-validation placeholderArt set from 3 to 9 entries
- refactor(core): confine side-effect primitives to designated seams
  - corruption/index.ts: corruptCard/corruptDeckCard now require rng param
    instead of direct Math.random calls
  - homestead/loot.ts: rollBonuses/getEnemyMaterialLoot now require rng param
  - mystery-flow.ts: rng added to MysteryEffectContext, replaces Math.random
  - game-constants.ts: isAnimationDisabled moved to new
    lib/animation/animation-prefs.ts seam
  - Update all call-sites and tests to thread rng through
- refactor(dedup): extract shared LabyrinthNodeHandlers type and defaultCompanionBondLevels
- refactor(seams): auto-generate asset barrel, split damage test, add audit tooling
  - Add scripts/sync-assets.mjs to auto-generate src/lib/game-data/assets.generated.ts
    from src/assets/optimized/ directory scan; hook into prebuild
  - Split tests/lib/battle/damage.test.ts (789-line mega test) into 9 focused files
    by describe-block family with shared test helpers
  - Write scripts/audit-change-amplification.mjs for reproducible hotspot analysis
  - Update PROMPTS.md #6 with co-edit signal, three-view methodology, encoding fix
  - Save audit plan to .opencode/plans/change-amplification-audit.md
  - Update AGENTS.md generated-files section for assets.generated.ts
- refactor(imports): break 6 cycle clusters, remove dev-mode from utils barrel
  - Cluster 1: move ghost/transfer types from presentation-types into shared/types
  - Cluster 2: lift applyGearDamageResistance/scaleGoldReward from gear-effects to types
  - Cluster 3: move getEnemyDamageMultiplier from status-effects barrel to status-helpers leaf
  - Cluster 4: extract TalentPreset to balance/types.ts, break simulator↔homestead-preset
  - Cluster 5: move withSelectedBossForDestinations from victory-flow to destination-flow
  - Cluster 6: import StaggerGroup/StaggerItem from source files, not shared-ui barrel
  - Extract dev-mode.ts from shared/utils barrel to stop store-dep chain
  - Move scene-rect functions from card-transfer-animations to controller-utils
  
  59 cycles eliminated (82→23); boundary violations remain 0; p90 imports 9
- refactor(complexity): clean up DragVisualPortal, InventoryGearTile, TalentNode, AppMainContent
- refactor(complexity): clean up SlotButton, ActorPanel, EnemyTooltip, LabyrinthNodeButton, DifficultyCard
- refactor(complexity): clean up armory drag math, board metrics, TiltSurface
- refactor(complexity): clean up battle engine, simulator, gear-store, labyrinth, destination-flow
- refactor(complexity): reduce cyclomatic complexity of 24 functions below threshold 11
- refactor(type-safety): eliminate non-null assertions and casts in src (non-test)
  - Fix 9 non-null assertions (crafting, generation, simulator, homestead,
    alchemist-shop, background-particles) with null guards or ?? defaults
  - Replace 9 as-unknown-as casts at save/boundary and UI tier with typed
    loops, in-operator guards, or discriminated union narrowing
  - Change DAMAGE_TYPES to as-const, removing the cast in shared-schemas
  - Simplify globalThis.requestIdleCallback access in image-preload
  - Fix keyboard-event forwarding in tilt-surface (no more cast through unknown)
  - Remove 2 eslint-disable lines in gauntlet.ts by eliminating ! assertions
  - Document remaining eslint-disable lines with reasons
  - Remove unused eslint-disable directive in effects/schemas.ts
- refactor(storage): simplify save-load path, drop diagnostics, fix Windows backup rotation
  - Revert SaveLoadStatus to 4-kind shape; no candidate/triedAll fields
  - Future-versioned candidates silently skipped, not errored to player
  - Eager card hydration at load time with silent drop for unknown IDs
  - Remove App.tsx parseActiveRun gate (hydration now in io.ts)
  - Delete save-merge.ts (local-wins policy, no cross-device merge)
  - Delete dead loadSave/backupSave IPC handlers and SAVE_BACKUP_PATH
  - Fix Windows backup rotation rename with { overwrite: true }
  - Simplify tombstoned-content-ids.ts to just card IDs
  - Update all tests and MIGRATIONS.md to match simplified policy
- refactor(validation): simplify validation enums, externalize card exceptions, and soften card parity checks
- refactor(validation): split monolithic content-validation module
- refactor(style): modernize theme keyframes and convert custom utilities to tailwind v4 directives
- refactor(style): simplify index.css architecture and consolidate theme tokens
- refactor(content-validation): simplify card-parity validation
- refactor(battle): simplify battle controller architecture and dependencies
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
- refactor: harden save migration, battle controller, and run initialization
  - Add save metadata tracking (schema/build/content version)
  - Add explicit save migration harness (migrateV0ToV1)
  - Add field-level normalization for all persisted data
  - Tighten active-run validation (finite HP/gold, labyrinth invariants)
  - Whitelist saved card hydration to prevent stale-field leakage
  - Add future-schema blocking UI with desktop Exit support
  - Extract pure helpers for run-start snapshot and reward finalization
  - Add timer cleanup and stale-state ref protection in battle controller
  - Add legacy save fixtures, migration docs, and 89 new unit tests
- refactor: overhaul tests, remove flaky E2E tests, add comprehensive unit tests, fix difficulty modifiers
- refactor: consolidate battle submodules, add immutable helpers, data-drive homestead/trinket effects
- refactor: extract run-state field setter, simplify battle ref sync, shorten variable names
- refactor: extract battle submodules (apply-effects, card-play, combat-text, damage, enemy-turn, status-effects, status-ticks, trinket-utils, wish)
- refactor: extract shared stun trigger, tickPlayerHarmfulStatus, finalizePlayerTurn; deduplicate first-card-free rules
- refactor: merge runTalentXP into talentXP, add placeholder mystery art, extract SelectableShopCard, remove unused exports
- refactor: reorganize talents into modular directory structure
- refactor: extract mystery flow into hook, split storage migrations, and restructure run/mystery modules
- refactor: rename ailment to harmful-status, remove ailment keyword, restructure deck/character data, add battle UI components
- refactor: battle system cleanup, talents rework, and screen polish
  - Refactor battle effects/turns modules for clarity
  - Rework talent data structure and balance
  - Polish multiple screens (homestead, victory, game-over, shops)
  - Remove dead code (audio-volume, material-icons, mystery-events cleanup)
  - Expand test coverage (talent-pool, homestead, config)
  - Net -1000 lines across the codebase
- refactor: centralize keyword visual data; rework armor to only mitigate burn and physical damage; add keyword-colored descriptions and shine-border indicators
- refactor: extract audio into focused modules; consolidate state into single-object stores; reorganize config/navigation/storage into subdirectories; add utility helpers; remove dead styles
- refactor: add module-level doc comments across codebase; extract mystery effects into dedicated function; add new game constants; clean up test imports
- refactor: extract run navigation, battle/shop controllers from monolithic use-alchemy-run-controller; add ESLint, Prettier config, error boundary; migrate PostCSS to ESM
- refactor: integrate mobile landscape into main battle layout with virtual-resolution stage
- refactor: battle engine cleanup, audio overhaul, UI consolidation, and bug fixes
  - Fix SFX volume slider (0-100 scale conversion in setSfxVolume)
  - Fix gold-on-poison combat text not rendering (threaded combatTexts into applyDamageStatuses)
  - Fix test mock data (makeState now matches current BattleState shape)
  - Extract clampHealth utility, export shuffleCards, replace inline shuffles
  - Split applyCardEffects, createBattleState, processEnemyAttack, endPlayerTurn
  - Remove dead code: COMBAT_TEXT/EFFECT_KINDS/TURN_PHASES consts, ScreenHeader, isInitialized
  - Replace magic numbers with named constants (ENEMY_HEAL_FRACTION, BLEED_EXECUTE_MULTIPLIER, etc.)
  - Clear unused lucide-react imports and useCallback import
  - Add shared PaginationControls and GoldCost components, replace 4 pagination duplicates
  - Add unit tests for clamp, clampHealth, shuffleCards (137 total, all passing)
  - Reorganize music tracks (Battle 1-4, single Menu 1), add auto-switching via screen state
  - Add smooth 300ms crossfade between tracks with fade-out/fade-in
  - Add music master gain (0.5) for volume headroom, reduce default volume
  - Fix currentKey not persisting through startTrack (removed stopMusic call)
  - Add playMusicImmediate for initial load (no fade), delayed-fade for transitions
  - Music now auto-plays on main menu load, persists across non-combat screens

### Tests

- test(desktop): remove Sentry crash harness
- test(desktop): symbolicate renderer crash probe
- test(desktop): expose Sentry startup checkpoints
- test(desktop): automate Sentry crash verification
- test(e2e): expect Wheat Field as a visible homestead farm plot
  Product already restored wheat-field; the E2E assertion still treated
  it as a hidden placeholder.
- test(e2e): replace homestead tab layout waitForTimeout with anchors
  Wait on tab-specific content instead of a fixed 300ms delay before
  measuring shell height.
- test(unit): drop redundant and empty battle coverage
  Remove a feature-shell echo of start-health, comment-only combat-text
  cases, and a duplicate getEnemyDamageMultiplier baseline.
- test: update stale suite expectations
- test(types): align battle tests with status model
- test(e2e): stabilize prepush battle fixtures
- test(tests): add missing assertion, deduplicate gear-damage setup, remove contradictory enableFastMode
- test(e2e): consolidate specs, add legacy save/preferences coverage, and stabilize tests
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

- ci: split lint gate and add boundary plus report tooling
  Make CI failures easier to diagnose by splitting lint:ci into named
  steps, adding dependency-cruiser phase boundaries, shared Prettier
  path scripts, and Vitest/Playwright summary reporters.
- ci: reduce pipeline cost, add release automation, and rebalance E2E test tiers
  - Move full E2E suite off main-push to tag-push only (saves ~10 min per push)
  
  - Add lint, test, build, e2e-full (3 shards) to release.yml; block release on E2E failure
  
  - Add restore-keys fallback to all npm and Playwright caches; add asset cache
  
  - Add changelog auto-commit subject with commit count and short hash
  
  - Create release.mjs and release-hotfix.mjs wrapper scripts
  
  - Rebalance @critical to 61 fast tests covering all areas with no gaps
  
  - Add @slow tag to 51 slow specs (animations, drag, viewport loops)
  
  - Add @critical coverage to progression-locks, difficulty-select, gear-combat, keyboard-navigation
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

- build(desktop): disable implicit CI publishing
- build(desktop): invoke builder cross-platform
- build(desktop): harden Steam release boundary
- build: sync package-lock.json with package.json dependencies

### Docs

- docs(audits): add orchestration skill
- docs: correct stale navigation, autosave, and materials paths
  Fix ARCHITECTURE screen-transition module name, ARMORY autosave
  API/file claims, and WORKFLOWS run-flow-handlers paths.
- docs(audits): let agents choose discovery and fix strategy
  Make audit probes optional signals, have passes fix confirmed findings,
  and point verification at CONTRIBUTING gates instead of restating them.
- docs: clarify agent workflow guidance
- docs(prompts): expand PROMPTS.md audits and add single-use + audit-all scripts
  - Add TODO/FIXME & runtime-warning audit (covers console.log leftovers,
    silent catch blocks, bare markers)
  - Add Accessibility audit (focus order, names, focus ring, reduced motion)
  - Rewrite Single-use abstraction audit (#7) to use scripts/audit-single-use.mjs
    (was prose; now exits non-zero on > 15% single-use ratio)
  - Add scripts/audit-all.mjs and
  pm run audit:all for periodic sweeps
    (knip strict, single-use, madge, eslint complexity + max-lines,
    change-amplification)
  - Normalize 'When done' lines in measurable audits to include npm run typecheck
  - Fix max-lines-per-function threshold off-by-one (#4) and add skipComments note
  - Add npx cold-start preamble for madge/jscpd in the Measurable section
  - Add .tmp-audit cleanup note + sample-size guard to Change amplification audit (#6)
  - Note npm run test:ship:desktop in the verification tier block
  - Drop stale @stryker-mutator/core reference in Coverage audit (#10) —
    package was removed in 82155dc3 but the doc reference was not cleaned up
  - Sync CHANGELOG.md (auto, by pre-push hook chain)
- docs(quality): rewrite PROMPTS.md with measurable code-quality audit criteria
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

- chore(architecture): align strict integration contracts
- chore(dead-code): remove unused shim and UI token exports
  Delete the test-only run-navigation-helpers re-export plus unused
  popupClassName and BUTTON_HEIGHT_LG.
- chore(lint): harden quality gates
- chore(config): set shell to pwsh
- chore(docs): sync PROMPTS.md audit format
- chore(deps): remove stryker-mutator, finalize battle core test coverage
  - Drop @stryker-mutator/{core,typescript-checker,vitest-runner} devDeps
  
  - Add start-health tests (new file)
  
  - Strengthen wish/damage-riders/enemy-turn-traits/status-stun-resolve/status-helpers tests
  
  - Fix coverage parser for *.md and active-run-snapshot-parity regex
  
  - Remove unused vi/beforeEach/afterEach imports
- chore(lint): enforce consistent-type-definitions, array-type; promote 5 rules to error; fix type->interface side effects
  - eslint.config.js: add consistent-type-definitions, array-type,
    no-template-curly-in-string; promote 5 rules to error
  - eslint.config.js: enable no-non-null-assertion as warn;
    react-refresh/only-export-components error in shared/ui
  - tsconfig.json: enable useUnknownInCatchVariables
  - Fix type->interface side effects in store-actions.ts,
    _field-setter.ts, all 4 slice files
  - Fix electron-smoke.spec.ts: loadSave -> listSaveCandidates
  - Remove unused imports in storage-backup.test.ts,
    platform-storage.test.ts
  - Prettier format desktop/main.cjs and all auto-fixed files
  - Auto-fix: type aliases -> interface, T[] -> Array<T>
- chore(ci): reduce GitHub Actions storage usage
  - Exclude dist/Music/ from upload artifacts (~70 MB saved per run)
  - Remove duplicate node_modules caches in favor of setup-node --prefer-offline
  - Drop release-desktop-win retention 30d -> 3d
  - Drop Playwright report retention 7d -> 3d
  - Delete 32 unused PNGs from public/ (webp versions already in use, ~54 MB freed)
- chore(lint): resolve CI warnings — type safety, unused import, fast-refresh split
- chore(repo): reorganize feature tests to mirror source paths
- chore: remove unused battle-facade, ignore tailwindcss-animate false positive
- chore: delete unused expectItemAtCell helper
- chore: remove unused exports across the codebase
- chore(content-validation): remove unused exports
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
- chore: remove screenshot artifacts from tracking and add to .gitignore
- chore: baseline before UI palette redesign
- chore: reset repository to local workspace snapshot

### Style

- style: prettier-format architecture docs and eslint config
- style: prettier-format docs and eslint config
- style(docs): format markdown for prettier gate
- style: fix Prettier formatting
- style: fix import type annotations in battle test files
- style: fix pre-existing formatting in 4 files
- style: unify user-facing text phrasing across cards, trinkets, talents, affixes, homestead, and encounter traits
- style: apply prettier formatting
- style(armory): clean up gear tooltip layout and purchasable item styling
  - Compact tooltip descriptions by removing redundant gradient wrapper
  - Adjust purchasable gear/trinket item text and layout spacing
  - Update armory-styling test to match new tooltip DOM structure
  - Sync CHANGELOG.md with previous commit entry

### Other

- test(battle, gear): add branch-coverage tests for 6 core modules
  - companion.ts: 12 tests for bleed/frozen/low-hp/mana/forge/leech branches
  - wish.ts: 4 tests for crystal gold, mana, burn triggers
  - damage-riders.ts: 4 tests for archery, nature leech, holy block, burn stun
  - effect-handlers/*: 46-test file covering all 5 handlers' secondary branches
  - gear/definitions.ts: 5 tests for gearInstanceRarity and rarity filter
  - gear/display.ts, footprints.ts: 8 tests for tooltip entries and footprints
  
  Branch coverage: battle 89.91%, storage 86.74%, gear 66.86%
- Abstract encounter traits across Labyrinth and Wildwood
- Refresh saved card art on resume
- Remove GitHub Pages deployment workflow; switch to Vercel
- Refactored Battle, App, Run Nav, Reward structure
- Phase 7: documentation — add top-of-file summaries, battle state machine lifecycle, fix stale comments, document key status effect functions
- Phase 6: structural improvements — screen registry, useEffectEvent removal, battleStateRef leak fix
  - 6a: Replace 18-way ternary-if screen routing in App.tsx with a switch-based
    renderScreen() function (~200 lines to ~140 lines, single dispatch point)
  - 6e: Replace experimental useEffectEvent with stable useRef pattern for
    battle victory/defeat side effects
  - 6d: Eliminate battleStateRef leak from battle controller to navigation
    layer — pass currentEnemyType as concrete value instead
- Phase 0-5: config centralization, error handling, naming, file splitting, duplication extraction, type fixes
  - Phase 0: Move 17+ tuning values from scattered files into game-constants.ts
  - Phase 1: Add console.error/warn to all 10 silent error paths; add startup validation
  - Phase 2: Fix barrel bypass, rename misleading functions (enemy-damage→damage-to-enemy,
    applyThreshold→applyHealthThresholdStatBonus, st→nextState), rename config/theme.ts
    to combat-text-icons.ts, remove emoji from homestead icons
  - Phase 3: Split shared-ui.tsx into 7 domain files; split hooks.ts; extract runtime code
    from battle/types.ts, homestead/types.ts, storage/types.ts
  - Phase 4: Extract shared getCardKeywords (keywords.ts) and generic shuffle<T> (utils.ts);
    eliminate 3 duplicate implementations
  - Phase 5: Fix unsafe Destination[] cast, inline EnemyStatusId subset, align forgeToBurn
    type (boolean vs number)
- Polish: UI refinements across screens, fix game-over layout, add game-import button to collection, expand test coverage
- WIP on main: 72ad68a refactor: centralize keyword visual data; rework armor to only mitigate burn and physical damage; add keyword-colored descriptions and shine-border indicators
- Feat: UI palette redesign with warm earthy tones, navigation debounce, and updated art assets
  - Redesign CSS color palette from neutral grayscale to warm fantasy tones (hue 30-40 range)
  - Add SVG noise texture overlay to background
  - Make button styling more tactile (rounded-xl, shadows, active scale)
  - Remove font-semibold from headings for cleaner typography
  - Add 100ms debounce to screen navigation to prevent double-click issues
  - Add useCallback import for navigateTo
  - Update logo, draw pile, and discard pile art assets
- Refactor: modularize codebase, standardize layout, add unit tests, fix shop, add e2e tests
  Structural refactoring:
  - Split meta-screens.tsx into 10 individual screen files with barrel index
  - Split utils.ts into domain sub-modules (string/battle/random/dom)
  - Extract useTalentState and useRunState sub-hooks from monolithic controller
  - Remove dead code: PlaceholderScreen, unused barrel exports
  - Fix dormant trinkets tab by adding to collectionTabMeta
  - Create shared PageLayout component for consistent screen centering
  - Move navigation buttons to bottom of Options, Talents, Collection screens
  - Add justify-center to Merchant's Shop for proper vertical centering
  
  Gameplay:
  - Destination color theming (red/purple/gold/green with white text)
  - Remove hover transition wiggle on destination buttons
  - Conditional destinations: Campfire only when HP < 80%, Shop only when gold >= 50
  - Shop prices: cards 30g, remove 50g, refresh 20g
  - All keywords have 8 talent nodes (placeholders added)
  
  Testing:
  - 88 unit tests across 5 files covering all pure game logic
  - Vitest configured with vite alias support
  - E2E tests for shop screen and full run flow
  - Test script added: npm test / npm run test:watch
  
  Refactoring standards enforced:
  - Functions split at 30 lines, max 2 levels of nesting
  - No dead code, unused imports, or unreachable logic
  - Every function has 'why' comments for game mechanics
  - Magic numbers extracted to game-constants.ts
- Feat: Implement Campfire destination with rest animation and HP restore
- Feat: Redesign talents system with inline choices, mechanical effects, and persistent XP; add game-over screen with talent progress; add e2e tests for core gameplay
  Talents:
  - Replace static talent tree with randomized 3-choice inline selection + confirm flow
  - Add 8 Physical talents with mechanical effects (flat dmg, armor synergy, crit)
  - Implement 5% global crit chance that doubles damage
  - Remove talent names, show description-only nodes with keyword-colored text
  - Add keyword icons, black background, keyword-colored borders
  - Show undiscovered talents greyed out in the talent list
  - Add Reset Talents button with confirmation dialog
  - Add red dot notification on keywords with unspent talent points
  - Choices persist per keyword via useRef cache (no reroll on tab switch)
  
  Battle:
  - Add block consumption floating combat text (player-side damage/block)
  - Add TalentEffectManifest to BattleState, injected from unlocked talents
  - Remove inline defeat overlay from battle screen
  
  Screens:
  - New GameOverScreen with animated talent progress bars and Return to Main Menu button
  - Remove 2-second auto-navigate delay on defeat
  - Remove centering wrapper from CollectionScreen
  - Remove PlaceholderScreen from OptionsScreen for fixed header layout
  - Options tabs no longer shift layout on switch
  - Character select now has card-style containers around each character
  
  Testing:
  - Add comprehensive e2e tests for menu, character select, battle mechanics,
    full run flow, game over, options, talents, collection, resolution, navigation
  
  Persistence:
  - Add unlockedTalents to save data (load/save/clear)
  - Reset runTalentXP between runs via resetRunState
- Remove duplicate deploy workflow
- Overhaul: cleanup, features, and fixes
  - Asset pipeline: restructured raw art into subfolders (Cards/Enemies/Logo/Misc/Player Characters), added gendered character art (male/female per class), new draw/discard pile art
  - Character select: 3 classes (Knight/Rogue/Wizard) with unique starting decks, per-character gender toggle, tilt+shimmer effects, keyword tags
  - Battle: sliding turn indicator, DoT damage triggers at enemy turn start, block absorbs and halves, Meteor reduces max mana, mana can exceed cap
  - Talents: keyword-based XP system, pyramid talent tree with Physical +1 damage node
  - Options: tabbed layout (Display/Sound/Other), music+SFX volume sliders, persist volumes in save data
  - Music: class-specific tracks, menu music, fix autoplay via user gesture
  - Combat text: shows keyword-appropriate colors/icons, positioned between characters, lasts longer
  - End Run + defeat screen: end run from battle, defeat overlay with auto-return to menu, Resume Run on menu
  - Codebase cleanup: removed 112 lines of dead sound functions, 8 unused files/folders (tooltip, entities/cards, shared/*), standardized shimmer via useShimmerController hook, unified keyword display with KeywordTag component, fixed tilt effect on character select
- Feat: Add 7 new enemies and stat scaling system
  - Add 7 new enemies to bestiary: Goblin, Imp, Lizard Scout, Mimic, Mud Elemental, Necromancer, Plague Doctor
  - Add battle count tracking (battlesWon) in run state
  - Add enemy health scaling: +2 HP per battle won (capped at +20)
  - Update asset optimizer script with new enemy assets
  - Reset battlesWon on new run
- Fix: Handle duplicate cards in hand properly with unique refs
  - Use card.id-index as key for handCardRefs instead of just card.id
  - Update animateRemainingHandDiscard to use the same key format
  - Fix commented-out draw animation code with correct key format
  - Add e2e test for multiple copies of same card hover and play
- Feat: Add enemy death animation before victory screen
- Fix: Play sound only once based on combat result
- Fix: Remove duplicate sound triggers and hover sounds
- Refactor: Clean up legacy code and add keyword-based sound system
  - Remove legacy battle/ features folder (HandFan, BattleScreen, etc.)
  - Remove unused app providers and router
  - Remove unused UI components (badge, card, hover-card, input, select, slider, tabs)
  - Remove unused shared content files and hooks
  - Remove unused feature folders (bestiary, campfire, character-select, collection, destination, main-menu, merchant-shop, mystery, options, run-end, talents, test-lab)
  - Create src/lib/audio.ts with Web Audio API sound system
  - Create src/shared/hooks/use-sound.ts hook
  - Add keyword-based sound system with 10 variants per category (damage, beneficial, ui)
  - Simplify to 3 categories: Damage (physical sounds), Beneficial (heal sounds), UI
  - Integrate sounds into battle controller and Options screen testing UI
  - Fix card draw animation by removing AnimatePresence
  - Fix duplicate card issues using array index instead of card.id
- Fix: Build game before deploying
- Merge branch 'main' of https://github.com/Talyen/Alchemy
- Trigger GitHub Actions deployment
- Add GitHub Actions workflow for GitHub Pages deployment
  This workflow automates the deployment of static content to GitHub Pages upon pushes to the main branch or manual triggers.
- Fix: Override base path in GitHub Actions build
- Restore missing index.html
- Merge branch 'main' of https://github.com/Talyen/Alchemy
- Add GitHub Actions deployment workflow
- Fix GitHub Pages deployment and base path
- Fix base path for GitHub Pages
- Add dist folder for GitHub Pages
- Resize destination buttons, change campfire to green, remove hover line feature
## [0.1.0] (2026-06-11)

### Features

- Initial Steam release preparation pipeline with agent-enforced ship gates.
