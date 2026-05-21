# Alchemy — AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder. Each **Run** starts by picking a **Character** with a unique starter deck. Battles are turn-based: draw cards, spend **Mana** to play them (deal damage, apply **Statuses**, gain **Block**, summon allies, etc.), then the enemy acts. Winning a battle rewards **Gold** and card choices, and the player picks a **Destination** to travel to next — more combat, a **Campfire** to heal, a **Merchant** or **Alchemist** shop, a **Mystery** event, or a **Corruption** altar that mutates a card. Die and the run ends. Survive through the final boss and win.

Between runs, the **Homestead** lets the player spend **Materials** on permanent upgrades. **Talent XP** earned during runs — awarded per **Keyword** when matching cards are played — unlocks passive bonuses that persist across future runs.

## Commands

```sh
npm run dev              # Vite dev server
npm run build            # tsc + vite build
npm test                 # vitest (unit tests)
npm run test:watch       # vitest in watch mode
npm run test:coverage    # vitest with coverage
npm run test:e2e         # Playwright tests
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run assets:optimize  # PNGs → webp
npm run sounds:optimize  # sounds → OGG
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
3. `npm run assets:optimize`

## Architecture

- `src/lib/` — Pure game logic (no React): `battle/` (state machine, effects, draw), `content-systems/` (map & encounter generation), `homestead/` (between-run hub), `animation/` (particle systems), `talents.ts` (XP math), `audio.ts` + `audio-*.ts` (Web Audio buffer playback), `trinkets.ts`, `game-constants.ts` (all tuning knobs).
- `src/features/alchemy/` — React UI. `use-alchemy-run-controller.ts` is the central orchestrator; `screens/` are pages, `ui/` are reusable widgets.
- `src/lib/game-data/` — Cards, keywords, enemies. Barrel export at `src/lib/game-data.ts`.
- `src/app/` — App-level bootstrapping: startup screen, save version checks, initial-load hook.
- `src/components/` — Shared UI primitives (`button.tsx`, `select.tsx`, `progress.tsx`, etc.).
- `@/` path alias → `src/`. Import game data through the barrel, not submodule paths.

## Key Conventions

- **Immutability**: Battle state never mutated — `createBattleState`, `playBattleCardResolved`, `endPlayerTurn` all return new `BattleState`. Reducer pattern through `applyCardEffects`.
- **Store initialization**: Never initialize Zustand store fields with `null as Type` or `null as unknown as Type` — use a factory function or a valid default value. The type assertion bypasses `strictNullChecks` and can cause runtime crashes in subscribers.
- **Combat texts**: Merged by `(target, kind, stat)` — multi-hit cards produce a single floating number.
- **Talent effects**: Pre-computed once per battle into `TalentEffectManifest` on state.
- **No audio files**: Web Audio API buffer playback (`lib/audio.ts`); music MP3s from `Music/`.
- **All tuning values** in `src/lib/game-constants.ts` — no magic numbers.
- **Rounding**: Battle math uses `Math.round()` — never `Math.floor()`. Enforced by ESLint `no-restricted-syntax` rule in battle files.
- **State mutated only through defined state functions**, never directly.
- **Comments**: Every function gets a "why" comment; every file gets a top-of-file summary of what it does and its dependencies.
- **Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, etc.) — enforced by commitlint + lefthook locally, validated in CI. `standard-version` reads these to generate the changelog and bump the version automatically.

## Navigation Hints

| Need | Look in |
|------|---------|
| Tuning values | `src/lib/game-constants.ts` |
| Card effects | `src/lib/game-data/cards.ts` |
| Battle state shape | `src/lib/battle/` |
| Run-level state | `src/features/alchemy/use-alchemy-run-controller.ts` |
| Sound behaviour | `src/lib/audio.ts` |
| Talent maths | `src/lib/talents.ts` |
| UI screen | `src/features/alchemy/screens/` |
| Reusable widget | `src/features/alchemy/ui/` |
| Homestead logic | `src/lib/homestead/` |
| Map/encounter generation | `src/lib/content-systems/` |
| Shared UI components | `src/components/` |
| Particle/animation system | `src/lib/animation/` |
| Game data imports | always through `@/lib/game-data` barrel |

## UI Design Rules

This is a fantasy roguelite deckbuilder. The interface must feel like a polished game, not a SaaS app, landing page, or dashboard. Gameplay clarity always beats decoration.

**Aesthetic direction**: Tactile, hand-crafted fantasy adventure. Commit to this with intentionality — every element either serves gameplay clarity or reinforces the fantasy atmosphere. What someone should remember: a game that feels physically real, like holding a deck of cards in a dim tavern.

**Color**: Grounded, atmospheric palette — warm neutrals, muted golds, deep reds, forest greens, smoky blues, bone/off-white. Dominant colors with sharp accents. Avoid timid evenly-distributed palettes, corporate gradients, glassmorphism, and neon-heavy UI.

**Layout**: Unexpected, game-native composition. Asymmetry and overlap where they serve the fantasy feel. Generous negative space or controlled density — no fragile magic-pixel positioning or landing-page whitespace. Stable, responsive layouts across common desktop/laptop sizes.

**Interactive states**: Every interactive element needs clear states — default, hover, active/pressed, selected, focus, disabled, loading. Never rely on color alone; use shape, contrast, motion, icons, borders, or brightness as supporting cues. Important actions must give immediate feedback.

**Motion**: Fast, responsive transitions using `transform` and `opacity`. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions. Avoid expensive layout/filter animations, unnecessary re-renders, heavy shadows, or large animated blurs.

**Backgrounds**: Create atmosphere and depth — textures, subtle patterns, layered transparencies. Never default to flat solid colors.

**Hard rules**:
- No emoji in game UI (use proper icons or symbols).
- No default-looking component-library UI — restyle primitives to feel native to the game world.
- Match implementation complexity to the aesthetic vision (maximalist needs elaborate code; refined needs precision and restraint).
- Vary between light and dark themes where appropriate.

## Project Gotchas

- **Shell is PowerShell**: chain with `;` not `&&`; double quotes for interpolation, single for verbatim.
- **Vite base path**: `/` (Vercel default); `npm run dev` opens browser automatically.
- **Assets**: `prebuild`/`predev` auto-run optimize scripts.

## Test Gotchas

- `test.skip(true, "reason")` when a required card isn't in the random opening hand.
- `startRun(page)`: navigates to `/`, clicks Play → Knight → Continue, waits for cards.
- `playUntilVictory(page)`: loops up to 12 turns playing all playable cards.

## Skip These Files

`package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`

## Stable Files (don't re-read within a session)

`src/lib/game-constants.ts`, `src/lib/game-data/cards.ts`, `src/lib/game-data/keywords.ts`, `src/lib/game-data/assets.ts`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`

## Domain Glossary

### Run & Progression

| Term | Definition |
|------|-----------|
| **Run** | A full playthrough from character select to victory or defeat. |
| **Destination** | A map node chosen between battles (e.g. Combat, Elite, Boss, Campfire, Merchant). |

### Battle Concepts

| Term | Definition |
|------|-----------|
| **Consume** | A card property removing it from the current battle after play. |
| **Death's Door** | A one-shot survival mechanic granting one final turn after player health reaches zero. |
| **Wish** | An effect presenting card choices from the full card library. |
| **Companion** | A persistent ally that acts at the start of each player turn. |
| **Haste** | Grants an extra player turn by skipping the enemy phase. |
| **Combat Text** | Floating battle numbers merged per (target, kind, stat) for deduplication. |

### Status Effects (by category)

| Term | Definition |
|------|-----------|
| **Protective Statuses** | Absorb or reduce incoming damage (Block, Armor). |
| **Empowering Statuses** | Amplify outgoing damage or grant extra actions (Forge, Haste). |
| **Damage-over-Time Statuses** | Tick damage each turn on the bearer, then decay or burst reset (Burn, Poison, Bleed). |
| **Crowd Control Statuses** | Prevent the enemy from acting when accumulated above a threshold (Freeze, Stun). |

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
| **Farm** | A Homestead building that produces materials.
