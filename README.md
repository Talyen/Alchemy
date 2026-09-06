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

| Command                    | Action                                                   |
| -------------------------- | -------------------------------------------------------- |
| `npm run dev`              | Start Vite dev server                                    |
| `npm run dev:desktop`      | Start the Electron shell                                 |
| `npm test`                 | Run Vitest unit tests                                    |
| `npm run test:e2e`         | Run Playwright against the existing production build     |
| `npm run lint`             | Lint all source files                                    |
| `npm run verify -- --diff` | Run related tests and risk escalations for changed paths |
| `npm run check -- --diff`  | Run the source-aware push and handoff gate               |

Install Playwright's browser once before the first local E2E run:

```sh
npx playwright install chromium
```

Run `npm run build` before `npm run test:e2e` to test current source. For
checks against the development server, use `npm run test:e2e:dev`. Focused
commands and fixture guidance live in the [E2E guide](./tests/e2e/README.md).

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
- `tests/` — unit tests grouped by source owner; browser specs in `tests/e2e/specs/`, Electron checks in `tests/electron/`, and desktop unit tests in `tests/desktop/`; shared fixtures, page objects, and helpers support multiple suites
- `performance/` — browser and desktop measurement scenarios and reporting tools; runtime instrumentation lives in `src/lib/performance/`
- `Raw Assets/`, `src/assets/`, `public/` — authored inputs, bundled assets, and public assets; [asset workflows](./docs/WORKFLOWS-ASSETS.md) identify generated outputs
- `scripts/` — command entry points and shared tooling in `scripts/lib/`; see the [script catalog](./scripts/README.md)
- `eslint/` — custom lint rules and import-boundary definitions composed by `eslint.config.js`
- `docs/`, `.agents/` — canonical project documentation, audit procedures, plans, and agent skills and lessons
- `steam/` — Steam packaging and upload configuration

Root configuration files remain beside `package.json` for tool discovery. Local
outputs such as `dist/`, `release-desktop/`, `reports/`, `playwright-report/`, and
`test-results/` are ignored artifacts. Existing `npm run clean` and
`npm run prune:transient` commands manage disposable reports and caches.

`npm run dev` prepares authored assets before starting Vite. Production builds
only validate committed generated outputs and never rewrite tracked sources.
Use the explicit authoring and `sync:*` commands in
[`docs/WORKFLOWS-ASSETS.md`](./docs/WORKFLOWS-ASSETS.md) when intentionally
regenerating outputs.
Do not hand-edit generated outputs.

## Documentation

Start with the document for your question:

| Question                                | Document                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| How do combat and progression work?     | [Battle rules and glossary](./docs/GAME_RULES.md), [Armory](./docs/ARMORY.md)                 |
| Where does game state live?             | [Architecture](./docs/ARCHITECTURE.md)                                                        |
| How do I add content or change a flow?  | [Implementation workflows](./docs/WORKFLOWS.md), [Asset workflow](./docs/WORKFLOWS-ASSETS.md) |
| Which UI and audio conventions apply?   | [UI system](./docs/UI.md), [Audio workflow](./docs/AUDIO.md)                                  |
| Which commands and checks should I run? | [Developer reference](./docs/REFERENCE.md), [Contributing](./CONTRIBUTING.md)                 |
| How do I profile or ship the game?      | [Performance profiling](./docs/PERFORMANCE.md), [Release](./docs/RELEASE.md)                  |

[AGENTS.md](./AGENTS.md#documentation-owners) provides the full ownership map
and agent working rules. Active plans and historical records are separate from
these current behavior and workflow owners.

## License

Alchemy is source-available for noncommercial use under [CC BY-NC 4.0](./LICENSE.md). The license applies to the repository's original code and content unless a file or bundled dependency states otherwise. Commercial use requires separate permission from the copyright owner.
