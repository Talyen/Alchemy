# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder.

## Working Style

- Treat an existing dirty tree as in-flight work: understand it before editing, preserve user intent, and improve it when it intersects with the task.
- Choose the simplest implementation that fully meets the current requirements, then optimize for robustness and maintainability.
- Do not preserve backward compatibility unless there is a concrete need, such as persisted data, shipped behavior, or external consumers.
- Prefer established, well-maintained libraries over custom implementations when they are a good fit.
- Prefer honest judgment over compliance. Challenge weak ideas, including user requests, and recommend the strongest architecture or product direction you see.
- If the same approach fails three times, stop, reassess with the relevant docs or audits, and ask rather than continuing speculative fixes.
- Run a code-quality audit only when the user cites one under [docs/Audits](./docs/Audits/README.md). Uncited audits are not backlog.
- Choose your own discovery and fix strategy. Do not invent work to fill a quota.
- When a change alters an invariant, workflow, or command documented in `docs/`, `CONTRIBUTING.md`, or this file, update that doc in the same change.

## Docs

For non-trivial work, find and read only the docs that match the task; prefer specific subsystem docs over broad assumptions.

Each document owns the concern named below. When another document needs the same policy, link to the owner instead of restating volatile commands, versions, counts, or file inventories.

| Need                                              | Read                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Run state, controllers, import boundaries, boot   | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                       |
| How-to (saves, cards, screens, materials, motion) | [docs/WORKFLOWS.md](./docs/WORKFLOWS.md)                             |
| Commands, battle rules glossary                   | [docs/REFERENCE.md](./docs/REFERENCE.md)                             |
| Hooks, area → test commands, E2E helpers          | [CONTRIBUTING.md](./CONTRIBUTING.md)                                 |
| Save-compat contract                              | [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md) |
| Armory / gear                                     | [docs/ARMORY.md](./docs/ARMORY.md)                                   |
| FPS / hitch profiling (on-demand)                 | [docs/PERFORMANCE.md](./docs/PERFORMANCE.md)                         |
| Steam release process                             | [docs/RELEASE.md](./docs/RELEASE.md)                                 |
| Audits                                            | [docs/Audits/README.md](./docs/Audits/README.md)                     |

## Verification

- Prefer an E2E-verifiable user flow when possible, with focused tests for implementation detail.
- Verify with the path-scoped gates for the touched area in [CONTRIBUTING.md § What to run when you change…](./CONTRIBUTING.md#what-to-run-when-you-change). Full pre-push and main-gate rules live in [CONTRIBUTING.md § Before you push](./CONTRIBUTING.md#before-you-push).
- Treat lint failures, test failures, flaky tests, and React Compiler ESLint errors (`react-compiler/react-compiler`) as real quality problems, not noise.
- Animation and canary specs use raw `@playwright/test`; never `enableFastMode` / `fastBattle`. See [CONTRIBUTING.md § E2E helpers](./CONTRIBUTING.md#e2e-helpers).

## Branch and commit policy

- Trunk-based. When the user explicitly asks for a commit, commit directly to `main`; do not create PR or feature branches unless asked.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.
- Type → audience mapping: player-facing patch notes get `feat`, `fix`, `balance`, `perf`. Dev-only entries get `refactor`, `test`, `chore`, `ci`, `build`, `docs`, `style`.
- **Do not edit `CHANGELOG.md`.** It is updated only at release from git history. See [CONTRIBUTING.md § Changelog and patch notes](./CONTRIBUTING.md#changelog-and-patch-notes).
- Hooks, commitlint, and patch-note rules: [CONTRIBUTING.md § Changelog and patch notes](./CONTRIBUTING.md#changelog-and-patch-notes) and [Before you push](./CONTRIBUTING.md#before-you-push).

## Architectural invariants

- **Run state:** feature code outside `shared/stores/` accesses run state through capability-specific ports (`run-session-react-ports`, `run-session-read-port`, `run-session-write-port`, `run-session-lifecycle-port`) and domain modules (`profile-store`, `gear-store`) — not `run-transitions` directly. Gameplay writes live in `run-session-write-port.ts`; commits go through `dispatchRunSessionCommand()` in `run-session-command.ts`. See [ARCHITECTURE](./docs/ARCHITECTURE.md).
- **Controllers:** screens receive run/battle data via controller props from `screen-routes/` / shell controllers — no React context for those bindings.
- **Battle:** treat `BattleState` as immutable; use `state.rng` and `Math.round()` (never `Math.random()` / `Math.floor()`); keep tuning in `src/lib/game-constants/` (barrel at `game-constants.ts`; edit the topical file under that folder).
- **Content:** card `descriptionLines` must match effects. Run-earned materials flow through `awardMaterialsDuringRun()` — do not call progress `addMaterials()` directly for run-loop loot. See [WORKFLOWS § Grant materials](./docs/WORKFLOWS.md#grant-materials-during-a-run).
- **Persistence:** update schemas, migrations or normalization, defaults, hydration/snapshots, and legacy fixtures together as applicable. Checklist: [WORKFLOWS § Change persisted save data](./docs/WORKFLOWS.md#change-persisted-save-data). Contract: [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- **Routes:** route screens are statically imported through `screen-routes/`; no `React.lazy()`. Game art is eagerly loaded at boot.
- **Imports:** import-boundary rules are enforced by `eslint.config.js` — it wins if this summary disagrees. Highest-cost layers: [ARCHITECTURE § Import boundaries](./docs/ARCHITECTURE.md#import-boundaries).
- **Purity:** keep pure logic out of screens and side effects out of pure modules. Push I/O, storage, clocks, RNG, and shared mutation to the owning seam.

## UI

- Be exacting about UI/UX polish: native feel, smooth motion, visual balance, spacing, alignment, and responsive behavior. If something looks off, fix it before calling the work done.
- Use plain function components with explicit `Props` types, not `React.FC`. Build conditional Tailwind classes with `cn()` from `@/lib/utils`; no template literals in `className`.
- Use CSS `active:` for press feedback on buttons; no Framer hover scale. Hover uses background lift from `src/lib/ui/button-hover.ts` plus sound via `Button` or `PressableSound`.
- Use `StaggerGroup` / `StaggerItem` per [the motion workflow](./docs/WORKFLOWS.md#staggered-screen-enter-motion). Do not wrap translate-centered absolute map nodes with `StaggerItem`.
- Initialize cosmetic randomness lazily with `useState(() => ...)`, not `useMemo` plus `Math.random()` during render.

## Environment

- Node + npm versions: see `package.json` `engines`; install via `npm ci`. First-time Playwright setup: `npx playwright install chromium`.
- Run the game with `npm run dev` (Vite, port 5173 with `strictPort`; override via `ALCHEMY_DEV_PORT`). Commands: [REFERENCE](./docs/REFERENCE.md#environment--commands).
- `predev` and `prebuild` run `scripts/prepare-assets.mjs` (and version sync on prebuild); the first build is slow. Escape hatch: `ALCHEMY_SKIP_ASSETS=1` (CI/Vercel/release skip because optimized outputs are committed; see [REFERENCE § Build commands](./docs/REFERENCE.md#build-commands-decision-tree)).
- Don't chain `cd` into commands — set your tool's working-directory option instead.
- Windows / PowerShell 7 shell details: [CONTRIBUTING.md](./CONTRIBUTING.md#before-you-push).

## Debugging

- Battle warnings use the `[Enemy Turn]` prefix.
- On E2E failure, diagnostic markdown lives under `test-results/failures/` (console/runtime logs + DOM snapshot). Flakiness analysis: `npm run test:e2e:audit`.

## Reporting

- Report what changed, what verification ran, and anything intentionally left untouched.
