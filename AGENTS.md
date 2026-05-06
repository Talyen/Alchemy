# Alchemy — AGENTS.md

## Commands

```sh
npm run dev          # Vite dev server
npm run build        # tsc + vite build (runs assets:optimize first)
npm run test:e2e     # Playwright tests (starts Vite on :4173 automatically)
npm run assets:optimize   # Convert Raw Assets/ PNGs → src/assets/optimized/ webps
npm run sounds:optimize   # Convert Raw Assets/Sound Effects → public/sounds/ OGGs
```

Add a new raw asset:
1. Add entry to `scripts/optimize-assets.mjs` (source path, target name, width, quality)
2. `npm run assets:optimize`
3. Import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`

## Architecture

- **`src/lib/`** — Pure game logic (no React). `battle/` (state machine, effects, draw), `talents.ts` (XP math), `audio.ts` (Web Audio buffer playback), `game-constants.ts` (all tuning knobs).
- **`src/features/alchemy/`** — React layer. `use-alchemy-run-controller.ts` is the single state orchestrator; all screens read from `run.xxx`. `screens/` are page-level components. `ui/` are reusable widgets.
- **`src/lib/game-data/`** — Card definitions (`cards.ts`), keyword definitions (`keywords.ts`), art imports (`assets.ts`), character/enemy data.
- Barrel export at `src/lib/game-data.ts` re-exports everything from `game-data/` submodules — import cards, enemies, keywords from `@/lib/game-data`.

## Key conventions

- **Immutability**: Battle state is never mutated — `createBattleState`, `playBattleCardResolved`, `endPlayerTurn` all return new `BattleState` objects. Reducer pattern through `applyCardEffects`.
- **Combat texts**: Damage/heal/status events are emitted by battle functions and merged by `(target, kind, stat)` so multi-hit cards produce a single floating number.
- **Talent effects**: Pre-computed once per battle start into `TalentEffectManifest` and carried on `BattleState.talentEffects`. The battle engine does not import talent-pool directly.
- **No audio files**: All sounds are Web Audio API buffer playback (`lib/audio.ts`). Music is MP3 files from a `Music/` directory at the site root.
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
- **Asset pipeline**: `prebuild`/`predev` run `assets:optimize` and `sounds:optimize` automatically. The art script reads from `Raw Assets/` and writes webp to `src/assets/optimized/`; the sound script reads from `Raw Assets/Sound Effects/` and writes OGG to `public/sounds/`. Run the relevant optimize command after adding new assets.
- **Vite base path** is `/Alchemy/` (for GitHub Pages deploy). Dev server runs at `http://127.0.0.1:4173/Alchemy/`.
- The `.github/copilot-instructions.md` file contains additional UI/design guidance.

## Token efficiency

### Never read these files
They are either binary, generated, or never relevant to coding tasks:
- `package-lock.json`
- `Raw Assets/**` — source PNGs and raw sound files, never needed; optimized outputs are in `src/assets/optimized/` and `public/sounds/`
- `src/assets/optimized/**` — webp binaries
- `Music/**` — MP3 binaries
- `dist/**`, `.vite/**`
- `.github/copilot-instructions.md` — only relevant for UI/design tasks; read only if explicitly working on visual styling

### Stable files — don't re-read within a session
These rarely change mid-session. Read once if needed, then rely on what you already know:
- `src/lib/game-constants.ts` — all tuning values; if you need a constant, check here once
- `src/lib/game-data/cards.ts`, `keywords.ts`, `assets.ts` — card/keyword/art definitions
- `vite.config.ts`, `tsconfig.json`, `playwright.config.ts` — build config, don't read unless the task is explicitly about build/test config

### Navigation hints — find things without reading everything
- Game tuning knobs → `src/lib/game-constants.ts`
- A card's effects → `src/lib/game-data/cards.ts`
- Battle state shape → `src/lib/battle/` (start with the type definitions)
- Run-level state → `src/features/alchemy/use-alchemy-run-controller.ts`
- A UI screen → `src/features/alchemy/screens/`
- A reusable widget → `src/features/alchemy/ui/`
- Sound behaviour → `src/lib/audio.ts`
- Talent maths → `src/lib/talents.ts`
- Imports for cards, enemies, keywords → always via `@/lib/game-data` barrel, not submodule paths directly

### Prefer surgical reads
- Read specific functions or types with a line range rather than whole files when the task is localised
- Don't read a file to confirm something you already saw earlier in this session
- Don't read `game-constants.ts` to find a value and then re-read the file that uses it — you already have the value

### Avoid polluting context with output
- Don't run `npm run dev` or leave a dev server running in a tool call — the streaming output will grow the context unboundedly
- Capture only the relevant portion of build/test output; don't dump full Playwright traces into context, asset optimization logs, or complete build file lists
- For type errors, run `tsc --noEmit` once and read the output; don't iterate by re-running repeatedly within one turn
- Use `Select-Object -Last 5` or `Select-String "error"` to filter build/test output to only what matters

# Alchemy Game UI/UX Taste Guidelines

Apply these rules whenever building or modifying UI, styling, layout, animation, or interaction code for this project.

## Core Principle

This is a fantasy roguelite deckbuilder web game. The interface should feel like a polished game, not a SaaS app, landing page, portfolio, or dashboard.

Gameplay clarity always beats decoration. A player should quickly understand what is happening, what they can interact with, what changed, and what consequences an action may have.

## Visual Direction

Use a cohesive fantasy adventure style: tactile, readable, atmospheric, and hand-crafted.

Prefer grounded colors:
- Warm neutrals, muted golds, deep reds, forest greens, smoky blues, bone/off-white

Avoid generic modern-web styling:
- Corporate gradients
- Glassmorphism as a default
- Neon-heavy UI
- SaaS cards and dashboards
- Marketing-page layouts

Ornamentation is welcome, but it should frame and support the interface rather than compete with it.

## Readability

Gameplay text must be easy to read at normal play size.

Use decorative fonts only for flavor, headings, logos, or major presentation moments. Use clear fonts for rules, numbers, labels, buttons, tooltips, settings, and repeated gameplay information.

Do not shrink text aggressively to fit a design. Improve the wording, layout, or hierarchy instead.

## Interaction

Every interactive element should have clear states:
- Default
- Hover
- Active/pressed
- Selected
- Focus
- Disabled
- Loading or unavailable, when relevant

Do not rely on color alone. Use shape, contrast, motion, icons, borders, brightness, or labels as supporting cues.

Important actions should provide immediate feedback. The UI should never leave the player wondering whether a click, drag, selection, purchase, confirmation, or cancellation worked.

## Motion

Motion should feel tactile and game-like, not like a marketing site.

Use animation to clarify:
- Selection
- Movement
- Confirmation
- Impact
- Change of state
- Entrance or exit of important UI

Avoid motion that is slow, decorative, distracting, or repeated so often that it gets annoying.

Prefer fast, responsive transitions using `transform` and `opacity`. Avoid expensive layout or filter animations unless clearly justified.

## Performance

This is a game. Responsiveness matters.

Avoid unnecessary re-renders, heavy shadows, large animated blurs, excessive particles, and constantly animated backgrounds.

Keep frequently repeated interactions snappy. Do not add cinematic delays to actions the player may perform hundreds of times.

## Layout

Use stable, responsive layouts that preserve clarity across common desktop and laptop sizes.

Avoid fragile magic-pixel positioning. Prefer clear layout regions, consistent spacing, and predictable alignment.

Prevent the UI from feeling cramped, but do not waste space with landing-page-style whitespace.

## Content Style

Use concise, concrete language.

Prefer direct, game-appropriate labels.

No emoji in game UI. Use proper icons, symbols, or text.

## Component Rule

Do not ship default-looking component-library UI.

If using UI primitives or component libraries, restyle them so they feel native to the game world while preserving accessibility and expected behavior.

## Pre-Flight Check

Before finalizing UI work, ask:

- Does this feel like a game rather than a website?
- Is the current state obvious?
- Are available actions obvious?
- Are unavailable actions explained or clearly disabled?
- Is important text readable?
- Are interactions responsive?
- Does motion help understanding rather than distract?
- Is the fantasy styling cohesive rather than generic?