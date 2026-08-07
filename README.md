# Alchemy

**Alchemy** is a fantasy roguelite deckbuilder for the browser and desktop. Build a deck, survive encounters, unlock talents between runs, and push through to the final boss.

## Features

- **Turn-based card combat** — spend Mana to play cards that deal damage, gain Block, apply statuses, and summon allies
- **Roguelite progression** — each Run is unique; Talent XP and Homestead upgrades persist across runs
- **Rich status system** — Protective (Block, Armor), Empowering (Forge, Haste), Damage-over-Time (Burn, Poison, Bleed), and Crowd Control (Freeze, Stun) effects
- **9 damage types** — Physical, Stun, Holy, Burn, Poison, Bleed, Freeze, Nature, and Arrow; enemies have unique resistances and vulnerabilities

## Prerequisites

- Node.js 24+ (see `engines` in `package.json`)
- npm 11+

## Quick Start

```sh
git clone <repository-url>
cd alchemy
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and opens the browser automatically.

## Key Scripts

| Command                 | Action                                                |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Start Vite dev server                                 |
| `npm run build`         | Production build (Vite; typecheck is a separate gate) |
| `npm run preview`       | Preview the production build locally                  |
| `npm test`              | Run Vitest unit tests                                 |
| `npm run test:coverage` | Run Vitest with coverage                              |
| `npm run test:e2e`      | Run Playwright end-to-end tests                       |
| `npm run lint`          | Lint all source files                                 |
| `npm run format`        | Format with Prettier                                  |
| `npm run release`       | Bump version + generate changelog + create git tag    |
| `npm run balance:sim`   | Run headless balance simulation report                |
| `npm run clean`         | Remove local test/report/.vite artifacts              |
| `npm run clean:all`     | clean + builds + stop stale E2E preview ports         |

> Full command reference: [`docs/REFERENCE.md`](./docs/REFERENCE.md#environment--commands). Agent/coding rules: [`AGENTS.md`](./AGENTS.md).

## Desktop Build

The game also has an Electron shell for local desktop builds.

| Command                 | Action                                           |
| ----------------------- | ------------------------------------------------ |
| `npm run dev:desktop`   | Run Vite and Electron together                   |
| `npm run build:desktop` | Desktop production build (Vite `--mode desktop`) |
| `npm run package:win`   | Unpacked Windows build via `dist-desktop.mjs`    |
| `npm run dist:desktop`  | Desktop installers via `dist-desktop.mjs`        |

## Testing

Unit tests run with Vitest:

```sh
npm test
```

End-to-end tests run with Playwright. Install the browser dependency once before the first local run:

```sh
npx playwright install chromium
npm run test:e2e
```

| Tier            | Command                         | When to use                                                            |
| --------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Unit            | `npm test`                      | Fast feedback on logic and stores                                      |
| Local fast gate | `npm run check:push`            | Format, typecheck (src + tests), lint, build, and `@prepush` scenarios |
| E2E critical    | `npm run test:e2e:prepush:full` | CI critical Playwright suite                                           |
| E2E full        | `npm run test:e2e:full`         | Broader Playwright suite in CI/nightly/release                         |

For fuller local static+unit (`lint:ci` + Vitest + build) with the same `@prepush` E2E canary, use `npm run check:push:full`. It is not CI E2E parity — use `npm run test:e2e:prepush:full` for that. The default hook stays lean; CI is the authoritative full gate.

CI runs formatting, linting, unit tests, production build, and the critical Playwright suite. Path-specific tests and CI parity: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Balance Simulation

The project includes a headless battle simulator for detecting overpowered or underpowered cards, classes, enemies, and trinkets. It runs thousands of battles through the real battle engine (no browser, no React) using simple play policies.

### Usage

```sh
npm run balance:sim
```

The report is skipped during normal `npm test` runs. Set environment variables to configure the sweep:

```sh
# Increase iterations per scenario (default: 100)
ALCHEMY_BALANCE_ITERATIONS=500 npm run balance:sim

# Change the play policy (random-playable, greedy-damage, defensive-random)
ALCHEMY_BALANCE_POLICY=greedy-damage npm run balance:sim
```

In Windows PowerShell, set environment variables before the command:

```powershell
$env:ALCHEMY_BALANCE_ITERATIONS="500"; npm run balance:sim
$env:ALCHEMY_BALANCE_POLICY="greedy-damage"; npm run balance:sim
```

### Output

The report runs all scenarios at three difficulty tiers to capture talent progression:

| Tier      | Act | Talents                     |
| --------- | --- | --------------------------- |
| **Early** | 1   | None                        |
| **Mid**   | 2   | First 3 talents per keyword |
| **Late**  | 3   | All talents per keyword     |

Console tables show the top/bottom 3 entries per tier. An HTML report is written to `reports/balance-report.html` and contains full expanded tables for all entries. On Windows, the report opens automatically after the simulation finishes.

**Categories measured:**

- **Weakest / Strongest Enemies** — per tier, averaged across all classes and depths
- **Class Rankings** — per tier, averaged across all enemies to show which classes over- and under-perform with current talent levels
- **Weakest / Strongest Cards** — each card evaluated in random 10-card decks vs baseline, per tier
- **Trinket Deltas** — win-rate change vs a no-trinket baseline, per tier

All simulations use deterministic seeding for reproducible results.

## Project Structure

```
desktop/               # Electron main/preload entry points
scripts/               # Build/optimization scripts
public/                # Static assets (sounds, music, card art)
src/
├── app/                  # App bootstrapping, startup screen, save-state, preload
├── lib/                  # Pure game logic (no React)
│   ├── animation/        # Particle systems
│   ├── balance/          # Balance simulation engine
│   ├── battle/           # State machine, effects, draw
│   ├── content-systems/  # Map and encounter generation
│   ├── game-data/        # Cards, keywords, talents, compendium (barrel: @/lib/game-data)
│   │   └── talents/      # Talent XP math and talent data
│   ├── homestead/        # Between-run hub logic
│   ├── ui/               # Utility UI logic
│   ├── validation/       # Zod schemas and migrations
│   ├── audio.ts          # Web Audio buffer playback
│   ├── audio-*.ts        # SFX, music, volume, state, cache
│   ├── game-constants.ts # All tuning knobs
│   └── trinkets.ts       # Trinket definitions
├── features/alchemy/     # React UI
│   ├── shared/           # stores, storage, ui, config
│   ├── meta/             # menu, collection, homestead, talents
│   ├── run-setup/        # character, difficulty, draft screens
│   ├── run-loop/         # battle glue, navigation, shop, in-run screens
│   └── shell/            # controller hooks
├── components/           # Shared UI primitives
└── assets/optimized/     # Pre-optimized images
tests/                   # Vitest unit tests and Playwright e2e specs
```

## Assets

Asset preparation runs automatically before development and production builds via `scripts/prepare-assets.mjs` (`predev` / `prebuild`). Set `ALCHEMY_SKIP_ASSETS=1` to skip (CI/Vercel/release do this because optimized outputs are committed).

| Command                   | Action                           |
| ------------------------- | -------------------------------- |
| `npm run assets:optimize` | Optimize image assets            |
| `npm run sync:assets`     | Regenerate `assets.generated.ts` |
| `npm run sync:gear-art`   | Regenerate `gear-art.ts`         |
| `npm run sounds:optimize` | Optimize sound effects           |
| `npm run music:optimize`  | Optimize music assets            |

Optimized images are committed under `src/assets/optimized/`. Optimized sounds are output to `public/sounds/`.

## Deployment

The web build targets Vercel. `vercel.json` runs `npm run build:web:ci` (typecheck + build with `ALCHEMY_SKIP_ASSETS=1`), outputs `dist`, and rewrites routes to `index.html` for the single-page app.

## Tech Stack

React • TypeScript • Vite • Tailwind CSS • Zustand • Electron • Vitest • Playwright • Motion • Radix UI • Zod • ESLint • Prettier • commitlint • lefthook

## Development Guide

**Docs:** [`AGENTS.md`](./AGENTS.md) (coding rules) · [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (run state) · [`docs/WORKFLOWS.md`](./docs/WORKFLOWS.md) (how-to checklists) · [`docs/REFERENCE.md`](./docs/REFERENCE.md) (commands, glossary, battle rules) · [`CONTRIBUTING.md`](./CONTRIBUTING.md) (hooks & tests) · [`docs/Audits`](./docs/Audits/README.md) (agent audits)
