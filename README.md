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
git clone https://github.com/Talyen/Alchemy.git
cd Alchemy
npm ci
npm run dev
```

`npm run dev` starts the Vite dev server and opens the browser automatically.

## Key Scripts

| Command            | Action                          |
| ------------------ | ------------------------------- |
| `npm run dev`      | Start Vite dev server           |
| `npm test`         | Run Vitest unit tests           |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run lint`     | Lint all source files           |

Full command catalog (build, desktop, gates, balance sim, perf, clean): [`docs/REFERENCE.md`](./docs/REFERENCE.md#environment--commands).

## Desktop Build

The game also has an Electron shell for local desktop builds. Use
`npm run dev:desktop` for local development; desktop builds and installers are
listed in the [command reference](./docs/REFERENCE.md#script-command-reference).

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

Path-specific tests, local gates, and CI parity live in
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

Headless balance simulation (`npm run balance:sim`) runs the real battle engine without a browser. Usage and environment variables: [`docs/REFERENCE.md` § Balance simulation](./docs/REFERENCE.md#balance-simulation).

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

## Documentation

| Need                                  | Start here                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Architecture, state, controllers      | [Architecture](./docs/ARCHITECTURE.md)                                                                   |
| Content and implementation checklists | [Workflows](./docs/WORKFLOWS.md) · [Asset workflow](./docs/WORKFLOWS-ASSETS.md)                          |
| Commands, battle rules, glossary      | [Developer reference](./docs/REFERENCE.md)                                                               |
| Verification and CI                   | [Contributing](./CONTRIBUTING.md) · [E2E helpers](./tests/e2e/README.md)                                 |
| Saves and migrations                  | [Save migration guide](./src/features/alchemy/shared/storage/MIGRATIONS.md)                              |
| Gear and profiling                    | [Armory](./docs/ARMORY.md) · [Performance](./docs/PERFORMANCE.md)                                        |
| Shipping and player notices           | [Release](./docs/RELEASE.md) · [Privacy](./PRIVACY.md) · [Third-party notices](./THIRD_PARTY_NOTICES.md) |

## Assets

Asset preparation runs automatically before development and production builds.
The authoring and regeneration checklist is
[`docs/WORKFLOWS-ASSETS.md`](./docs/WORKFLOWS-ASSETS.md); generated outputs are
not hand-edited.

## Deployment

The web build targets Vercel; its build command and rewrites are owned by
[`vercel.json`](./vercel.json).

## License

Alchemy is source-available for noncommercial use under [CC BY-NC 4.0](./LICENSE.md). The license applies to the repository's original code and content unless a file or bundled dependency states otherwise. Commercial use requires separate permission from the copyright owner.
