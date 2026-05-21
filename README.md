# Alchemy

**Alchemy** is a browser-first fantasy roguelite deckbuilder prototype. Build a deck, survive encounters, unlock talents between runs, and push through to the final boss.

## Features

- **Turn-based card combat** — spend Mana to deal damage, gain Block, apply statuses, and summon allies
- **Roguelite progression** — each Run is unique; Talent XP and Homestead upgrades persist across runs
- **Rich status system** — Burn, Poison, Bleed, Freeze, Stun, Forge, Haste, and more

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

## Key Scripts

| Command               | Action                                              |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Start Vite dev server (opens browser automatically) |
| `npm run build`       | TypeScript check + production build                 |
| `npm run test:e2e`    | Run Playwright end-to-end tests                     |
| `npm run lint`        | Lint all source files                               |
| `npm run format`      | Format with Prettier                                |
| `npm run release`     | Bump version + generate changelog + create git tag  |
| `npm run balance:sim` | Run headless balance simulation report              |

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

### Output

The report runs all scenarios at three difficulty tiers to capture talent progression:

| Tier      | Act | Talents                     |
| --------- | --- | --------------------------- |
| **Early** | 1   | None                        |
| **Mid**   | 2   | First 3 talents per keyword |
| **Late**  | 3   | All talents per keyword     |

Console tables show the top/bottom 3 entries per tier. An HTML report is written to `reports/balance-report.html` and opens automatically — it contains full expanded tables for all entries.

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
│   └── game-data/        # Cards, keywords, enemies
├── features/alchemy/     # React UI
│   ├── screens/          # Pages
│   └── ui/               # Reusable widgets
└── assets/optimized/     # Pre-optimized images and sounds
```

## Tech Stack

React • TypeScript • Vite • Tailwind CSS • Playwright

## Contributing

See [`AGENTS.md`](./AGENTS.md) for the full development guide — architecture, conventions, tuning knobs, and domain glossary.
