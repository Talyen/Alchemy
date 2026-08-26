# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder.

## Working style

- Treat a dirty tree as in-flight user work: inspect it before editing, preserve intent, and keep unrelated paths out of the task.
- Choose the smallest complete implementation; prefer established libraries when they fit. Preserve compatibility only for a concrete consumer such as persisted saves, shipped behavior, or an external contract.
- Challenge weak requirements with evidence; if one approach fails three times, reassess with the owning docs/tests and ask rather than continue speculatively.
- Run a guide under [docs/Audits](./docs/Audits/README.md) only when the user cites it. Uncited audits are not backlog, and zero findings is valid.
- When a change alters a documented invariant, workflow, or command, update its canonical owner in the same change.

## Communication

Write for a collaborator who knows Alchemy as a game, not its file tree. Lead with what is now true in the game or workflow, then name files/symbols only as needed. Match the question’s level, name a term once, and do not echo repository rules or raw tool output into chat.

## Documentation owners

For non-trivial work, choose the primary owner that matches the task. Read an additional owner only when the change demonstrably crosses that document's boundary; other documents link to the owner instead of copying volatile commands, versions, counts, or inventories.

| Need                                            | Read                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Run state, controllers, import boundaries, boot | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                       |
| Saves, cards, screens, materials, motion        | [docs/WORKFLOWS.md](./docs/WORKFLOWS.md)                             |
| Raw art / sound / generated asset barrels       | [docs/WORKFLOWS-ASSETS.md](./docs/WORKFLOWS-ASSETS.md)               |
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
- Keep evidence opt-in: raw/optimized assets, generated files, lockfiles, `CHANGELOG.md`, release notes, `reports/`, `dist/`, `release-desktop/`, `playwright-report/`, `test-results/`, `coverage/`, and `node_modules/` are not default context.

## Verification

- After edits, use the `verifier` skill for changed-path verification and the final handoff gate. [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) owns exact commands and route policy; treat lint, test, flake, and React Compiler failures as real problems.

## Branch and commits

- Trunk-based: when the user explicitly requests a commit, commit directly to `main`; create a branch/PR only when asked.
- Use Conventional Commits. Player-facing patch-note types are `feat`, `fix`, `balance`, and `perf`; dev-only types include `refactor`, `test`, `chore`, `ci`, `build`, `docs`, and `style`.
- **Do not edit `CHANGELOG.md`.** Release derives it from git history; see [RELEASE](./docs/RELEASE.md) and [CONTRIBUTING](./CONTRIBUTING.md#changelog-and-patch-notes).

## High-risk invariants

- **Run state:** feature code outside `shared/stores/` uses capability ports and domain stores, never `run-transitions` directly. Gameplay writes go through `run-session-write-port.ts` and commit through `dispatchRunSessionCommand()`. See [ARCHITECTURE](./docs/ARCHITECTURE.md#run-state).
- **Controllers:** screens receive run/battle bindings through route or shell controller props, not React context. Allowed presentation contexts: `AppScreenChromeProvider`, `CardDescriptionProvider`, and `ui-store`.
- **Battle:** treat `BattleState` as immutable and use the supplied RNG; follow [REFERENCE](./docs/REFERENCE.md#battle-implementation-rules) for arithmetic and engine rules. Tuning belongs in topical files under `src/lib/game-constants/`.
- **Content:** `descriptionLines` must match effects. Run-earned materials use `awardMaterialsDuringRun()`, not progress `addMaterials()`.
- **Persistence:** change schemas, normalization/migrations, defaults, hydration/snapshots, and legacy fixtures together as applicable. Follow [MIGRATIONS](./src/features/alchemy/shared/storage/MIGRATIONS.md).
- **Routes/assets:** route screens are statically imported through `screen-routes/`; game art loads eagerly. Generated asset barrels are outputs—edit their manifest/source and regenerate. Pipeline: [WORKFLOWS-ASSETS](./docs/WORKFLOWS-ASSETS.md).
- **Imports/purity:** `eslint.config.js` owns import boundaries. Keep pure logic out of screens and I/O, clocks, RNG, storage, and shared mutation at the owning seam.

## Change guards

- **Existing boundaries:** before modifying a shared store/port, save contract, core constant, or routing policy, identify the invariant being changed and search the touched subsystem first; expand to consumers only for a public symbol, never repository-scan private helpers.
- **Intent recovery:** if the owner-doc section and nearest assertions leave an established gameplay/persistence rule ambiguous, recover intent from the nearest tests and at most five relevant commits before editing; record the recovered invariant. Never trigger this from a path alone.
- **Post-edit review:** review only the changed diff for speculative abstraction, copied logic, and accidental fan-out; never scan unrelated dirty work. Prefer delete → reuse → local simplify → parameterizing proven duplication → abstraction.
- **Comments:** keep why, ordering, non-obvious invariants, layout/math traps, and eslint/type gaps. Do not restate the next identifier or type, and do not add file banners that only name the module. Never record `Depends on` / `Depended on by` / `Used by:` graphs — imports and search already answer that, and they go stale. Do not require a comment on every export. Load-bearing rules belong in tests.
- New or structurally revised cross-boundary contracts additionally use the `architect` skill before implementation.

## UI

- Plain function components with explicit `Props`, not `React.FC`; `cn()` for conditional Tailwind classes.
- Motion, interaction, and tooltip behavior is owned by [WORKFLOWS](./docs/WORKFLOWS.md#screen-fade-motion); follow the matching section before changing it.
- Cosmetic randomness initializes lazily via `useState(() => ...)`, never render-time `Math.random()`.
- Accessibility scope is intentionally constrained; follow the canonical [WORKFLOWS stance](./docs/WORKFLOWS.md#accessibility-stance) before adding accessibility-specific behavior.

## Environment and failures

- Node/npm versions are authoritative in `package.json`; commands and build flags live in [REFERENCE](./docs/REFERENCE.md#environment--commands). Set the tool working directory instead of chaining `cd`.
- Start failure work from the command's bounded digest or `reports/current-run.md`, then open the exact named failure file. Raw logs, JSON, HTML, traces, snapshots, and report directories are drill-down evidence only. Triage: [REFERENCE § Failure-first triage](./docs/REFERENCE.md#failure-first-triage).

## Handoff

Report what changed in game/workflow terms, exact verification and status, and anything intentionally untouched. Do not paste logs or diff dumps.
