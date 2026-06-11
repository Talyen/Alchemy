# Alchemy — AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder: pick a **Character**, fight turn-based battles with cards (**Mana**, **Statuses**, **Block**, companions), earn rewards, and travel to **Destinations** (combat, **Campfire**, shops, **Mystery**, **Corruption**). Between runs, the **Homestead** and **Talent** trees provide permanent progression.

> **Docs:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks & tests) · [PROMPTS.md](./PROMPTS.md) (audits) · [README.md](./README.md) (human setup)

## Where to look

| If you are… | Read first | Verify with |
|-------------|------------|-------------|
| Adding content (card, enemy, screen) | [WORKFLOWS task index](./docs/WORKFLOWS.md#task-index) | Targeted `npm test -- <path>` per [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) |
| Touching run state / stores | [ARCHITECTURE](./docs/ARCHITECTURE.md) | `tests/features/stores/` |
| Battle / card effects | [REFERENCE battle rules](./docs/REFERENCE.md#battle-implementation-rules), [BATTLE_HANDLERS.md](./src/lib/game-data/effects/BATTLE_HANDLERS.md) | `tests/lib/battle`, `descriptions-match-effects` |
| UI / motion | [WORKFLOWS stagger](./docs/WORKFLOWS.md#staggered-screen-enter-motion) | `npm run lint:ci` |
| Stuck after 3 tries | [PROMPTS.md](./PROMPTS.md) matching audit | — |

## Agent defaults

- **Pre-push:** `npm run lint:ci && npm test` · **Full hook:** `npm run check:push` ([CONTRIBUTING.md](./CONTRIBUTING.md))
- **PowerShell chaining:** `; if ($?) { next-command }` — `;` alone ignores exit codes on Windows.
- **Commands / Node / Playwright:** [docs/REFERENCE.md § Environment](./docs/REFERENCE.md#environment--commands)
- **Barrels:** `@/lib/game-data`, `@/lib/battle`, `@/lib/validation`, `@/features/alchemy/shared/screens`, `@/features/alchemy/shared/utils`, `@/features/alchemy/shared/storage` — top-level lib modules (`@/lib/audio.ts`, etc.) are not barrelled; validation schemas stay on `@/lib/validation`.
- **Battle:** immutable `BattleState`, `state.rng` (not `Math.random()`), tuning in `game-constants.ts`, `Math.round()` not `Math.floor()` (ESLint).
- **Routes:** `screen` on run domain store (`useActiveRunScreen`); no `React.lazy()` on route screens; game art eager at boot ([ARCHITECTURE § Boot](./docs/ARCHITECTURE.md#boot-and-loading)).
- **Content / save workflows:** [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) task index.
- **File locations:** [docs/REFERENCE.md § Navigation hints](./docs/REFERENCE.md#navigation-hints)
- **Stuck:** matching [PROMPTS.md](./PROMPTS.md) audit, then ask the user.
- **Verification:** path → tests in [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change); tests mirror source (`tests/lib/battle/foo.test.ts` ↔ `src/lib/battle/foo.ts`).
- **E2E:** no `skipCombatToVictory` / Skip Combat / Unlock All in specs — use `winViaCombat()` or `playCardNamed()`. See [CONTRIBUTING § E2E helpers](./CONTRIBUTING.md#e2e-helpers).
- **`gh`:** only when the user asks (CI logs, PR creation). Never substitute for `npm run lint:ci && npm test`. Do not `git push` unless the user asks.

## Import boundaries (ESLint)

Enforced in `eslint.config.js` — violations fail `npm run lint`. Run-state detail: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). Feature code outside `shared/stores/` uses `run-session-facade`, not `run-domain-store`.

| Layer | May import | Must not import |
|-------|------------|-----------------|
| `src/lib/**` | other `lib/`, npm | `@/features/**` |
| `src/lib/game-data/**` | lib data modules | `@/lib/battle` |
| `src/lib/battle/**` | lib, npm | `react`, `zustand`, `@/features/**` |
| `features/alchemy/*/screens/**` | `shared/ui`, `config`, props types | `run-loop/battle`, `run-loop/navigation`, `run/`, session actions |
| `features/alchemy/meta/**` | `shared/` | `run-loop/`, `run-setup/` |
| `features/alchemy/shared/ui/**` | `ui-store` only (ephemeral hover) | run/battle/session stores |
| Features (except `stores/`) | `run-session-facade` hooks, `readRunSessionStore`, `readActiveRunStore`, `readBattleStore` | `run-domain-store` direct imports |

**Import paths:** use on-disk paths under `src/features/alchemy/` (e.g. `@/features/alchemy/shared/stores/run-session-facade`). Only `@/*` → `src/*` in `tsconfig.json`. Edit `Screen` in [`src/lib/routing/screens.ts`](src/lib/routing/screens.ts), `DESTINATIONS` in [`src/lib/routing/destinations.ts`](src/lib/routing/destinations.ts), `REWARD_ROUTES` in [`src/features/alchemy/shared/types.ts`](src/features/alchemy/shared/types.ts).

**Tech stack:** React 19 + React Compiler (`vite.config.ts`). Avoid patterns that fight the compiler.

## Key conventions

- **Card/data:** update `descriptionLines` with effects; barrel imports for game data.
- **Persistence:** schemas, migrations, defaults, legacy fixtures together — [WORKFLOWS.md](./docs/WORKFLOWS.md).
- **File summaries:** one-line purpose comment at top of new/touched files.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — commitlint + lefthook.

### UI hard rules

- **No `React.FC`** — plain functions + explicit `Props` type.
- **Tailwind via `cn()`** from `@/lib/utils`; no template literals inside `className={}` (ESLint).
- **UI store isolation** — `shared/ui` must not import `run-domain-store`, `battle-store`, or `run-session-facade`; pass data via props; only `ui-store` for transient hover/shimmer.
- **Motion:** hover scale on `Button` / `PressableMotion` only (Framer); tap/press via CSS `active:` — not Framer `whileTap`. Panel enter / stagger: [WORKFLOWS § Staggered screen enter](./docs/WORKFLOWS.md#staggered-screen-enter-motion).
- **Cosmetic randomness** — `useState(() => …)` lazy init, not `useMemo` + `Math.random()` during render.

## Common mistakes

- **Card effects without matching `descriptionLines`** — run `npm test -- tests/lib/game-data/descriptions-match-effects.test.ts`.
- **ClassName template literals** — always use `cn(...)`.
- **Deep imports** — use barrels (see [Agent defaults](#agent-defaults)).
- **Mutating `BattleState`** or using `Math.random()` in battle.
- **`homesteadStore.addMaterials()` from run flows** — use `awardMaterialsDuringRun()` ([WORKFLOWS § Grant materials](./docs/WORKFLOWS.md#grant-materials-during-a-run)).
- **`stagger-item` on motion components** — wrap with `StaggerItem`; not on `Button` / `PressableMotion` directly.
- **`StaggerItem` on translate-centered absolute nodes** — breaks `-translate-x/y` centering (labyrinth map).
- **`ui-store` / `resetTransientRunUi` for route `screen`** — use `navigation.screen` + `useActiveRunScreen()` / `navigateTo`.
- **Importing `run-domain-store` from screens** — use `run-session-facade` outside `shared/stores/`.
- **`React.lazy()` on route screens** — static `screen-routes/` only.

## Debugging

- **DEV-only QA:** Skip Combat, Unlock All, Error Log (Options) — not in production; E2E must not target them.
- **Startup bypass:** `localStorage["alchemy-skip-loading-screen"]` — `shouldSkipStartupLoadingGate()` in `utils/dev-mode.ts`.
- **Startup validation:** `validate-startup.ts` on boot — check console.
- **Enemy turn warnings:** `[Enemy Turn]` in `enemy-turn.ts` for bad effects/traits.

## Large / generated / heavy files

Avoid repeated reads unless relevant:

- **Never edit:** `node_modules/`, `package-lock.json`, `Raw Assets/**`, `src/assets/optimized/**`, `Music/**`, `dist/**`, `.vite/**`, `release-desktop/**`, `coverage/**`, `reports/**` — also in [`.cursorignore`](.cursorignore)
- **Read on demand:** `game-constants.ts`, `cards.ts`, `keywords.ts`, `assets.ts`, `vite.config.ts`

## AI behavior

- **When stuck:** after 3 failed attempts on the same approach, run a matching [PROMPTS.md](./PROMPTS.md) audit if applicable, then ask the user. No speculative spirals; timebox to 3 hypothesis steps per sub-problem.

## Multi-agent rules

- Never run `git reset`, `git checkout --`, `git restore`, `git clean`, `git rebase`, or `git merge`. **OpenCode:** [`opencode.json`](opencode.json). **Cursor:** same via user rules; ask before `git stash`.
- Only edit your assigned area; do not touch another agent's in-progress files.
- Commit and push directly to the main branch.
