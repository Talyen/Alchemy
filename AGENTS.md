# Alchemy — AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder. Each **Run** starts by picking a **Character** with a unique starter deck. Battles are turn-based: draw cards, spend **Mana** to play them (deal damage, apply **Statuses**, gain **Block**, summon allies, etc.), then the enemy acts. Winning a battle rewards **Gold** and card choices, and the player picks a **Destination** to travel to next — more combat, a **Campfire** to heal, a **Merchant** or **Alchemist** shop, a **Mystery** event, or a **Corruption** altar that mutates a card. Die and the run ends. Survive through the final boss and win.

Between runs, the **Homestead** lets the player spend **Materials** on permanent upgrades. **Talent XP** earned during runs — awarded per **Keyword** when matching cards are played — unlocks passive bonuses that persist across future runs.

## Commands

```sh
npm run dev              # Vite dev server
npm run dev:desktop      # Vite dev server + Electron shell
npm run build            # tsc + vite build
npm run build:web        # tsc + vite build (alias for build)
npm run compile:desktop  # tsc + vite build --mode desktop
npm run build:desktop    # tsc + vite build in desktop mode
npm run package:win      # Build unpacked Windows desktop app
npm run package:win:full # Build unpacked Windows app (full path)
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
npm run release:minor    # Force minor bump
npm run release:major    # Force major bump
```

Add a new raw asset:
1. Add entry to `scripts/optimize-assets.mjs`
2. `npm run assets:optimize`
3. Import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`

Add a new raw art asset:
1. Place art in `public/assets/card-art/` or `public/assets/templates/frames/`
2. Add entry to `scripts/optimize-art.mjs`
3. `node scripts/optimize-art.mjs`

Add a new status effect:
1. Define the status type in `src/lib/game-data/types.ts`
2. Add tick logic in `src/lib/battle/status-ticks.ts`
3. Add application logic in `src/lib/battle/status-application.ts`
4. Add CC threshold logic in `src/lib/battle/status-cc.ts`
5. Register in `src/lib/battle/status-effects.ts`
6. Add matching keyword in `src/lib/game-data/keywords.ts`
7. Cover through `tests/lib/battle/` tests

## Architecture

- `src/lib/` — Pure game logic (no React): `battle/` (state machine, effects, draw), `content-systems/` (map & encounter generation), `homestead/` (between-run hub), `animation/` (particle systems), `talents.ts` (XP math), `audio.ts` + `audio-*.ts` (Web Audio buffer playback), `trinkets.ts`, `game-constants.ts` (all tuning knobs).
- `src/features/alchemy/` — React UI. `use-alchemy-run-controller.ts` is the central orchestrator; `screens/` are pages, `ui/` are reusable widgets.
- `src/features/alchemy/stores/` — Zustand stores for app, screen, run, battle, and homestead state.
- `src/features/alchemy/storage/` — Save/load, persistence defaults, active-run storage, options, and migrations.
- `src/features/alchemy/navigation/` — Map screen and routing between destinations.
- `src/features/alchemy/talents/` — Talent tree UI.
- `src/lib/balance/` — Headless balance simulation engine.
- `src/lib/ui/` — Shared utility UI logic (e.g. `progress.ts`).
- `src/lib/game-data/` — Cards, keywords, characters, companions, difficulties, talents, compendium (enemies & trinkets). Barrel export at `src/lib/game-data/index.ts`.
- `src/lib/validation/` — Zod schemas and migration validation for persisted saves.
- `src/app/` — App-level bootstrapping: startup screen, save version checks, initial-load hook.
- `src/components/` — Shared UI primitives (`ui/` subdirectory: `button.tsx`, `select.tsx`, `progress.tsx`, etc.).
- `desktop/` — Electron main/preload entry points for desktop builds.
- `tests/` — Vitest unit/integration tests and Playwright e2e specs.
- `scripts/` — Build/optimization scripts (asset, sound, music optimization, etc.).
- `@/` path alias → `src/`.

## Key Conventions

- **Immutability**: Battle state never mutated — `createBattleState`, `playBattleCardResolved`, `endPlayerTurn` all return new `BattleState`. Reducer pattern through `applyCardEffects`.
- **Store initialization**: Never initialize Zustand store fields with `null as Type` or `null as unknown as Type` — use a factory function or a valid default value. The type assertion bypasses `strictNullChecks` and can cause runtime crashes in subscribers.
- **Combat texts**: Merged by `(target, kind, stat)` — multi-hit cards produce a single floating number.
- **Talent effects**: Pre-computed once per battle into `TalentEffectManifest` on state.
- **Upfront asset preloading (intentional)**: All game art (webp files in `src/assets/optimized/`) is collected at build time via `import.meta.glob` with `eager: true` and preloaded during the startup loading screen (`useInitialLoadReady` in `src/app/use-initial-load-ready.ts`). Sound effects are preloaded at idle after startup (`preloadAllSounds`). This is deliberate — this is a game, not a web app. The loading screen sets expectations, and after it clears, every card art, enemy sprite, and UI icon must be instantly available with zero decode-pop-in during gameplay. **Do not switch to lazy-on-render asset loading.**
- **All tuning values** in `src/lib/game-constants.ts` — no magic numbers.
- **Rounding**: Battle math uses `Math.round()` — never `Math.floor()`. Enforced by ESLint `no-restricted-syntax` rule in battle files.
- **File summaries**: Every file should begin with a one-line description of its purpose.
- **Why comments, not what**: Annotate non-obvious decisions; never restate the code.
- **Persistence**: Treat save data as external API. When changing stored shape, update defaults, schemas, migrations, and legacy save fixtures/tests together.
- **Randomness**: Prefer existing seeded/test helpers for generated content and random draws. Avoid tests that depend on lucky random outcomes.
- **Card/data consistency**: When changing card effects, update descriptions and tests together. Keep game data imports through the barrel.
- **Test-Driven Development**: Write tests before implementing features or fixing bugs. The test defines the expected behavior first; implement only enough to pass it. Ensures all new logic is covered and tests capture intent, not implementation.
- **Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, etc.) — enforced by commitlint + lefthook locally, validated in CI. `commit-and-tag-version` reads these to generate the changelog and bump the version automatically.

## Navigation Hints

| Need | Look in |
|------|---------|
| Audio buffer cache | `src/lib/audio-buffer-cache.ts` |
| Audio music | `src/lib/audio-music.ts` |
| Audio SFX | `src/lib/audio-sfx.ts` |
| Balance simulation | `src/lib/balance/` |
| Battle state shape | `src/lib/battle/` |
| Card effects | `src/lib/game-data/cards.ts` |
| Characters data | `src/lib/game-data/characters.ts` |
| Companions data | `src/lib/game-data/companions.ts` |
| Desktop shell | `desktop/` |
| Difficulties | `src/lib/game-data/difficulties.ts` |
| Game data imports | always through `@/lib/game-data` barrel |
| Game-data types | `src/lib/game-data/types.ts` |
| Homestead logic | `src/lib/homestead/` |
| Map/encounter generation | `src/lib/content-systems/` |
| Map screen / navigation | `src/features/alchemy/navigation/` |
| Particle/animation system | `src/lib/animation/` |
| Playwright flows | `tests/**/*.spec.ts`, `tests/pages/` |
| Reusable widget | `src/features/alchemy/ui/` |
| Run-level state | `src/features/alchemy/use-alchemy-run-controller.ts` |
| Save/load and migrations | `src/features/alchemy/storage/`, `src/lib/validation/` |
| Shared UI components | `src/components/` |
| Shared UI logic | `src/lib/ui/` |
| Sound behavior | `src/lib/audio.ts` |
| Talent maths | `src/lib/talents.ts` |
| Talent tree UI | `src/features/alchemy/talents/` |
| Test fixtures | `tests/fixtures/` |
| Trinket logic | `src/lib/trinkets.ts` |
| Tuning values | `src/lib/game-constants.ts` |
| UI screen | `src/features/alchemy/screens/` |
| Unit/integration tests | `tests/**/*.test.ts` |
| Zustand stores | `src/features/alchemy/stores/` |

## UI/UX Design Guidelines

This is a fantasy roguelite deckbuilder. The interface must feel like a polished game with a well-designed UI/UX.

**Layout**: Game-native composition. No fragile magic-pixel positioning. Responsive layouts across common desktop/laptop sizes.

**Styling**: Favor utility-first styling with Tailwind CSS v4.0 for standard components, layout, and theme customization. Limit Vanilla CSS to complex custom game-feel animations, shaders, or rendering effects that cannot be easily written with utility classes.

**Interactive states**: Interactive elements need clear states — default, hover, active/pressed, selected, disabled. Important actions must give immediate feedback.

**Motion**: Fast, responsive transitions using `transform` and `opacity`. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions. Avoid expensive layout/filter animations, unnecessary re-renders, heavy shadows, drop shadows, gradients, or large animated blurs.

**Misc**:
- No emoji in game UI (use proper icons or symbols).

## Project Gotchas

- **Shell is PowerShell**: chain dependent commands with `; if ($?) { next-command }` — `;` alone always runs regardless of prior exit code. Double quotes for interpolation, single for verbatim.
- **Vite base path**: `/` (Vercel default); `npm run dev` opens browser automatically.
- **Assets**: `prebuild`/`predev` auto-run asset, sound, and music optimize scripts.
- **Desktop**: Web builds use Vite directly; desktop builds use Electron entry points in `desktop/` and Vite desktop mode.
- **SFX are buffers, not files**: SFX use Web Audio API buffer playback (`src/lib/audio.ts`); music MP3s are copied from `Raw Assets/Music/` to `public/Music/` during build and streamed via `<audio>` elements.

## Debugging

- `npm run dev` enables Vite HMR with full source maps.
- Use React DevTools (Chrome extension) for component tree and state inspection.
- Zustand stores have devtools middleware — check store config for enabled logging.
- `window.__ALCHEMY_DEBUG = true` enables verbose combat logging (if implemented).

## Verification Strategy

- Battle logic: run focused Vitest files under `tests/lib/battle/`, then broader `npm test` when changes are cross-cutting.
- Card data/effects: run game-data tests plus `tests/lib/game-data/descriptions-match-effects.test.ts` and relevant battle tests.
- Save, storage, or schema changes: run storage, migration, validation, active-run, and legacy save fixture tests.
- UI flow changes: run the relevant Playwright spec; use `npm run test:e2e:critical` for broad flow confidence.
- Store/controller changes: run matching `tests/features/stores/`, navigation flow tests, and affected Playwright specs.
- Desktop changes: run `npm run build:desktop` or a narrower desktop package command when packaging behaviour is affected.
- Balance simulation: after battle logic or card data changes, consider `npm run balance:sim` to detect regressions in win rates.

## Test Gotchas

- `test.skip(true, "reason")` when a required card isn't in the random opening hand.
- `startRun(page)`: navigates to `/`, clicks Play → Knight → Continue, waits for cards.
- `playUntilVictory(page)`: loops up to 12 turns playing all playable cards.
- Prefer deterministic setup helpers over relying on random opening hands or generated maps.

## Testing Patterns

- Use `createBattleState()` from `@/lib/battle/draw` for deterministic test setup.
- Prebuilt decks, enemies, and save data live in `tests/fixtures/`.
- Organize tests per mechanic: `describe("MechanicName", ...)` with focused `it` blocks.

## Generated And Heavy Files

Avoid editing or re-reading unless directly relevant: `node_modules/`, `package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`, `release-desktop/**`, `coverage/**`, `reports/**`.

## Large Stable Files

These are central and may be large. Avoid repeated reads within a session unless they are relevant to the task: `src/lib/game-constants.ts`, `src/lib/game-data/cards.ts`, `src/lib/game-data/keywords.ts`, `src/lib/game-data/assets.ts`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`.

## Domain Glossary

### Run & Progression

| Term | Definition |
|------|-----------|
| **Run** | A full playthrough from character select to victory or defeat. |
| **Destination** | A map node chosen between battles (e.g. Combat, Elite, Boss, Campfire, Merchant). |
| **Gold** | Currency earned in battle, spent at Merchants and the Alchemist. |

### Battle Concepts

| Term | Definition |
|------|-----------|
| **Consume** | A card property removing it from the current battle after play. |
| **Death's Door** | A one-shot survival mechanic granting one final turn after player health reaches zero. |
| **Wish** | An effect presenting card choices from the full card library. |
| **Companion** | A persistent ally that acts at the start of each player turn. |
| **Haste** | Grants an extra player turn by skipping the enemy phase. |
| **Combat Text** | Floating battle numbers merged per (target, kind, stat) for deduplication. |
| **Mana** | Resource spent to play cards; hand refills and Mana regenerates each turn. |
| **Health** | Player health — reaching 0 ends the run. Also a keyword on healing effects. |
| **Leech** | Heals the player for damage dealt by the card. |

### Status Effects (by category)

| Term | Definition |
|------|-----------|
| **Protective Statuses** | Absorb or reduce incoming damage (Block, Armor). |
| **Empowering Statuses** | Amplify outgoing damage or grant extra actions (Forge, Haste). |
| **Damage-over-Time Statuses** | Deal damage each turn on the bearer — Burn halves each turn, Poison decreases by 1, Bleed bursts (deals full stack then resets to 0). |
| **Crowd Control Statuses** | Prevent the enemy from acting when accumulated above a threshold (Freeze, Stun). |

### Damage Types

| Term | Definition |
|------|-----------|
| **Damage Types** | Cards deal one of nine damage types (Physical, Stun, Holy, Burn, Poison, Bleed, Freeze, Nature, Arrow). Damage that matches a status name (Burn, Poison, Bleed, Freeze, Stun) applies that status on hit. Enemies can have unique resistances or vulnerabilities to specific types. |

### Card & Economy

| Term | Definition |
|------|-----------|
| **Corruption** | A destination event that mutates a card in the player's deck. |
| **Mixed Potion** | A card created by combining two potions at the Alchemist. |
| **Trinket** | A passive equippable item with a persistent effect. |
| **Talent XP** | Per-keyword cross-run experience awarded when matching cards are played. |
| **Talent Effect Manifest** | All active talent bonuses pre-computed into one object per battle. |

### Between-Run Progression

| Term | Definition |
|------|-----------|
| **Homestead** | The persistent hub between runs for spending materials on permanent upgrades. |
| **Material** | A resource type earned between runs and spent in the Homestead. |
| **Farm** | A Homestead building that produces materials. |

## Token Efficiency Rules

### Core Principle
Prioritize targeted accuracy over exhaustive exploration.

### File Reading
- Avoid recursively scanning the repo — inspect structure first, then open only likely targets
- Prefer symbol-level lookup over full-file reads
- Stop reading once you have sufficient context
- Avoid rereading files already summarized

### Tool Usage
- Avoid calls to multiple tools for the same purpose
- Avoid retrying identical failed commands without modification
- Batch related operations whenever possible

### Output
- No prose, commentary, or task restatement
- No line-by-line explanation of code changes unless asked
- Prefer diffs over full rewrites
- Status updates: <100 words — Implementation summaries: <200 words

### Reasoning Effort
- Simple bugfixes/CRUD: low deliberation, fast execution
- Reserve deeper reasoning for architecture, concurrency, security, and ambiguous requirements

## Preventing Reasoning Loops

Recognize when you are getting stuck cycling through the same hypotheses or re-reading the same files without making progress and take a step back to try something different.

### Recognize When You Are Stuck

You are stuck if any of the following are true:

- The last few tool calls or reasoning steps produced no new information
- You are re-reading the same files for the same reason
- You are rephrasing the same hypothesis without new evidence to support or refute it
- Repeatedly thinking "Wait, but..." and "I will..." many times in a row without making progress
- Doing lots of pixel-accurate math troubleshooting tricky CSS layout issues
- Second-guessing user intent "What if the user..." when it's better to just stop and ask me

### Hard Iteration Cap

If you have attempted the same approach — or a close variant — more than a few times without progress, stop immediately. Do not try again. Escalate/ask the user instead.

### No Speculative Spirals

Do not follow a hypothesis chain longer than **3 steps** without grounding it in a concrete tool call or observation. If you are reasoning about what *might* be true, verify it immediately — or drop it.

### Timebox Sub-Problems

If a single sub-problem (e.g., "find where X is initialized") takes more than **3 steps** to resolve, declare it unresolved and move on. Note it clearly in your output so a human can assist.

### Escalate Explicitly

When stuck, ask the user for clarification/advice. Do not attempt "one more thing" repeatedly.