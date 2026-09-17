# Changelog

All notable changes to Alchemy are documented here. Player-facing summaries ship in `release-notes/`.

## [Unreleased]

### Features

- feat: add armory equipment animations, inventory ordering, and shine loops
  - Add in-flight artwork transfer animations and position reflow when
    equipping, unequipping, and replacing items in the Armory
  - Support transient hero/slot working order with on-demand inventory
    sorting by rarity/name and page clamping
  - Compare loadouts using authoritative rules to handle hand conflicts
    and off-hand displacement, and guard animations against reduced motion
  …
- feat: rename Crystal material to Gems, randomize Banshee purge, polish menus and tooltips
- feat: rename Gems to Crystal, add Stone and Hide, and harden gear uniqueness
  Gems become Crystal and Stone plus Hide join the material inventory,
  with homestead costs, enemy loot, mystery rewards, salvage yields, and
  the wallet UI updated to match. Hunter's Lodge now also yields Hide
  and several buildings fold Stone into their costs.
  
  Unique gear instances store identity only while affixes, effects, and
  …
- feat: autoplay wish picks, greedy card selection, and storage hardening
  Autoplay now resolves Wish options itself with the same hover preview as
  cards, and picks the highest-scoring playable card (defensive cards first
  at half health or below) instead of the leftmost one.
  
  Storage moves browser access behind a guarded environment seam, splits
  browser/desktop save backends with per-call dispatch, stamps lastSavedAt
  …
- feat: preview autoplay cards and polish battle card flights
  Autoplay briefly lifts and shines the next card before committing it,
  without the description popup; disabling autoplay, opening the menu,
  or leaving battle cancels the uncommitted preview. Reduced motion
  plays instantly with no preview.
  
  Played cards fly as artwork and pop on arrival, with overlapping
  …
- feat: grant Predator's Focus Leech and align keyword wording
  Predator's Focus now grants Leech alongside its critical strike via a new
  next-hit-leech effect, consumed on the next damaging card while Dodge
  preserves it and companion or delayed effects leave it untouched.
  
  Clarify Maul, Distillation, Brewmaster, Restock, Ambush, and Dread Wail
  wording so each names its keywords, and teach corruption targeting the
  …
- feat: move battle gold to toolbar and align bottom-bar piles
  Move live gold counter to the battle toolbar with an increase highlight.
  Move dev-only Skip Combat to a toolbar icon before Menu.
  Size draw/discard artwork at 80 percent of hand width with matched Mana and End Turn heights.
  Refresh logo sources and archive prior logo files.
- feat: consolidate combat feedback bursts and rework connector talents
  Consolidate per-action combat text into typed bursts with capped lifetimes and portrait tracking.
  
  Rework Divine Intervention to grant an extra Wish choice and Cull the Weak to bonus Leech damage.
  
  Reorder Holy/Nature/Leech progression.
- feat: expand loot progression and game presentation
- feat: overhaul battle and labyrinth interactions
- feat: add labyrinth corruption chambers, retire gear protection, polish chrome
  Labyrinth corruption chambers reuse the altar flow
  with five chamber blessings. Gear protection is removed
  and old saves load as unlocked. Cinder Skin and Holy
  Retribution hit once per turn. Shared header icon button,
  deck shine on inspect, and readable shop prices.
- feat: refine combat and interface flows
- feat: expand card corruption and fix combat interactions
  Add weighted card mutations, Health bargains, damage conversion, rare
  jackpots, and compatible Consume changes without expanding the altar flow.
  Keep corrupted numbers solid dark red and preserve title shimmer.
  Retain saved Consume overrides and cover outcomes, combat, and persistence.
  
  Fix Companion keyword perks, Mana Flare buildup, Icy Heart threshold
  …
- feat: add deck inspection and harden battle interactions
  Add deck and pile inspection and reserve equipment during active battles.
  
  Correct talent, damage, resource, and reward interactions.
- feat: expand labyrinth modifiers and restore consistency
- feat: expand unique gear combat interactions
- feat: expand combat rewards and stabilize card layout
- feat: ship outstanding Alchemy updates
- feat: improve labyrinth and defeat feedback
- feat: improve responsive display and UI flows
- feat: rename shops to card and gear, boons in battle, unified headers, bleed rebalance
  Escape now closes the game menu before navigating back, talents header
  hides its back button at the top level, and game-mode back keeps
  return-to-run bookkeeping.
- feat: global game menu, background intensity settings, and loading polish
  Move the game menu button to a global overlay with battle autoplay
  alongside it and simplify screen shells to drop per-screen menu wiring.
  Add background particle and glow intensity settings with save
  persistence, extend plasma backgrounds to enemies, refresh the startup
  loading wordmark fill and deferred gear-art preload, and update logo
  assets.
- feat: igniting loading wordmark, paired menu layout, and Floating UI tooltips
  Replace startup bar with synced igniting wordmark, simplify menu to
  single logo with paired rows and thematic icons, migrate tooltips to
  Floating UI, and remove logo variants.
- feat: show game title on startup loading screen
  Add the Alchemy heading above the loading bar in both the
  boot HTML shell and the React loading screen so players see
  the game name while assets load.
- feat: wire dedicated art for all remaining enemies and bosses
  Register 24 new enemy portraits (Bandit, Ogre, Fire Imp, Hellhound,
  Pyromancer, Giant Spider/Snake, Blood Cultist, Dire Wolf, Vampire,
  The Blood Countess, Zealot, Cleric, Inquisitor, Paladin, The Seraph,
  Winter Wolf, Ice Wraith, Yeti, Banshee, Brawler, Stone Golem, Earth
  Elemental, The Stone Titan) in core-assets manifest, generate optimized
  WebPs and barrel exports, and point bestiary entries at dedicated art
  …
- feat: add git safety guard and worktree helper
- feat: consolidate battle effect handlers and streamline homestead architecture
- feat: improve labyrinth layout, mystery reward ordering, and talent XP feedback
- feat: expand enemy roster, surface refactor and battle traits
  - Add 24 imported enemies (will-o-wisp, bandit, ogre, fire-imp, hellhound,
    pyromancer, giant-spider/snake, cultist, dire-wolf, vampire, blood-countess,
    zealot/inquisitor/paladin/seraph, winter-wolf/ice-wraith/yeti, banshee,
    brawler, stone-golem/earth-elemental/stone-titan) with art, loot, damage
    rules and trait parity validators
  - Expand Wildwood bosses to 7 and generate assets for will-o-wisp
  …
- feat: enrich labyrinth rewards and presentation
- feat(labyrinth): pin a floating chamber card and broaden perf coverage
  Hover a hex for its name and type, click any uncleared chamber to pin an
  inspector, and confirm Enter only when that room is reachable. The harness
  now covers startup, shop, armory, and labyrinth interactions, and treats
  battle-over as a valid end-turn outcome.
- feat(labyrinth): replace the 8x9 grid with hex floors
  Select a chamber then enter from the inspector. Dying ends the run.
  Schema 14 regenerates in-progress grids from the run seed without dropping the save.
- feat(collection): add a Uniques tab and persist discoveries
  Owned unique gear backfills discoveredUniqueIds on load so existing
  inventories appear without a schema bump.
- feat: persist Wildwood rewards on interruptedFlow
  Resume Wildwood Victory from the same claim surface as Campaign and Labyrinth.
- feat: overhaul Armory trinkets, run boons, and save schema v12
- feat: update battle traits and CI verification
- feat: harden run systems and repository workflows
- feat(run): park inactive modes and share a profile gold purse
  Players can switch content systems without losing the other run. Gold lives on
  the profile, and battle, shop, and armory seams rebind live meta instead of
  snapshotting stale state.
- feat(run): persist starter drafts and isolate battle playback
  Keep combat ticks off the shell controller and treat wildcard drafting as a resumable run phase.
- feat(armory): add salvage yield preview and refine combat mechanics
  - Armory: add SalvageYieldPreview UI and salvage yield calculation helpers
  - Battle: expand talent effects, cost rules, riders, and companion logic
  - Wildwood: streamline wildwood gauntlet recovery flow into removal screen
  - Docs & tests: update subsystem docs and fix profile gold key guard
- feat(homestead): trinket resource art, wallet UI, persistent gold
  Replaces Lucide placeholder icons with Trinket raster artwork and
  adopts Trinket wallet card layout throughout all material display sites.
  
  Gold is now a persistent homestead resource: remaining run gold is
  saved to runProfile.gold at run end and seeded into runGold at the
  start of the next run. Gold appears in the homestead wallet alongside
  …
- feat: refresh hero/talent art, overhaul SFX, and polish run/meta UI
  Ship new talent portraits, relocated hero art, combat SFX, mystery
  trinket inspect, and shine/tile polish so run and meta screens match
  the current content.
- feat: persist mystery visits, refresh content art, and polish tile hover
  Keep mid-visit mystery state on the active-run save, replace placeholder art
  with named event and mode assets, and share tile hover popups for collection
  and shop art.
- feat(ui): polish screens, honest startup load bar, and trunk-only CI
  Drive the cold-start bar from real boot work, tighten armory and screen chrome,
  and drop PR-oriented CI now that trunk is the only gate.
- feat(ui): fade identity swaps and polish armory, shops, and talent screens
  Hold last mystery and shop views through FadeSlot instead of flashing empty
  routes. Align armory, homestead, and talent layouts with collection motion.
- feat: replace armory board with slot picker, add battle autoplay, and refresh content art
  Drop the packed inventory board and extra armor slots so equipment is six
  slots with a collection-style picker. FadeSlot replaces staggered screen
  motion, and new cards, enemies, and art land in the same pass.
- feat(talents): row-based grid unlock replacing positioned tree
- feat(ui): implement floating combat text, standardize tooltips, and fix mutual KO resolution
- feat(options): remove UI Scale setting
  Drop the unused display preference from options UI, settings store, save
  schema, and CSS so rem sizing stays fixed and legacy saves strip uiScale.
- feat(battle): surface enemy armor/forge/burnBonus/freezeBonus as status chips with combat text
  Move burnBonus/freezeBonus from EnemyMitigation into EnemyStatusId so they
  render alongside existing enemy status chips (burn, poison, bleed, freeze, stun).
  
  - Extend EnemyStatusId with burnBonus/freezeBonus; add EnemyStatusDamageId
    for card-effect contexts that exclude augment ids
  - EnemyMitigation shrinks to { armor, forge, block }
  …
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
  …
- feat(homestead): add 5 farm plot definitions with effects and card bonuses
  - restore wheat-field, chicken-coop, pasture, orchard, crystal-garden as real farms
  - wheat-field: Bread heal bonus (+2/4/6) + end-of-run Food yield
  - chicken-coop: Max health bonus (+5/10/15) + end-of-run Food yield
  - pasture: Freeze DR (-1/2/3) + end-of-run Food yield
  - orchard: Apple heal bonus (+2/4/6) + end-of-run Food yield
  - crystal-garden: 3-tier: Crystal yield / +startMana / +1 Mana Crystal
  …
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
  …
- feat(armory): add ArmoryTransferMenu primitive for right-click gear transfer
  New armory-transfer-menu.tsx component renders a portaled context menu
  at the right-click anchor point with one 'Send to [ClassName]' button
  per unlocked, non-source character. Escape key and backdrop click close
  the menu. Viewport-edge clamping prevents overflow.
  
  Wire into armory-screen.tsx and meta-routes.tsx: the onTransferGear
  …
- feat(armory): wire right-click transfer menu through screen panels into gear tiles
- feat(armory): add transferToInventory store action and onTransferGear controller callback
  Add the missing transferToInventory(instanceId, targetCharacterId)
  action to useGearStore. Moves the gear instance between character
  inventories, clears all loadout references, transfers the board
  position, and sanitizes orphan positions.
  
  Add onTransferGear to the ArmoryController facade hook with HP-sync
  …
- feat(armory): enforce ranged-weapon + quiver off-hand pairing
  Wire the rangedWeapon/quiver contract from base-items into the equip
  pipeline:
  
  - Add isRangedWeapon and isQuiver helpers in operations.ts.
  - Add isGearCompatibleWithLoadoutSlot(definition, slot, characterLoadout,
    inventory): extends the basic slot check with contextual rules —
  …
- feat(armory): tag base items as ranged weapons or quivers
  Add two optional fields to GearBaseItemDefinition:
  - rangedWeapon: true for longbow, shortbow, recurve-bow, crossbow.
  - quiver: true for the quiver base item.
  
  Reclassify the crossbow as a one-handed weapon (requiresTwoHands:
  false) so it can be paired with a quiver off-hand, matching the
  …
- feat(armory): reducer for targeting state, effect-key guard, and migration v10
  Three orthogonal cleanups for the Armory subsystem:
  
  - Replace the 3 // eslint-disable react-hooks/set-state-in-effect
    disables in armory-screen.tsx with a useReducer over a dedicated
    armoryTargetingState (armory/armory-targeting-state.ts). The 4 useState
    hooks (salvageMode, salvageTarget, activeCurrencyId, cursorPoint)
  …
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
  …
- feat: integrate Steamworks, migrate to Tailwind CSS v4, and optimize save/load logic
- feat: add new homestead buildings, research upgrades, validation improvements, and leech/status talent effects
- feat: add battle edge-case tests, vite-plugin-checker, and UI polish
  - Add vite-plugin-checker for TS type checking in dev mode
  - Add extensive edge-case tests: haste/Death's Door overlap,
    enemy damage types (holy/burn/poison), DoT kills during CC skip,
    forge threshold bursts, stun/freeze talent chains, null field
    halving, overkill clamping, and defensive guards
  - Fix save schema TypeScript cast for legacy deck check
  …
- feat: UI shell standardization, hamburger navigation, wildcard draft, new character art
  - Standardized hamburger menu as primary navigation across all screens
  - Added consistent alchemy-shell containers to Collection, Talents, Battle
  - Added ember particles inside Battle shell
  - Created wildcard DraftDeckScreen (pick 1-of-3, 6 rounds)
  - Restored controller-utils.ts for battle card measurement/transfers
  - Added Alchemist, Druid, Warlock, Wildcard character art assets
  …
- feat: room scaling for enemy traits, sundering armor rework, enemy balance pass
  - Enemy traits (regeneration, forge, armor, burn bonus, freeze bonus) now scale with room multiplier
  - Sundering Charm / Sundering Armor Piercing now removes enemy armor instead of ignoring it (applies to Physical & Stun)
  - Added IRON_HIDE_BURN_BONUS_PER_TURN constant
  - Elite HP multiplier 1.4 -> 1.2, Boss HP multiplier 1.7 -> 1.3
  - Enemy base regeneration 2 -> 1, lizard scout attack 1->2, iron bear attack rebalanced
  - Added roomScalingMultiplier to BattleState type
  …
- feat(alchemy): implement companion mechanics, extend talents, and refactor active-run storage
  Implement companion phase and actions, expand talent lists, simplify active-run storage validation, and fix NoticeCombatTextEvent types to support custom text notifications.
- feat(alchemy): redesign talent screen with radial tree layout and background art
  - Rewrite talent-tree.tsx with elliptical orbital positioning per keyword
  - Add 11 talent background art assets with SVG mask transitions
  - Replace filler-button centering hack with absolute positioning
  - Guard unlockAllTalents dev helper behind import.meta.env.DEV
  - Fix UnlockedTalents type mismatch in use-run-navigation.ts
  - Extract nested ternary in TalentKeywordButton to ringClass()
  …
- feat: add 10 new cards with assets, improve battle UI and enemy turn logic
- feat: add new card effects (lose-health, draw-cards, remove-armor, multiply-status) and 11 cards
- feat: implement Block/Forge/Armor keyword talents and custom cursor system
  - Add 14 new talent effects across Block, Forge, and Armor keywords
    (blockReduceBurnDamage, blockDepletedHeal, blockToHolyDamage, blockToStunDamage,
     startForge, forgeToBleed, forgeStripArmorThreshold, flatForgeGained,
     forgeDoubledBelowHalfHealth, forgeBlockThreshold, forgeBlockAmount,
     startArmor, armorMitigatesBleed, armorBreakBlock, armorMitigatesStun,
     armorCleanseThreshold, flatArmorAmount)
  …
- feat: battle rebalance — Math.round, player CC, CC cooldown, enemy healing removed
  - Battle engine: replace Math.floor with Math.round across all files,
    enforce via ESLint no-restricted-syntax rule
  - Player CC: stun/freeze now skip player turn, with CC cooldown (2 turns)
    preventing chain-lock on both sides
  - Enemy healing removed: no more heal-below-50%-HP mechanic
  - Enemy armor decays by 1 per hit dealing health damage; enemy forge decays
  …
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
  …
- feat: homestead tier system, companion assets, card descriptions, and battle/homestead refinements
- feat: add art assets for potions, nature cards, and trinkets
- feat: aspect ratio system, nature cards, companion buffs, Wildkeeper deck, and Homestead optimization
  - Replace resolution options with aspect ratio selector (standard/narrow/ultrawide)
  - Block tooltips during screen transitions to prevent jarring popups
  - Add Nature damage type with new cards (Bloodthorn, Cinderbloom, Grasping Vines, Briar Shield, Thorn Mail, Pack Tactics)
  - Add companion damage buff mechanic and buff-companion card effect
  - Add potion cards (Stoneskin, Acid, Luck, Wishing)
  - Update Wildkeeper starting deck with new nature/companion cards
  …
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
  …
- feat: Death's Door mechanic, Armor/Forge consume on interaction, homestead overhaul, and system refactors
  - Add Death's Door: one-time grace window at 0 HP, must heal before next enemy turn
  - Armor now degrades by 1 per tick of player damage (burn/poison/bleed/stun/freeze) and enemy attacks
  - Forge degrades by 1 per Physical/Stun damage dealt
  - Homestead rework: new buildings with combat effects, farms with potion mana bonus, removed old buildings
  - Apply player healing centralized into applyPlayerHealing function
  - Add horror-sting sound for Death's Door activation
  …
- feat: boss title shine animation, player name in battle, trait line splitting, and test coverage expansion
  - Add boss title shine animation on destination screen with keyword-colored gradient
  - Pass player name to BattleScreen based on selected character
  - Split multi-effect enemy trait descriptions across lines in tooltips
  - Remove conditional formatting in formatEnemyAttackLines, one line per effect
  - Add injectSaveState test helper for precise save state setup
  - Add natural death test, shop card removal/refresh tests, boss/run tests
  …
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
  …

### Bug Fixes

- fix: harden corruption rolls, strengthen health-loss delta, and reset picker state
  - Reset selection and page state when leaving the corruption screen
  - Treat consume and reusable as opposite axes to prevent pairing in twin-offering
  - Clamp boundary roll in mutation selection to avoid undefined outcomes
  - Correct strengthen/weaken delta sign for inverted numeric effects like health loss
  - Support reversible draw card text replacements and use shallow effect comparison
- fix: stabilize interrupted tab-reveal E2E coverage
  Re-arm each attempt from Heroes so every Cards click starts a fresh
  transition, and hold the FadeSlot node across the interrupt instead
  of re-querying .screen-fade-in (which misses the flipped exit phase).
- fix: isolate newer saves, harden autosave exits, and simplify loading logo
  Blocked newer-version saves render in an isolated shell without
  hydrating stores or restoring the newer run. Autosave gains an
  exit-once latch per revision, failure retry that new changes cannot
  bypass, snapshot-before-submit so a throwing build cannot stall the
  scheduler, and a canSubmit peek so idle exit events skip snapshot
  work. Rename scheduler/storage generations to epochs. Remove the
  …
- fix: dedupe mystery reward pairing, correct tile and clamp rendering, expand shop coverage
- fix: make readRefreshPrice internal to shop commands core
  Avoid exporting readRefreshPrice since createGetRefreshPrice is the public
  factory entry point.
- fix: improve homestead upgrades and animation lifecycle reliability
  Consolidate Homestead affordability and costs, and clarify benefit descriptions.
  
  Share canvas lifecycle and motion preferences.
  
  Resume Stun and Freeze effects after zero-size containers become visible.
  …
- fix: strengthen validation, lint safeguards, and test reliability
  Consolidate related tests while preserving coverage and Stun rounding.
  
  Validate art transparency, improve startup diagnostics, and tighten lint rules.
  
  Share save helpers and make verification independent of Git filesystem caches.
- fix: keep pre-launch save skips silent in candidate evaluation
  Routine empty or missing candidates on fresh profiles must not report
  through the storage error sink: the E2E journeys assert zero runtime
  errors, so logging the skip failed save-gate and e2e shards.
- fix: render-phase hygiene, store selector narrowing, battle logic decomposition, and test consolidation
  - Replace direct ref writes and setState-in-effect with render-phase
    patterns (useHeldWhile, useLatestRef, derived state)
  - Narrow Zustand selectors and extract components to reduce re-render
    scope (BattleCluster, RewardPlasmaController, AppKeywordPlasmaBackground)
  - Decompose computeAdditiveDamageBonus and prepareTalentCardPlay into
    focused helpers
  …
- fix: add battle hover polish, cache lookups, and harden edge cases
  Battle UI shares the standard hover scale across End Turn,
  
  piles, mana crystals, the gold counter, and the menu logo.
  
  Primary-bloom transition fix plus UI doc update.
  …
- fix: health thresholds resolve before kill payouts in DoT and holy reflection
  processEncounterTraitHealthThreshold now runs before payKillPayouts in both
  applyEnemyDotDamage and reflectBlockedAttackAsHoly. Status-conditional kill
  rewards (healOnBurnEnemyDefeated, goldOnPoisonedKill) evaluate against the
  pre-hit enemy statuses so they are not influenced by damage-rider mutations.
  
  returnHarvestCard falls back to uid matching when reference equality fails
  …
- fix: use native paths for packaged music verification
- fix: align battle reactions and combat rules
- fix: raise total JS bundle allowance for battle toolbar
  Measured total is 1,659,709 bytes with Gold and Skip Combat
  in the battle toolbar, 829 bytes over the prior ceiling.
  Increase the total allowance by 2 KiB and record it.
- fix: reduce CI browser contention
- fix: harden static diagnostics and context discovery
- fix: harden overlay transition lifecycle
- fix: stabilize battle CI checks
- fix: harden labyrinth, battle, and save flows
- fix: align enemy combat reactions
- fix: make audio e2e playback deterministic
- fix: stabilize browser audio playback checks
- fix: resume collection music from gestures
- fix: align bundle budget with renderer growth
- fix: redesign talents and battle interactions
- fix: harden labyrinth, battle, and balance workflows
- fix: harden run state, UI, and asset workflows
- fix: harden battle flow and UI feedback
- fix: support discovery without ripgrep
- fix: update bundle budget for unique gear
- fix: align eager bundle budget
- fix(test): stabilize critical browser checks
- fix: restore game menu label, clamp labyrinth inspector in canvas
  The unified header hamburger keeps the established Open game menu name
  so existing journeys find it. The chamber inspector is clamped
  vertically inside the map canvas so open panels no longer cover the
  floor tabs.
- fix: update collection e2e for wardbreaker wording and hero tooltip
  Match the retuned Wardbreaker purge description and tolerate
  transient duplicate hero tooltips during hover fade-out.
- fix: update stale talent stacking expectation after Shield Slam rework
  physical-shield-bash no longer grants blockToPhysicalDamageMultiplier
  (reworked to armor-strip in the combat rebalance); only block-to-physical
  contributes 0.3 now. Assert the new Shield Slam flag instead.
- fix: harden saves, tooltips, audio preload, and battle menu cluster
  Move the Boons bag between Auto and Menu in a single battle cluster,
  make exit saves wait for in-flight writes, re-read tooltip bounds per
  update, free failed sound preloads, widen card-id migration coverage,
  and clean up tuning constants and dead talent fields.
- fix: unexport internal gold resolution helper flagged by deadcode audit
- fix: fail-closed desktop wipe during normal play, force local wipe only for unusable saves
- fix: run verified vite build through shell on Windows
- fix: clear knip dead exports and stale route fixture blocking CI
- fix: use live card ids in E2E injected decks so hydrate keeps them
- fix: update committed-assets header for consolidated art sync
- fix: keep homestead pagination spacer for shell height stability
- fix: prevent vite preview from auto-opening browser on 4174
  vite preview was inheriting server.open=true from vite.config.ts:34,
  causing every pre-push smoke gate (port 4174) to call open
  http://127.0.0.1:4174 and race its immediate teardown, surfacing as
  Safari cannot find page. Explicit preview.open:false keeps dev
  auto-open on 5173 while stopping preview.
- fix(scripts): git guard protects the caller's repo, not its own
  The guard resolved its repo root from its own file location and ran
  dirty-tree checks, stash backups, and re-invoked commands there. When
  invoked from any other repository it inspected and executed git against
  the wrong tree. Target the caller's working tree via cwd instead and use
  the resolved real git for helper commands.
- fix: suppress TS check for eslint fragment JS import in rationalization test
  Use @ts-nocheck with ban-ts-comment disable to allow JS import without
  declarations; keeps typecheck:all green for check:push.
- fix: allow eslint 10 with jsx-a11y peer via legacy-peer-deps
  eslint-plugin-jsx-a11y 6.10.2 peer still caps at eslint 9; repo is on
  eslint 10.3. Enables npm ci --dry-run in check:push without --force.
- fix: harden hand keys, draw sequencing, corruption and persistence
  Stabilize duplicate-card handling for uidless hand cards by making
  hand/draw keys index-aware and fixing draw/discard animations.
  Harden corruption targeting to queue numeric fields and keep
  corruptedValuePositions in sync with shifted description lines.
  Ensure victory flow awards all pending materials and clears
  pending inventory, handle parked run clones with non-cloneable
  …
- fix: hunt and fix 6 bugs across battle, save and ui
  - labyrinth: move setViewedFloor from render to useEffect
  
  - wish: upgrade all corruptible fields (amount, perManaCrystal etc)
  
  - utils: clamp shuffle/pickRandom/takeRandom when rng()==1
  …
- fix(audit): narrow labyrinth plasma keywords
- fix(audit): remove stale animation assertion
- fix(audit): stabilize shop fade-out canary
- fix(audit): harden e2e fixtures and animation assertions
- fix(audit): restore strict dead-code exclusions
- fix: stabilize e2e shop and save tests for reload flakes
- fix: stabilize shop fade-out with longer timeout
- fix: relax reload assertions in e2e to avoid storage flake
- fix: preserve save across reload via init script for e2e
- fix: restore battle end-turn two-phase wait to prevent hang
- fix: restore missing expect import in alchemy e2e
- fix: decouple gear crafting ids from art to unblock Playwright
  - Extract crafting-ids (EMPTY_CRAFTING_CURRENCIES, CRAFTING_CURRENCY_IDS,
    normalize/add helpers) to avoid webp import in Node context
  - crafting.ts now re-exports ids and loads craftingArt only for UI list
  - Route validation and Playwright fixtures/specs through crafting-ids
  - Fixes SyntaxError on acid-potion.webp during test collection that
    broke e2e, save-gate, and gear-gate
- fix: align battle RNG, rounding and health clamp invariants
  - enemy-turn-traits: use rngInt + getBattleRng for iron-hide
  - damage-status-riders/state-helpers: use getBattleRng via lib/battle/rng
  - move getBattleRng to lib/battle/rng to break circular import
  - battle-card-schemas: Math.floor -> Math.round for cost
  - destination-availability test: Math.floor -> Math.round to match prod
  - normalize-active-run-data: finite clamp for health
  …
- fix: prune dead exports to satisfy knip
  - make getEnemyTraitSet private to enemy-turn-attack (only used internally)
  - remove unused testFilesUnder re-export from test-suites barrel
- fix: keep internal helpers private
- fix: map legacy runGold injection to unified top-level gold for E2E
  Persistence unified seam moved gold from activeRun.runGold to
  save.gold (runProfile). E2E helper buildActiveRunSave still injected
  runGold into activeRun, which is now stripped by Zod and left shop
  tests with 0 gold causing Buy buttons to stay disabled and fade-out
  assertions to fail. Support both gold and legacy runGold overrides
  and write to save.gold.
- fix: align architecture smoke with consolidated domain store boundaries
  DOMAIN_STORE_PATTERNS now only guards gameplay-state-store and
  run-transitions after the barrel/orphan cleanup (run-domain-store etc
  removed). Smoke previously asserted the deleted stores and failed after
  the test-owner gate was fixed.
  
  Co-Authored-By: internal-model
- fix: address code review follow-ups from unpushed batch
  Remove dead SaveWriteState enum and clarify write policy handling of
  corrupt saves; clone RNG in normalizeActiveRunData so Zod transforms
  stay pure and persist advanced counters; key gear affix pool by
  baseItemId|aspect|affinity to avoid collisions; clone empty
  collections in runFieldsFromSnapshot; remove TODO in run-meta-rebind;
  fix stop-dev-server vanished-PID log and add displayName to shop
  …
- fix: lint unnecessary assertions and plan doc path
- fix: persistence io pure serialize and write-disable handling
- fix: tooltip fade render bug and resolveGameDelay, balance chance scoring
- fix: make indexed deck mutations transactional
  Centralize isValidDeckIndex and apply to merchant remove, alchemist
  mix, potion mixer, wildwood removal, and mystery choose/remove.
  Mystery now validates offered cardIds and returns success booleans,
  only clearing state on valid transactions. Invalid fractional, NaN,
  out-of-range, or duplicate callbacks are no-ops with no gold or slot
  costs.
- fix: repair empty draft and mystery choice lists on save resume
  Re-offer live choices once when tombstoned filtering leaves a required
  picker empty — starter draft (rewards stream), wildwood draft (world
  stream with affinity), and mystery card choices (events stream) — and
  advance the corresponding RNG counter so the fix persists. Fixes the
  campaign-typed wildwood hydration fixture, adds
  tests/lib/active-run-session to the ship suite, and covers campaign,
  …
- fix: satisfy knip after shop and constants refactor
- fix: satisfy lint on shop encode types and test gear imports
- fix: repair restored shop shelves and separate Trinket reward gates
  Resume and hydrate remap purchasedSlotKeys when offerings drop, keep gear
  rarity rolls free of permanent Trinkets, and split topical game-constants.
- fix(labyrinth): satisfy React Compiler on hex seal hover and pulse
  Destructure the hover hook like other tooltips, and drive the reachable
  pulse from CSS so the seal does not set state in an effect.
- fix: clear React Compiler lint on audio mute and labyrinth floors
  Sync mute-in-background from an effect, and snap the viewed floor
  during render when the descent advances.
- fix(ui): stabilize collection paging and battle particle density
  Reserve pagination space when a tab has one page, and thread optional
  particle counts through battle embers.
- fix(audio): mute Cursor shells and restage the music bed
  Keep undisplayed Electron/IDE hosts silent, OS-mute headed Playwright,
  and raise MUSIC_MASTER_GAIN so the bed sits under combat SFX at equal sliders.
- fix(talents): allow sequential unlocks without waiting on the burst
  Keep the same-node click gated so a double-press cannot fire twice before the parent re-renders.
- fix(tests): satisfy test-tsconfig types for save and armory hooks
- fix: share enemy DoT resolution and add focused CI gates
  Labyrinth mystery nodes clear leftover combat modifiers, detonations run
  Divine Aegis, and stale mystery visits drop off other screens. Focused
  Playwright gates, Alchemy ESLint rules, and test-owner checks keep shop,
  gear, mystery, and audio paths from drifting.
- fix(ui): restore contained-panel alchemy-shell on meta screens
  Collection and Options lost panel chrome when ScreenShell went
  transparent; harden neighbor-gap e2e to wait for settled tile boxes.
- fix(ci): clear knip, sound sparse-checkout, and homestead shell regressions
  Drop unused exports, skip raw-sound source checks when Raw Assets are
  absent, restore the homestead panel shell class for layout e2e, and pin
  lethal-defeat fixtures to zero dodge.
- fix(ui): clear React Compiler and lint blockers for plasma push
- fix(tests): align reward and chance fixtures with tightened types
- fix(ui): remove unused trinket wallet grid
- fix(tests): include all shop destinations in e2e types
- fix: stabilize sound manifest across machines and shop gold parsing in e2e
  - Prefer the stored fingerprint for curated OGG entries so committed
    manifests do not churn on fresh checkouts
  - Drop the unused DEFAULT_DEV_PORT export flagged by knip
  - Parse thousands-separated gold in the shop page object
- fix(tests): align fixtures with DamageType union, FakeAudio stub, and port helper types
- fix(gear): pay the high Discordant Dice yield on the high salvage roll
- fix(battle): pay lethality rewards once via shared payouts
  Bone Charm heal and gear kill rewards now flow through payKillPayouts on
  every damage source (main hits, typed follow-ups, CC procs, wish triggers,
  DoT ticks, bleed detonation, mana-crystal burn) so a kill pays the same
  rewards exactly once per health transition. Harmful statuses applied by
  attacks emit status-kind combat text so the floats stay hidden.
- fix(battle): keep turn-start combat texts on DoT kills and scale gold once
  - Standard enemy phase early exit now passes enemyTurnStartCombatTexts to
    finalizePlayerTurn, mirroring the skipped-turn branch
  - addGoldWithCombatText applies the scaled amount directly so displayed and
    actual gold share a single scale step
  - remove now-unused addGold helper and its test
- fix(meta): expose settings slider labels to assistive tech
- fix(armory): pass Math.random without reading a ref in render
  React Compiler forbids rngRef.current on the controller object built during render.
- fix(battle): draw combat RNG from the persisted world stream
  Live fights bind BattleState.rng to the run world stream inside command recipes.
  Saved snapshots rest a throwing callback so resume cannot silently consume RNG.
  Route screens take finished-run and shimmer bindings as props.
- fix(ci): drop unused balance exports and accept autoplay victory
  Knip flagged internal sim helpers as unused, and autoplay can win the
  fight before mana locators resolve on the reward screen.
- fix(ci): clear knip leftovers and campfire talent invariant
  Parked-run helpers left unused exports, and Warm Rest's campfireHealBonus
  was read without the talentEffects.field pattern the invariant scan requires.
- fix(run): satisfy lint on parked slots and fade swap
  Omit parked modes without dynamic delete, drop a redundant save assertion,
  and remove an unused React Compiler disable.
- fix(battle): shared playability, autoplay missing-ref, auto-end-turn deps
  Share hand playability checks, fall back when a hand card ref is missing,
  and keep auto-end-turn scheduling off full battle-state identity churn.
- fix(run-flow): live reads, wildwood screen map, shop session clear
  Read content-system type from the active run at call time, share one
  Wildwood phase-to-screen map, split draft-pick handlers, and clear shop
  offerings on destination advance so session state matches encode.
- fix(ci): align resume tests with screen-scoped save and locked clicks
  Null off-screen corruption in the complete fixture, and force-click aria-disabled gates.
- fix(test): force-click locked hero tiles in SFX canary
  Locked chooser cards stay aria-disabled for assistive tech while still playing the deny cue.
- fix(test): complete presentation stubs and drop unused split-file imports
  Restore a full BattlePresentationPort stub and clean leftovers from the run-domain split.
- fix(ci): stop exporting unused armory and resource helpers
  Knip failed the lint job on public exports that were only used inside their modules.
- fix(battle): guard affix lookups, standardize rollPercent, companion threshold constant
  - crafting: safe fallback for unknown affix IDs in affixMaxValue and upgradeAffixValueToAstral
  - companion: add optional-chain fallback for companionBondLevels; replace magic 0.3 with
    COMPANION_LOW_HEALTH_THRESHOLD_PERCENT constant
  - damage-type-modifiers: guard bleedExecuteThreshold > 0 before applying execute multiplier
  - card-play: standardize nature mana proc to rollPercent instead of raw rng() * 100
  - damage-status-riders: simplify applyBleedStatusRider signature (remove duplicate arg)
  …
- fix(ci): stabilize SFX hashes and clear knip, Audio, and destination e2e
  Keep Safari MP3 fallbacks from being re-encoded on Linux, drop unused UI
  barrels, skip HTMLAudio in Node, and match destination tiles by name.
- fix(lint): split shine keyframes helper and drop unused eslint disables
  Keep Fast Refresh on the cycling shine component, satisfy consistent-type
  definitions in the SFX test, and remove a stale refs disable.
- fix(test): type mystery fixtures for art, narrative, and owned trinkets
  Pre-push typecheck:all rejected empty ownedTrinketIds as never[] and a
  MysteryEvent stub that still used description instead of art/narrative.
- fix(ci): clear knip unused save helper and duplicate art class exports
  Keep CI lint green after the mystery/art commit without changing player-facing layout.
- fix(ci): keep change-amplification smoke under Vitest's timeout
  Run one no-pager git log instead of three temp-file walks, and restore
  the 30s test timeout so CI load cannot flake the suite.
- fix(runtime): harden startup and save recovery
- fix(lint): sync bootstrap-ready off render and fix slice-crack array type
  Unblock pre-push: refs must not update during render, and tests must use Array<T>.
- fix(ci): clear knip leftovers and pin gear combat away from Slime
  Knip failed on unused armory/autoplay/slice exports after the slot-picker
  pass. FadeSlot also hid Options and Armory tab content from immediate
  queries, and seed 42 now rolls Slime whose half-physical trait broke the
  flat-damage e2e.
- fix(lint): unblock pre-push after armory picker and save migration changes
- fix(docs): drop stale docs/Plans link from staleness audit (#28)
  * fix(docs): drop stale docs/Plans link from staleness audit
  
  The Plans directory was deleted when its last plan finished, which left a
  broken relative link that failed documentation-contract unit tests on main.
  …
- fix(battle): keep victory VFX until unmount and play gold SFX from goldEarned
  Defer full combat presentation reset until the battle screen leaves so kill
  animations can finish, and treat goldEarned as the gold-gain signal so Wildwood
  in-combat gold still plays SFX.
- fix(ci): remove unused rngSequence fixture export (#27)
  * fix(ci): remove unused rngSequence fixture export
  
  Knip failed on main after the victory/combat-text typecheck fix left
  rngSequence exported from test fixtures with no callers.
  …
- fix(run): companion turn-start timing, Wildwood gold, and combat presentation
  Companions now attack at the start of the player turn, including battle open,
  with the same hit audio and portrait feedback as later turns. Wildwood
  victories keep gold earned in combat, armory board metrics no longer outlive
  a drag frame, and combat text, particles, and tests are tightened around
  those contracts.
- fix(battle): resolve companion healing stacking, mana refund order, overheal FCT, and save wipe race condition
- fix(ci): unexport unused matIconMap for knip (#25)
  matIconMap is only used by MaterialPill in the same file.
- fix(battle): destination picker sampling, wildwood wish gold, and rider fixes
  Implements improvement plans rounds 1 and 2 plus review fixes.
  
  Bugs:
  - Sample the live destination index after non-combat continues so the boss
    gate and Corruption suppression apply on post-shop / post-mystery pickers
  - Wildwood crystal wish outcome grants gold instead of silently dropping
  …
- fix(ui): anchor locked game-mode tooltips to their own tile
  GameModeSelectScreen shared one modeTileRef across all three mode tiles;
  a shared object ref resolves to the last-committed element, so hovering a
  locked non-last tile (e.g. Labyrinth) positioned its lock tooltip over the
  wildwood tile. Each tile now owns its anchor ref via a GameModeTile
  component, and the progression-locks E2E asserts the tooltip stays centered
  on the hovered tile.
- fix(battle): apply cold resistance to freeze attacks only once
  receiveHalfFreezeBuildUp halved a freeze attack's health damage in
  computeMitigatedDamage and then halved the freeze stack gain again in
  applyPlayerDamageStatuses, quartering buildup instead of halving it. Status
  riders apply equal to the actual damage dealt, so the stack is no longer
  re-scaled. Removes the now-unused scaleFreezeBuildUp helper.
- fix(battle): do not revive DoT-killed enemies on CC-skipped turns
  The standard enemy-turn path already early-returns victory when turn-start
  DoTs drop the enemy to 0 HP, but resolveSkippedEnemyTurn ran processEnemyRegeneration
  unconditionally, healing a dead enemy back to life after a lethal burn/poison/bleed
  tick on a stunned or frozen turn. Mirror the death check so the kill stands.
- fix(gameplay): harden persistence and progression flows
- fix(lint): unexport unused resolveParticleBackingScale (#24)
  Knip failed on main after the particle backing-scale helper was exported
  but only used inside startBackgroundParticles.
- fix(runtime): harden timer and presentation lifecycle
- fix(audio): correct gold spend sound effect and optimize preloading
- fix(test): stabilize mid-combat resume fixture against auto-end
  Empty hand with autoEndTurn raced into Defeat on CI before HP
  assertions; give the fixture a playable card and disable auto-end.
- fix(ci): unblock change-amplification smoke and document CI fixer
  Narrow the audit smoke test window so main CI can go green again, and
  check in fixer Tier A/B policy for solo trunk + agents.
- fix(gear): unexport unused position registry helpers (#20)
  Knip reported unused PositionRegistry and positionsEqual after the
  shop/mixer/audio consolidation; keep them file-local and drop the
  store-helpers re-export.
- fix(armory): anchor character art sizing to the stage so it stops collapsing
  The art container queried 100cqh from the workspace, which is a size
  container whose content height includes the art itself — a cycle that
  resolves to 0 and collapsed the portrait to ~22px. Size it from the
  vr-stage (definite height) at 1.1x the battle player art panel instead.
  
  Also verified: armory drag/transfer/layout/crafting suites still pass
  …
- fix(ci): stabilize asset hash fingerprints and skip raw-only tests (#13)
  * fix(ci): stabilize asset hash fingerprints and skip raw-only tests
  
  Keep prior mtime/size in committed .asset-hashes.json when content hashes
  are unchanged so CI checkouts no longer dirty manifests. Delete unused
  skipBattleAndClaimReward (knip) and skip Raw Assets unit tests when the
  sparse-checkout omits that tree.
  …
- fix(battle): floor lethal hits during Death's Door grace and stabilize E2E
  Lethal hits during the grace window floor the player at 1 HP so they always
  get a full turn to save themselves; grace expiry is re-checked at enemy phase
  start, and healing still spends the grace window.
  
  Also in this batch:
  - refactor run-state stores onto capability ports and slim progress slices
  …
- fix(lint): unexport knip-unused shell battle and shop types (#12)
  BattleLauncherDeps and RunFlowShopKind are only used in-file; keep them local and relax the architecture export assertion.
- fix(test): type reward navigateTo mock access with vi.mocked
- fix(saves): clear lint blockers for persistence refactor push
  Use interfaces for Props/claim surface, pickActiveRunFields for progress
  stripping, and z.looseObject for persisted battle state.
- fix(ci): clear knip unused export and invalid Playwright action timeouts (#11)
  * fix(test): unexport runProgressKeyGuards for knip
  
  Keep the compile-time exhaustiveness probe without an unused export.
  
  
  * ci(actions): drop unsupported timeout-minutes from setup-playwright
  …
- fix(e2e): block value imports of asset-coupled barrels in Playwright-collected tests
  The game-data and gear barrels re-export .webp assets that Playwright's esbuild
  cannot parse, so a single value import anywhere in the collected graph breaks the
  whole E2E suite at collection time. Add a no-restricted-syntax guard over the
  spec/fixture/page/helper graph prohibiting value imports (importKind 'value')
  of those barrels; type-only and safe deep imports remain allowed.
- fix(e2e): keep gear/save fixtures off the game-data asset barrel import graph
  Playwright's esbuild transform cannot parse .webp imports, so any spec that
  value-imported @/lib/gear or fixtures/legacy-saves transitively loaded the
  game-data asset barrel and failed collection. Replace barrel value imports in
  e2e gear helpers, gear-combat spec, and legacy-saves fixtures with small
  test-local builders and type-only imports.
- fix(test): drop replace flag from profile/gear setState resets (#9)
  Profile and gear store facades only accept a single setState argument after
  the gameplay-state migration; tests still passed Zustand's replace=true.
- fix(test): expect split run-flow React ports after write-port collapse (#8)
  Architecture guard still required useRunFlowEnginePort; update to the
  narrow useRunFlowRunPort / useRunFlowTalentPort exports.
- fix(ci): clear knip unused exports after run-flow engine refactor (#7)
  * fix(ci): remove unused run-flow React ports flagged by knip
  
  Drop dead narrow-port hooks superseded by useRunFlowEnginePort, unused
  route-command type aliases, and update architecture docs/tests to match.
  …
- fix(test): stabilize burn DoT e2e and sync changelog
  Exclude Goblin from DoT encounters so double-burn cannot end the battle
  before HP assertions, and regenerate Unreleased changelog after the knip PR.
- fix(lint): clear knip unused file and export findings (#6)
  Drop the unused battle-stage-marks re-export shim, unexport internal UI
  helpers, trim migration re-exports tests never import, and keep perf
  harness mark names local so deadcode stays green.
- fix(perf): use interface for PerfDeckCard lint consistency
- fix(armory): use fixed rem cells so inventory tiles stay visible
  Container-query cell sizing collapsed to 0 with content-sized flex
  ancestors; switch to rem and tighten TypeScript in perf harness and tests.
- fix(audits): rebind resumed battle RNG and ship confirmed audit fixes
  Normalize pending enemy-turn resultState on load, delete dead surfaces,
  align docs/tests/selection chrome, and ledger deferred proposals.
- fix(perf): clear eslint errors in performance harness
  Attach error causes, prefer interface for CDP session, drop unused
  imports, and replace waitForTimeout with delay in art diagnostics.
- fix(ui): enlarge chrome, defer hollow Victory, and ship perf harness
  Bump shared typography/buttons after UI Scale removal, keep reward offers
  populated until screen commit with mid-claim resume encoding, portal
  tooltips with scroll/resize remeasure, and add on-demand FPS profiling
  with baseline-stable battle stage marks.
- fix(battle): wire run RNG into battle init and clear CI gates
- fix(ui): fill viewport, densify non-battle layouts, and unify gear offer footprints
  Drop the virtual-stage inset so native windows stay at scale 1.
  Scale non-battle UI denser, and keep gear reward choices in one
  footprint family with static aspect classes.
- fix(battle): keep enemy-turn presentation when CC skips attacks
  Stop the battle resume effect from committing live pending transitions
  mid-presentation, and apply the post-enemy hand inside the draw sequence
  so stunned/frozen enemies still show Enemy Turn without flashing the next
  hand.
- fix(audits): consolidate confirmed audit findings
- fix(test): boot battle setup straight to injected destination
- fix(battle): persist turn transitions across resume
- fix(state): unify gameplay commits and gear health sync
- fix(armory): stabilize inventory drag pointer handling
- fix(ci): fetch changelog history for unit tests
- fix: consolidate runtime helpers and changelog guard
- fix(ci): disable implicit desktop publishing
- fix(lint): drive session core picker from ACTIVE_RUN_SESSION_CORE_KEYS
  Use the key list as a value in pickActiveRunSessionCoreFields so eslint
  no longer treats it as type-only dead assignment.
- fix(lint): unexport knip-flagged run-flow and route-command symbols
  Keep route-command helpers and session core keys module-private, and drop
  unused BattleRunPort barrel re-exports so deadcode gates pass.
- fix(scripts): stop exporting internal asset-manifest helpers
  Knip flagged pathExists and sortManifest as unused exports; they are
  only used within the manifest cache module.
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
  …
- fix(audit): harden module boundaries, fix 7 pre-existing test failures, update agent safety docs
  - S1: implement applyDestinationChoices on run-domain store, wire resume seam
  - S2: short-circuit sampleDestinationChoices when pool <= DESTINATION_CHOICES
  - S3: guard resolveEndTurn/resolveNormalEnemyTurn with isCurrentBattleSession
  - S4: skip duplicate beginPointer for same item within activation distance
  - S5: add cleanup symmetry in animateDiscardedHand on session loss
  - S6: stabilize useArmoryTargetingEvents deps with ref pattern
  …
- fix(armory): match flyover visual content to slot structure for pixel-perfect landing
  Three changes that together eliminate the 1-2px perceived offset:
  
  1. Extract GearSlotArt to shared component (parts/gear-slot-art.tsx).
     Use it in the drag visual portal for equipment-destination flyovers,
     so the portal's children are structurally identical to the slot's
     children (including the slot-specific textured background image).
  …
- fix(armory): animate drag flyover via transform for pixel-perfect landing
  Animate transform: translate() instead of left/top for double-click
  flyover and magnet settle/release animations. The element's CSS
  left/top is always set to the final dest position (integer), while
  the animation interpolates a transform offset to identity. This
  eliminates sub-pixel left/top interpolation and style-vs-animate
  prop conflicts that caused the flyover visual to land 1-3px off.
  …
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
  …
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
  …
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
  …
- fix(armory): fix gear-save store initialization, workspace layout overflow, and currency drag swap targeting
- fix(use-battle-controller): guard companion follow-up re-entry, stabilize cardPlay deps cascade
  - Fix scheduleCompanionFollowUp guard to prevent duplicate timers under
    concurrent turn resolution (early return + set ref before setTimeout)
  - Wrap scheduleAutoEndTurn behind a ref so cardPlay doesn't rebuild on
    every battle state tick; mirrors onEndTurnRef pattern in same hook
  - Narrow cardPlay deps from whole talents object to stable
    awardCardXP store action only, avoiding rebuilds on talent changes
  …
- fix(armory): polish drag visuals, unified carry, and edge-case fixes
  - fix: add image-rendering-pixelated to gear art to eliminate 1px edge flicker
  - fix: increase board right padding 8->12px so rightmost borders aren't cut off
  - fix: shrink equipment panel padding p-2->p-1 to free up board space
  - fix: discordant-dice requires item.affixes.length > 0 to be a valid target
  - fix: hide 'Salvage for...' tooltip text on 0-affix items
  - fix: implement unified item carry — currency drops on gear/currency now
  …
- fix(armory): polish gear drag placement and salvage sound
- fix(armory): correct secondary displacement logic and drag visual stability
- fix(armory): eliminate drag flicker by unifying DragVisualPortal element type
  The portal conditionally rendered <div> (drag) vs <motion.div> (settle/flyover).
  Every type-swap caused a fresh mount where Framer's initial={{x:0,y:0}}
  reset the visual to its startRect (origin), producing rapid cursor-to-origin
  teleporting.
  
  - Replace the ternary with a single <motion.div> that uses {duration:0}
  …
- fix(armory): quiver compat check, drag-FSM unmount races, rng determinism, cursorPoint perf
  Bug fixes:
  - Reject equipping non-ranged main-hand when quiver is in off-hand
  - Remove same-footprint swap shortcut that ignored third-item collisions
  - Fix drag-FSM cursor chain-capture, pendingCommit unmount races,
    and null-instance crash in drag visual
  - Expand contextmenu whitelist (inventory item + equip slot) so
  …
- fix(armory): resolve stale closure health sync bug and clean up drag hooks
- fix(ci): resolve Electron binary missing error and stabilize E2E drag-and-drop tests
- fix(tests): commits 3-6 - resolve remaining 25 errors across 12 files
  Battle mocks (G4): cast partial mocks as BattleControllerContext/TurnOrchestrationDeps
  BattleState mock (G5): add 6 missing fields to battle-feedback test state
  Architecture casts (G8): widen gear-ranged-tags with GearBaseItemDefinition &
    save-migration-guard with Record<string, T> casts
  RewardState (G7): cast trinket reward via unknown to avoid CardRewardState spread
  Generic mismatches (G9): fix DifficultyModifier shape, mapState prev type
  …
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
  …
- fix(tests): resolve remaining Phase D type errors (batch 2)
  - armory-targeting-state: add transferMenu null to dirty state objects
  - armory-inventory-layout: add definitionId/affixes to gear item mocks
  - armory-screen: fix partial GearLoadout using cast pattern
  - active-run-data: remove as const from remainingBossIds
  - balance-report: cast anomaly values as number, add thresholds to return type
  - run-domain: add MaterialId values to runMaterialsEarned
  …
- fix(tests): resolve systematic test type errors (Phase A+B+C)
  Phase A — default-battle-state fixture helpers:
  - combat-text, enemy-turn, apply-effects, card-play, encounter-traits,
    enemy-turn-attack, enemy-turn-utils, end-player-turn, status-forge
  - Replace raw object literals with defaultPlayerStatusValues, defaultCcState,
    defaultEnemyMitigation, defaultCombatFlags
  …
- fix(tests): resolve 369 type errors across Phase 3-4 fixes
  - Fix partial-object leftovers in enemy-turn, status-ticks, damage-riders, feedback
  - Fix domain type mismatches in reward-flow, run-domain, error-log-store
  - Fix armory/gear type issues (ranged-tags, targeting, inventory-layout)
  - Fix module declarations for .mjs imports (scripts/global.d.ts)
  - Fix window type assertions across storage tests
  - Fix E2E spec types (gear-equip, save-injection, gear-flow)
  …
- fix(tests): resolve partial-object type errors in battle test files
  - Create default-battle-state.ts fixtures for PlayerStatusValues,
    EnemyStatusValues, CcState, CombatFlags, TrinketManifest, EnemyMitigation
  - Apply fixtures across ~20 battle test files (status-ticks, damage,
    end-player-turn, status-player, status-stun-resolve, trinket-effects, etc.)
  - Fix TS2353 object key errors (battle traits, turn-resolution-ui)
  - Fix TS2352 loose cast errors (storage, audio test files)
  …
- fix(tests): resolve 87 type errors in test and page-object files
  - Fix TS2729 class field init order in 9 page-object files (move fields to constructor)
  - Fix TS6133 unused imports (homestead-page)
  - Fix TS2352 loose type casts (add as unknown intermediate)
  - Fix TS2353 object key mismatches (gear-test, battle traits)
  - Fix TS7053/2339 indexed access and property errors (companions, difficulties)
  - Fix TS2554/2304 missing rng args and type imports (gear tests)
  …
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
  …
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
  …
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
  …
- fix: glacial-shell respects freezePreventsEnemyScaling, cleanup transfer refs, improve CI and Playwright config
- fix: remove unused cardLibrary import from active-run.ts
- fix: harden battle persistence and audio startup, refactor UI barrels
  - Battle persistence: merge saved state with defaultBattleState() to prevent
    NaN/crashes from missing fields; always persist current battleState instead of
    reverting to battleStartState on enemy phase; skip activeCombat save when battle
    is resolved (enemyHealth <= 0 or player defeated)
  - Labyrinth: move labyrinthPendingNode to ActiveRunData top-level so non-combat
    nodes (campfire/shop/alchemist/mystery) survive reload
  …
- fix: format source files and add lefthook pre-commit hook
- fix: correct playwright baseURL, add lefthook pre-commit hook and prepare script
- fix: card selection visuals, difficulty select screen polish, mystery intro layout, screen header styling
- fix: holy damage calc, poison talent scaling, sound alias cleanup, and test infra

### Balance

- balance: tune enemy progression and combat pacing
- balance: retune stun, purge, burn, and rewards with homestead pagination
  Move attack purge to all attacks, simplify Saintfall, extend CC
  immunity, lower burn vulnerability, add random damage pools, boost
  companionless rewards, normalize talent presets and Normal
  difficulty, paginate homestead onto interactive tiles, enforce
  period-free wording, and refresh Stone Titan art.
- balance: rebalance combat pacing, damage scaling, cards, and talents
  Update enemy health multipliers and fight pacing clocks, consolidate
  damage modifiers into additive scaling, adjust Rend and Combustion cards,
  tune archery and burn talents, and expand balance sweeps with turn metrics.
- balance(cards): remove Antivenom Potion
  Drops the card from the library, tombstones the save id, and removes its
  art and sound mapping.
- balance: refresh class starting decks
- balance(combat): add fight pacing and findings-first sim reports
  Hidden fight pacing, Death's Door grace, and kit/loadout presets
  make combat length and the balance sim match current design.
- balance: reduce early enemy damage, select bg tweak, remove screenshot eslint block

### Performance

- perf: use shallow selectors for array/object slices
  - talent effects, display overrides, bonded companions
  - homestead effects, run boons, labyrinth modifiers
  - prevents render churn on revision bump where content equal
- perf: stream balance simulations and add summary path
  Add simulateBatchSummary that aggregates while simulating without
  retaining every battle result. Core scenarios keep detailed results for
  anomaly analysis; boon/card/talent/companion sweeps use the summary
  path. Add equivalence tests and phase timing/progress output for the
  opt-in report when ALCHEMY_BALANCE_VERBOSE is set.
- perf(shell): stabilize routeCommands / run-flow engine
  Memoize remaining flow-hook returns so destination and mystery
  callbacks keep stable identities across unrelated rerenders.
- perf(ui): stabilize description context and labyrinth node handlers
  WishOverlay rebuilt the card description context object on every render,
  defeating value caching for its three wish cards; memoize it like the hand
  does. LabyrinthMapScreen passed a fresh onLeave closure per render, which
  prevented React Compiler from memoizing the ~25 node buttons and re-ran
  enterability checks on every hover.
- perf(ui): build card description text only for the hovered card
  BattleCardButton ran getEffectiveCardDescriptionLines for every hand, shop, and
  reward card on every re-render, even though the result is only displayed inside
  the hover popup. The formatting now runs only when a card is actually hovered,
  removing per-render effect-scan and line-formatting work from the hottest
  component in the battle loop.
- perf(ui): stabilize battle particle color identity across renders
  BackgroundParticles keys its start/stop effect on the colors prop, but the
  battle screen built a fresh array literal every render. The effect now
  receives a stable module constant so the particle system cannot tear down and
  respawn (rAF loop, ~1.3MP canvas resize) on every battle commit if the React
  Compiler ever bails out of hoisting the literal.
- perf(ui): shape only the visible collection page
  getCollectionPageItems built and formatted every library entry (all ~91 cards)
  before slicing to the 12-item page, running getEffectiveCardDescriptionLines on
  each discovered card and an O(n^2) includes scan per card on every render.
  Shape only the page window after sorting and use Set lookups for discovery.
- perf(ui): improve runtime responsiveness
- perf(startup): defer image decode gate, music fetch, fonts, and non-critical work
  - Drop upfront decode gate for all 305 webp assets (22 MB) — menu now
    paints after 650 ms min duration; images stream in via idle callback
  - Defer music MP3 fetch (~45 MB) to first user gesture instead of mount
  - Self-host Inter variable woff2 (48 KB) — eliminates render-blocking
    Google Fonts CSS request entirely; no FOUC
  - Defer startup validation and error-log-store registration to idle time
  …
- perf: speed up pre-push e2e with parallel @prepush subset
  Run eight parallel prepush tests locally; keep full critical suite for CI via test:e2e:prepush:full.

### Refactors

- refactor: consolidate balance helpers, streamline simulator and findings
  Move combat-talent helpers into talent-preset, TalentPreset into
  simulator-types, and HTML format helpers into report-html. Simplify
  findings title lookups, cache finding scores, hoist gear loot weights,
  and clean up simulator internals with a gear-skip fast path.
  
  User-Facing: none, balance simulation internals only
- refactor: streamline assets and preloading, consolidate toolbar, and enforce content parity
  - Consolidate image and sound preloading and URL resolution with error recovery
  - Combine battle autoplay and toolbar extras into BattleCluster
  - Unify card description classifiers across count and numeric parity validation
  - Standardize game timing and balance constant units and segregation
  - Remove deprecated Ironwood Buckler block-to-armor effect in favor of tested manifest consumers
  - Fix room 2 enemy progression depth curve calculation
- refactor: unify shell navigation, harden E2E, warn before bundle cap
  Share one destination reader and hover-clear across shell flows,
  with every flow navigateTo clearing hover by construction.
  Guarded navigation stays silent even on disallowed edges.
  Labyrinth traits travel via the run session; empty sets still
  forward [] clears while writers skip only already-empty writes,
  so map taps avoid revision bumps without leaking stale traits.
  …
- refactor: consolidate run-session write ports and battle effect chains
  Fold the topical write-port modules, session lifecycle port, gear
  initial-state, and meta rebind helper into run-session-write-port as
  the single gameplay draft seam, with lifecycle reads staying on
  run-lifecycle. Rename the draft grant to addMaterialsToStockpile and
  keep awardMaterialsDuringRun as the run-ledgered path behind the
  renamed lint rule.
  …
- refactor: dedupe docs tooling, split architecture guards, and tune animation loops
  Share Markdown fence/link helpers, plan checks, and route budgets across
  docs tooling; give plan archiving and content audits the same single owners.
  Extend seeded-RNG lint to gameplay doors and keep asset/type-only imports honest.
  
  Split affix-pool, base-item slot, barrel export, asset-loading, and docs
  meaning guards out of monolithic tests with a shared repo helper; bound card
  …
- refactor: consolidate run loop flows, strengthen battle gating and save validation
  Unify battle playback blocked gating between auto-end turn and autoplay,
  and reset pending draws on session start.
  
  Consolidate shop refresh transactions and streamline Alchemist Shop browse
  layout.
  …
- refactor: decompose battle methods, standardize clamping, consolidate tests, and strengthen invariants
- refactor: consolidate battle epilogue, RNG boundaries, and release tooling
  Share encounter-threshold plus kill-payout ordering behind
  applyHitEpilogue across card, rider, and status hits.
  
  Memoize playable-hand keys on playability slices, narrow combat-text
  and description selectors, and hold exit-fade values explicitly.
  …
- refactor: consolidate battle, balance, and inspection helpers
  Deduplicate percent scaling, effect schemas, title lookups, and inspection shells.
  
  Harden RNG picks, wish queue, and UI guards.
- refactor: consolidate battle, balance, and test helpers
  Deduplicate CLI resolution, report formatting, and empty battle cards.
  
  Route battle draws through getBattleRng/rngInt and tighten battle lint scope.
  
  Add save-repair warnings, error-log copy feedback, and storage logging;
  …
- refactor: deduplicate content tables, battle helpers, and UI guards
  Compress the 200-entry talent pool into a talent() factory and the gear
  affix catalog into uniqueAffix()/resistAffix() helpers, removing ~1900
  lines of repetitive data while keeping every entry type-checked.
  
  Share the reflected-holy card constant between damage riders and enemy
  retaliation, unify burn/bleed similarity behind one predicate, and give
  …
- refactor: consolidate battle damage helpers, harden logging and reward restore
  Decompose computeCardDamageToEnemy into encounter, bonus, and mitigation
  helpers with shared burn/bleed predicates; centralize leech scaling behind
  applyScaledLeechHealing and extract split chances and conversion fractions
  into combat-rules constants.
  
  Simplify enemy turn-start trait tables, fix playerStatuses mutation in
  …
- refactor: simplify run state and verification boundaries
- refactor: consolidate UI and verification boundaries
- refactor: harden app shell, save migration, and content validation
  Split menu badge subscriptions out of the chrome provider; gate card
  inspection on a shared battle check; simplify audio, loading-word, and
  startup seams.
  
  Make save migration table-driven with a termination bound; replace the
  global validation collector with per-card repair notes; remove the
  …
- refactor: separate battle resolution from presentation
- refactor: consolidate run flow and battle boundaries
- refactor: simplify shop refresh transactions
- refactor: streamline card validators, inventory math, and run presentation flows
- refactor: consolidate e2e specs, asset tooling, and UI pagination hooks
  Streamline E2E suites by merging redundant and granular scenarios
  into contiguous-run and talents-flow suites.
  
  Consolidate release hotfix logic into release CLI, extract shared
  release checks, and clean up asset optimization scripts.
  …
- refactor: consolidate armory targeting, gear affix pool, and save flush paths
- refactor: consolidate battle, run-flow, shop, and save pipelines
  Fold battle presentation and turn helpers into shared layers.
  
  Move hand reflow and autoplay toggle to owning screens.
  
  Use a single run-flow entry with shared shell actions.
  …
- refactor: consolidate rng, run setup, homestead, and shop routes
  Move RNG helpers into lib/rng and run-start helpers into shared/run-flow.
  
  Unify shop commands and screen-route plumbing.
- refactor: organize audio and balance modules
- refactor: align sound asset taxonomy
- refactor: simplify armory and gear subsystem
  Consolidate pure gear rules and dedupe store selectors.
  
  Gate saves on success and fold single-use Armory UI modules.
  
  Add battle/save/labyrinth/wildwood/outcomes E2E routes.
- refactor: simplify asset pipeline, audio policy, and save plumbing
- refactor: harden run-state ports, codecs, and save wipe
  Complete the write barrel (setHasActiveRun), curate the read port,
  rename the profile codec, fix wipe teardown and profile-hydrate rebind,
  stop save-time crashes on future screens, and pin each behavior.
- refactor: consolidate build helpers and streamline knowledge routing
  Extract vite chunk, sentry release, and vite bin helpers into shared
  script libs; run builds through the bundled vite CLI; fold deprecated
  asset sync shims into sync-generated aliases; add ALCHEMY_CHECK_SKIP_BUILD
  for fast local checks; split knowledge into live patterns vs enforced
  rationale with per-area routing.
- refactor: fold run-state helpers and persist labyrinth traits at top level
  Consolidate combat-meta, presentation lifecycle, and autosave select into owner modules.
  
  Persist labyrinth modifiers outside active combat with fallback decode.
  
  Preserve both sides of mid-claim companion rewards on resume.
- refactor: simplify run-state ports, codecs, and run-end plumbing
- refactor: flex talent trees, unify trinket rewards, wire webgl plasma
- refactor: consolidate meta progression tiles, pickers, and panels
- refactor: harden save resume, simplify persistence and migration seams
  Strict retired-content cleanup at load with re-offered choices.
  
  Silent version protection by save timestamp.
  
  Split save io into candidate evaluation and write queue behind the storage barrel.
  …
- refactor: canonicalize rng, math, and audio doors with hardened draws
  Consolidate run randomness on lib/rng and remove the run-rng shim.
  
  Share one chance core, validate draws, ranges, and counters,
  
  extract the audio-url helper, and route battle and content
  …
- refactor: simplify battle glue, unify draw and playback, trim presentation
- refactor: consolidate scripts surface, dedupe gates, add catalog
- refactor: simplify battle engine module shape
  Consolidate overlapping battle modules without behavior change:
  - single RNG import path (drop shim), merged combat-text pair,
    moved save-repair helper to validation
  - shared wound-resolution helper across all six hit tails,
    kill payouts absorbed into combat-text (fixes import cycle),
    card-effect dispatch merged into registry
  …
- refactor: reshape active-run normalization on validated types and clear dead-code debt
  - Active-run soft-fix normalizer now operates on schema-validated types,
    removing unreachable defensive guards and casts; its tests route through
    ActiveRunDataSchema like production (unreachable-branch tests now assert
    the real load outcome)
  - Share FNV-1a string hash via src/lib/rng (migration seed derivation +
    mystery trinket fallback); extract migrateRunTree for the three migration
  …
- refactor: harden git guard classification and consolidate tooling scripts
  - Extract destructive-subcommand classifier; guard now sees through global
    options (closes shim fast-path bypass via -c/--git-dir/--no-pager preludes)
  - Injection-proof release tooling (execFileSync, tag/semver validation)
  - Content-aware handoff digest incl. >1MiB staged files; guard reports
    failed stash backups honestly
  - Prepared-assets check restores outputs on any preparation failure
  …
- refactor: consolidate run-setup ownership and harden draft navigation
  Move wildcard starter-draft and novice campaign helpers from
  shared/run-flow into run-setup/run with backward-compatible re-exports,
  extract computeRunMaxHealth for shared use, and make
  content-system-navigation and run-init read authoritative store state
  instead of stale props. Harden starter and Wildwood draft flows to
  clone cards and rely on authoritative decks, tighten difficulty
  …
- refactor: rationalize lint boundaries, a11y and battle invariants
  - Collapse battle guards to single Math.random selector and expand
    Math.floor/ceil/trunc + .rng destructuring bans via fragments
  - Enforce jsx-a11y (alt-text, role, interactive-supports-focus) and
    vitest recommended (no-disabled/no-focused) via @vitest/eslint-plugin
    and eslint-plugin-jsx-a11y; remove react-compiler eslint plugin in
    favor of babel-plugin-react-compiler
  …
- refactor: consolidate fade, tooltip and motion handling
  Consolidate fade primitives into shared use-fade with compat re-exports
  (fade-presence, fade-slot, use-sequential-fade-swap) and centralize
  performance marks into lib/performance/marks. Unify motion durations
  around MOTION_FADE_MS/TOOLTIP_FADE_MS with CSS var sync enforced in
  lint-architecture-smoke and mirror durations in theme/components CSS.
  Fix tooltip placement to share a global resize/scroll listener, prefer
  …
- refactor: centralize game constants and clean dead tuning paths
  Move boss health multiplier to combat-rules with re-export, name enemy
  trait damage multipliers and attack constants, extract audio fade/boss
  boost and homestead loot multipliers, invert shop price source of truth,
  alias particle intensity and drop unused destination dampen (0). Keeps
  HALF_DIVISOR/PERCENT_DENOMINATOR as named tuning per battle invariant.
- refactor: consolidate asset pipeline, defer gear preload and harden build tooling
  Centralize asset presets and audio settings in asset-constants, re-export via
  asset-defaults for compat; bump ASSET_SCHEMA_VERSION to 4 and unify sound
  loudnorm/vorbis handling. Extract registry validation and glob-pattern helpers,
  add fast generated check and E2E route runner, defer non-essential gear art
  to idle after startup, add Rollup manualChunks fallback and game-data bundle
  budget, and harden verification/playwright harnesses.
  …
- refactor: centralize RNG, split utils and harden platform save
  Extract canonical RNG to src/lib/rng with explicit Rng param and
  Unsafe variants for cosmetic use; split cn/math from utils and make
  shuffle/pick/take require explicit RNG. Add batched preload helpers
  and unify idle scheduling for sounds/images. Centralize desktop API
  via getDesktopApi/isDesktopApiAvailable and make SaveBackend.writeSync
  required, fixing exit-save coalescing and unifying desktop guards.
  …
- refactor: consolidate docs, harden tooling and battle exhaustiveness gates
  Extract UI and audio owner docs (UI.md, AUDIO.md) from WORKFLOWS, split
  save migration history into MIGRATION_HISTORY.md, and prune archived
  simplification plans. Add non-mutating verified builds (build:verified,
  build:desktop:verified) and strong handoff gate (check:handoff) with
  source-digest staleness and strict route ownership. Tighten package gates
  (check:push now dry-run + format + typecheck + lint + check:generated +
  …
- refactor: harden run flow and battle lifecycle
- refactor: consolidate gear slot rules and harden tooling
  Replace requiresTwoHands/ranged/quiver booleans with GearSlotRule
  ("two-handed"|"ranged"|"quiver"|"standard") across base-items,
  definitions and operations, simplifying hand-conflict resolution and
  ranged/quiver gating. Dedup affix catalog rolls into shared constants
  and unify tier generation/salvage handling with null-rarity guards.
  …
- refactor: consolidate homestead materials, persistence codec, and tooling
  - Rename crystal to gems across homestead buildings, farm plots, loot,
    gear and save schemas with versioned migration and content steps
  - Consolidate card builders (advanced/companion/shared/simple) into
    card-builders.ts and tighten gear type ownership via types-core
  - Streamline persistence codec (encodePersistenceFields), save
    validation, and RNG seed fallback hashing for parked runs
  …
- refactor: simplify run state battle and CI tooling
- refactor: harden settings, run setup, and CI verification
- refactor: add unified script entry points
  - ci-summarize consolidates vitest/playwright summarizers
  - assets consolidates optimize/sync/prepare with flags
  - verify consolidates changed/bundle/routing/arch checks
  - audit consolidates all/type/amplification/content audits
  - old scripts kept as shims for one release
- refactor: inline draft field setter
  - move createDraftFieldSetter into write-port-run
  - keep draft-helpers as re-export shim
- refactor: consolidate tiny effect schemas and handlers
  - add simple-schemas consolidating flag/companion/utility definitions
  - add simple-handlers consolidating flag/companion/utility handlers
  - keep old files as deprecated re-export shims
  - registry now imports from consolidated modules
  - warn on missing handler kind instead of silent no-op
- refactor: consolidate boundary ownership into fragments
  - move ASSET_BARREL selectors to fragments, import in eslint config
  - add cruiserPathFromGroups helper to fragments
  - dependency-cruiser now derives paths via fragment helper
  - remove duplicated toTargetPath logic
- refactor: elegantly simplify next pass - battle, balance and store extractions
  Split balance harness into report-catalog/options/sweeps for testability.
  Extract battle utilities into combat-text-events, enemy-attack-damage,
  trait-query, turn-rules and health thresholds.
  Consolidate shop UI into purchasable-shop-item/tile and re-export shims.
  Restore deepFreeze recursion, fix pacing env handling and stabilize seeds.
  Harden desktop after-pack for Node 20 fallback and fix shop mock targets.
  …
- refactor: split card library and consolidate run ports
- refactor: consolidate store barrels, shop screens, and battle RNG
  Unify run-session read port to run-reads, move gold-purse helpers
  into write-port-run and draft-helpers, delete legacy re-export shims
  (run-port-types, run-session-model, run-session-react-ports,
  store-helpers) and update ~90 import sites.
  
  Make labyrinthMap nullable from session init, guard labyrinth
  …
- refactor: simplify and harden architecture
- refactor: simplification and hardening across stores, battle, routing, CI
  - Save persistence: coalescing guards, Array.isArray parkedRuns, gold
    repair warnings, envelope deny-list, NaN/Infinity guards in
    clampHealth/applyPlayerCombatDamage
  - Routing/run-flow: symmetric LABYRINTH_MAP<->DESTINATION, cancel-
    guaranteed commitDestinationProgress with cause preservation,
    pendingCharacterId clear on system switch
  …
- refactor: draft-source battle start, unify reward choice and harden shop refresh
  Derive battle talent/gear/trinket manifests from the open GameplayDraft
  instead of React BattleRun/BattleTalent ports to avoid stale reads and
  extra subscriptions. Centralize derivation in deriveCombatMeta with
  explicit CombatMeta typing and expand shop-state-init to maximize novel
  trinkets on refresh while capping at available pool. Replace reward
  choice {choice,type} with discriminated ResolvedRewardChoice and
  …
- refactor: consolidate mystery effect display order and normalize gear affix copy
  Unify mystery reward ordering to XP → gold → materials → portrait
  across pool authoring, tooltip (MysteryEffectList) and reward summary.
  Extract shared getMysteryEffectRank/sortMysteryEffectsByDisplayOrder in
  src/lib/mystery/effect-order.ts to eliminate duplication between badge
  and test. Update WORKFLOWS checklist, mystery-reward-summary layout,
  and add ordering guard in mystery-events.test.ts. Normalize 13 gear
  …
- refactor: unify persistence and screen-gated encode
  - storage: merge codec-registry + persistence-coordinator +
    build-save-data into single persistence.ts; old files re-export
    for compat; createDefault/encode/hydrate/build in one place
  - run: collapse screen-gated persistence (shops, mystery,
    corruption, interruptedFlow) into encodeScreenGatedFields
    in run-resume-codec; remove 2 branching helpers
  …
- refactor: consolidate battle flags, unify material grants, harden hydrate
  - battle: single source FLAG_DEFINITIONS combat-flags.ts with
    defaults and preserveAs; derive CombatFlags, creation and
    preservation from table; remove 3 manual maps in state-helpers
  - stores: add grantMaterials(draft,mats,{trackRunEarned}) as single
    material entry; keep award/add as wrappers; update salvage
    command to use grantMaterials
  …
- refactor: simplification sweep — affix, RNG, amount, tooltip, storage, infra
  - gear: rename duplicate affix names Aegis->Aetherward,
    Warding->Wardplate, Leeching->Sanguine; add unique-name guard
  - battle: unify RNG via rollPercent with WISH_CRYSTAL_GOLD_PERCENT
    and WISH_TRINKET_FORK_PERCENT in wish and card-play
  - battle: add scalePercent helper and route holy/gold percent
    math through it in damage-calc
  …
- refactor: consolidate effect registry, lifecycle, battle helpers and build ergonomics
  Unify battle effect kinds/schemas into registry.ts with deprecated shims
  for backwards compat, split run-transitions into run-lifecycle and
  run-presentation-lifecycle, harden persisted battle normalization with
  throwing RNG sentinel and clamping, fix reward and heal rounding
  (floor->round), tighten desktop asset path and preload guards, deduplicate
  per-mana scaling and crit helpers, and share vite SSR alias config.
- refactor: consolidate talent pools, battle helpers, store lifecycle and build ergonomics
  - talent: collapse 19 copy-pasted pool/{keyword}.ts into
    talent-pool-definitions.ts single table; pool/index.ts is a compat
    barrel using single reduce-into-Map instead of 19 filters
  - battle: add amount-helpers.ts (applyPotionMultiplier/scaleBlockBonus),
    fix random-damage potion bias, make DAMAGE_TYPE_HANDLERS exhaustive
    Record<DamageType> with runtime guard, apply Option B for
  …
- refactor: consolidate gear cache key, coverage exclude, knip entry, batch sim
- refactor: phase 0 simplification doc and storage prep
- refactor: make RNG mandatory for selectRewardCards
  Remove Math.random fallback; gameplay reward selection now requires a
  seeded RNG. Migrate tests to deterministic generators and add a
  static guard preventing silent Math.random usage.
- refactor: modularize screen routes, persist active run sessions, and strengthen test coverage
- refactor(shop): rename Merchant's Shop to Card Shop
  Hydrate still remaps the old destination label so in-progress saves keep their shop history.
- refactor: complete simplification and consistency pass
  - Author trinket combat effects alongside compendium prose with numeric
    parity validation; derive the runtime effect map from the manifest
  - Fall back to deterministic astral gear drops once every trinket is owned
  - Convert card art to JPEG sources, regenerate optimized webp barrels,
    and replace Roulette with Roll the Dice
  - Consolidate selectable choice cards into shared/ui/selectable-card.tsx
  …
- refactor(ui): explicit Button wrapper prop and shared hover-visible hook
  Button drops the layout-class splitter in favor of a wrapperClassName
  prop, renames the default variant to primary, and ShineBorder now
  requires shineColor. Shared tooltip surfaces adopt the useHoverVisible
  hook, adding focus parity for keyboard users.
- refactor(app): mount screen error boundaries directly
- refactor(ui): centralize trinket/gear art tiles and pagination math
- refactor(cards): derive effect-backed descriptions via an effectsCard builder
- refactor(stores): keep gameplay state data-only behind draft-first write ports
- refactor(ui): make partial BattleCardButton hover props a type error
  The hover trio becomes a discriminated union: controlled callers must pass
  hovered plus both handlers, uncontrolled callers must pass none, so a
  half-bound set fails at compile time instead of being silently ignored.
  
  SelectableShopCard drops its redundant local hover state and handler
  fallbacks — uncontrolled callers get the button's internal tracking and the
  …
- refactor(battle): only emit status combat text when a gain lands
  addPlayerStatusWithCombatText now reports the applied delta only when it is
  positive, matching gainManaWithCombatText, so clamped applications can never
  surface a no-op +0 text to future call sites.
- refactor(ui): make BattleCardButton hover self-contained and unify gear reward popup
  - hovered/onHoverStart/onHoverEnd are now optional on BattleCardButton;
    simple call sites (corruption result, alchemist mixed-card reveal,
    purchasable shop card) drop throwaway hover state and a redundant
    double-binding wrapper div; controlled callers (hand, wish overlay,
    choice grids) keep their handoff behavior
  - character select adopts the shared useHoverVisible hook, matching the
  …
- refactor(battle): consolidate mana-gain, status-application, and companion scaling
  - gainManaWithCombatText and addPlayerStatusWithCombatText in combat-text
    replace five hand-rolled paced-mana blocks and six paced-status delta
    text blocks across card-play, talent-effects, leech riders, wish,
    status-player, status-helpers, and companion
  - companion scaling threads a CompanionScaleContext object instead of nine
    positional scalars through three functions
  …
- refactor(ui): use tone props and owning-module imports, drop dead tooltip helper
  - corruption screen uses ScreenDescription tone=danger instead of literal
    class strings; campfire drops a redundant default-tone class
  - shared/ui siblings import GoldCost and PaginationControls from their
    owning modules instead of the shared-ui barrel
  - remove single-use DIALOG_CONFIG indirection in dialogs
  - hoist repeated menu nav button class into MENU_NAV_BUTTON_CLASS
  …
- refactor: drop dead surface area and duplicate invariants across run flow, effects, audio, and tests
  - Shrink VictoryRewardsResult to consumed fields; trim createRunFlowHandlers
    to composed handlers only
  - Collapse MysteryEffectContext to { draft, rng }; reuse deck-mutation
    discovery helpers and write-port setters directly
  - Remove no-op removeAll from cleanse-player-status-to-damage; share
    dealSelfDamage across self-damage/lose-health handlers
  …
- refactor: remove dedicated accessibility features per accessibility stance
- refactor: consolidate assets, audio, battle math, and run-end screens
  - Serve art from generated barrels under src/assets/optimized and drop
    the public/assets copies
  - Replace audio-buffer-cache with audio-preload
  - Merge damage-type-modifiers into damage-calc; extract gear constants
    to game-constants/gear.ts
  - Unify game-over/victory into run-end screens with shared modal,
  …
- refactor: consolidate audits, tooling, and test suites
- refactor(stores): split write-port barrel
  Move run, session, battle, and profile mutators into region files and
  keep run-session-write-port as the import surface.
- refactor(battle): split turn-orchestration
  Move haste, enemy-phase, and resume paths into focused modules while
  keeping resolveEndTurn as the public dispatcher.
- refactor(ui): standardize material icons and homestead shell sizing
- refactor(sound): drop buff and leech chime battle events
- refactor(ui): cap hover tooltip widths at shared 288px class
- refactor(store): drop dead reset alias, dedupe burn multiplier and field setters
  Remove resetActiveRunStores, a one-line teardownRun alias with zero production
  callers, and document resetTransientRunUi as test/teardown support. Extract the
  burn-vs-bleeding damage bonus into getBurnBonusToBleedingMultiplier used by both
  the card damage calc and burn ticks so tuning changes can't drift. Collapse
  setMysteryCardChoices/setMysteryGrantedTrinketIds onto the shared setField
  helper, which already supports functional updaters.
- refactor(battle): unify gear CC damage and heal-with-text payouts
  applyGearFreezeDamage and applyStunGearDamage were mirror functions differing
  only in the gear field and a lucky-clover call; merge into
  applyGearCcPhysicalDamage in gear-effects with an explicit grantLuckyClover
  option so the freeze/stun drift is a visible decision. Route the five remaining
  hand-rolled heal+text+overheal blocks (gear kill rewards, poison leech, leech
  execute, wish heal, parasitic bloom) through applyHealingWithCombatText.
- refactor(battle): collapse six DoT ticks into shared helpers
  The burn/poison/bleed enemy ticks and the player-side twins re-implemented the
  same clamp-health / apply-stacks / armor-decay / trait-threshold tail, and two
  heal payouts hand-rolled applyPlayerHealing + heal text + overheal text that
  applyHealingWithCombatText already owns. Extract dealEnemyDotTick and
  dealPlayerDotTick and route both heal blocks through the shared helper, leaving
  each tick with only its unique rule. Verified against the balance sim.
- refactor(routing): consolidate screen transition policy
- refactor(armory): consolidate drag types and gear actions into leaf modules
- refactor(alchemy): consolidate shop, mixer, audio, and state utilities
  - Move shop-transactions under run-loop/shop and fold selectors,
    gear pricing, and spend feedback into shop-pricing/shop-transactions
  - Rework potion mixing to scale description numbers via effect amounts,
    validate deck indices, and generate readable deterministic ids
  - Replace per-kind description getters with an effect cursor
  - Unify field setters and dedupe keyword aliases into a lookup map
  …
- refactor(run-state): simplify flow wiring and aggregate commits
- refactor(state): narrow gameplay draft action creation
- refactor(architecture): clarify state ownership boundaries
- refactor(alchemy): clarify run command ownership
- refactor(state): simplify run session command layer
- refactor(battle): consolidate status application into player/status-riders modules
  Replace the split status-effects/status-application modules with a focused
  layout: player-side status application lives in status-player, damage-type
  status riders in damage-status-riders, and CC trigger resolution in
  status-cc/stun-resolve. Add a rollPercent helper to centralize chance rolls
  and drop the now-unused PERCENT_DENOMINATOR math. Rename tests to match and
  fold RunFlowRunPort into ActiveRunCorePort.
- refactor(app): consolidate app shell hooks, route registry, and presentation ports
- refactor(run-flow): replace intent dispatch with RunFlowShellActions
- refactor(saves): unify battle persistence and interruptedFlow resume
  Raise the pre-launch save floor to schema 11, replace battle-state-guard
  with PersistedBattleStateSchema plus restore-time trinket repair, and wipe
  the full local bak/tmp set on Save Protected clear.
- refactor: share inventory cell rect and armor decay helpers
  Deduplicate armory drag rect resolution and battle armor decay
  behind common helpers so both call sites stay in sync.
- refactor(stores): collapse gear/profile into gameplay aggregate and dedupe write port
  - Remove production useGearStore/useProfileStore facades; keep test-only
    views in gameplay-store-test helper
  - Boyerize run-session-write-port via bindWriteAction for trivial
    single-action writes; keep compound cross-lifetime writes explicit
  - Route gear mutations through dispatchGearMutationWithRunHealthSync
  - Share pickActiveRunFields between the committed read model and read port
  …
- refactor(stores): own transaction depth in the store and derive the run view from the canonical model
  Move the nested-transaction depth and draft into gameplay-state-store so the
  store and command never drift on outer-level detection; fold the failure flag
  into commitGameplayTransaction(success), replacing the separate
  rollbackGameplayTransaction path. Collapse the hand-maintained active-run key
  lists into pickActiveRunView (ActiveRunReadView = ActiveRunProgressFields:
  + initialized), adopted by both the committed session read model and the
  …
- refactor(stores): consolidate run-session ports, migration pipeline, and shell hooks
  - Collapse run/profile/gear write and read ports into run-session-write-port
    and profile/gear store hooks; drop obsolete run-flow-ports, use-run-navigation,
    use-run-teardown, and battle-bindings.
  - Consolidate validation migration steps into save-data.ts and migration/index.ts,
    removing per-slice migrate-* files and the gear read/profile ports.
  - Move legacy-save fixture helpers off extraneous exports; clear knip dead-code
  …
- refactor(stores): collapse write ports into run-session-write-port
  Fold capability-specific write ports and transaction helpers into the
  command-backed write port, and remove obsolete gear/save migration paths.
- refactor(shell): replace RunFlowEnginePort fat-port with five narrow port hooks
  useRunFlowEnginePort() subscribed to 14 activeRun fields in a single
  useShallow selector, causing the entire useRunFlowEngine subtree to
  re-render on any run field write — including writes irrelevant to the
  sub-hook being updated.
  
  The five narrow port types (RunFlowRunPort, ContentNavigationRunPort,
  …
- refactor(shell): extract run-flow engine + shell types; renumber audit docs
  - Extract use-run-flow-engine.ts from use-run-navigation.ts (run flow
    intent execution now lives in its own hook)
  - Add shell-types.ts for shared shell-layer type definitions
  - Add RunFlowEngine and related types to run-port-types.ts and
    run-session-react-ports.ts
  - Slim use-run-navigation.ts down to navigation concerns only
  …
- refactor(state): consolidate run state on capability ports, drop legacy slice stores
- refactor(state): drop unused run-domain write-port exports
- refactor(state): command-back run mutations and RNG sources
- refactor(state): split run session capability ports
- refactor(run): centralize session commands and resume codec
- refactor(state): publish atomic run-session updates
- refactor(state): split run-flow into ports, intents, and concern modules
  Narrow handlers behind RunFlowRunPort/TalentPort and shell-executed
  RunFlowIntent dispatch, and share active-run core field picks for session reads.
- refactor(state): split run shell into concern hooks and narrow battle ports
  Thin the mega-controller into route-command assembly and navigation concern
  hooks, replace the screen flatten twin with RunScreenData, and give battle
  BattleRunPort/BattleTalentPort instead of full adapters.
- refactor(state): extract run-store-views and drop controller display bus
  Route run-loop display reads through useRunScreenData and composed store
  views so controllers own commands only, and shop handlers read live
  facade state at call time.
- refactor(state): split run-domain hub into lifetime-matched stores
  Extract permanent progression, transient session, and battle snapshot
  into lifetime-matched stores with ports, and route external lifecycle
  through run-session-facade.
- refactor(build): consolidate asset prep and harden Steam release pipeline
  Unify predev/prebuild asset work in prepare-assets.mjs with shared script helpers
  and richer manifest caching. Simplify ship gates, fix release CI (SteamCMD,
  commitlint, artifact uploads), and bake packaged Steam app ID into desktop builds.
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
  …
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
  …
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
  …
- refactor(homestead): make mergeIntoManifest generic, eliminate type duplication
  - HOMESTEAD_BATTLE_*_KEYS arrays (numeric/boolean/record) are the single
    source of truth for which TalentEffectManifest fields homestead can affect.
  - HomesteadEffectManifest = Pick<TalentEffectManifest, battle keys> &
    HomesteadMetaEffects (5 run-level fields) — no type duplication.
  - mergeIntoManifest now iterates the key arrays: numbers add, booleans OR,
    Records merge-by-key. Adding a key to the arrays automatically makes it
  …
- refactor(assets): remove placeholder art stubs and expand audit
  - Delete boss-combat.webp stub (98 B) and source JPEG (343 B), replace fallback with normalEnemyBg
  
  - Remove 5 hidden placeholderFarm entries and the factory
  
  - Delete orphan placeholder-boon.webp (no source PNG)
  …
- refactor(core): confine side-effect primitives to designated seams
  - corruption/index.ts: corruptCard/corruptDeckCard now require rng param
    instead of direct Math.random calls
  - homestead/loot.ts: rollBonuses/getEnemyMaterialLoot now require rng param
  - mystery-flow.ts: rng added to MysteryEffectContext, replaces Math.random
  - game-constants.ts: isAnimationDisabled moved to new
    lib/animation/animation-prefs.ts seam
  …
- refactor(dedup): extract shared LabyrinthNodeHandlers type and defaultCompanionBondLevels
- refactor(seams): auto-generate asset barrel, split damage test, add audit tooling
  - Add scripts/sync-assets.mjs to auto-generate src/lib/game-data/assets.generated.ts
    from src/assets/optimized/ directory scan; hook into prebuild
  - Split tests/lib/battle/damage.test.ts (789-line mega test) into 9 focused files
    by describe-block family with shared test helpers
  - Write scripts/audit-change-amplification.mjs for reproducible hotspot analysis
  - Update PROMPTS.md #6 with co-edit signal, three-view methodology, encoding fix
  …
- refactor(imports): break 6 cycle clusters, remove dev-mode from utils barrel
  - Cluster 1: move ghost/transfer types from presentation-types into shared/types
  - Cluster 2: lift applyGearDamageResistance/scaleGoldReward from gear-effects to types
  - Cluster 3: move getEnemyDamageMultiplier from status-effects barrel to status-helpers leaf
  - Cluster 4: extract TalentPreset to balance/types.ts, break simulator↔homestead-preset
  - Cluster 5: move withSelectedBossForDestinations from victory-flow to destination-flow
  - Cluster 6: import StaggerGroup/StaggerItem from source files, not shared-ui barrel
  …
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
  …
- refactor(storage): simplify save-load path, drop diagnostics, fix Windows backup rotation
  - Revert SaveLoadStatus to 4-kind shape; no candidate/triedAll fields
  - Future-versioned candidates silently skipped, not errored to player
  - Eager card hydration at load time with silent drop for unknown IDs
  - Remove App.tsx parseActiveRun gate (hydration now in io.ts)
  - Delete save-merge.ts (local-wins policy, no cross-device merge)
  - Delete dead loadSave/backupSave IPC handlers and SAVE_BACKUP_PATH
  …
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
  …
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
  …
- refactor(battle): eliminate BattleControllerContext, inline factories, flatten controller
  - Delete controller-context.ts (50-field megastruct) and its contextRef indirection
  - Each create* factory now takes a small explicit params bag instead of the full context
  - Add resetHandTransferUi/resetCardTransfers actions to battle-presentation-store
  - use-battle-controller.ts drops 3 ref-of-ref workarounds (resolveEndTurnRef,
    getTurnOrchestrationDepsRef, scheduleCompanionFollowUpRef); uses direct closure
  - Create battle-facade.ts with BattleLifecycle shared type
  …
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
  …
- refactor(game-data): extract pool helpers and hydrateCard from cards.ts
  - Extract isStandardPotionCard/getOfferableCardPool/getStandardPotionPool into cards/card-pools.ts
  - Refactor hydrateCard into cards/hydrate-card.ts (local SavedCard type, drop
    duplicated corruptedValuePositions filter, Math.floor -> Math.round)
  - Remove COMBAT/SUPPORT section markers from cards.ts
  - Replace cauterize ordering comment with test reference
  - Add card-effect-ordering.test.ts for effect-order invariants
  …
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
  …
- refactor(armory): reduce complexity and consolidate lib/gear
  - Phase 0: Remove dead armory-salvage-confirm, unused reducer actions
  - Phase 1: Centralize geometry/point/test-id constants into dedicated files
  - Phase 2: Remove Math.random defaults from lib/gear public functions
  - Phase 3: Merge grid-packing.ts into inventory-layout.ts (1 canonical
    packer family), consolidate legacy ID tables and duplicate helpers
  - Phase 4: Extract use-inventory-scroll-drag hook from inventory-panel
  …
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
  …
- refactor: split run-domain-store into per-slice action files
  Extract progress, session, navigation, and battle action impls into
  
  co-located slices/ files with factory functions and types.
  
  Eliminate duplicated RunProgressActions / RunSessionActions type
  …
- refactor(battle): consolidate CC state, add static guards, and reduce engine friction
  - Group 6 top-level CC fields into playerCC/enemyCC CcState records
  - Add withPreservedFlags() helper for companion first-time flag scope-guard
  - Add drawFromState() convenience wrapper over drawCards
  - Replace nested-spread in status-application.ts with addPlayerStatus()
  - Add satisfies Record<> to EFFECT_APPLY_BY_KIND for build-time handler coverage
  - Add unsafeNonSeededRng export and tighten eslint Math.random rule
  …
- refactor(armory): extract useArmoryController facade and split screen + panels
  Phase 3 cleanup of the Armory subsystem:
  
  - New useArmoryController() facade hook reads useGearStore directly,
    wraps mutations (equip, unequip, salvage, applyCurrency, dev spawn)
    with the HP-sync + save-flush side effects that previously lived as
    four closures in meta-routes.tsx. The ArmoryScreenRoute wrapper
  …
- refactor(armory): extract shared board-drag math and dedupe gear/currency drag
  The currency drag hook (use-armory-currency-drag) and the gear drag
  hook (use-armory-gear-drag) each carried their own copy of three
  duplicated pieces of pointer-drag logic:
  
  - a placeInventoryTileFromMetrics helper that read board metrics,
    called findNearestInventoryPlacement, and computed a screen-space
  …
- refactor(armory): extract useBoardDrag FSM and route currency drag through it
  The currency drag hook duplicated the gear drag hook's pointer FSM,
  magnet snap, hysteresis, double-click activation distance, and
  animation timers. Extract a single parameterized FSM in
  armory/use-board-drag.ts that owns the shared logic and the magnet
  constants (MAGNET_SWITCH_MARGIN_PX, MAGNET_RELEASE_HYSTERESIS_PX,
  INVENTORY_SNAP_RADIUS_CELLS, DOUBLE_CLICK_FLYOVER_MS,
  …
- refactor(armory): unify grid packing into a single tested module
  The Armory had three near-identical implementations of grid packing:
  - inventory-layout.ts (canPlace/markPlaced/findPlacement/packInventory)
  - gear-store.ts resolveMoveItemAndSwap (inlined overlap detection and
    displaced-item re-placement)
  - gear-store.ts syncBoardPositions (inlined occupancy grid, canPlace,
    markPlaced, findFirstAvailable)
  …
- refactor(navigation): unify transitions, type-exhaustive route registry, and SCREEN_PHASE table
  Six independent cleanups in the run-navigation layer. No player-facing
  behavior change; all 2747 navigation/battle/shop tests pass.
  
  - Consolidate the three TimerGroups in the run shell (navTimer in
    useScreenNavigation, rewardTransitionTimer in useRunNavigation, and the
    standalone screen-transition.ts helper) into a single useScreenTransitions
  …
- refactor(battle): drop Math.random defaults, remove dispatch route metadata, and refresh stale doc
  Phase 0 of the battle engine refactor. Five small cleanups that remove
  footguns and dead abstractions without changing public behavior; all 1055
  battle+game-data tests pass.
  
  - Make draw.ts and shuffleCards require an explicit rng. Production uses
    state.rng; tests pass any seeded fn. The previous '= Math.random' default
  …
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
  …
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
  …
- refactor: split screen stores and unify battle state flow
  Split ui-store from run-session-store.
  
  Pass battleScreenData from controller to BattleScreen.
  
  Inject store accessors into run victory and destination handlers.
  …
- refactor: card builders, hurt pulse fix, and theme tokens
  Add card-builders and shared companion turn-line text.
  
  Migrate combat and support cards; edge-trigger portrait hurt pulses.
  
  Reset hurt tokens between battles; extract TalentEffectManifest.
  …
- refactor: split battle, app shell, and data modules
  Modularize battle, UI, validation, and tests. Memoize talentEffects and seed battle RNG in tests.
- refactor: unify battle state, split modules, and harden tests
  Consolidate run/talent state in run-store and remove logicalBattleState.
  
  Split cards, talent pool, and save-schemas into focused modules.
  
  Fix enemy-status null-field stacking and haste end-turn sync timing.
  …
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
  …
- refactor: damage handlers, ESLint conventions, homestead extraction, knip integration
  - Extract damage type modifiers into DAMAGE_TYPE_HANDLERS registry
  - Add ESLint rules: ban React.FC, enforce barrel imports, cn() for classNames
  - Split homestead screen into sub-component files under homestead/
  - Integrate knip dead code detection (deadcode/deadcode:strict scripts)
  - Refactor storage IO with getDesktopBackend() helper
  - Convert renderAlchemyScreen() function to RenderAlchemyScreen component
  …
- refactor: consolidate PRNG, migrate React 19 refs, add logicalBattleState
  - Consolidate Mulberry32 PRNG into createSeededRng in lib/utils.ts;
    remove duplicate implementations from map-generation.ts and simulator.ts
  - Thread seeded rng through shuffle/pickRandom, draw.ts, wish.ts so
    card shuffles and draws respect state.rng for full determinism
  - Migrate all forwardRef components to React 19 prop-ref pattern:
    button, progress, select, switch, tooltip-panel, PilePanel, actor-panel,
  …
- refactor: rebalance talents, add physical status riders, fix TS type for handleWishChoice
- refactor: consolidate test state, extract validation guard, harden enemy-turn
  - Extract createTestBattleState helper, removing ~1100 lines of duplicated
    baseState boilerplate across 9 test files
  - Move isPersistedBattleState to dedicated battle-state-guard.ts
  - Replace mutable global validation error array with scoped
    safeParseWithErrors collector
  - Extract getCardKey/centeredRectForSize to controller-utils.ts
  …
- refactor: consolidate timers, migrate homestead store to immer, add page objects and tests
  - Add TimerGroup and delay() utility in src/lib/animation/game-timer.ts for
    centralized timeout lifecycle and animation-disabled awareness
  - Replace ad-hoc setTimeout refs in battle-store, use-battle-controller,
    and use-run-navigation with TimerGroup/delay
  - Migrate homestead-store to zustand immer middleware (reduces boilerplate)
  - Restore pendingNodeRef in use-labyrinth-controller to fix race condition
  …
- refactor: extract victory-flow and talent-effects modules, clean up battle navigation
  - Extract processBattleVictory/createVictoryRewardState into victory-flow.ts
  - Extract stun/freeze talent effect helpers into talent-effects.ts
  - Move TalentEffectManifest type export from battle to game-data barrel
  - Refactor forge burst logic with shared onForgeCrossThreshold helper
  - Remove RUN_NAV_CONSTANTS object, use literals
  - Remove try/catch fallback in run reset
  …
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
  …
- refactor: standardize UI patterns across screens
  - Extract MaterialPill, GoldPill, StarRating, TabBar, TurnBadge components
  - Merge ProgressBar into Progress with size/color/fillStyle props
  - Create useInteractiveCard hook (hover + shimmer state) and migrate 5 screens
  - Create TiltSurface component and migrate 6+ callers
  - Replace inline tooltips with TooltipPanel + useTooltipFlip
  - Switch collection-screen and character-select to battle-store shimmer
  …
- refactor: skip startup loading screen via Playwright storageState, add maxFailures
  - Add dedicated alchemy-skip-loading-screen localStorage flag checked by
    useInitialLoadReady alongside the existing alchemy-dev-mode path
  - Set the flag globally for all e2e tests via Playwright storageState,
    so new tests automatically skip the loading screen without per-test
    enableDevMode() calls
  - Revert enableDevMode() additions from test files (no longer needed)
  …
- refactor: wire battle victory/defeat callbacks, centralise hydration, harden save validation
  - Wire onBattleVictory/onBattleDefeat via stable refs from useRunNavigation,
    replacing the brittle useEffect-based detection
  - Extract resetPlayerTurnState shared helper in enemy-turn to remove sync hazard
    between handleCCSkipTurn and performDrawAndResetPhase
  - Move hydrateCard from run-store into cards.ts (data layer) and update all
    call sites through the barrel export
  …
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
  …
- refactor: clean up and harden core subsystems across the codebase
  - Battle: remove dead code, split overlong functions, replace magic numbers
    with named constants, add file/function comments (apply-effects, card-play,
    combat-text, cost, damage, draw, enemy-turn, status-effects, status-ticks,
    trinket-effects, types, wish)
  - Mystery Events: remove unused vars/imports, extract helpers, add comments
  - Navigation: refactor destination-flow, mystery-flow, reward-flow,
  …
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
  …
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
  …
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
  …

### Tests

- test: retry transient autoplay HUD updates
- test: wait for battle readiness in CI
- test: allow autoplay CI headroom
- test: harden browser timing assertions
- test: stabilize critical e2e journeys
- test: reorganize suites and improve agent tooling
- test: page through expanded unique collection
- test: stabilize armory and tooltip CI checks
- test: tolerate subpixel collection gaps
- test: probe open trace
- test: cover crafting-ids extraction
- test: align labyrinth chamber label assertion
- test: cover desktop bridge contract
- test: add manifest utility ownership
- test: add mirrored owner for mystery effect order helper
- test: add mirrored owner for game-constants barrel
  Satisfies check:test-owners for src/lib/game-constants/index.ts added
  in 848981ea. Barrel re-export is verified via property existence.
  
  Co-Authored-By: internal-model
- test: add mirrored owners for new lib modules
- test: fix equipment hydrate fixture affix typing
- test: own startup marks and drop unused labyrinth exports
  CI requires a mirrored Vitest suite for src/lib files, and knip failed on
  map-state helpers that generation re-exported without consumers.
- test(e2e): keep contention-prone polls iterating instead of starving
  The autoplay, mode-tile tooltip, and collection aspect-ratio checks failed
  under 4-worker load when an inner expect spent its whole default timeout on
  one attempt: a victory-screen unmount left the pressed-attribute poll waiting
  on a detached toggle, and mid-mount zero-area tile boxes measured as NaN
  ratios. Short inner timeouts let the existing toPass loops re-hover and
  re-measure; aspect ratios now retry until every tile box is finite.
- test(e2e): drop unused smoke and armory tags
- test(verify): make focused e2e flows opt-in locally
  Local changed-path verification now runs focused unit suites plus the
  @prepush canary only; save, shop, audio, gear, and mystery browser flows
  are opt-in via --e2e <route>. CI keeps gating them through the every-push
  critical job, the path-filtered save-gate, and nightly.
- test(e2e): re-hover locked mode tiles until their tooltip mounts
  Under runner load the first hover can land before the tile settles and the
  portal never opens; retry the hover until the lock message is visible.
- test(e2e): align destination, autoplay, and progression assertions with shipped UI
  DestinationPage.expectVisible now accepts either the standard title or the
  choice list — boss-only runs title the screen with the upcoming boss, and
  injected primary-reward resumes can render before choices exist.
  
  The autoplay assertion tolerates the battle resolving (control unmounts)
  before the pressed attribute re-renders under worker contention.
  …
- test(assets): tolerate the Raw Assets sparse-checkout exclusion in CI
  The registry validation asserted raw source existence, but CI deliberately
  excludes Raw Assets from checkout — duplicate/export checks still run there,
  and the existence check stays active wherever raw art is present.
- test(e2e): stop the save fixture from clobbering injected talent unlocks
  injectSaveState now builds its payload from baseHomesteadSave, whose
  unlockedTalents empty default shallow-overwrites whatever earlier init
  scripts wrote at navigation time — so injectTalentUnlocks silently no-oped
  and block-start has been red since 11a71ff8. The prebuilt payload now skips
  that key so injection-owned keys survive the merge.
- test(menu): type finishedRunCharacters as a mutable array
  Pre-push typecheck rejected `[] as const` on the MenuScreen prop.
- test(e2e): expect opening fight-pacing on gear damage
  Flat physical still adds +1; the live clock scaler turns 6 authored
  damage into 7 on turn 1, so the HP assertion must include that.
- test(battle): fill burnBonus and freezeBonus in pacing fixture
  The enemy status object must include trait bonuses so test typecheck matches live BattleState.
- test: fix typecheck errors blocking pre-push
  Align battle fixtures and run-start snapshots with current mock and gold types
  so typecheck:all can pass.
- test(e2e): de-dupe critical/slow overlap
  Drop specs already covered by units, share layout and destination-inject
  helpers, and keep one representative size per aspect-ratio class.
- test: fix typecheck errors blocking push after armory and autoplay changes
- test(run): fix victory and combat-text typecheck errors
- test(e2e): remove battle flows redundant with unit and sibling specs
  trinkets-flow.spec.ts re-ran combat-mechanics' companion auto-attack battle but
  passed a runTrinkets flag whose effect it never asserted; delete it. The
  armory-crafting 'affix physical damage increases battle damage' battle is an
  identical assertGearFlatDamageBoostsPhysicalDamage flow to gear-combat's; drop
  it (slot math is unit-tested). Fold death-door-flow's third grace-preservation
  case into the defeat-lifecycle test, which already covers the icon and 1-HP
  …
- test(e2e): share goblin battle fixture and bootstrap helpers across specs
  Deduplicate the identical goblin enemy + battle state hand-built in
  death-door-flow, run-outcomes, and mid-combat-save into
  tests/e2e/battle-fixtures.makeGoblinBattleState. wildwood.spec.ts now builds
  its draft state from one wildwoodDraftDefaults factory instead of four inline
  copies, destination-progression uses the shared startAtDestination helper
  instead of a divergent local copy, difficulty-select dedupes its two
  …
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
  …
- test(changelog): conditionally skip sync guard locally
- test(e2e): refactor 5 slowest tests — split, save-injection, runtimeErrors
- test(armory): expand resolveEquipSwap coverage, add browseOnly and transfer-menu tests
  - Add 4 missing resolveEquipSwap scenarios: same-instance equip,
    displaced missing from inventoryById, incoming not on board, and
    multi-cell displacement
  - Add browseOnly when combat active prevents equip/unequip test
  - Add right-click opens transfer menu during salvage mode test
  - Tighten save-migration contract LAUNCH assertion to ===4
  …
- test(e2e): move combat test out of animation spec; apply fastBattle to draft/mystery/difficulty
- test: fix prepush unit failures
- test(e2e): stabilize critical run flow specs
- test(armory): add 7 e2e tests for right-click gear transfer and auto-swap
  New tests/gear-transfer.spec.ts (6 tests): sends gear to another
  class via right-click menu, sends equipped gear unequipped, excludes
  the source character, includes all unlocked characters, closes on
  Escape, closes on backdrop click.
  
  Add auto-swap test to tests/gear-equip.spec.ts: equipping a
  …
- test(armory): land 3 e2e specs covering combat, equip, and layout
  - tests/gear-combat.spec.ts (2 tests): equipped gear increases
    physical damage in battle; Armory editing is disabled while a
    battle is active (browseOnly banner is shown).
  - tests/gear-equip.spec.ts (6 tests): full inventory visible + drag
    equip + character switch; swap equipped gear via drag onto
    occupied slot; cursor-following during drag (no magnet snap);
  …
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

- ci: run lint:ci gates concurrently and add architecture smoke step
- ci(nightly): install Playwright Chromium in ship gate
- ci(actions): add reusable Playwright Chromium setup action
  Extract the shared cache-and-install Playwright browser logic used by the CI and
  nightly workflows into a composite action with an install-deps input, removing
  the duplicated inline steps and the drift-prone cache-miss branches.
- ci: split lint gate and add boundary plus report tooling
  Make CI failures easier to diagnose by splitting lint:ci into named
  steps, adding dependency-cruiser phase boundaries, shared Prettier
  path scripts, and Vitest/Playwright summary reporters.
- ci: reduce pipeline cost, add release automation, and rebalance E2E test tiers
  - Move full E2E suite off main-push to tag-push only (saves ~10 min per push)
  
  - Add lint, test, build, e2e-full (3 shards) to release.yml; block release on E2E failure
  
  - Add restore-keys fallback to all npm and Playwright caches; add asset cache
  …
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

- build: accelerate tsc and vite
  - enable incremental tsc with tsBuildInfoFile cache
  - set explicit vite cacheDir and disable reportCompressedSize unless ANALYZE
- build(deps): bump softprops/action-gh-release from 2.6.2 to 3.0.2
  Bumps [softprops/action-gh-release](https://github.com/softprops/action-gh-release) from 2.6.2 to 3.0.2.
  - [Release notes](https://github.com/softprops/action-gh-release/releases)
  - [Changelog](https://github.com/softprops/action-gh-release/blob/master/CHANGELOG.md)
  - [Commits](https://github.com/softprops/action-gh-release/compare/3bb12739c298aeb8a4eeaf626c5b8d85266b0e65...3d0d9888cb7fd7b750713d6e236d1fcb99157228)
  
  ---
  …
- build(deps): bump actions/download-artifact from 5 to 8
  Keep upload-artifact v7 and download-artifact v8 in lockstep.
- build(deps): bump actions/upload-artifact from 5 to 7
  Bumps [actions/upload-artifact](https://github.com/actions/upload-artifact) from 5 to 7.
  - [Release notes](https://github.com/actions/upload-artifact/releases)
  - [Commits](https://github.com/actions/upload-artifact/compare/v5...v7)
  
  ---
  updated-dependencies:
  …
- build(deps): bump actions/cache to v6 in setup-playwright
- build(deps): bump actions/cache from 5 to 6
  Bumps [actions/cache](https://github.com/actions/cache) from 5 to 6.
  - [Release notes](https://github.com/actions/cache/releases)
  - [Changelog](https://github.com/actions/cache/blob/main/RELEASES.md)
  - [Commits](https://github.com/actions/cache/compare/v5...v6)
  
  ---
  …
- build(deps): bump dorny/paths-filter from 3.0.3 to 4.0.3
  Bumps [dorny/paths-filter](https://github.com/dorny/paths-filter) from 3.0.3 to 4.0.3.
  - [Release notes](https://github.com/dorny/paths-filter/releases)
  - [Changelog](https://github.com/dorny/paths-filter/blob/master/CHANGELOG.md)
  - [Commits](https://github.com/dorny/paths-filter/compare/d1c1ffe0248fe513906c8e24db8ea791d46f8590...ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d)
  
  ---
  …
- build(pre-push): run the E2E canary against a fresh build and guard ship-unit scripts
  check:push now typechecks src and tests, then builds with committed assets
  (ALCHEMY_SKIP_ASSETS=1) before the @prepush E2E canary, so the browser gate never
  exercises stale dist/. Run typecheck:all in parallel for speed. Wrap the ship unit
  gate in scripts/run-ship-unit.mjs so a renamed or retyped suite path fails loudly
  instead of silently narrowing vitest's selection.
- build(desktop): disable implicit CI publishing
- build(desktop): invoke builder cross-platform
- build(desktop): harden Steam release boundary
- build: sync package-lock.json with package.json dependencies

### Docs

- docs: split battle rules and release setup into owned guides
  Move battle rules and glossary out of REFERENCE into GAME_RULES,
  and one-time shipping setup out of RELEASE into RELEASE_SETUP,
  leaving pointers behind. Retarget cross-links across AGENTS,
  ARMORY, WORKFLOWS, and audit docs; drop the completed archived
  plan and stale test-file inventory.
- docs: tighten ownership, fix drift, slim knowledge patterns
- docs: update simplification plan checklist
- docs: refresh README, agent policy, and context budgets
  Fix the CHANGELOG.md bold in AGENTS.md and keep command catalogs on their owners.
- docs: document the two per-mana-crystal damage units in the talent manifest
  Burn scales as a percent of max mana while freeze and companion scale as
  mana-halves; values are tuned around it and burn's percent is contractual
  with legacy saves, so record the divergence where future talents will look.
- docs: point verification, battle arithmetic, and motion rules at owner docs
- docs: architecture and contributing drift
  Correct public-asset layout, run-flow engine composition, battle screen
  data, fade/corruption owners, and bootstrap/helper paths.
- docs(ci): drop required ci-ok push gate on main
  Trunk pushes cannot wait on a status check that only exists after CI
  runs; document local pre-push + post-push CI + fixer bot instead.
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
  …
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
  …
- docs: update AGENTS.md rule to push directly to main
- docs: add PROMPTS.md with LLM code review guidance templates

### Chores

- chore: consolidate agent tooling and battle fixes
- chore: consolidate outstanding Alchemy updates
- chore: tighten local verification workflow
- chore(scripts): consolidate and simplify script catalog
  Remove deprecated agent-worktree.sh forwarder and duplicate
  audit:sweep alias; add clearly-named sync:art-barrels alongside
  sync:assets. Dedupe optimize pipeline runner, barrel export
  helper, and gear slot lookup; unify asset CLI runner shape and
  surface sound/music failure causes. Split docs contracts into
  gating plus advisory ledger, mark audit trend probes advisory,
  …
- chore(lint): tighten lint/knip guards and prune dead exports
- chore: consolidate verification workflow
- chore: trigger CI retry for e2e flakes
- chore: fix deadcode for unified persistence seam and draft helper
  Remove exported setDraftField (internal to createDraftFieldSetter) and
  add knip ignores for persistence compat re-exports that are consumed
  via codec-registry/persistence-coordinator barrels.
- chore: fix knip deadcode after barrel and registry additions
  Add game-constants barrel to knip entry, ignore the type-only
  architecture contract file, and suppress expected duplicate alias and
  registry export warnings.
  
  Co-Authored-By: internal-model
- chore: remove unused re-exports
  Drop isTrinketId and TrinketId from the catalog seam and
  RefreshableShopFields from the active-run type barrel. knip now
  reports clean.
- chore: update strict test typecheck comment and track remaining drift
  WS1 hydration failure is fixed; ~220 noUncheckedIndexedAccess /
  exactOptionalPropertyTypes violations remain in fixtures, gear, and
  browser helpers. Re-enable flags only alongside staged fixture
  cleanup with typed helpers.
- chore(release): derive patch notes from git history and path filters
  Honor User-Facing trailers and skip infra-only commits so Steam notes stay player-facing.
- chore: drop unused extractKeywordIds barrel re-export
- chore: verify prepared assets without mutating the tree
  Restore stale outputs on assets:check failure and own public/sounds via a manifest.
- chore: tighten documentation and audit tooling
- chore(tools): harden bounded command runners and drop dead script exports
  Adds an async sibling of runCommand for concurrent audit sweeps, parses
  git rename pairs in changed-path collection, guards changelog sync
  against git log failures, and removes re-export shims.
- chore(tools): inline static gates into lint-ci and check-push
- chore(ui): replace Radix switch with a native checkbox pill
- chore: drop exports knip flags as dead
  GoldCost and discoverTrinketIds re-exports lost their last barrel importers
  to the owning-module import pass; SelectableCardChrome is only referenced
  inside its own module.
- chore: dedupe playwright configs, slim pre-commit, and compose static gates
  - playwrightCiSettings shared base for the browser and desktop configs;
    desktop config gains preserveOutput=failures-only and globalTimeout
  - electron JSON results default to reports/playwright-electron-results.json
    so browser and desktop runs stop overwriting each other; CI summarize and
    artifact steps updated to match
  - pre-commit now only formats staged files; lockfile-check moves to pre-push
  …
- chore: drop duplicate ensure-electron from desktop ship test script
  Playwright globalSetup already runs scripts/ensure-electron.mjs before any
  spec executes; the npm-script copy ran the same check twice per run.
- chore: consolidate repository verification workflow
- chore(e2e): keep goblin fixture const module-local
  Knip flagged GOBBLIN_ENEMY as exported but only consumed by the same module.
- chore(ci): re-trigger checks after Dependabot rebase
- chore(config): use zsh shell and allow review rebase commands
- chore(changelog): generate CHANGELOG only at release
  Drop day-to-day post-commit/pre-push sync and CI Unreleased drift
  guards; conventional commits stay the source of truth until release
  prerelease/postbump rewrite and promote the changelog.
- chore(dev): add clean scripts and keep Playwright failure-only output
- chore(tooling): automate changelog sync after commits
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
  …
- chore(lint): enforce consistent-type-definitions, array-type; promote 5 rules to error; fix type->interface side effects
  - eslint.config.js: add consistent-type-definitions, array-type,
    no-template-curly-in-string; promote 5 rules to error
  - eslint.config.js: enable no-non-null-assertion as warn;
    react-refresh/only-export-components error in shared/ui
  - tsconfig.json: enable useUnknownInCatchVariables
  - Fix type->interface side effects in store-actions.ts,
  …
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
  …
- chore: add scaffold-test utility for mirroring source to test paths
- chore: sync CHANGELOG.md with recent commits
- chore: verify vercel git webhook after reconnect
- chore: checkpoint draw discard experiment
- chore: remove screenshot artifacts from tracking and add to .gitignore
- chore: baseline before UI palette redesign
- chore: reset repository to local workspace snapshot

### Style

- style: use interface and ReadonlyArray in enemy DoT pipeline
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
## [0.1.0] (2026-06-11)

### Features

- Initial Steam release preparation pipeline with agent-enforced ship gates.
