# Changelog

All notable changes to Alchemy are documented here. Player-facing summaries ship in `release-notes/`.

## [Unreleased]

### Features

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

- perf: speed up pre-push e2e with parallel @prepush subset
  Run eight parallel prepush tests locally; keep full critical suite for CI via test:e2e:prepush:full.

### Refactors

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

- docs: update AGENTS.md rule to push directly to main
- docs: add PROMPTS.md with LLM code review guidance templates

### Chores

- chore: verify vercel git webhook after reconnect
- chore: checkpoint draw discard experiment

### Other

- Abstract encounter traits across Labyrinth and Wildwood
## [0.1.0] (2026-06-11)

### Features

- Initial Steam release preparation pipeline with agent-enforced ship gates.
