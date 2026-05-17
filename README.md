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

| Command | Action |
|---|---|
| `npm run dev` | Start Vite dev server (opens browser automatically) |
| `npm run build` | TypeScript check + production build |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run lint` | Lint all source files |
| `npm run format` | Format with Prettier |

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
