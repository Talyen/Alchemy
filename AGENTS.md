# Alchemy — AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder. Each **Run** starts by picking a **Character** with a unique starter deck. Battles are turn-based: draw cards, spend **Mana** to play them (deal damage, apply **Statuses**, gain **Block**, summon allies, etc.), then the enemy acts. Winning a battle rewards **Gold** and card choices, and the player picks a **Destination** to travel to next — more combat, a **Campfire** to heal, a **Merchant** or **Alchemist** shop, a **Mystery** event, or a **Corruption** altar that mutates a card. Die and the run ends. Survive through the final boss and win.

Between runs, the **Homestead** lets the player spend **Materials** on permanent upgrades. **Talent XP** earned during runs — awarded per **Keyword** when matching cards are played — unlocks passive bonuses that persist across future runs.

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

## Commands

```sh
npm run dev              # Vite dev server
npm run dev:desktop      # Vite dev server + Electron shell
npm run build            # tsc + vite build
npm run build:web        # tsc + vite build (alias for build)
npm run build:desktop    # tsc + vite build in desktop mode
npm run package:win      # Build unpacked Windows desktop app
npm run dist:win         # Build Windows desktop installer
npm run check            # format:check + lint + test + build
npm run preview          # Preview production web build
npm test                 # vitest (unit tests)
npm run test:watch       # vitest in watch mode
npm run test:coverage    # vitest with coverage
npm run test:e2e         # Playwright tests
npm run test:e2e:smoke   # Playwright boot smoke test
npm run test:e2e:critical # Playwright critical flow subset
npm run test:e2e:ui      # Playwright UI mode
npm run balance:sim      # Balance simulator report
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run assets:optimize  # PNGs → webp
npm run sounds:optimize  # sounds → OGG
npm run music:optimize   # music optimization
npm run release          # Auto-bump + changelog + tag (patch)
```

## Workflows

**Add a new raw asset**: edit `scripts/optimize-assets.mjs` → `npm run assets:optimize` → import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`.

**Add new art**: place in `public/assets/card-art/` or `public/assets/templates/frames/` → add entry in `scripts/optimize-art.mjs` → `node scripts/optimize-art.mjs`.

**Add a new status effect**:
1. Define the status type in `src/lib/game-data/types.ts` — extend `PlayerStatusId` or `EnemyStatusId` string unions (discriminated union pattern).
2. Add tick logic in `src/lib/battle/status-ticks.ts`
3. Add application logic in `src/lib/battle/status-application.ts`
4. Add CC threshold logic in `src/lib/battle/status-cc.ts`
5. Register in `src/lib/battle/status-effects.ts`
6. Add matching keyword in `src/lib/game-data/keywords.ts`
7. Cover through `tests/lib/battle/` tests

**Add a new card**:

| Step | File(s) |
|---|---|
| 1. Add card ID to `CardId` union | `src/lib/game-data/types.ts` |
| 2. Define card object in `cardLibrary` array | `src/lib/game-data/cards.ts` |
| 3. Add effects (discriminated union on `kind`) | same file, `effects: [...]` |
| 4. Add art reference | `src/lib/game-data/assets.ts` |
| 5. (Optional) Register card sound | `src/lib/sound-registry.ts` (`cardSounds` record) |
| 6. Update `descriptionLines` to match effects | same `cards.ts` entry |
| 7. Cover through `tests/lib/game-data/descriptions-match-effects.test.ts` | |

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
| 4. Add summon card for companion (`kind: "summon-companion"`) | `src/lib/game-data/cards.ts` |
| 5. Add summon card ID to `CardId` union | `src/lib/game-data/types.ts` |
| 6. (Optional) Register card sound | `src/lib/sound-registry.ts` |
| 7. Add bond level to talent defaults (`companionBondLevels`) | `src/lib/game-data/talents.ts` |
| 8. Add bond level to homestead defaults | `src/lib/homestead/defaults.ts` |
| 9. Update description lines + tests | `tests/lib/game-data/companions.test.ts` + `tests/lib/game-data/descriptions-match-effects.test.ts` |

**Add a new keyword**:

| Step | File(s) |
|---|---|
| 1. Define keyword config (label, description, colors) | `src/lib/game-data/keywords.ts` |
| 2. Add display config if needed | `src/features/alchemy/config/keywords.ts` |
| 3. Add talent XP trigger | `src/lib/talents.ts` (keyword-based XP logic) |

## Architecture

### Directory Layout

- `src/lib/` — Pure game logic (no React): `battle/` (state machine, effects, draw), `content-systems/` (map & encounter generation — three variants: `campaign`, `labyrinth` with modifiers, `wildwood` with per-boss data), `homestead/` (between-run hub), `animation/` (particle systems), `talents.ts` (XP math), `audio.ts` + `audio-*.ts` (Web Audio buffer playback), `trinkets.ts`, `game-constants.ts` (all tuning knobs).
- `src/features/alchemy/` — React UI. Controllers (see below) bridge pure lib logic to React. Subdirs: `screens/` (pages), `ui/` (reusable widgets), `config/` (display config for enemies, keywords, routes, options, layout, combat-text icons), `battle/` (UI-side helpers: feedback, card ghost animations, auto-end-turn), `run/` (run init), `utils/` (feature-level utilities), `navigation/` (map screen, destination/mystery/reward/victory flows), `stores/` (Zustand), `storage/` (persistence), `talents/` (talent tree UI).
- `src/app/` — App bootstrapping: startup screen, audio/display/preload side-effect hooks, save-state hook, screen renderer.
- `src/components/` — Shared UI primitives (`ui/` subdirectory: `button.tsx`, `select.tsx`, `progress.tsx`, etc.).
- `src/lib/balance/` — Headless balance simulation engine.
- `src/lib/game-data/` — Cards, keywords, characters, companions, difficulties, talents, compendium (enemies & trinkets). Barrel export at `src/lib/game-data/index.ts`.
- `src/lib/validation/` — Zod schemas and migration validation for persisted saves.
- `src/lib/ui/` — Shared utility UI logic (e.g. `progress.ts`).
- `desktop/` — Electron main/preload entry points for desktop builds.
- `tests/` — Vitest unit/integration tests and Playwright e2e specs.
- `scripts/` — Build/optimization scripts.
- `@/` path alias → `src/`.

### Controllers (Feature Layer)

Controllers in `src/features/alchemy/` bridge pure lib logic to React UI:

| Controller | File | Owns |
|---|---|---|
| Run lifecycle | `use-alchemy-run-controller.ts` | Screen transitions, central orchestrator |
| Battle | `use-battle-controller.ts` | Battle state ↔ UI, ghost animations, turn flow |
| Labyrinth | `use-labyrinth-controller.ts` | Labyrinth map generation + modifier state |
| Navigation | `use-run-navigation.ts` | Destination selection, route availability |
| Run persistence | `use-run-state.ts` | Run persistence via storage layer |
| Homestead | `use-homestead-state.ts` | Homestead upgrades and material inventory |
| Shop | `use-shop-controller.ts` | Merchant and alchemist purchase flow |
| Talents | `use-talent-state.ts` | Talent tree state and XP spending |
| Mystery | `use-mystery-flow.ts` (in `navigation/`) | Mystery event resolution |

### Data Flow

- **Card play**: UI click → `useBattleController.playCard()` → `playBattleCardResolved()` (`src/lib/battle/card-play.ts`) → `applyCardEffects()` (`src/lib/battle/apply-effects.ts`) → new `BattleState` → Zustand store update → React re-render.
- **Enemy turn**: `endPlayerTurn()` (`src/lib/battle/enemy-turn.ts`) → enemy action resolution → status ticks → new `BattleState` → store update.
- **Screen transition**: Controller calls `goToScreen(Screen)` → Zustand `screen` field → `renderAlchemyScreen()` switch in `src/app/render-alchemy-screen.tsx` → matching React component mounts.

### Screen Routing

- Screen type union: `src/features/alchemy/types.ts` (20 values: `"menu"`, `"battle"`, `"rewards"`, `"destination"`, `"campfire"`, `"shop"`, `"alchemist"`, `"mystery"`, `"corruption"`, etc.)
- Dispatch: `renderAlchemyScreen()` in `src/app/render-alchemy-screen.tsx` — a `switch (screen)` returning the correct React component
- Navigation: `useAlchemyRunController.goToScreen(screen)` sets the screen store value

**Adding a new screen**:

| Step | File(s) |
|---|---|
| 1. Add string to `Screen` union and `ROUTE_SCREENS` | `src/features/alchemy/types.ts` |
| 2. Create component + barrel export | `src/features/alchemy/screens/<name>.tsx` + `screens/index.ts` |
| 3. Add case in `renderAlchemyScreen()` switch | `src/app/render-alchemy-screen.tsx` |
| 4. Add callbacks to `ControllerActions` type | `src/app/render-alchemy-screen.tsx` |
| 5. Wire navigation trigger | caller of `goToScreen("<name>")` |

**Adding a new destination (map node)**:

| Step | File(s) |
|---|---|
| 1. Add to `DESTINATIONS` const | `src/features/alchemy/types.ts` |
| 2. Add to `destinationPool` | `src/features/alchemy/config/routes.ts` |
| 3. Add availability logic in `getAvailableDestinations()` | same file |

**Adding a new mystery effect kind**:

| Step | File(s) |
|---|---|
| 1. Add `kind` string to `MysteryEffect` union | `src/features/alchemy/navigation/mystery-events.ts` |
| 2. Add `case` in `applyMysteryEffect()` switch | `src/features/alchemy/navigation/mystery-flow.ts` |
| 3. Add fields to `MysteryEffectContext` if needed | same file |
| 4. Wire follow-up UI in mystery screen | `src/features/alchemy/screens/mystery-screen.tsx` |

### Core Types

| Type | File |
|---|---|
| `BattleState` | `src/lib/battle/types.ts:93` |
| `BattleCard` | `src/lib/game-data/types.ts:82` |
| `RunStateFields` | `src/features/alchemy/stores/run-store.ts:30` |
| `Screen` | `src/features/alchemy/types.ts:9` |
| `TurnPhase` | `src/lib/battle/types.ts` |
| `EnemyState` / `EnemyTemplate` | `src/lib/game-data/types.ts` |
| `PlayerStatusId` / `EnemyStatusId` | `src/lib/game-data/types.ts` |

## Key Conventions

- **Immutability**: Battle state never mutated — `createBattleState`, `playBattleCardResolved`, `endPlayerTurn` all return new `BattleState`. Reducer pattern through `applyCardEffects`.
- **Zustand stores**: Separate `type StoreFields`, `type StoreActions`, then `type Store = StoreFields & StoreActions`. Use factory functions for initial state (never `null as Type`). Granular selectors only (`useStore(s => s.field)`), never the full store object. Persistence handled externally (`src/features/alchemy/storage/io.ts`), not through Zustand's built-in `persist` middleware.
- **Combat texts**: Merged by `(target, kind, stat)` — multi-hit cards produce a single floating number.
- **Talent effects**: Pre-computed once per battle into `TalentEffectManifest` on state.
- **Upfront asset preloading (intentional)**: All game art collected at build time via `import.meta.glob` with `eager: true` and preloaded during startup. **Do not switch to lazy-on-render asset loading.**
- **All tuning values** in `src/lib/game-constants.ts` — no magic numbers.
- **Rounding**: Battle math uses `Math.round()` — never `Math.floor()` (enforced by ESLint in battle files).
- **File summaries**: Every file begins with a one-line description of its purpose.
- **Why comments, not what**: Annotate non-obvious decisions; never restate the code.
- **Persistence**: Treat save data as external API. When changing stored shape, update defaults, schemas, migrations, and legacy save fixtures/tests together.
- **Randomness**: Prefer existing seeded/test helpers. Avoid tests that depend on lucky random outcomes.
- **Card/data consistency**: When changing card effects, update descriptions and tests together. Keep game data imports through the barrel.
- **Test-Driven Development**: Write tests before implementing features or fixing bugs.
- **Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, etc.) — enforced by commitlint + lefthook.

### React & UI Conventions

- **No `React.FC`** — components are plain functions with explicit `interface Props` or local `type` above the component
- **Tailwind via `cn()`** — use `cn()` from `@/lib/utils` for all conditional class merging. Order: layout/structure → visual → variant → external `className`. Primitives with variants use `class-variance-authority` (`cva()`)
- **Zustand selectors** — always granular: `useStore((s) => s.field)`, never the full store object
- **Event handlers** — chain feedback first (sound via `playUISound("buttonHover")`), then call original handler via `onX?.(e)`. Avoid `useEffect` for UI side effects
- **Motion** via `framer-motion` (`motion/react`). Use `PressableMotion` wrapper for spring-based press feedback (`stiffness: 400`, `damping: 15`)
- **Modals** — render as `fixed` overlay with backdrop `bg-black/70`, close on backdrop click with `e.stopPropagation()` on inner panel
- **Interactive elements** need all four states: default, hover, active/pressed, disabled
- **No emoji in game UI** — use icons or symbols

### Domain Glossary

| Term | Definition |
|---|---|---|
| **Block** | Temporary damage absorption that expires at end of player's turn. |
| **Burn** | Damage-over-time status; ticks at start of enemy turn, then stack decreases by 1. |
| **Combat Text** | Floating battle numbers merged per `(target, kind, stat)` for deduplication. |
| **Companion Bond** | Per-companion talent level that boosts companion damage each turn. |
| **Content System** | One of `campaign`, `labyrinth`, or `wildwood` — defines map generation, modifier pool, and encounter rules. |
| **Corruption** | Altar event that mutates a card by adding a random harmful effect/tag. |
| **Death's Door** | One-shot survival mechanic granting one final turn after player health reaches zero. |
| **Potion** | Consumable item with a temporary effect, mixed at the Alchemist shop. |
| **Status** | Temporary effect on a player or enemy with tick/expiry logic (e.g. Burn, Freeze, Poison, Stun). |
| **Summon** | Effect that brings a companion ally into battle. |
| **Talent Effect Manifest** | All active talent bonuses pre-computed into one object per battle (`BattleState.talentEffects`). |
| **Trinket Manifest** | All equipped trinket bonuses pre-computed once at battle start (`BattleState.trinketEffects`). |
| **Wish** | Effect presenting card choices from the full card library; queued via `wishQueue`. |

## Barrel Imports

Always import through canonical barrels, not deep paths:

| Barrel | Contents |
|--------|----------|
| `@/lib/game-data` | Types, cards, keywords, characters, companions, compendium, talents, difficulties, assets |
| `@/lib/battle` | Battle state machine helpers (`createBattleState`, `playBattleCardResolved`, `endPlayerTurn`, etc.) |
| `@/lib/validation` | Save schemas, migration, metadata, battle-state guard |
| `@/features/alchemy/screens` | All screen components |
| `@/features/alchemy/utils` | Battle helpers, card descriptions, DOM, enemy utils, random, string |

Individual top-level lib modules (`balance.ts`, `talents.ts`, `trinkets.ts`) are imported directly — e.g. `@/lib/talents.ts` (no barrel at `@/lib`).

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
| Feature config (enemies, keywords, routes, etc.) | `src/features/alchemy/config/` |
| Game-data types | `src/lib/game-data/types.ts` |
| Homestead (data, tiers, inventory, loot, logic) | `src/lib/homestead/` |
| Image preloading | `src/lib/image-preload.ts` |
| Labyrinth map generation | `src/lib/content-systems/labyrinth/map-generation.ts` |
| Labyrinth modifiers | `src/lib/content-systems/labyrinth/modifiers.ts` |
| Particle/animation system | `src/lib/animation/` |
| Platform bridge (desktop vs browser) | `src/lib/platform.ts` |
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
| Zustand stores | `src/features/alchemy/stores/` |

## Project Gotchas

- **Shell is PowerShell**: chain dependent commands with `; if ($?) { next-command }` — `;` alone always runs regardless of prior exit code. Double quotes for interpolation, single for verbatim.
- **Vite base path**: `/` (Vercel default); `npm run dev` opens browser automatically.
- **Assets**: `prebuild`/`predev` auto-run asset, sound, and music optimize scripts.
- **Desktop**: Web builds use Vite directly; desktop builds use Electron entry points in `desktop/` and Vite desktop mode.
- **SFX are buffers, not files**: SFX use Web Audio API buffer playback (`src/lib/audio.ts`); music MP3s are streamed via `<audio>` elements.

## Debugging

- **Dev mode**: `localStorage["alchemy-dev-mode"] = "true"` enables "Skip Combat" (battle screen), "Unlock All" QA panel (Options), and bypasses the startup loading screen
- **Startup validation**: `src/lib/validate-startup.ts` auto-runs assertions on boot — check console for errors if constants are invalid
- **Console warnings**: `src/lib/battle/enemy-turn.ts` logs `[Enemy Turn]` warnings for unrecognized attack effects or missing trait handlers
- **React DevTools**: Chrome extension for component tree and Zustand state inspection

## Verification Strategy

- **Battle logic**: Run focused Vitest files under `tests/lib/battle/`, then broader `npm test` when cross-cutting.
- **Card data/effects**: Run game-data tests + `tests/lib/game-data/descriptions-match-effects.test.ts` + relevant battle tests.
- **Save, storage, or schema changes**: Run storage, migration, validation, active-run, and legacy save fixture tests.
- **UI flow changes**: Run the relevant Playwright spec; use `npm run test:e2e:critical` for broad confidence.
- **Store/controller changes**: Run matching `tests/features/stores/`, navigation flow tests, and affected Playwright specs.
- **Desktop changes**: Run `npm run build:desktop` or a narrower package command.
- **Balance simulation**: After battle logic or card data changes, consider `npm run balance:sim` to detect win-rate regressions.
- **Content system changes** (labyrinth/wildwood): Run `tests/labyrinth.spec.ts`, `tests/labyrinth-node-types.spec.ts`, `tests/wildwood.spec.ts`.

Tests mirror source: `tests/lib/battle/foo.test.ts` tests `src/lib/battle/foo.ts`.

## Testing Patterns

- Use `createBattleState()` from `@/lib/battle/draw` for deterministic test setup.
- Prebuilt decks, enemies, and save data live in `tests/fixtures/`.
- Organize tests per mechanic: `describe("MechanicName", ...)` with focused `it` blocks.
- `test.skip(true, "reason")` when a required card isn't in the random opening hand.
- `startRun(page)`: navigates to `/`, clicks Play → Knight → Continue, waits for cards.
- `playUntilVictory(page)`: loops up to 12 turns playing all playable cards.
- Prefer deterministic setup helpers over relying on random opening hands or generated maps.

## Large / Generated / Heavy Files

Avoid repeated reads unless directly relevant:

- **Generated/heavy** (never edit): `node_modules/`, `package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`, `release-desktop/**`, `coverage/**`, `reports/**`
- **Large stable files** (edit rarely, read on demand): `src/lib/game-constants.ts`, `src/lib/game-data/cards.ts`, `src/lib/game-data/keywords.ts`, `src/lib/game-data/assets.ts`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`

## AI Behavior

- **Token efficiency**: Prefer targeted reads over full-file scans. Batch parallel tool calls. Prefer diffs over full rewrites. Status updates <100 words, implementation summaries <200 words.
- **When stuck**: If >3 attempts at the same approach fail, stop and ask the user. Do not speculative-spiral beyond 3 ungrounded hypothesis steps. Timebox sub-problems to 3 steps.
