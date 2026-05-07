# Alchemy — AGENTS.md

## Commands

```sh
npm run dev          # Vite dev server
npm run build        # tsc + vite build
npm run test:e2e     # Playwright tests
npm run assets:optimize   # PNGs → webp
npm run sounds:optimize   # sounds → OGG
```

Add a new raw asset:
1. Add entry to `scripts/optimize-assets.mjs`
2. `npm run assets:optimize`
3. Import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`

## Architecture

- `src/lib/` — Pure game logic (no React): `battle/` (state machine, effects, draw), `talents.ts` (XP math), `audio.ts` (Web Audio buffer playback), `game-constants.ts` (all tuning knobs).
- `src/features/alchemy/` — React UI. `use-alchemy-run-controller.ts` is the central orchestrator; `screens/` are pages, `ui/` are reusable widgets.
- `src/lib/game-data/` — Cards, keywords, enemies. Barrel export at `src/lib/game-data.ts`.
- `@/` path alias → `src/`. Import game data through the barrel, not submodule paths.

## Key Conventions

- **Immutability**: Battle state never mutated — `createBattleState`, `playBattleCardResolved`, `endPlayerTurn` all return new `BattleState`. Reducer pattern through `applyCardEffects`.
- **Combat texts**: Merged by `(target, kind, stat)` — multi-hit cards produce a single floating number.
- **Talent effects**: Pre-computed once per battle into `TalentEffectManifest` on state.
- **No audio files**: Web Audio API buffer playback (`lib/audio.ts`); music MP3s from `Music/`.
- **All tuning values** in `src/lib/game-constants.ts` — no magic numbers.
- **State mutated only through defined state functions**, never directly.
- **Comments**: Every function gets a "why" comment; every file gets a top-of-file summary of what it does and its dependencies.

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
| Game data imports | always through `@/lib/game-data` barrel |

## UI Design Rules

This is a fantasy roguelite deckbuilder. The interface must feel like a polished game, not a SaaS app, landing page, or dashboard. Gameplay clarity always beats decoration.

**Aesthetic direction**: Tactile, hand-crafted fantasy adventure. Commit to this with intentionality — every element either serves gameplay clarity or reinforces the fantasy atmosphere. What someone should remember: a game that feels physically real, like holding a deck of cards in a dim tavern.

**Color**: Grounded, atmospheric palette — warm neutrals, muted golds, deep reds, forest greens, smoky blues, bone/off-white. Dominant colors with sharp accents. Avoid timid evenly-distributed palettes, corporate gradients, glassmorphism, and neon-heavy UI.

**Typography**: Distinctive, characterful fonts — never Arial, Inter, Roboto, or system fonts. Decorative/display fonts for logos and major presentation moments; clear, readable fonts for rules, numbers, labels, buttons, tooltips, and repeated gameplay text. Don't shrink text to fit a design — improve wording or layout instead.

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
- **Vite base path**: `/Alchemy/` (GitHub Pages); dev at `http://127.0.0.1:4173/Alchemy/`.
- **Assets**: `prebuild`/`predev` auto-run optimize scripts.

## Test Gotchas

- `test.skip(true, "reason")` when a required card isn't in the random opening hand.
- `startRun(page)`: navigates to `/`, clicks Play → Knight → Continue, waits for cards.
- `playUntilVictory(page)`: loops up to 12 turns playing all playable cards.

## Skip These Files

`package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`

## Stable Files (don't re-read within a session)

`src/lib/game-constants.ts`, `src/lib/game-data/cards.ts`, `keywords.ts`, `assets.ts`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`
