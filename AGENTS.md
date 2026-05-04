# Alchemy — AGENTS.md

## Commands

```sh
npm run dev          # Vite dev server
npm run build        # tsc + vite build (runs assets:optimize first)
npm run test:e2e     # Playwright tests (starts Vite on :4173 automatically)
npm run assets:optimize  # Convert Raw Art Assets/ PNGs → src/assets/optimized/ webps
```

Add a new raw asset:
1. Add entry to `scripts/optimize-assets.mjs` (source path, target name, width, quality)
2. `npm run assets:optimize`
3. Import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`

## Architecture

- **`src/lib/`** — Pure game logic (no React). `battle/` (state machine, effects, draw), `talents.ts` (XP math), `audio.ts` (Web Audio synthesis), `game-constants.ts` (all tuning knobs).
- **`src/features/alchemy/`** — React layer. `use-alchemy-run-controller.ts` is the single state orchestrator; all screens read from `run.xxx`. `screens/` are page-level components. `ui/` are reusable widgets.
- **`src/lib/game-data/`** — Card definitions (`cards.ts`), keyword definitions (`keywords.ts`), art imports (`assets.ts`), character/enemy data.
- Barrel export at `src/lib/game-data.ts` re-exports everything from `game-data/` submodules — import cards, enemies, keywords from `@/lib/game-data`.

## Key conventions

- **Immutability**: Battle state is never mutated — `createBattleState`, `playBattleCardResolved`, `endPlayerTurn` all return new `BattleState` objects. Reducer pattern through `applyCardEffects`.
- **Combat texts**: Damage/heal/status events are emitted by battle functions and merged by `(target, kind, stat)` so multi-hit cards produce a single floating number.
- **Talent effects**: Pre-computed once per battle start into `TalentEffectManifest` and carried on `BattleState.talentEffects`. The battle engine does not import talent-pool directly.
- **No audio files**: All sounds are Web Audio API synthesis (`lib/audio.ts`). Music is MP3 files from a `Music/` directory at the site root.
- **`@/` path alias**: Maps to `src/`. Use in all imports.

## Architecture Rules
- All shared constants live in `src/lib/game-constants.ts`. No magic numbers in game logic.
- State is mutated only through defined state functions, never directly.

## Refactoring Standards
- Functions must do one thing. Split anything over 30 lines.
- Max 2 levels of nesting. Use early returns and guard clauses.
- No dead code, unused imports, or unreachable logic.
- Repeated patterns go in utils.

## Comments
- Every function gets a comment explaining the "why", not just the "what".
- Every file gets a top-of-file summary: what it does, what it depends on.
- Non-obvious game mechanics, coordinate systems, and state assumptions must be annotated.

## Test Standards
- All pure game logic functions must have unit tests. Integration and E2E smoke tests cover the rest.

## Test gotchas

- Tests play real cards against real enemy AI. A `test.skip(true, "reason")` pattern is used when a required card isn't in the random opening hand.
- `startRun(page)` navigates to `/`, clicks Play → Knight → Continue, then waits for cards to appear.
- `playUntilVictory(page)` loops up to 12 turns playing all playable cards. Throws if the battle doesn't resolve in time.

## Project gotchas

- **PowerShell** is the default shell on Windows. Use `;` instead of `&&` to chain commands.
- **Asset pipeline**: `prebuild`/`predev` run `assets:optimize` automatically. The script reads from `Raw Art Assets/` and writes webp to `src/assets/optimized/`. Run `npm run assets:optimize` after adding new art.
- **Vite base path** is `/Alchemy/` (for GitHub Pages deploy). Dev server runs at `http://127.0.0.1:4173/Alchemy/`.
- The `.github/copilot-instructions.md` file contains additional UI/design guidance.
