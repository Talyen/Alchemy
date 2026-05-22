# Alchemy — AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder. Each **Run** starts by picking a **Character** with a unique starter deck. Battles are turn-based: draw cards, spend **Mana** to play them (deal damage, apply **Statuses**, gain **Block**, summon allies, etc.), then the enemy acts. Winning a battle rewards **Gold** and card choices, and the player picks a **Destination** to travel to next — more combat, a **Campfire** to heal, a **Merchant** or **Alchemist** shop, a **Mystery** event, or a **Corruption** altar that mutates a card. Die and the run ends. Survive through the final boss and win.

Between runs, the **Homestead** lets the player spend **Materials** on permanent upgrades. **Talent XP** earned during runs — awarded per **Keyword** when matching cards are played — unlocks passive bonuses that persist across future runs.

## Commands

```sh
npm run dev              # Vite dev server
npm run dev:desktop      # Vite dev server + Electron shell
npm run build            # tsc + vite build + format
npm run build:desktop    # tsc + vite build in desktop mode
npm run package:win      # Build unpacked Windows desktop app
npm run dist:win         # Build Windows desktop installer
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

## Architecture

- `src/lib/` — Pure game logic (no React): `battle/` (state machine, effects, draw), `content-systems/` (map & encounter generation), `homestead/` (between-run hub), `animation/` (particle systems), `talents.ts` (XP math), `audio.ts` + `audio-*.ts` (Web Audio buffer playback), `trinkets.ts`, `game-constants.ts` (all tuning knobs).
- `src/features/alchemy/` — React UI. `use-alchemy-run-controller.ts` is the central orchestrator; `screens/` are pages, `ui/` are reusable widgets.
- `src/features/alchemy/stores/` — Zustand stores for app, screen, run, battle, and homestead state.
- `src/features/alchemy/storage/` — Save/load, persistence defaults, active-run storage, options, and migrations.
- `src/lib/game-data/` — Cards, keywords, enemies. Barrel export at `src/lib/game-data.ts`.
- `src/lib/validation/` — Zod schemas and migration validation for persisted saves.
- `src/app/` — App-level bootstrapping: startup screen, save version checks, initial-load hook.
- `src/components/` — Shared UI primitives (`button.tsx`, `select.tsx`, `progress.tsx`, etc.).
- `desktop/` — Electron main/preload entry points for desktop builds.
- `tests/` — Vitest unit/integration tests and Playwright e2e specs.
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
- **Comments**: Files should have a top-of-file summary. Public or non-obvious functions should have a brief "why" comment; avoid comments that only restate the code.
- **Persistence**: Treat save data as external API. When changing stored shape, update defaults, schemas, migrations, and legacy save fixtures/tests together.
- **Randomness**: Prefer existing seeded/test helpers for generated content and random draws. Avoid tests that depend on lucky random outcomes.
- **Card/data consistency**: When changing card effects, update descriptions and tests together. Keep game data imports through the barrel.
- **Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, etc.) — enforced by commitlint + lefthook locally, validated in CI. `commit-and-tag-version` reads these to generate the changelog and bump the version automatically.

## Navigation Hints

| Need | Look in |
|------|---------|
| Tuning values | `src/lib/game-constants.ts` |
| Card effects | `src/lib/game-data/cards.ts` |
| Battle state shape | `src/lib/battle/` |
| Run-level state | `src/features/alchemy/use-alchemy-run-controller.ts` |
| Zustand stores | `src/features/alchemy/stores/` |
| Save/load and migrations | `src/features/alchemy/storage/`, `src/lib/validation/` |
| Sound behaviour | `src/lib/audio.ts` |
| Talent maths | `src/lib/talents.ts` |
| Desktop shell | `desktop/` |
| UI screen | `src/features/alchemy/screens/` |
| Reusable widget | `src/features/alchemy/ui/` |
| Unit/integration tests | `tests/**/*.test.ts` |
| Playwright flows | `tests/**/*.spec.ts`, `tests/pages/` |
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
- **Build side effect**: `npm run build` runs `npm run format`, so it can modify `src/**/*.{ts,tsx,css}`.
- **Assets**: `prebuild`/`predev` auto-run asset, sound, and music optimize scripts.
- **Desktop**: Web builds use Vite directly; desktop builds use Electron entry points in `desktop/` and Vite desktop mode.

## Verification Strategy

- Battle logic: run focused Vitest files under `tests/lib/battle/`, then broader `npm test` when changes are cross-cutting.
- Card data/effects: run game-data tests plus `tests/lib/game-data/descriptions-match-effects.test.ts` and relevant battle tests.
- Save, storage, or schema changes: run storage, migration, validation, active-run, and legacy save fixture tests.
- UI flow changes: run the relevant Playwright spec; use `npm run test:e2e:critical` for broad flow confidence.
- Store/controller changes: run matching `tests/features/stores/`, navigation flow tests, and affected Playwright specs.
- Desktop changes: run `npm run build:desktop` or a narrower desktop package command when packaging behaviour is affected.

## Test Gotchas

- `test.skip(true, "reason")` when a required card isn't in the random opening hand.
- `startRun(page)`: navigates to `/`, clicks Play → Knight → Continue, waits for cards.
- `playUntilVictory(page)`: loops up to 12 turns playing all playable cards.
- Prefer deterministic setup helpers over relying on random opening hands or generated maps.

## Generated And Heavy Files

Avoid editing or re-reading unless directly relevant: `package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`, `release-desktop/**`, `coverage/**`, `reports/**`.

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
| **Trap** | Cards that prepare delayed effects for when an enemy acts. |
 
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
| **Damage Types** | Cards deal one of nine damage types (Physical, Stun, Holy, Burn, Poison, Bleed, Freeze, Nature, Trap). Damage that matches a status name (Burn, Poison, Bleed, Freeze, Stun) applies that status on hit. Enemies can have unique resistances or vulnerabilities to specific types. |

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

## Token Efficiency Rules

### Core Principle
Prioritize targeted accuracy over exhaustive exploration. Minimize tool calls, file reads, and output length.

### File Reading
* Never recursively scan the repo — inspect structure first, then open only likely targets
* Prefer symbol-level lookup over full-file reads
* Stop reading once you have sufficient context
* Never reread files already summarized

### Tool Usage
* Never call multiple tools for the same purpose
* Never retry identical failed commands without modification
* Batch related operations whenever possible

### Planning & Execution
* For simple tasks: act immediately, explain briefly after
* For complex tasks: plan in ≤5 bullets, no speculative analysis
* Do not re-plan after every action

### Output
* No prose, commentary, or task restatement
* No line-by-line explanation of code changes unless asked
* Prefer diffs over full rewrites
* Status updates: <100 words — Implementation summaries: <200 words

### Coding
* Minimal diffs only — no refactors, style rewrites, or unrelated file changes

### Reasoning Effort
* Simple bugfixes/CRUD: low deliberation, fast execution
* Reserve deeper reasoning for architecture, concurrency, security, and ambiguous requirements

## Preventing Reasoning Loops

Agents can get stuck cycling through the same hypotheses or re-reading the same files without making progress. Follow these rules to avoid it.

### Recognize When You Are Stuck

You are stuck if any of the following are true:

- The last 2 tool calls or reasoning steps produced no new information
- You are re-reading the same files for the same reason
- You are rephrasing the same hypothesis without new evidence to support or refute it

### Hard Iteration Cap

If you have attempted the same approach — or a close variant — more than 2 times without progress, stop immediately. Do not try again. Escalate instead (see below).

### Require Forward Progress

Before each step, state in one sentence what **new information** you expect to learn. If you cannot name something new, stop and escalate.

### No Speculative Spirals

Do not follow a hypothesis chain longer than **3 steps** without grounding it in a concrete tool call or observation. If you are reasoning about what *might* be true, verify it immediately — or drop it.

### Timebox Sub-Problems

If a single sub-problem (e.g., "find where X is initialized") takes more than **3 steps** to resolve, declare it unresolved and move on. Note it clearly in your output so a human can assist.

### Distinguish Exploration from Looping

| Exploration ✅ | Loop ❌ |
|---|---|
| Reading a new file or module | Re-reading a file you already analyzed for the same reason |
| Testing a new hypothesis | Rephrasing a hypothesis you already ruled out |
| Trying a different fix strategy | Retrying the same fix with minor wording changes |

Keep a running list of files and hypotheses already ruled out so you do not revisit them.

### Escalate Explicitly

When stuck, emit the following and halt. Do not attempt "one more thing."

```
STUCK: [one sentence on what you tried]
NEED:  [one sentence on what information or action would unblock you]
```
