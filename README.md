# Alchemy

**Alchemy** is a fantasy roguelite deckbuilder for the browser and desktop. Pick a
mode, build a deck, and fight 1v1 card battles — then spend what you earned on
Talents, Homestead upgrades, and Armory Gear that persist between runs.

## Play

**Modes.** Campaign is three acts. Labyrinth is a branching maze of encounters.
Wildwood Draft is a drafted deck against an endless boss gauntlet.

**Combat.** Spend Mana to play cards. Eight damage types — Physical, Stun, Holy,
Burn, Poison, Bleed, Freeze, and Nature — meet enemy resists and
vulnerabilities. Block and Armor absorb hits; Forge boosts Physical and Stun;
Burn, Poison, and Bleed tick; Stun and Freeze skip turns. Companions fight at
the start of your turn and cannot die.

**Between runs.** Keyword Talent XP unlocks talents. Materials fund Homestead
upgrades. Gear and Trinkets live in the Armory. Characters, modes, and
Collection entries unlock as you finish runs.

A run's map mixes combat with shops, Mystery events, Corruption altars, and
Campfires.

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0` (see `engines` in `package.json`; `.node-version` pins 24 for local dev)
- npm 11+

## Quick Start

```sh
git clone https://github.com/Talyen/Alchemy.git
cd Alchemy
npm ci
npm run dev
```

`npm run dev` starts the Vite dev server and opens the browser automatically.
Desktop local development is `npm run dev:desktop`.

## Develop

| Command                            | Action                                |
| ---------------------------------- | ------------------------------------- |
| `npm run dev`                      | Start Vite dev server                 |
| `npm run dev:desktop`              | Start the Electron shell              |
| `npm test`                         | Run Vitest unit tests                 |
| `npm run test:e2e`                 | Run Playwright end-to-end tests       |
| `npm run lint`                     | Lint all source files                 |
| `npm run verify:changed -- --diff` | Route checks to the paths you changed |

Install Playwright's browser once before the first local E2E run:

```sh
npx playwright install chromium
```

Full command catalog (build, desktop, gates, balance sim, perf, clean):
[`docs/REFERENCE.md`](./docs/REFERENCE.md#environment--commands). Path-specific
tests, local gates, and CI parity: [`CONTRIBUTING.md`](./CONTRIBUTING.md).
Headless balance simulation (`npm run balance:sim`):
[`docs/REFERENCE.md` § Balance simulation](./docs/REFERENCE.md#balance-simulation).

Web deploys through Vercel ([`vercel.json`](./vercel.json)). Desktop builds,
installers, and Steam shipping:
[`docs/RELEASE.md`](./docs/RELEASE.md) and the
[command reference](./docs/REFERENCE.md#script-command-reference).

## Layout

Feature layout and run-state ownership:
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

- `desktop/` — Electron main/preload
- `src/app/` — boot, screen routes, save-state
- `src/lib/` — React-free game logic (battle, game-data, gear, content-systems, homestead, … — see `docs/REFERENCE.md#navigation-hints`)
- `src/features/alchemy/` — React UI (`meta`, `run-setup`, `run-loop`, `shell`, `shared`)
- `tests/` — Vitest unit tests and Playwright specs

Asset preparation runs automatically before development and production builds.
Do not hand-edit generated outputs; authoring lives in
[`docs/WORKFLOWS-ASSETS.md`](./docs/WORKFLOWS-ASSETS.md).

## Documentation

| Need                                  | Start here                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture, state, controllers      | [Architecture](./docs/ARCHITECTURE.md)                                                                                                                        |
| Content and implementation checklists | [Workflows](./docs/WORKFLOWS.md) · [Asset workflow](./docs/WORKFLOWS-ASSETS.md)                                                                               |
| Commands, battle rules, glossary      | [Developer reference](./docs/REFERENCE.md)                                                                                                                    |
| Verification and CI                   | [Contributing](./CONTRIBUTING.md) · [E2E helpers](./tests/e2e/README.md)                                                                                      |
| Saves and migrations                  | [Save migration guide](./src/features/alchemy/shared/storage/MIGRATIONS.md) · [Migration history](./src/features/alchemy/shared/storage/MIGRATION_HISTORY.md) |
| UI, audio, gear, and profiling        | [UI](./docs/UI.md) · [Audio](./docs/AUDIO.md) · [Armory](./docs/ARMORY.md) · [Performance](./docs/PERFORMANCE.md)                                             |
| Shipping and player notices           | [Release](./docs/RELEASE.md) · [Privacy](./PRIVACY.md) · [Third-party notices](./THIRD_PARTY_NOTICES.md)                                                      |

## License

Alchemy is source-available for noncommercial use under [CC BY-NC 4.0](./LICENSE.md). The license applies to the repository's original code and content unless a file or bundled dependency states otherwise. Commercial use requires separate permission from the copyright owner.
