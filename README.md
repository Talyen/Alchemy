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
Burn, Poison, and Bleed tick; Stun and Freeze skip turns. Companions act at
the start of playable turns and cannot die.

**Between runs.** Keyword Talent XP unlocks talents. Materials fund Homestead
upgrades. Gear and Trinkets live in the Armory. Characters, modes, and
Collection entries unlock as you finish runs.

A run's map mixes combat with shops, Mystery events, Corruption altars, and
Campfires.

[Localization](./Docs/LOCALIZATION.md) describes the AI translation workflow, language settings, and Steam exports.

## Prerequisites

- Node.js 24.18 or later within 24.x
- npm 11.x

[`package.json`](./package.json) owns the supported ranges; `.npmrc` enforces
them during installation. `.node-version` selects the Node 24 release line.

## Quick Start

```sh
git clone https://github.com/Talyen/Alchemy.git
cd Alchemy
npm ci
npm run dev
```

`npm run dev` starts the Vite dev server and opens the browser automatically.
Desktop local development is `npm run dev:desktop`. See
[local development](./Docs/COMMANDS.md#local-development) for missing Electron
binaries, prepared-asset failures, and running checkouts on separate ports.

## Develop

Use [Contributing](./CONTRIBUTING.md#what-to-run-when-you-change) for task checks,
verification permissions and completion requirements. Ordinary task verification
starts with `npm run check`; use explicit task-owned paths in a mixed checkout.

[Commands](./Docs/COMMANDS.md) covers development, builds and operational tools.
The [E2E guide](./tests/e2e/README.md#running-focused-checks) covers browser and
Electron execution, including browser installation and fresh-build requirements.
Web deployments are deliberate through Vercel; desktop and Steam shipping follow
[Release](./Docs/RELEASE.md).

## Layout

Repository ownership and feature layout:
[`Docs/ARCHITECTURE.md`](./Docs/ARCHITECTURE.md).

- `desktop/` — Electron main/preload
- `src/app/` — boot, screen routes, save-state
- `src/lib/` — React-free game logic (battle, game-data, gear, content-systems, homestead, … — see the [ownership map](./Docs/ARCHITECTURE.md#repository-ownership))
- `src/features/alchemy/` — game features and session infrastructure (`meta`, `run-setup`, `run-loop`, `shell`, `shared`)
- `tests/` — unit tests grouped by source owner; browser specs in `tests/e2e/specs/`, Electron checks in `tests/electron/`, and desktop unit tests in `tests/desktop/`; shared fixtures, page objects, and helpers support multiple suites
- `performance/` — browser and desktop measurement scenarios and reporting tools; runtime instrumentation lives in `src/lib/performance/`
- `assets/sources/`, `src/assets/`, `public/` — raw masters, bundled assets, and public assets; [asset workflows](./Docs/WORKFLOWS-ASSETS.md) identify generated outputs
- `scripts/` — command entry points, asset registries and pipeline helpers in `scripts/assets/`, and other shared tooling in `scripts/lib/`; see the [script implementation map](./scripts/README.md)
- `lint/` — custom lint rules and import-boundary definitions composed by `oxlint.config.ts`
- `Docs/`, `.agents/` — canonical project documentation, audit procedures, plans, and agent skills and lessons
- `Docs/design/` — current audio-review inputs; see [design inputs](./Docs/design/README.md)
- `steam/` — Steam packaging and upload configuration

Root configuration files remain beside `package.json` for tool discovery. Local
outputs such as `dist/`, `dist-demo/`, `release-desktop/`, `release-desktop-demo/`, `reports/`, `playwright-report/`, and
`test-results/` are ignored artifacts. `scratch/` and `output/` hold temporary local
work; current tool inputs belong in `Docs/design/`; discard completed experiments. Existing `npm run clean` and
`npm run prune:transient` commands manage disposable reports and caches.

`npm run dev` validates committed prepared assets before starting Vite. Production builds
only validate committed generated outputs and never rewrite tracked sources.
Use the explicit authoring and `sync:*` commands in
[`Docs/WORKFLOWS-ASSETS.md`](./Docs/WORKFLOWS-ASSETS.md) when intentionally
regenerating outputs.
Do not hand-edit generated outputs.

## Documentation

Start with the document for your question:

| Question                                      | Start here                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| What do the terms mean?                       | [Glossary](./Docs/GLOSSARY.md)                                           |
| How do combat and progression work?           | [Game rules](./Docs/GAME_RULES.md)                                       |
| Where does a subsystem live?                  | [Architecture](./Docs/ARCHITECTURE.md)                                   |
| How does state change and persist?            | [Run state](./Docs/RUN_STATE.md)                                         |
| How do I add content or change a flow?        | [Workflow index](./Docs/WORKFLOWS.md)                                    |
| Which UI and audio conventions apply?         | [UI](./Docs/UI.md#guide-index), [Audio](./Docs/AUDIO.md)                 |
| Which command should I use?                   | [Commands](./Docs/COMMANDS.md)                                           |
| Which checks should I run?                    | [Contributing](./CONTRIBUTING.md)                                        |
| How do I test player interactions and layout? | [E2E guide](./tests/e2e/README.md)                                       |
| How do I investigate balance or performance?  | [Simulation](./Docs/SIMULATION.md), [Performance](./Docs/PERFORMANCE.md) |
| How do I ship?                                | [Release](./Docs/RELEASE.md)                                             |
| What is included in the Steam demo?           | [Demo contract](./Docs/STEAM_DEMO.md)                                    |
| How do agents work here?                      | [AGENTS.md](./AGENTS.md)                                                 |

[Audit guides](./Docs/Audits/README.md) are on-demand review procedures.
[Plans](./Docs/Plans/README.md) hold active work; [design inputs](./Docs/design/README.md)
support current tools. Keep durable rules in their current owner and remove
completed task records rather than archiving them.

For automated gameplay capture and cinematic video exports, see [Trailer production](./Docs/TRAILERS.md).

### Keeping documentation useful

Put each rule in one owner and link directly to it from indexes and workflows.
Document intent, surprising behavior, compatibility, and decisions a reader
cannot safely infer from names or types. Examples should show the supported
path; catalogs, exact defaults, and command inventories belong in their code
owners unless the prose needs them to explain behavior.

When behavior changes, update its owner instead of appending a dated correction
or another exception elsewhere. Remove obsolete guidance and redundant
forwarding sections; move useful rationale into its current owner and delete completed records. Keep
checklists proportional to the task. `npm run docs:check` checks explicit local
links and anchors, documented npm script names, and discovery references; it
reports reachability as an advisory. It does not validate bare paths or command
arguments, so source review is still needed to establish that instructions work.
Documentation edits follow the same
[handoff gate](./CONTRIBUTING.md#what-to-run-when-you-change) as other work.

## License

Alchemy is source-available for noncommercial use under [CC BY-NC 4.0](./LICENSE.md). The license applies to the repository's original code and content unless a file or bundled dependency states otherwise. Commercial use requires separate permission from the copyright owner.
