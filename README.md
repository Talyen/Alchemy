# Alchemy

**Alchemy** is a fantasy roguelite deckbuilder for the browser and desktop. Build a deck, survive encounters, unlock talents between runs, and push through to the final boss.

## Features

- **Turn-based card combat** — spend Mana to play cards that deal damage, gain Block, apply statuses, and summon allies
- **Roguelite progression** — each Run is unique; Talent XP and Homestead upgrades persist across runs
- **Rich status system** — Protective (Block, Armor), Empowering (Forge, Haste), Damage-over-Time (Burn, Poison, Bleed), and Crowd Control (Freeze, Stun) effects
- **8 damage types** — Physical, Stun, Holy, Burn, Poison, Bleed, Freeze, and Nature; enemies have unique resistances and vulnerabilities

## Prerequisites

- Node.js 24+ (see `engines` in `package.json`)
- npm 11+

## Quick Start

```sh
git clone <repository-url>
cd alchemy
npm ci
npm run dev
```

`npm run dev` starts the Vite dev server and opens the browser automatically.

## Key Scripts

| Command            | Action                               |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start Vite dev server                |
| `npm test`         | Run Vitest unit tests                |
| `npm run test:e2e` | Run Playwright end-to-end tests      |
| `npm run lint`     | Lint all source files                |
| `npm run release`  | Bump version, changelog, and git tag |

Full command catalog (build, desktop, gates, balance sim, perf, clean): [`docs/REFERENCE.md`](./docs/REFERENCE.md#environment--commands). Agent/coding rules: [`AGENTS.md`](./AGENTS.md).

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

CI runs formatting, linting, unit tests, production build, and the critical Playwright suite. Path-specific tests and CI parity: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Headless balance simulation (`npm run balance:sim`) runs the real battle engine without a browser. Usage, env vars, and report categories: [`docs/REFERENCE.md` § Balance simulation](./docs/REFERENCE.md#balance-simulation).

## Project Structure

- `desktop/` — Electron main/preload
- `scripts/` — build, assets, release
- `public/` — static sounds and music
- `src/app/` — boot, screen routes, save-state
- `src/lib/` — React-free game logic (battle, game-data, homestead, validation)
- `src/features/alchemy/` — React UI (`meta`, `run-setup`, `run-loop`, `shell`, `shared`)
- `src/components/ui/` — design-system primitives
- `tests/` — Vitest unit tests and Playwright specs

Feature layout and run-state ownership: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

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

The web build targets Vercel. `vercel.json` buildCommand exports `ALCHEMY_SKIP_ASSETS=1` then runs typecheck + `vite build`, outputs `dist`, and rewrites routes to `index.html` for the single-page app.

## Tech Stack

React • TypeScript • Vite • Tailwind CSS • Zustand • Electron • Vitest • Playwright • Motion • Radix UI • Zod • ESLint • Prettier • commitlint • lefthook

## Development Guide

**Docs:** the table in [`AGENTS.md`](./AGENTS.md#docs) is the map for which document to read.

## License

Alchemy is source-available for noncommercial use under [CC BY-NC 4.0](./LICENSE.md). The license applies to the repository's original code and content unless a file or bundled dependency states otherwise. Commercial use requires separate permission from the copyright owner.
