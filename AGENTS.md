# Alchemy — AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder. Each **Run** starts by picking a **Character** with a unique starter deck. Battles are turn-based: draw cards, spend **Mana** to play them (deal damage, apply **Statuses**, gain **Block**, summon allies, etc.), then the enemy acts. Winning a battle rewards **Gold** and card choices, and the player picks a **Destination** to travel to next — more combat, a **Campfire** to heal, a **Merchant** or **Alchemist** shop, a **Mystery** event, or a **Corruption** altar that mutates a card. Die and the run ends. Survive through the final boss and win.

Between runs, the **Homestead** lets the player spend **Materials** on permanent upgrades. **Talent XP** earned during runs — awarded per **Keyword** when matching cards are played — unlocks passive bonuses that persist across future runs.

> **Related docs:** [PROMPTS.md](./PROMPTS.md) — copy-paste agent prompt library for focused audits. [README.md](./README.md) — human setup and feature overview.

## Quick Reference

- [Core Gameplay Mechanics](#core-gameplay-mechanics)
- [Prerequisites](#prerequisites)
- [Commands](#commands)
- [Workflows](#workflows)
- [Architecture](#architecture)
- [Key Conventions](#key-conventions)
    - [React & UI Conventions](#react--ui-conventions)
    - [Domain Glossary](#domain-glossary)
- [Barrel Imports](#barrel-imports)
- [Navigation Hints](#navigation-hints)
- [Project Gotchas](#project-gotchas)
- [Common Mistakes](#common-mistakes)
- [Debugging](#debugging)
- [Verification Strategy](#verification-strategy)
    - [GitHub CLI (`gh`)](#github-cli-gh)
- [Testing Patterns](#testing-patterns)
- [Large / Generated / Heavy Files](#large--generated--heavy-files)
- [AI Behavior](#ai-behavior)
- [Multi-Agent Rules](#multi-agent-rules)
- [Agent prompt library (PROMPTS.md)](./PROMPTS.md)

## Core Gameplay Mechanics

Non-obvious rules that deviate from typical CCG/roguelike assumptions:

- **Single enemy per battle** — always 1-on-1. No multi-enemy fights, no AoE targeting decisions.
- **Mana resets fully each turn** — starts at `maxMana` (4 base), unspent mana is lost (unless Wellspring talent adds bonus mana).
- **Companions are invulnerable** — no HP, no damage targeting, no block. They act for the player automatically at turn start, then persist indefinitely.
- **Draw 4 per turn, max hand 7** — overflow draws are silently skipped, not discarded. Hand is cleared to discard pile before drawing.
- **Deck auto-reshuffles** — when draw pile empties, discard is reshuffled immediately (mid-draw if needed). Only `consume` cards leave permanently.
- **Block decays at end of enemy turn** — halved (not cleared) after the enemy attacks, during turn transition. Absorbs all enemy damage first.
- **Turn order** — Player (companion attacks → play cards) → Enemy (DoT ticks on enemy → enemy attacks → DoT ticks on player → regen) → Turn reset (draw 4, restore mana, decay block).
- **Status DoT ticks**: enemy DoTs tick at start of enemy phase; player DoTs tick during enemy resolution (after enemy attack). Stun/freeze CC checked after DoT damage.
- **Death's Door** — when player hits 0 HP, they get 1+ grace turn at 0 HP. Must heal above 0 before grace expires or the run ends. CC skip turns are suppressed during grace.
- **Battle RNG** — battle logic must use `state.rng`, not bare `Math.random()` (tests and `createBattleState` may pass explicit RNG).
- **Enemy status modifiers** — enemy status stack changes should go through `adjustEnemyStatusDelta()` so labyrinth/difficulty modifiers apply correctly.
- **Damage types** — card effects and enemy attacks use one of nine damage types (`physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature`, `arrow`); enemies can resist or be vulnerable per type.

## Prerequisites

- **Node.js `>=24`** — authoritative version in `package.json` `engines` (README may lag; trust `engines`).
- **npm 10+**
- **GitHub CLI (`gh`)** — optional for humans; expected for agentic PR/CI workflows ([install](https://cli.github.com/)). Authenticate once with `gh auth login` (interactive; not for agents to run).
- **Playwright (e2e)**: run `npx playwright install chromium` once before the first local `npm run test:e2e`.

## Commands

```sh
npm run dev              # Vite dev server
npm run dev:desktop      # Vite dev server + Electron shell
npm run build            # tsc + vite build
npm run build:web        # tsc + vite build (alias for build)
npm run build:desktop    # tsc + vite build in desktop mode
npm run compile:desktop  # tsc + vite build in desktop mode (used by package:win)
npm run package:win      # compile:desktop + unpacked Windows desktop app
npm run package:win:full # build:desktop + unpacked Windows desktop app
npm run dist:win         # Build Windows desktop installer
npm run prepare          # Install lefthook git hooks (runs on npm install)
npm run check            # npm ci --dry-run + lint:ci + test + build
npm run check:push       # check + test:e2e:prepush (full local gate before main)
npm run preview          # Preview production web build
npm test                 # vitest (unit tests)
npm run test:watch       # vitest in watch mode
npm run test:coverage    # vitest with coverage
npm test -- <path>       # Run a single test file (e.g. `npm test -- tests/lib/battle/foo.test.ts`)
npm run test:e2e         # Playwright tests
npm run test:e2e:smoke   # Playwright boot smoke test
npm run test:e2e:critical # Playwright critical flow subset
npm run test:e2e:prepush  # Fast @prepush e2e subset (parallel preview; pre-push hook)
npm run test:e2e:prepush:full  # Full @critical on preview (matches CI e2e job)
npm run test:e2e:main-gate     # Full Playwright suite on preview (matches CI e2e-full on main)
npm run test:e2e:preview  # Full Playwright suite against preview build (CI e2e-full)
npm run test:e2e:ui      # Playwright UI mode
npm run balance:sim      # Balance simulator report
npm run lint             # ESLint
npm run lint:ci          # format:check + lint + deadcode (matches CI lint job and pre-push hook)
npm run lint:fix         # ESLint auto-fix
npm run deadcode         # knip unused exports (also runs inside lint:ci and check)
npm run deadcode:strict  # stricter knip pass
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run assets:optimize  # PNGs → webp
npm run sounds:optimize  # sounds → OGG
npm run music:optimize   # music optimization
npm run release          # Auto-bump + changelog + tag (patch)
npm run release:minor    # minor version bump + changelog + tag
npm run release:major    # major version bump + changelog + tag
```

**Pre-PR (lighter than `check`):** `npm run lint:ci && npm test`

**Git hooks (lefthook, via `npm run prepare`):** `pre-push` runs sequentially: `lint:ci`, `test`, `build`, then `test:e2e:prepush` (~9 parallel `@prepush` tests). CI still runs full `@critical` via `test:e2e:prepush:full`. See [CONTRIBUTING.md](./CONTRIBUTING.md).

**Balance sim env vars** (see [README.md](./README.md)): `ALCHEMY_BALANCE_ITERATIONS`, `ALCHEMY_BALANCE_POLICY` (`random-playable`, `greedy-damage`, `defensive-random`).

## Workflows

**Add a new raw asset**: edit `scripts/optimize-assets.mjs` → `npm run assets:optimize` → import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`.

**Add new art**: place in `public/assets/card-art/` or `public/assets/templates/frames/` → add entry in `scripts/optimize-art.mjs` → `node scripts/optimize-art.mjs`.

**Change persisted save data** (see also [`src/features/alchemy/storage/MIGRATIONS.md`](src/features/alchemy/storage/MIGRATIONS.md)):

1. Decide if a schema bump is needed (transform required vs safe additive default).
2. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
3. Add `migrateVNToVNPlus1` in `src/lib/validation/migration.ts` and chain it from `migrateSaveDataToCurrent` (tests use `storage/migrations.ts` → `SaveDataSchema.parse` only).
4. Update Zod schemas in `src/lib/validation/save-schemas.ts`, storage defaults, and legacy fixtures in `tests/fixtures/legacy-saves.ts`.
5. Run storage/migration tests (`tests/features/storage.test.ts`, `tests/features/storage/migrations.test.ts`, and related `tests/features/storage/` specs).

**Change mid-run resume (`ActiveRunData`)**:

1. Extend `ActiveRunData` and Zod schema in `src/lib/validation/save-schemas.ts` if new fields are required.
2. Update `createActiveRunData()` in `src/features/alchemy/run-loop/run/active-run-data.ts` and the snapshot builder in `run-loop/run/use-active-run-snapshot.ts`.
3. Update hydration in `shell/use-alchemy-run-controller.ts` via `restoreActiveRunToStores` (restore `screen`, `destinationChoices`, combat, etc.).
4. Run `tests/features/storage/active-run.test.ts` plus storage/migration tests.

**Active-run helpers (do not confuse):**

| Function | Module | When |
|----------|--------|------|
| `normalizeActiveRunData` | `@/lib/validation` | Zod transform while loading save files (legacy deck / content-system fixes) |
| `parseActiveRun` | `@/lib/active-run-session` or `@/features/alchemy/storage/active-run` | Runtime validation before hydration |

**Add or change post-victory routing (`REWARD_ROUTES`)**:

| Step | File(s) |
|---|---|
| 1. Add route constant | `src/features/alchemy/types.ts` → `REWARD_ROUTES`, exported via `CONSTANTS` |
| 2. Compute route after rewards | `src/features/alchemy/navigation/reward-flow.ts` (`finalizeRewardState` / related) |
| 3. Handle transition | `reward-flow.ts` (`executeRewardRouteTransition`) and/or `shell/use-run-navigation.ts` (`routeAfterReward`) |
| 4. Tests | `tests/features/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run |

**Run teardown** — `src/features/alchemy/stores/reset.ts`:

- `teardownRun()` / `flushSaveAfterRunEnd()` in [`run-lifecycle-coordinator.ts`](src/features/alchemy/shared/stores/run-lifecycle-coordinator.ts) — run teardown and immediate save flushes (navigation calls these on run end).
- `clearAllPersistentGameData()` — clears app options, permanent run/talent data, and homestead (Options “clear save”).

**Add a new status effect**:
1. Define the status type in `src/lib/game-data/types.ts` — extend `PlayerStatusId` or `EnemyStatusId` string unions (discriminated union pattern).
2. Add tick logic in `src/lib/battle/status-ticks.ts`
3. Add application logic in `src/lib/battle/status-application.ts`
4. Add CC threshold logic in `src/lib/battle/status-cc.ts`
5. Register in `src/lib/battle/status-effects.ts`
6. Add matching keyword in `src/lib/game-data/keywords.ts`
7. Cover through `tests/lib/battle/status-*.test.ts` tests

**Add a new card**:

| Step | File(s) |
|---|---|
| 1. Define card in `combatCards.ts` or `supportCards.ts` (merged into `cardLibrary`) | `src/lib/game-data/cards/` |
| 2. Add effects (discriminated union on `kind`) | same entry, `effects: [...]` |
| 3. Add art reference | `src/lib/game-data/assets.ts` (or `placeholderCard` while WIP) |
| 4. (Optional) Register card sound | `src/lib/sound-registry.ts` (`cardSounds` record) |
| 5. Update `descriptionLines` to match effects | same card entry |
| 6. Cover through `tests/lib/game-data/descriptions-match-effects.test.ts` | |

**Add a new card effect `kind`** (new `effects[].kind` string):

| Step | File(s) |
|---|---|
| 1. Add to `BattleCardEffect` union | `src/lib/game-data/types.ts` |
| 2. Create `effects/<kind>/definition.ts` (schema + `dispatchRoute`) | `src/lib/game-data/effects/` |
| 3. Register in `TEMPLATE_EFFECT_DEFINITIONS` (+ `ALL_EFFECT_REGISTRY_ENTRIES` if needed) | `src/lib/game-data/effects/template-definitions.ts` |
| 4. Add `kind` to `BATTLE_CARD_EFFECT_KINDS` | `src/lib/game-data/effects/kinds.ts` |
| 5. Implement handler (existing route module or new) | `src/lib/battle/effect-handlers/` — see `src/lib/game-data/effects/BATTLE_HANDLERS.md` |
| 6. Update `effect-metadata.ts` keywords | `src/lib/game-data/effect-metadata.ts` |
| 7. Tests | `tests/lib/battle/apply-effects*.test.ts`, `tests/lib/game-data/effects-registry.test.ts` |

Cards in `cardLibrary` are automatically included in merchant shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration (only `mixed-potion` is excluded).

**Add a new character**:

| Step | File(s) |
|---|---|
| 1. Add character ID to `CharacterId` union | `src/lib/game-data/types.ts` |
| 2. Define character in `characters` record | `src/lib/game-data/characters.ts` |
| 3. List card IDs in `startingDeck` (resolved via `resolveDeck`) | same file |

**Add a new enemy**:

| Step | File(s) |
|---|---|
| 1. Add enemy ID to `EnemyId` union | `src/lib/game-data/types.ts` |
| 2. Define entry in `enemyBestiary` array | `src/lib/game-data/compendium.ts` |
| 3. Set `enemyType` (`normal`/`elite`/`boss`) | same file |
| 4. Add traits as `{ id, title, description }` objects | same file (logic lives in battle system) |
| 5. (Optional) Register attack sound | `src/lib/sound-registry.ts` (`enemyAttackSounds`) |

**Add a new trinket**:

| Step | File(s) |
|---|---|
| 1. Define entry in `trinketLibrary` array | `src/lib/game-data/compendium.ts` |
| 2. Implement effect logic | `src/lib/trinkets.ts` — extend `TrinketEffectManifest` and apply in battle init |
| 3. Add art reference | `src/lib/game-data/assets.ts` |

**Add a new companion**:

| Step | File(s) |
|---|---|
| 1. Add companion ID to `CompanionId` union | `src/lib/game-data/types.ts` |
| 2. Add optimized art and barrel export | `src/lib/game-data/assets.ts` |
| 3. Define companion in `companionLibrary` record | `src/lib/game-data/companions.ts` |
| 4. Add summon card via `summonCompanionCard()` in `combatCards.ts` / `supportCards.ts` | `src/lib/game-data/cards/card-builders.ts` — companion must have **exactly one** `turnStartEffects` entry |
| 5. Add summon card ID to `CardId` union | `src/lib/game-data/types.ts` |
| 6. (Optional) Register card sound | `src/lib/sound-registry.ts` |
| 7. Add bond level to talent defaults (`companionBondLevels`) | `src/lib/game-data/talents/manifest-defaults.ts` |
| 8. Add bond level to homestead defaults | `src/lib/homestead/defaults.ts` |
| 9. Update description lines + tests | `tests/lib/game-data/companions.test.ts` + `tests/lib/game-data/descriptions-match-effects.test.ts` |

**Add a new keyword**:

| Step | File(s) |
|---|---|
| 1. Define keyword config (label, description, colors) | `src/lib/game-data/keywords.ts` |
| 2. Add display config if needed | `src/features/alchemy/shared/config/keywords.ts` |
| 3. Add talent XP trigger | `src/lib/talents.ts` (keyword-based XP logic) |

## Architecture

### Directory Layout

- `src/lib/` — Pure game logic (no React): `battle/` (state machine, effects, draw), `content-systems/` (map & encounter generation — three variants: `campaign`, `labyrinth` with modifiers, `wildwood` with per-boss data), `homestead/` (between-run hub), `animation/` (particle systems), `talents.ts` (XP math), `audio.ts` + `audio-*.ts` (Web Audio buffer playback), `trinkets.ts`, `game-constants.ts` (all tuning knobs).
- `src/features/alchemy/` — React UI (Phase 3 zones). **`shared/`** — `ui/`, `config/`, `stores/`, `storage/`, `utils/`, `types.ts`. **`meta/`** — menu, collection, homestead, talents. **`run-setup/`** — character/difficulty/draft/wildwood screens + run start init. **`run-loop/`** — battle, navigation, shop, in-run screens, destination/reward handlers. **`shell/`** — `use-alchemy-run-controller`, `use-run-navigation`, battle/shop/labyrinth controllers. Root shims (`types.ts`, `run/*.ts`, `screens/index.ts`) keep `@/features/alchemy/...` imports stable.
- `src/app/` — App bootstrapping: startup loading gate, audio/display/preload side-effect hooks, save-state hook, `screen-routes/` (route registry), `render-alchemy-screen.tsx` (store subscriptions + render wrapper).
- `src/components/` — Shared UI primitives (`ui/` subdirectory: `button.tsx`, `select.tsx`, `progress.tsx`, etc.).
- `src/lib/balance/` — Headless balance simulation engine.
- `src/lib/game-data/` — Cards, keywords, characters, companions, difficulties, talents, compendium (enemies & trinkets). Barrel export at `src/lib/game-data/index.ts`.
- `src/lib/validation/` — Zod schemas and migration validation for persisted saves.
- `src/lib/ui/` — Shared utility UI logic (e.g. `progress.ts`).
- `desktop/` — Electron main/preload entry points for desktop builds; Steam Cloud/rich presence via `src/lib/platform.ts` with web fallbacks.
- `tests/` — Vitest under `tests/lib/`, `tests/features/`, etc.; Playwright e2e at `tests/*.spec.ts`.
- `scripts/` — Build/optimization scripts.
- `@/` path alias → `src/`.

### Import boundaries (ESLint)

Enforced in `eslint.config.js` — violations fail `npm run lint`.

| Layer | May import | Must not import |
|-------|------------|-----------------|
| `src/lib/**` | other `lib/`, npm | `@/features/**` |
| `src/lib/game-data/**` | lib data modules | `@/lib/battle` |
| `src/lib/battle/**` | lib, npm | `react`, `zustand`, `@/features/**` |
| `features/alchemy/*/screens/**` | `shared/ui`, `config`, props types | `run-loop/battle`, `run-loop/navigation`, `run/`, session actions |
| `features/alchemy/meta/**` | `shared/` | `run-loop/`, `run-setup/` |
| `features/alchemy/shared/ui/**` | `ui-store` only (ephemeral hover) | run/battle/session stores |
| Features (except `stores/`) | facade hooks, `run-session-actions`, `readRunSessionStore` | `run-session-store`, `store-access` |

Run-state ownership and Phase 4 consolidation plan: [`RUN_STATE.md`](src/lib/active-run-session/RUN_STATE.md).

**Tech stack:** React 19 with React Compiler enabled (`vite.config.ts`, ESLint `react-compiler` rule). Avoid patterns that fight the compiler; use documented `eslint-disable` only when intentional.

### Feature Hooks & Controllers

Orchestration in `src/features/alchemy/shell/` bridges pure lib logic to React UI. `*-controller.ts` hooks compose domain factories from `run-loop/` and `run-setup/`. Run progression, session UI, and screen routing live in separate stores: **`run-progress-store`** (`useRunStore`), **`run-session-store`** (`useRunSessionStore`), and **`navigation-store`** (`useNavigationStore`). Bootstrap hydrates run + screen via `initializeActiveRunStores()` in [`run-store-sync.ts`](src/features/alchemy/shared/stores/run-store-sync.ts). Lifecycle sync/teardown/save flushes: [`run-lifecycle-coordinator.ts`](src/features/alchemy/shared/stores/run-lifecycle-coordinator.ts). Use `useRunAdapter()` / `useTalentAdapter()` from [`run-store.ts`](src/features/alchemy/stores/run-store.ts); use `useActiveRunScreen()` from [`run-session-facade.ts`](src/features/alchemy/stores/run-session-facade.ts) for navigation screen state.

| Hook / controller | File | Owns |
|---|---|---|
| Run lifecycle | `shell/use-alchemy-run-controller.ts` | Composes battle/shop/labyrinth/nav; delayed `navigateTo` via `useScreenNavigation` |
| Screen pacing | `shell/use-screen-navigation.ts` | `navigateTo`, `commitPendingTransition` (reads/writes `navigation-store` via caller) |
| Battle | `shell/use-battle-controller.ts` | Battle state ↔ UI, ghost animations, turn flow |
| Labyrinth | `shell/use-labyrinth-controller.ts` | Labyrinth map generation + modifier state |
| Navigation | `shell/use-run-navigation.ts` | Rewards, destinations, mysteries, campfires, act transitions, run defeat/victory teardown |
| Run + talents | `stores/run-store.ts` | Deck, gold, HP, acts/destinations, talent XP/unlocks (`useRunAdapter`, `useTalentAdapter`) |
| Navigation screen | `stores/navigation-store.ts` | Current `screen` + `setScreen` (source of truth for routing) |
| Homestead | `homestead-store.ts` | Homestead upgrades and material inventory |
| Shop | `shell/use-shop-controller.ts` | Merchant and alchemist purchase flow |
| Mystery (pure) | `run-loop/navigation/mystery-flow.ts` | `applyMysteryEffect` and related helpers |
| Mystery (hook) | `run-loop/navigation/use-mystery-flow.ts` | React wiring for mystery event resolution |

### Zustand Stores

| Store | File | Owns |
|---|---|---|
| App / options | `app-store.ts` | Display/audio options, collection discovery, completed difficulties |
| Transient run UI | `run-session-store.ts` | Reward state, shop/alchemist offers, labyrinth map + pending node, mystery event/choices, corruption result, pending character/content-system |
| Navigation screen | `navigation-store.ts` | Current `screen` + `setScreen` (`screen-store.ts` resets transient session + ui stores only) |
| Run lifecycle | `run-lifecycle-coordinator.ts` | `syncRunToBattleStart`, `syncBattleToRun`, `teardownRun`, `flushSaveAfterRunEnd` |
| Run session facade | `stores/run-session-facade.ts` | `getRunSession` / `useRunSession`, `buildActiveRunSnapshotFromStores`, `restoreActiveRunToStores`, `useActiveRunScreen` (re-exports lifecycle APIs) |
| Run screen flattening | `stores/run-screen-data.ts` | `flattenRunSessionForScreens` — flat props for `screen-routes/`; hook: `useRunScreenData(screen)` |
| Session store access | `store-access.ts`, `run-session-actions.ts`, `run-session-read.ts` | Writes: `run-session-actions`; reads: `readRunSessionStore()`; avoid direct `useRunSessionStore` outside store modules |
| Narrow session hooks | `run-session-model.ts` | `useRunSessionBattleContext`, `useRunSessionNavigationSlice`, `useRunSessionShopSlice`, `useRunSessionMysterySlice`, `useRunSessionLabyrinthSlice` — prefer over full `useRunSession` |
| Run phase | `@/lib/routing` (`getRunPhase`, `RunPhase`) | `meta` / `runLoop` / `battle` / `runEnd` from screen + `hasActiveBattle`; `data-run-phase` on `#vr-stage`; Steam via `getSteamRichPresenceLabel` |
| Run + talents | `run-store.ts` | Persistent run fields and talent XP/unlocks; exposes `useRunAdapter()` / `useTalentAdapter()` |
| Battle | `battle-store.ts` | Synced battle state, display overrides, active-battle flag |
| Homestead | `homestead-store.ts` | Material inventory and upgrade tiers |
| Error log (dev) | `error-log-store.ts` | Dev error log buffer |

Implementation under `src/features/alchemy/shared/stores/` (`run-progress-store.ts`, `run-session-store.ts`, `navigation-store.ts`; `@/features/alchemy/stores/*` aliases resolve here).

### Data Flow

- **Card play**: UI click → `useBattleController.playCard()` → `playBattleCardResolved()` (`src/lib/battle/card-play.ts`) → `applyCardEffects()` (`src/lib/battle/effect-handlers/dispatch.ts`) → new `BattleState` → Zustand store update → React re-render.
- **Enemy turn**: `endPlayerTurn()` (`src/lib/battle/enemy-turn.ts`) → enemy action resolution → status ticks → new `BattleState` → store update.
- **Screen transition**: `goToScreen` / `navigateTo` in run controller → `navigation-store.screen` (100ms delay via `NAVIGATION_DELAY_MS` in `game-constants.ts`) → `RenderAlchemyScreen` → `renderAlchemyScreenRoute()` in `src/app/screen-routes/`. Transition commits can defer store updates until the old screen unmounts (see `useScreenNavigation` in `shell/use-screen-navigation.ts`).
- **Run phase reads**: Prefer `useRunSession(screen)` or `nav.runPhase` over re-deriving from stores. Screen routes use `useRunScreenData(screen)` (includes `phase`). E2E: `GameStage` in `tests/pages/game-stage.ts` reads `data-run-phase`.

### Screen Routing

- Screen type union: `Screen` in `src/features/alchemy/types.ts` — see `ROUTE_SCREENS` (also `CONSTANTS.SCREENS`) for the canonical list (`menu`, `game-mode-select`, `character-select`, `difficulty-select`, `draft-deck`, `battle`, `rewards`, `destination`, `options`, `collection`, `talents`, `homestead`, `game-over`, `campfire`, `shop`, `alchemist`, `mystery`, `corruption`, `run-victory`, `labyrinth-map`, `wildwood-select`).
- Dispatch: `renderAlchemyScreenRoute()` in `src/app/screen-routes/` (barrel `index.ts`) — a `Record<Screen, …>` registry, each route wrapped in `ErrorBoundary`. Screen taxonomy and documented transitions: `src/lib/routing/run-screen-router.ts`. `RenderAlchemyScreen` in `src/app/render-alchemy-screen.tsx` subscribes to stores and passes props into the route registry. `screen` lives in **`navigation-store`** (`useActiveRunScreen()`), not local React state.
- Navigation: prefer `CONSTANTS.SCREENS` over raw string literals. `goToScreen` (in `shell/use-run-navigation.ts`) clears hover state then calls `navigateTo`; run-flow screens call `navigateTo` directly from navigation.

### Startup & upfront loading

Alchemy uses **one** loading experience at cold start, then instant screen navigation — no per-route "Loading …" fallbacks.

| Layer | Where | Policy |
|-------|--------|--------|
| **Images** | `allGameArt` in `src/lib/game-data/assets.ts` (`import.meta.glob` with `eager: true`) | Every optimized `.webp` is discovered at build time and decoded before the menu via `useInitialLoadReady` in `App.tsx` |
| **Fonts** | `document.fonts.ready` in `use-initial-load-ready.ts` | Waited alongside images during startup |
| **Screen JS** | `src/app/screen-routes/` | All screens are **static** imports from `@/features/alchemy/screens` — **no** `React.lazy()`, **no** route-level `Suspense` |
| **Runtime extras** | `use-app-preload-effects.ts` | Screen-aware image warm-up for battle/rewards/shop only (safety net; main art is already decoded at startup) |
| **SFX** | `preloadAllSounds()` in `use-app-audio-effects.ts` | Critical UI/battle sounds eager; remainder on idle |

**Do not add:**

- `React.lazy()` / dynamic `import()` for route screens (causes visible "Loading collection/homestead/options" flashes).
- Lazy-on-render card/enemy art (`loading="lazy"` on game art, or deferring `import.meta.glob` for assets).
- Per-screen loading spinners for assets already covered by `allGameArt`.

**E2E / dev bypass:** `localStorage["alchemy-skip-loading-screen"]` (Playwright) skips the startup gate only — it does not change production loading policy.

**Campaign run start funnel:** `menu` → `game-mode-select` → `character-select` → `difficulty-select` → `draft-deck` (see `DRAFT_ROUNDS` in `game-constants.ts`) → `battle`.

**Content-system entry screens:** `labyrinth-map` (labyrinth), `wildwood-select` (wildwood).

**Adding a new screen**:

| Step | File(s) |
|---|---|
| 1. Add string to `Screen` union and `ROUTE_SCREENS` | `src/features/alchemy/types.ts` |
| 2. Create component + barrel export | `src/features/alchemy/screens/<name>.tsx` + `screens/index.ts` |
| 3. Export from screens barrel | `src/features/alchemy/screens/index.ts` |
| 4. Add route handler in `meta-routes`, `run-setup-routes`, or `run-loop-routes` (wrapped in `ErrorBoundary` via registry) | `src/app/screen-routes/` |
| 5. Extend `RenderAlchemyScreenProps` / route context if new props needed | `src/app/render-screen-props.ts`, `src/app/render-alchemy-screen.tsx` |
| 6. Add callbacks to `ControllerActions` if new handlers needed | `src/app/controller-actions.ts` |
| 7. Wire navigation trigger | caller of `goToScreen("<name>")` |

**Adding a new destination (map node)**:

| Step | File(s) |
|---|---|
| 1. Add to `DESTINATIONS` const | `src/features/alchemy/types.ts` |
| 2. Add to destination pool / availability | `src/lib/routing/destination-availability.ts` (re-exported from `features/alchemy/config/routes.ts`) |

**Adding a new mystery effect kind**:

| Step | File(s) |
|---|---|
| 1. Add `kind` string to `MysteryEffect` union | `src/lib/mystery/types.ts` |
| 2. Add `case` in `applyMysteryEffect()` switch | `src/features/alchemy/navigation/mystery-flow.ts` (pure logic) |
| 3. Add fields to `MysteryEffectContext` if needed | `mystery-flow.ts` |
| 4. Wire React hook if needed | `src/features/alchemy/navigation/use-mystery-flow.ts` |
| 5. Wire follow-up UI in mystery screen | `src/features/alchemy/screens/mystery/mystery-screen.tsx` |

### Core Types

| Type | File |
|---|---|
| `BattleState` | `src/lib/battle/types.ts` |
| `BattleCard` | `src/lib/game-data/types.ts` |
| `RunStateFields` | `src/features/alchemy/stores/run-store.ts` |
| `Screen` | `src/features/alchemy/types.ts` |
| `TurnPhase` | `src/lib/battle/types.ts` |
| `EnemyState` / `EnemyTemplate` | `src/lib/game-data/types.ts` |
| `PlayerStatusId` / `EnemyStatusId` | `src/lib/game-data/types.ts` |

## Key Conventions

- **Immutability**: Battle state never mutated — `createBattleState`, `playBattleCardResolved`, `endPlayerTurn` all return new `BattleState`. Reducer pattern through `applyCardEffects`.
- **Zustand stores**: Separate `type StoreFields`, `type StoreActions`, then `type Store = StoreFields & StoreActions`. Use factory functions for initial state (never `null as Type`). Granular selectors only (`useStore(s => s.field)`), never the full store object. Persistence handled externally (`src/features/alchemy/storage/io.ts`), not through Zustand's built-in `persist` middleware.
- **Combat texts**: Merged by `(target, kind, stat)` — multi-hit cards produce a single floating number.
- **Talent effects**: Pre-computed once per battle into `TalentEffectManifest` on state.
- **Upfront loading (intentional)**: See [Startup & upfront loading](#startup--upfront-loading) — images/fonts at startup, all route screens eagerly imported. Do not reintroduce lazy routes or lazy-on-render game art.
- **All tuning values** in `src/lib/game-constants.ts` — no magic numbers.
- **Rounding**: Battle math uses `Math.round()` — never `Math.floor()` (enforced by ESLint in battle files).
- **File summaries**: New and touched files should start with a one-line purpose comment at the top (older battle files may use mid-file block comments instead).
- **Why comments, not what**: Annotate non-obvious decisions; never restate the code.
- **Persistence**: Treat save data as external API. When changing stored shape, update defaults, schemas, migrations, and legacy save fixtures/tests together.
- **Randomness**: Prefer existing seeded/test helpers. Avoid tests that depend on lucky random outcomes. Battle code uses `state.rng`.
- **Card/data consistency**: When changing card effects, update descriptions and tests together. Keep game data imports through the barrel.
- **Tests**: Preferred for battle logic, save migrations, and regressions; write or update tests before merging substantive behavior changes.
- **Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, etc.) — enforced by commitlint + lefthook.

### React & UI Conventions

- **No `React.FC`** — components are plain functions with explicit `interface Props` or local `type` above the component
- **Tailwind via `cn()`** — use `cn()` from `@/lib/utils` for all conditional class merging. Order: layout/structure → visual → variant → external `className`. Primitives with variants use `class-variance-authority` (`cva()`)
- **Inline `style={}`** — rare; prefer Tailwind utilities. Keep inline styles only for: (1) CSS custom properties consumed by `index.css` motion/tilt rules (`--card-base-transform`, `--stagger-index`, `--talent-glass-accent`, etc.); (2) runtime layout from DOM or data (tooltip/menu anchors, labyrinth/talent node `%` positions, combat-text lane offsets); (3) values that cannot be static utilities (progress bar width, dynamic `backgroundImage`, keyword ring `--tw-ring-color`). Document non-obvious props (`wrapperStyle`, `anchorStyle`) at their type definition.
- **Dynamic Tailwind classes** — never interpolate utility segments (e.g. `` `text-${color}-500` ``). Pass complete class strings from maps/constants (`colorClass`, `layout.ts` width classes).
- **Theme tokens** — colors and glows from `:root` / `@theme` in `src/index.css`; avoid arbitrary `rgba(...)` in components when a token or utility class exists.

- **Event handlers** — chain feedback first (sound via `playUISound("buttonHover")`), then call original handler via `onX?.(e)`. Avoid `useEffect` for UI side effects
- **Motion** via `framer-motion` (`motion/react`). Use `PressableMotion` wrapper for spring-based press feedback (`stiffness: 400`, `damping: 15`)
- **Modals** — render as `fixed` overlay with backdrop `bg-black/70`, close on backdrop click with `e.stopPropagation()` on inner panel
- **Interactive elements** need all four states: default, hover, active/pressed, disabled
- **No emoji in game UI** — use icons or symbols

### Domain Glossary

| Term | Definition |
|---|---|
| **Block** | Temporary damage absorption; halved (not cleared) at end of enemy turn. |
| **Burn** | Damage-over-time status; ticks at start of enemy turn, then stack decreases by 1. |
| **Combat Text** | Floating battle numbers merged per `(target, kind, stat)` for deduplication. |
| **Companion Bond** | Per-companion talent level that boosts companion damage each turn. |
| **Content System** | One of `campaign`, `labyrinth`, or `wildwood` — defines map generation, modifier pool, and encounter rules. |
| **Corruption** | Altar event that mutates a card by adding a random harmful effect/tag. |
| **Damage type** | One of nine types (`physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature`, `arrow`); enemies can resist or be vulnerable per type. |
| **Death's Door** | Survival mechanic: at 0 HP the player gets one or more grace turns; must heal above 0 before grace expires or the run ends. |
| **Potion** | Consumable item with a temporary effect, mixed at the Alchemist shop. |
| **Regen / Regeneration** | Enemy trait that restores health each turn; resolved at the end of the enemy phase. |
| **Reward route** | Internal post-rewards destination (`CONSTANTS.REWARD_ROUTES` in `types.ts`), not a player-facing screen. |
| **Status** | Temporary effect on a player or enemy with tick/expiry logic (e.g. Burn, Freeze, Poison, Stun). |
| **Summon** | Effect that brings a companion ally into battle. |
| **Talent Effect Manifest** | All active talent bonuses pre-computed into one object per battle (`BattleState.talentEffects`). |
| **Trinket Manifest** | All equipped trinket bonuses pre-computed once at battle start (`BattleState.trinketEffects`). |
| **Wish** | Effect presenting card choices from the full card library; queued via `wishQueue`. |

## Barrel Imports

Always import through canonical barrels, not deep paths. The authoritative list lives in each barrel's `index.ts`:

| Barrel | Barrel file |
|--------|-------------|
| `@/lib/game-data` | `src/lib/game-data/index.ts` |
| `@/lib/battle` | `src/lib/battle/index.ts` |
| `@/lib/validation` | `src/lib/validation/index.ts` |
| `@/features/alchemy/screens` | `src/features/alchemy/screens/index.ts` |
| `@/features/alchemy/utils` | `src/features/alchemy/utils/index.ts` |
| `@/features/alchemy/storage` | `src/features/alchemy/storage/index.ts` |

Individual top-level lib modules are imported directly — e.g. `@/lib/talents.ts` (no barrel at `@/lib`). The storage barrel re-exports I/O and metadata; **validation schemas** stay on `@/lib/validation`. Read the barrel file when you need to confirm its exports.

## Navigation Hints

| Need | Look in |
|---|---|
| Audio (buffer cache / music / SFX / state / volume) | `src/lib/audio-*.ts` |
| Balance simulation | `src/lib/balance/` |
| Card corruption | `src/features/alchemy/corruption.ts` |
| Card effects data | `src/lib/game-data/cards.ts` |
| Characters data | `src/lib/game-data/characters.ts` |
| Companions data | `src/lib/game-data/companions.ts` |
| Content system types | `src/lib/content-systems/types.ts` |
| Destination / reward / victory routing | `src/features/alchemy/run-loop/navigation/` (alias `@/features/alchemy/navigation/*`) |
| Post-victory routing / reward routes | `navigation/reward-flow.ts`, `CONSTANTS.REWARD_ROUTES` in `types.ts` |
| Reward card/trinket sampling | `reward-utils.ts` |
| Shared nav helpers (novice start, defeat teardown) | `navigation/run-navigation-helpers.ts` |
| Active-run snapshot | `run-loop/run/active-run-data.ts`, `run-loop/run/use-active-run-snapshot.ts`, `storage/active-run.ts` |
| Run lifecycle (sync/teardown/flush) | `stores/run-lifecycle-coordinator.ts` |
| Store reset on run end | `stores/reset.ts` (prefer `teardownRun()` from lifecycle coordinator) |
| Run + talent Zustand API | `stores/run-store.ts` (`useRunAdapter`, `useTalentAdapter`) |
| Feature config (enemies, keywords, routes, etc.) | `src/features/alchemy/shared/config/` (barrel: `config.ts` → `shared/config-barrel.ts`) |
| Game-data types | `src/lib/game-data/types.ts` |
| Homestead (data, tiers, inventory, loot, logic) | `src/lib/homestead/` |
| Image preloading | `src/lib/image-preload.ts` |
| Startup loading gate | `src/app/use-initial-load-ready.ts`, `src/app/startup-loading-screen.tsx` |
| Screen route registry | `src/app/screen-routes/` |
| Run screen taxonomy | `src/lib/routing/run-screen-router.ts` |
| Labyrinth map generation | `src/lib/content-systems/labyrinth/map-generation.ts` |
| Labyrinth modifiers | `src/lib/content-systems/labyrinth/modifiers.ts` |
| Particle/animation system | `src/lib/animation/` |
| Platform bridge (desktop / Steam vs browser) | `src/lib/platform.ts`, `desktop/` |
| Potion mixing | `src/features/alchemy/potion-mixer.ts` |
| Save migrations doc | `src/features/alchemy/storage/MIGRATIONS.md` |
| Save/load and migrations | `src/features/alchemy/storage/`, `src/lib/validation/` |
| Shared UI logic | `src/lib/ui/` |
| Sound behavior | `src/lib/audio.ts` |
| Sound-to-card registry | `src/lib/sound-registry.ts` |
| Startup validation | `src/lib/validate-startup.ts` |
| Talent maths | `src/lib/talents.ts` |
| Trinket logic | `src/lib/trinkets.ts` |
| Tuning values | `src/lib/game-constants.ts` |
| Wildwood boss data | `src/lib/content-systems/wildwood/bosses.ts` |
| Feature-level utilities (battle helpers, card descriptions, DOM, enemy utils, random, string) | `src/features/alchemy/utils/` |
| Zustand stores | `src/features/alchemy/stores/` |

## Project Gotchas

- **Shell is PowerShell**: chain dependent commands with `; if ($?) { next-command }` — `;` alone always runs regardless of prior exit code. Double quotes for interpolation, single for verbatim.
- **Vite base path**: `/` (Vercel default); `npm run dev` opens browser automatically.
- **Assets**: `prebuild`/`predev` auto-run asset, sound, and music optimize scripts.
- **Desktop**: Web builds use Vite directly; desktop builds use Electron entry points in `desktop/` and Vite desktop mode. Steam Cloud and rich presence use `platform.ts` with local fallbacks when Steam is unavailable.
- **SFX are buffers, not files**: SFX use Web Audio API buffer playback (`src/lib/audio.ts`); music MP3s are streamed via `<audio>` elements.

## Common Mistakes

- **Forgetting both `src/lib/game-data/talents/` (data, manifest defaults, pool) and `src/lib/talents.ts` (XP math)** exist — they serve different purposes. Add bond level defaults to `manifest-defaults.ts`, XP triggers to `src/lib/talents.ts`.
- **Editing a card effect without updating `descriptionLines`** — the descriptions-match-effects test will fail.
- **Using deep imports** instead of barrel imports (`@/lib/game-data`, `@/lib/battle`, etc.) — always use the canonical barrel.
- **Mutating battle state** instead of returning a new `BattleState` — state is immutable; reducer pattern only.
- **Hardcoding magic numbers** — put all tuning values in `src/lib/game-constants.ts`.
- **Using `Math.random()` in battle logic** — use `state.rng` so runs and tests stay deterministic.
- **Treating `screen-store` as route state** — it does not store `screen`; use `navigation-store` via `useActiveRunScreen()` and run controller `navigateTo`.
- **Importing deleted run/talent hooks** — use `useRunAdapter` / `useTalentAdapter` from `run-store.ts`.
- **Code-splitting route screens with `React.lazy()`** — all screens must static-import via `screen-routes/`; use the startup gate for load time, not per-navigation Suspense fallbacks.

## Debugging

- **Dev build** (`import.meta.env.DEV`): "Skip Combat" (battle screen) and "Unlock All" / Error Log QA panel (Options). Not available in production builds. E2E specs must not target these controls (enforced by ESLint on `tests/**/*.spec.ts`).
- **Startup bypass**: `localStorage["alchemy-skip-loading-screen"]` (Playwright) skips the startup loading gate only — see `shouldSkipStartupLoadingGate()` in `src/features/alchemy/utils/dev-mode.ts`
- **Startup validation**: `src/lib/validate-startup.ts` auto-runs assertions on boot — check console for errors if constants are invalid
- **Console warnings**: `src/lib/battle/enemy-turn.ts` logs `[Enemy Turn]` warnings for unrecognized attack effects or missing trait handlers
- **React DevTools**: Chrome extension for component tree and Zustand state inspection

## Verification Strategy

Each audit prompt in [PROMPTS.md](./PROMPTS.md) ends with explicit verification commands for that task; pick the prompt that matches your change and run its **When done** block.

### GitHub CLI (`gh`)

Use the [GitHub CLI](https://cli.github.com/) for GitHub-hosted steps after local checks pass — not for building or testing the app (use `npm` commands above).

- **When to use `gh`**: open or update PRs when the user asks; inspect CI (`gh pr checks`, `gh run list`, `gh run view --log-failed`); re-run workflows when explicitly requested.
- **When not to use `gh`**: substitute for `npm test`, `npm run lint`, or `npm run check`; run `gh auth login` (interactive; ask the user to authenticate instead).
- **Auth**: If `gh auth status` reports not logged in, say so and continue with local verification; do not invent CI results.
- **Git write**: `git push` and `gh pr create` only when the user explicitly requests them (same policy as commits in user rules and [Multi-Agent Rules](#multi-agent-rules)).
- **Typical commands**: `gh pr create`, `gh pr checks`, `gh run list --workflow CI`, `gh run view <id> --log-failed`.

Detailed PR steps live in Cursor user rules; this repo’s CI workflow is named **CI** (`.github/workflows/ci.yml`).

- **Pre-push gate**: lefthook `pre-push` (or `npm run check:push` manually). Lighter static-only check: `npm run lint:ci && npm test`.
- **Battle logic**: Run focused Vitest files under `tests/lib/battle/`, then broader `npm test` when cross-cutting.
- **Card data/effects**: Run game-data tests + `tests/lib/game-data/descriptions-match-effects.test.ts` + relevant battle tests.
- **Save, storage, or schema changes**: Run `tests/features/storage.test.ts`, `tests/features/storage/migrations.test.ts`, `tests/features/storage/active-run.test.ts`, validation tests, and legacy save fixtures under `tests/fixtures/`.
- **UI flow changes**: Run the relevant Playwright spec in `tests/*.spec.ts`; use `npm run test:e2e:prepush` for CI parity.
- **Store/controller changes**: Run matching `tests/features/stores/` (including `run-session-facade.test.ts`), `tests/lib/active-run-session/hydrate.test.ts`, `tests/architecture/active-run-bootstrap.test.ts`, navigation flow tests under `tests/features/navigation/`, and `npm run test:e2e:prepush`.
- **Desktop changes**: Run `npm run build:desktop` or a narrower package command.
- **Balance simulation**: After battle logic or card data changes, consider `npm run balance:sim` to detect win-rate regressions.
- **Content system changes** (labyrinth/wildwood): Run `tests/labyrinth.spec.ts`, `tests/labyrinth-node-types.spec.ts`, `tests/wildwood.spec.ts`.

Tests mirror source: `tests/lib/battle/foo.test.ts` tests `src/lib/battle/foo.ts`.

## Testing Patterns

- Use `createBattleState()` from `@/lib/battle/draw` for deterministic test setup.
- Prebuilt decks, enemies, and save data live in `tests/fixtures/`.
- Organize tests per mechanic: `describe("MechanicName", ...)` with focused `it` blocks.
- `test.skipIf(condition)` when a required card isn't in the random opening hand.
- `startCampaignBattle(page, character?)`: navigates to `/`, clicks a character → Continue, waits for cards.
- `tests/helpers.ts` contains shared helpers: `startCampaignBattle`, `startBattleWithDeck`, `injectSaveState`, `resumeCampaignRun`, etc.
- Prefer deterministic setup helpers over relying on random opening hands or generated maps.
- First-time e2e: `npx playwright install chromium` before `npm run test:e2e`.

## Large / Generated / Heavy Files

Avoid repeated reads unless directly relevant:

- **Generated/heavy** (never edit): `node_modules/`, `package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`, `release-desktop/**`, `coverage/**`, `reports/**`
- **Edit-rarely, read on demand**: `src/lib/game-constants.ts`, `src/lib/game-data/cards.ts`, `src/lib/game-data/keywords.ts`, `src/lib/game-data/assets.ts`, `vite.config.ts`

## AI Behavior

- **When stuck**: If >3 attempts at the same approach fail, stop and ask the user. Do not speculative-spiral beyond 3 ungrounded hypothesis steps. Timebox sub-problems to 3 steps.

## Multi-Agent Rules

- Never run `git reset`, `git checkout --`, `git restore`, `git clean`, `git rebase`, or `git merge`. **OpenCode** enforces this via bash permissions in [`opencode.json`](opencode.json). **Cursor** does not read that file — follow the same restrictions via user rules and these docs; ask before `git stash`.
- Only edit files in your assigned area of the codebase. Do not modify files being worked on by another agent.
- If you need changes from another agent's work, ask the user to merge them in.
- Commit to your own branch, not `main`, unless explicitly told otherwise.
