# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder.

## Working style

- Treat a dirty tree as in-flight user work: inspect it before editing, preserve intent, and keep unrelated paths out of the task.
- Choose the smallest complete implementation, then optimize for robustness and maintenance. Prefer established libraries when they fit.
- Preserve compatibility only for a concrete consumer such as persisted saves, shipped behavior, or an external contract.
- Challenge weak requirements with evidence. If one approach fails three times, reassess with the owning docs/tests and ask rather than continue speculatively.
- Run a guide under [docs/Audits](./docs/Audits/README.md) only when the user cites it. Uncited audits are not backlog, and zero findings is valid.
- When a change alters a documented invariant, workflow, or command, update its canonical owner in the same change.

## Communication

Write for a collaborator who knows Alchemy as a game, not its file tree. Lead with what is now true in the game or workflow, then name files/symbols only as needed. Match the question’s level, name a term once, and do not echo repository rules or raw tool output into chat.

## Documentation owners

For non-trivial work, select only the owner that matches the task. Other documents should link to that owner instead of copying volatile commands, versions, counts, or inventories.

| Need                                            | Read                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Run state, controllers, import boundaries, boot | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                       |
| Saves, cards, screens, materials, motion        | [docs/WORKFLOWS.md](./docs/WORKFLOWS.md)                             |
| Commands, battle rules, glossary                | [docs/REFERENCE.md](./docs/REFERENCE.md)                             |
| Hooks, changed-path verification, E2E policy    | [CONTRIBUTING.md](./CONTRIBUTING.md)                                 |
| Save compatibility                              | [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md) |
| Armory / gear                                   | [docs/ARMORY.md](./docs/ARMORY.md)                                   |
| FPS / hitch profiling                           | [docs/PERFORMANCE.md](./docs/PERFORMANCE.md)                         |
| Steam release                                   | [docs/RELEASE.md](./docs/RELEASE.md)                                 |
| Cited audits                                    | [docs/Audits/README.md](./docs/Audits/README.md)                     |
| Active plans                                    | [docs/Plans/README.md](./docs/Plans/README.md)                       |
| UI folder placement                             | [shared/ui/README.md](./src/features/alchemy/shared/ui/README.md)    |
| Card effect handlers                            | [BATTLE_HANDLERS.md](./src/lib/game-data/effects/BATTLE_HANDLERS.md) |

### Bounded discovery

- Read headings first, then the one matching H2/H3 section; expand only across a demonstrated ownership boundary.
- Search the touched path or named symbol first. For repository-wide work, list/count matches before printing content, cap the first pass, and inspect symbol/heading ranges before whole files.
- Inspect `git status --short` before diffs and `git diff --stat` before a large diff.
- Keep evidence opt-in: raw/optimized assets, generated files, lockfiles, release notes, `reports/`, `dist/`, `release-desktop/`, `playwright-report/`, `test-results/`, `coverage/`, and `node_modules/` are not default context.
- This policy is portable across agent harnesses; do not rely on harness-specific ignore files.

## Verification

- Use `npm run verify:changed -- --diff` or explicit paths. Preview with `--plan`; full argv is opt-in with `--verbose-plan`. The executable route catalog owns path-to-command and path-to-document selection.
- Current risk routes may include focused E2E by default. Add `--e2e <route>` only when explicitly escalating another supported flow; use `--full` for an explicit full local gate. Details: [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change).
- During implementation, run the changed-path route and focused tests. At handoff, report exact checks; treat lint, test, flake, and React Compiler failures as real problems.
- Active plans live only under `docs/Plans/`. Scaffold with `npm run new:plan -- <Name>`, validate with `npm run docs:check`, delete completed plans, and run `npm run docs:check:final` (`--keep-plan` only for intentionally unfinished work).
- Animation/canary specs use raw `@playwright/test`, never `enableFastMode` or `fastBattle`. E2E mechanics live in [tests/e2e/README.md](./tests/e2e/README.md).

## Branch and commits

- Trunk-based: when the user explicitly requests a commit, commit directly to `main`; create a branch/PR only when asked.
- Use Conventional Commits. Player-facing patch-note types are `feat`, `fix`, `balance`, and `perf`; dev-only types include `refactor`, `test`, `chore`, `ci`, `build`, `docs`, and `style`.
- **Do not edit `CHANGELOG.md`.** Release derives it from git history; see [RELEASE](./docs/RELEASE.md) and [CONTRIBUTING](./CONTRIBUTING.md#changelog-and-patch-notes).

## High-risk invariants

- **Run state:** feature code outside `shared/stores/` uses capability ports and domain stores, never `run-transitions` directly. Gameplay writes go through `run-session-write-port.ts` and commit through `dispatchRunSessionCommand()`. See [ARCHITECTURE](./docs/ARCHITECTURE.md#run-state).
- **Controllers:** screens receive run/battle bindings through route or shell controller props, not React context.
- **Battle:** treat `BattleState` as immutable; use `state.rng` and `Math.round()`, never `Math.random()`/`Math.floor()`. Tuning belongs in topical files under `src/lib/game-constants/`.
- **Content:** `descriptionLines` must match effects. Run-earned materials use `awardMaterialsDuringRun()`, not progress `addMaterials()`.
- **Persistence:** change schemas, normalization/migrations, defaults, hydration/snapshots, and legacy fixtures together as applicable. Follow [MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- **Routes/assets:** route screens are statically imported through `screen-routes/`; game art loads eagerly. Generated asset barrels are outputs—edit their manifest/source and regenerate.
- **Imports/purity:** `eslint.config.js` owns import boundaries. Keep pure logic out of screens and I/O, clocks, RNG, storage, and shared mutation at the owning seam.

## UI

- Use plain function components with explicit `Props`, not `React.FC`; use `cn()` for conditional Tailwind classes.
- Use CSS `active:` feedback. Shared hover/press, button, tooltip, and fade rules live in [WORKFLOWS](./docs/WORKFLOWS.md#interactive-button-conventions); do not invent parallel motion.
- Use `FadeSlot` for in-screen identity swaps. Do not stagger page chrome or use Framer hover scale.
- Initialize cosmetic randomness lazily with `useState(() => ...)`, never `useMemo` plus render-time `Math.random()`.

## Environment and failures

- Node/npm versions are authoritative in `package.json`; commands and build flags live in [REFERENCE](./docs/REFERENCE.md#environment--commands). Set the tool working directory instead of chaining `cd`.
- Start failure work from the command’s bounded digest or `reports/current-run.md`. Open the exact named failure file next; raw logs, JSON, HTML, traces, snapshots, and report directories are drill-down evidence only.
- E2E text diagnostics live under `test-results/failures/`; flakiness analysis is `npm run test:e2e:audit`. Battle warnings use the `[Enemy Turn]` prefix.

## Handoff

Report what changed in game/workflow terms, exact verification and status, and anything intentionally untouched. Do not paste logs or diff dumps.
