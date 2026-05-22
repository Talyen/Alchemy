# Alchemy

**Alchemy** is a fantasy roguelite deckbuilder prototype for the browser and desktop. Build a deck, survive encounters, unlock talents between runs, and push through to the final boss.

## Features

- **Turn-based card combat** — spend Mana to play cards that deal damage, gain Block, apply statuses, and summon allies
- **Roguelite progression** — each Run is unique; Talent XP and Homestead upgrades persist across runs
- **Rich status system** — Protective (Block, Armor), Empowering (Forge, Haste), Damage-over-Time (Burn, Poison, Bleed), and Crowd Control (Freeze, Stun) effects
- **9 damage types** — Physical, Stun, Holy, Burn, Poison, Bleed, Freeze, Nature, and Trap; enemies have unique resistances and vulnerabilities

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+

## Quick Start

```sh
git clone <repo-url>
cd alchemy
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and opens the browser automatically.

## Key Scripts

| Command                 | Action                                                 |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Start Vite dev server                                  |
| `npm run build`         | TypeScript check, production build, then format source |
| `npm run preview`       | Preview the production build locally                   |
| `npm test`              | Run Vitest unit tests                                  |
| `npm run test:coverage` | Run Vitest with coverage                               |
| `npm run test:e2e`      | Run Playwright end-to-end tests                        |
| `npm run lint`          | Lint all source files                                  |
| `npm run format`        | Format with Prettier                                   |
| `npm run release`       | Bump version + generate changelog + create git tag     |
| `npm run balance:sim`   | Run headless balance simulation report                 |

## Desktop Build

The game also has an Electron shell for local desktop builds.

| Command                 | Action                            |
| ----------------------- | --------------------------------- |
| `npm run dev:desktop`   | Run Vite and Electron together    |
| `npm run build:desktop` | Build the desktop renderer bundle |
| `npm run package:win`   | Create an unpacked Windows build  |
| `npm run dist:win`      | Create a Windows installer        |

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

CI runs formatting, linting, unit tests, production build, and the critical Playwright suite.

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
src/
├── lib/                  # Pure game logic (no React)
│   ├── battle/           # State machine, effects, draw
│   ├── content-systems/  # Map and encounter generation
│   └── game-data/        # Cards, keywords, enemies
├── features/alchemy/     # React UI
│   ├── screens/          # Pages
│   └── ui/               # Reusable widgets
├── components/           # Shared UI primitives
└── assets/optimized/     # Pre-optimized images and sounds
```

## Assets

Asset optimization runs automatically before development and production builds.

| Command                   | Action                  |
| ------------------------- | ----------------------- |
| `npm run assets:optimize` | Optimize image assets   |
| `npm run sounds:optimize` | Optimize sound effects  |
| `npm run music:optimize`  | Optimize music assets   |

Generated optimized assets are committed under `src/assets/optimized/`.

## Deployment

The web build targets Vercel. `vercel.json` uses `npm run build`, outputs `dist`, and rewrites routes to `index.html` for the single-page app.

## Tech Stack

React • TypeScript • Vite • Tailwind CSS • Zustand • Electron • Vitest • Playwright • Motion • Radix UI • ESLint • Prettier

## Contributing

See [`AGENTS.md`](./AGENTS.md) for the full development guide — architecture, conventions, tuning knobs, and domain glossary.
