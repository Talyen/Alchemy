# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder.

## Working Style

- Start code tasks with `git status --porcelain`. Treat existing changes as in-flight work: understand them before editing, preserve user intent, and improve them when they intersect with the task.
- Optimize for quality, simplicity, robustness, scalability, and maintainability. Development cost is secondary.
- Prefer honest judgment over compliance. Challenge weak ideas, including user requests, and recommend the strongest architecture or product direction you see.
- If the same approach fails three times, stop, reassess with the relevant docs or audits, and ask rather than continuing speculative fixes.
- Run a code-quality audit only when the user cites one under [docs/Audits](./docs/Audits/README.md). Uncited audits are not backlog.

## Docs

- For non-trivial work, discover relevant docs with `rg --files -g '*.md'` and `rg <topic>`. Read only what matches the task; prefer specific subsystem docs over broad assumptions.

| Need                                              | Read                                             |
| ------------------------------------------------- | ------------------------------------------------ |
| Run state, controllers, import boundaries, boot   | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)   |
| How-to (saves, cards, screens, materials, motion) | [docs/WORKFLOWS.md](./docs/WORKFLOWS.md)         |
| Commands, battle rules glossary                   | [docs/REFERENCE.md](./docs/REFERENCE.md)         |
| Hooks, area → test commands, E2E helpers          | [CONTRIBUTING.md](./CONTRIBUTING.md)             |
| Armory / gear                                     | [docs/ARMORY.md](./docs/ARMORY.md)               |
| Audits (only when the user cites one)             | [docs/Audits/README.md](./docs/Audits/README.md) |

## Verification

- Start from an E2E-verifiable user flow whenever possible, then use focused tests to cover the implementation details.
- Prefer path-scoped commands from [CONTRIBUTING.md § What to run when you change…](./CONTRIBUTING.md#what-to-run-when-you-change).
- Treat lint failures, test failures, flaky tests, and React Compiler ESLint errors (`react-compiler/react-compiler`) as real quality problems, not noise.
- Pre-push is expensive: changelog sync, `lint:ci` (format, typecheck, ESLint, dependency-cruiser boundaries, architecture smoke, knip), unit tests, `build:ship`, and `@prepush` E2E. Details: [CONTRIBUTING.md § Before you push](./CONTRIBUTING.md#before-you-push).
- Pre-commit formats staged files via `scripts/run-prettier.mjs` (same globs as `format:check`, including `docs/` and root configs).
- Before merging to `main`, or when battle E2E helpers change, also run the `@critical` / `test:e2e:main-gate` gate as CONTRIBUTING describes.
- Animation and canary specs use raw `@playwright/test`; never `enableFastMode` / `fastBattle` in those specs. See [CONTRIBUTING.md § E2E helpers](./CONTRIBUTING.md#e2e-helpers).

## Branch and commit policy

- Trunk-based. When the user explicitly asks for a commit, commit on the current `main`; do not create PR branches unless asked.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.
- Type → audience mapping: player-facing patch notes get `feat`, `fix`, `balance`, `perf`. Dev-only (`CHANGELOG.md`) get `refactor`, `test`, `chore`, `ci`, `build`, `docs`, `style`.
- Commit-msg runs `commitlint`. Pre-commit: lockfile dry-run, `typecheck`, and Prettier on staged files. Pre-push: full gate in [CONTRIBUTING.md](./CONTRIBUTING.md#before-you-push). Changelog / patch-note rules: [CONTRIBUTING.md § Changelog and patch notes](./CONTRIBUTING.md#changelog-and-patch-notes).

## Architectural invariants

- **Run state:** feature code outside `shared/stores/` accesses run state through `run-session-facade` hooks/readers and transition APIs, not `run-domain-store` directly.
- **Controllers:** screens receive run/battle data via controller props from `screen-routes/` / shell controllers — no React context for those bindings. See [ARCHITECTURE § Data flow](./docs/ARCHITECTURE.md#data-flow).
- **Battle:** treat `BattleState` as immutable; use `state.rng` and `Math.round()` (never `Math.random()` / `Math.floor()`); keep tuning in `src/lib/game-constants/` (barrel at `game-constants.ts`; edit the topical file under that folder).
- **Content:** card `descriptionLines` must match effects. Run-earned materials flow through `awardMaterialsDuringRun()` — do not call progress `addMaterials()` directly for run-loop loot. See [WORKFLOWS § Grant materials](./docs/WORKFLOWS.md#grant-materials-during-a-run).
- **Persistence:** update schemas, migrations or normalization, defaults, hydration/snapshots, and legacy fixtures together as applicable. Checklist: [WORKFLOWS § Change persisted save data](./docs/WORKFLOWS.md#change-persisted-save-data) and [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- **Routes:** route screens are statically imported through `screen-routes/`; no `React.lazy()`. Game art is eagerly loaded at boot.
- **Imports:** use the established barrels for game data, battle, validation, phase screens (`meta/screens`, `run-setup/screens`, `run-loop/screens`), shared utilities, and shared storage. Validation schemas stay imported from `@/lib/validation`. Only `@/*` maps to `src/*` in `tsconfig.json`; use on-disk paths under `src/features/alchemy/`. Import-boundary rules are enforced by `eslint.config.js` — it wins if this summary disagrees. Highest-cost layers ([ARCHITECTURE § Import boundaries](./docs/ARCHITECTURE.md#import-boundaries)):
  - `src/lib/**` must not import `@/features/**`
  - `src/lib/game-data/**` must not import `@/lib/battle`
  - screens must not import `run-loop/battle` or `run-loop/navigation` (wire via controller props)
  - `meta/**` must not import `run-loop/**` or `run-setup/**`
  - `shared/ui/**` may use `ui-store` only; no session/run/battle stores
- **Purity:** keep pure logic out of screens and side effects out of pure modules. Push I/O, storage, clocks, RNG, and shared mutation to the owning seam.

## UI

- Be exacting about UI/UX polish: native feel, smooth motion, visual balance, spacing, alignment, and responsive behavior.
- If something looks off, fix it before calling the work done.
- Aim for crafted, artisanal software: every interaction should feel intentional.
- Use plain function components with explicit `Props` types, not `React.FC`.

  ```tsx
  type CardProps = { card: Card; onPlay: (id: string) => void };
  function Card({ card, onPlay }: CardProps) {
    /* ... */
  }
  ```

- Build conditional Tailwind classes with `cn()` from `@/lib/utils`; no template literals in `className`.

  ```tsx
  cn("base-card", isSelected && "ring-2", size === "lg" && "p-6");
  ```

- Keep reusable `shared/ui` components isolated from run, battle, and session stores (`ui-store` is the allowed exception); pass domain data through props.
- Use CSS `active:` for press feedback on buttons; no Framer hover scale. Hover uses background lift from `src/lib/ui/button-hover.ts` plus sound via `Button` or `PressableSound`.
- Use `StaggerGroup` / `StaggerItem` per [the motion workflow](./docs/WORKFLOWS.md#staggered-screen-enter-motion). Do not wrap translate-centered absolute map nodes with `StaggerItem`.
- Initialize cosmetic randomness lazily with `useState(() => ...)`, not `useMemo` plus `Math.random()` during render.

## Environment

- Windows / PowerShell 7: prefer `&&` / `||`. Details: [CONTRIBUTING.md](./CONTRIBUTING.md#before-you-push).
- Do not `cd` inside commands — use the `workdir` parameter.
- `predev` and `prebuild` run asset optimization and version sync; the first build is slow. Don't try to skip them.
- Node + npm versions: see `package.json` `engines`; install via `npm ci`. First-time Playwright setup: `npx playwright install chromium`.

## Debugging

- Battle warnings use the `[Enemy Turn]` prefix.
- On E2E failure, read `test-results/failures/` for diagnostic markdown (console/runtime logs + DOM snapshot). Run `npm run test:e2e:audit` for flakiness analysis per spec.

## Reporting

- Report what changed, what verification ran, and anything intentionally left untouched.
