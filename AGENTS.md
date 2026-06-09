# Alchemy — AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder. Each **Run** starts by picking a **Character** with a unique starter deck. Battles are turn-based: draw cards, spend **Mana** to play them (deal damage, apply **Statuses**, gain **Block**, summon allies, etc.), then the enemy acts. Winning a battle rewards **Gold** and card choices, and the player picks a **Destination** to travel to next — more combat, a **Campfire** to heal, a **Merchant** or **Alchemist** shop, a **Mystery** event, or a **Corruption** altar that mutates a card. Die and the run ends. Survive through the final boss and win.

Between runs, the **Homestead** lets the player spend **Materials** on permanent upgrades. **Talent XP** earned during runs — awarded per **Keyword** when matching cards are played — unlocks passive bonuses that persist across future runs.

> **Related docs:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — run state and layers. [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) — implementation checklists. [PROMPTS.md](./PROMPTS.md) — agent audit stubs. [README.md](./README.md) — human setup. [CONTRIBUTING.md](./CONTRIBUTING.md) — git hooks.

### Agent defaults

- **Pre-PR:** `npm run lint:ci && npm test` · **Full hook:** `npm run check:push` ([CONTRIBUTING.md](./CONTRIBUTING.md))
- **Barrels:** `@/lib/game-data`, `@/lib/battle`, `@/lib/validation`, `@/features/alchemy/shared/screens`, `@/features/alchemy/shared/utils`, `@/features/alchemy/shared/storage`
- **Battle:** immutable `BattleState`, `state.rng` (not `Math.random()`), tuning in `game-constants.ts`
- **Routes:** `screen` on run domain store (`useActiveRunScreen`); no `React.lazy` on route screens — [Startup & upfront loading](#startup--upfront-loading)
- **Implementing content:** [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) task index
- **Stuck:** matching [PROMPTS.md](./PROMPTS.md) audit, then ask the user

## Quick Reference

- [Core Gameplay Mechanics](#core-gameplay-mechanics)
- [Environment & commands](#environment--commands)
- [Workflows](#workflows)
- [Architecture](#architecture)
    - [Import paths](#import-paths)
    - [Runtime map](#runtime-map)
- [Key Conventions](#key-conventions)
    - [React & UI Conventions](#react--ui-conventions)
- [Barrel Imports](#barrel-imports)
- [Common Mistakes](#common-mistakes)
- [Debugging](#debugging)
- [Verification Strategy](#verification-strategy)
- [Testing Patterns](#testing-patterns)
- [Large / Generated / Heavy Files](#large--generated--heavy-files)
- [AI Behavior](#ai-behavior)
- [Multi-Agent Rules](#multi-agent-rules)
- [Static Reference Guide](file:///c:/Users/Talye/Alchemy/docs/REFERENCE.md) (Glossary, command list, file locations)

## Core Gameplay Mechanics

Operational rules that deviate from typical CCG/roguelike assumptions (term definitions: [Glossary](#domain-glossary)):

- **Single enemy per battle (1-on-1 Targeting)** — All battles are strictly 1-on-1. Because of this, card effects apply implicitly: attacks/debuffs go to the single enemy, and blocks/heals/buffs go to the player or companions. No target selectors or targeting fields are used.
- **Mana resets fully each turn** — starts at `maxMana` (4 base), unspent mana is lost (unless Wellspring talent adds bonus mana).
- **Companions are invulnerable** — Summoned companions have no health, block, or stats, and cannot take damage or be targeted. They act automatically for the player at turn start, then persist indefinitely.
- **Draw 4 per turn, max hand 7** — overflow draws are silently skipped, not discarded. Hand is cleared to discard pile before drawing.
- **Deck auto-reshuffles** — when draw pile empties, discard is reshuffled immediately (mid-draw if needed). Only `consume` cards leave permanently. There are no mechanics to retrieve, view, or interact with cards in the discard or consumed states.
- **Block decays at end of enemy turn** — halved (not cleared) after the enemy attacks, during turn transition. Absorbs all enemy damage first.
- **Turn order** — Player (companion attacks → play cards) → Enemy (DoT ticks on enemy → enemy attacks → DoT ticks on player → regen) → Turn reset (draw 4, restore mana, decay block).
- **Status DoT ticks**: enemy DoTs tick at start of enemy phase; player DoTs tick during enemy resolution (after enemy attack). Stun/freeze CC checked after DoT damage.
- **Death's Door** — when player hits 0 HP, they get 1+ grace turn at 0 HP. Must heal above 0 before grace expires or the run ends. CC skip turns are suppressed during grace.
- **Battle RNG** — battle logic must use `state.rng`, not bare `Math.random()` (tests and `createBattleState` may pass explicit RNG).
- **Enemy status modifiers** — enemy status stack changes should go through `adjustEnemyStatusDelta()` so labyrinth/difficulty modifiers apply correctly.
- **Damage types** — eight types with per-enemy resist/vulnerable; see Glossary (**Damage type**).
- **Static Enemy Actions** — Enemies resolve their exact, static list of `enemyAttackEffects` sequentially every turn. There are no randomized intent selectors or stateful intent cycles.

## Environment & commands

- **Pre-PR / local checks:** `npm run lint:ci && npm test`
- **Full pre-push hook:** `npm run check:push`
- **PowerShell command chaining:** If running multiple terminal commands on Windows, use `; if ($?) { next-command }` as `;` alone ignores exit codes.
- For full command scripts, Node/npm requirements, Playwright, and balance sim settings, see **[docs/REFERENCE.md](./docs/REFERENCE.md#environment--commands)**.

## Workflows

| Task | Doc section |
|------|-------------|
| Card, effect kind, status, enemy, character, trinket, companion, keyword | [WORKFLOWS.md](./docs/WORKFLOWS.md#task-index) |
| Save / migration / active run | [WORKFLOWS.md](./docs/WORKFLOWS.md#change-persisted-save-data) |
| Screen, destination, mystery effect | [WORKFLOWS.md](./docs/WORKFLOWS.md#adding-a-new-screen) |
| Assets, REWARD_ROUTES, run teardown | [WORKFLOWS.md](./docs/WORKFLOWS.md) task index |

All step-by-step tables live in **[docs/WORKFLOWS.md](./docs/WORKFLOWS.md)**. Update that file when workflows or file paths change.

## Architecture

### Directory Layout

- `src/lib/` — Pure game logic (no React): `battle/`, `content-systems/` (`campaign`, `labyrinth`, `wildwood`), `homestead/`, `animation/`, `audio*.ts`, `trinkets.ts`, `game-constants.ts`.
- `src/features/alchemy/` — React UI. **`shared/`** — `ui/`, `config/`, `stores/`, `storage/`, `utils/`, `types.ts`, `screens/index.ts` (barrel). **`meta/`** — menu, collection, homestead, talents. **`run-setup/`** — run start screens. **`run-loop/`** — battle, navigation, shop, in-run screens. **`shell/`** — controllers. **New screens:** `run-loop/screens/` or `meta/screens/` → `shared/screens/index.ts` → `src/app/screen-routes/`.
- `src/app/` — Boot, `screen-routes/`, `render-alchemy-screen.tsx`.
- `src/components/ui/` — Shared primitives.
- `desktop/` — Electron; Steam via `src/lib/platform.ts`.
- `tests/` — Vitest (`tests/lib/`, `tests/features/`); Playwright (`tests/*.spec.ts`).
- `@/` → `src/`.

### Import paths

Use **on-disk** paths under `src/features/alchemy/` (e.g. `@/features/alchemy/shared/stores/run-session-facade`). Only `@/*` → `src/*` is configured in `tsconfig.json`. Edit `Screen` in [`src/lib/routing/screens.ts`](src/lib/routing/screens.ts), `DESTINATIONS` in [`src/lib/routing/destinations.ts`](src/lib/routing/destinations.ts), and `REWARD_ROUTES` in [`src/features/alchemy/shared/types.ts`](src/features/alchemy/shared/types.ts).

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
| Features (except `stores/`) | `run-session-facade` hooks, `readRunSessionStore`, `readActiveRunStore`, `readBattleStore` | `run-domain-store` direct imports |

Run-state ownership: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Lifecycle: **`useRunDomainStore`** with `progress`, `session`, `navigation`, `battle` slices; **`run-transitions.ts`** (`snapshotRun`, `restoreRun`, teardown); **`run-session-facade.ts`** for reads, writes, and hooks.

**Tech stack:** React 19 + React Compiler (`vite.config.ts`). Avoid patterns that fight the compiler.

### Runtime map

All paths under `src/features/alchemy/shared/stores/` unless noted. Import stores via `@/features/alchemy/shared/stores/*`.

| Concern | Entry points | Owns / notes |
|---------|--------------|--------------|
| **Run lifecycle** | `shell/use-alchemy-run-controller.ts`, `run-transitions.ts` | Composes controllers; `teardownRun`, `restoreRun`, `syncRunToBattleStart` |
| **Navigation & rewards** | `shell/use-run-navigation.ts`, `run-loop/navigation/*` | Destinations, rewards, mysteries, act transitions; `reward-flow.ts`, `mystery-flow.ts` |
| **Screen routing** | `shell/use-screen-navigation.ts`, `run-session-facade.ts` (`useActiveRunScreen`) | `navigation.screen` on domain store; `navigateTo` / `goToScreen` |
| **Run session API** | `run-session-facade.ts`, `run-session-model.ts` | Reads, writes, slice hooks; `useRunScreenData(screen)` for routes |
| **Run + talents (UI)** | `run-domain-store.ts` | `useRunAdapter`, `useTalentAdapter` over progress slice |
| **Battle** | `shell/use-battle-controller.ts`, `src/lib/battle/*` | Immutable `BattleState`; `playBattleCardResolved` → `applyCardEffects` |
| **Battle presentation** | `battle-presentation-store.ts` | VFX, ghosts, shake (not persisted) |
| **Shop** | `shell/use-shop-controller.ts`, `run-loop/shop/*` | Merchant / alchemist |
| **Labyrinth** | `shell/use-labyrinth-controller.ts`, `content-systems/labyrinth/` | Map + modifiers |
| **Persistence** | `shared/storage/io.ts`, `src/lib/validation/` | No Zustand `persist` middleware |
| **Meta / options** | `app-store.ts`, `homestead-store.ts`, `meta/screens/` | Collection, homestead, menu |
| **Run phase** | `@/lib/routing` (`getRunPhase`) | `meta` / `runLoop` / `battle` / `runEnd`; E2E: `data-run-phase` on `GameStage` |
| **UI transient** | `ui-store.ts`, `reset.ts` (`resetTransientRunUi`) | Hover / shimmer; clears transient session — **not** route `screen` |
| **App boot** | `src/app/screen-routes/`, `render-alchemy-screen.tsx` | Static screen registry, `ErrorBoundary` per route |

### Data Flow

- **Card play**: UI → `useBattleController.playCard()` → `playBattleCardResolved()` → `applyCardEffects()` → new `BattleState` → store → re-render.
- **Enemy turn**: `endPlayerTurn()` → enemy resolution → status ticks → new `BattleState`.
- **Screen transition**: `navigateTo` → `runDomain.navigation.screen` (`NAVIGATION_DELAY_MS`) → `renderAlchemyScreenRoute()`.

### Screen Routing

- **`Screen` union:** `shared/types.ts` — `ROUTE_SCREENS` / `CONSTANTS.SCREENS` (`menu`, `battle`, `rewards`, `destination`, …).
- **Dispatch:** `src/app/screen-routes/` + `src/lib/routing/run-screen-router.ts` for taxonomy.
- **Adding a screen:** [WORKFLOWS.md § Adding a new screen](./docs/WORKFLOWS.md#adding-a-new-screen).

### Startup & upfront loading

One loading experience at cold start, then instant navigation — no per-route "Loading …" fallbacks.

| Layer | Where | Policy |
|-------|--------|--------|
| **Images** | `allGameArt` in `assets.ts` (`import.meta.glob`, eager) | Decoded before menu via `useInitialLoadReady` |
| **Fonts** | `use-initial-load-ready.ts` | With images at startup |
| **Screen JS** | `screen-routes/` | Static imports from `@/features/alchemy/shared/screens` — **no** `React.lazy()` |
| **Runtime extras** | `use-app-preload-effects.ts` | Battle/rewards/shop warm-up only |
| **SFX** | `use-app-audio-effects.ts` | Critical sounds eager; rest on idle |

**Do not add:** `React.lazy()` on route screens; lazy game art; per-screen spinners for assets in `allGameArt`.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only.

**Campaign funnel:** `menu` → `game-mode-select` → `character-select` → `difficulty-select` → `draft-deck` → `battle`.

## Key Conventions

- **Immutability**: Battle state never mutated — reducer pattern through `applyCardEffects`.
- **Zustand stores**: `StoreFields` + `StoreActions`; factory initial state; granular selectors only. Persistence via `shared/storage/io.ts`.
- **Combat texts**: Merged by `(target, kind, stat)`.
- **Talent / trinket manifests**: Pre-computed once per battle on `BattleState`.
- **Upfront loading**: See [Startup & upfront loading](#startup--upfront-loading).
- **Tuning:** `src/lib/game-constants.ts` only — no magic numbers.
- **Rounding:** `Math.round()` in battle — never `Math.floor()` (ESLint).
- **File summaries:** One-line purpose comment at top of new/touched files.
- **Persistence:** Schemas, migrations, defaults, legacy fixtures together — [WORKFLOWS.md](./docs/WORKFLOWS.md).
- **Randomness:** `state.rng` in battle; deterministic test helpers.
- **Card/data:** Update `descriptionLines` with effects; barrel imports for game data.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — commitlint + lefthook.

### React & UI Conventions

- **No `React.FC`** — plain functions + explicit `Props` type.
- **Tailwind via `cn()`** from `@/lib/utils`; variants via `cva()`.
- **No template-literal classNames** — ESLint rules ban template literals inside `className` attributes (e.g. `className={`p-4 ${active ? "bg-primary" : ""}`}`). Use `cn(...)` from `@/lib/utils` for all dynamic or concatenated class names.
- **UI Store Isolation** — Presentational/reusable widgets in `src/features/alchemy/shared/ui/` must NOT import from domain/session/battle stores (`run-domain-store`, `battle-store`, `run-session-facade`). Pass state data via props; only `ui-store` is allowed for transient UI state (e.g. hovers).
- **Inline `style={}`** — rare: CSS vars for motion, runtime anchors, dynamic widths/images only.
- **No dynamic Tailwind segments** — use complete class strings from maps.
- **Theme tokens** from `src/index.css` — avoid arbitrary `rgba` when a token exists.
- **Event handlers** — UI sound first, then `onX?.(e)`; avoid `useEffect` for UI side effects.
- **Motion:** `framer-motion` / `PressableMotion` (`stiffness: 400`, `damping: 15`).
- **Modals:** `fixed` + `bg-black/70`; `stopPropagation` on panel.
- **Interactive elements:** default, hover, active, disabled.
- **No emoji in game UI.**

*(Definitions moved to **[docs/REFERENCE.md](./docs/REFERENCE.md#domain-glossary)**)*

## Barrel Imports

| Barrel | Barrel file |
|--------|-------------|
| `@/lib/game-data` | `src/lib/game-data/index.ts` |
| `@/lib/battle` | `src/lib/battle/index.ts` |
| `@/lib/validation` | `src/lib/validation/index.ts` |
| `@/features/alchemy/shared/screens` | `src/features/alchemy/shared/screens/index.ts` |
| `@/features/alchemy/shared/utils` | `src/features/alchemy/shared/utils/index.ts` |
| `@/features/alchemy/shared/storage` | `src/features/alchemy/shared/storage/index.ts` |

Top-level lib modules: `@/lib/audio.ts`, etc. Validation schemas stay on `@/lib/validation` (storage barrel is I/O + metadata).

## Navigation Hints

For file locations of audio, balance simulation, card library definitions, content systems, homestead features, etc., see **[docs/REFERENCE.md](./docs/REFERENCE.md#navigation-hints)**.



## Common Mistakes

- **Card effects without matching `descriptionLines`** — fails the strict `descriptions-match-effects` test. When changing/adding cards, enemies, or trinkets, make sure descriptions explicitly match their numeric effects, and run `npm test -- tests/lib/game-data/descriptions-match-effects.test.ts`.
- **ClassName template literals:** ESLint restricts using template literals inside `className={}` attributes. Always use `cn(...)` for dynamic strings.
- **Deep imports** — use barrels (see [Agent defaults](#agent-defaults)).
- **Mutating `BattleState`** or using `Math.random()` in battle.
- **`ui-store` / `resetTransientRunUi` for route `screen`** — use run domain `navigation.screen` + `useActiveRunScreen()` / `navigateTo`.
- **Importing `run-domain-store` from screens** — use `run-session-facade` outside `shared/stores/`.
- **`React.lazy()` on route screens** — static `screen-routes/` only.

## Debugging

- **DEV-only QA:** Skip Combat, Unlock All, Error Log (Options) — not in production; E2E must not target them.
- **Startup bypass:** `localStorage["alchemy-skip-loading-screen"]` — `shouldSkipStartupLoadingGate()` in `utils/dev-mode.ts`.
- **Startup validation:** `validate-startup.ts` on boot — check console.
- **Enemy turn warnings:** `[Enemy Turn]` in `enemy-turn.ts` for bad effects/traits.

## Verification Strategy

**Path → tests:** [CONTRIBUTING.md](./CONTRIBUTING.md#what-to-run-when-you-change). **Audits:** [PROMPTS.md](./PROMPTS.md) **When done** blocks.

### GitHub CLI (`gh`)

After local `npm` checks pass — not instead of them.

- **Use `gh` when asked:** PRs, `gh pr checks`, `gh run view --log-failed`.
- **Do not:** substitute for `npm test` / `lint:ci`; run `gh auth login`.
- **Git write:** `git push` / `gh pr create` only when the user explicitly requests.
- **CI workflow name:** **CI** (`.github/workflows/ci.yml`).

**Local gates:** `npm run lint:ci && npm test`; full hook: `npm run check:push`. Tests mirror source: `tests/lib/battle/foo.test.ts` ↔ `src/lib/battle/foo.ts`.

## Testing Patterns

- **Unit:** `createBattleState()` from `@/lib/battle/draw`; fixtures in `tests/fixtures/`; `describe` per mechanic.
- **E2E helpers, canary, fast mode:** [CONTRIBUTING.md § E2E helpers](./CONTRIBUTING.md#e2e-helpers).
- **Playwright E2E restrictions:** Do not use `skipCombatToVictory()`, `skipCombatBtn`, or target 'Skip Combat' / 'Unlock All' strings in e2e specs. These UI elements are hidden/disabled in preview/production builds, which will cause CI failures. Use preview-safe methods like `winViaCombat()` or `playCardNamed()`.

## Large / Generated / Heavy Files

Avoid repeated reads unless relevant:

- **Never edit:** `node_modules/`, `package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`, `release-desktop/**`, `coverage/**`, `reports/**` — also in [`.cursorignore`](.cursorignore)
- **Read on demand:** `game-constants.ts`, `cards.ts`, `keywords.ts`, `assets.ts`, `vite.config.ts`

## AI Behavior

- **When stuck:** After 3 failed attempts on the same approach, run a matching [PROMPTS.md](./PROMPTS.md) audit if applicable, then ask the user. No speculative spirals; timebox to 3 hypothesis steps per sub-problem.

## Multi-Agent Rules

- Never run `git reset`, `git checkout --`, `git restore`, `git clean`, `git rebase`, or `git merge`. **OpenCode:** [`opencode.json`](opencode.json). **Cursor:** same via user rules; ask before `git stash`.
- Only edit your assigned area; do not touch another agent's in-progress files.
- Commit and push directly to the main branch.
