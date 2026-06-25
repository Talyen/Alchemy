# Alchemy - AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder: pick a **Character**, fight turn-based battles with cards (**Mana**, **Statuses**, **Block**, companions), earn rewards, and travel to **Destinations** (combat, **Campfire**, shops, **Mystery**, **Corruption**). Between runs, the **Homestead** and **Talent** trees provide permanent progression.

This file is for AI coding agents and the people guiding them. Humans should start at [README.md](./README.md).

> **When in doubt, ask.** A short clarifying question is cheaper than an undo.

> **Pragmatic simplicity.** When facing a behavior-vs-simplicity trade-off, propose a simpler, more stable compromise and recommend it over complex or fragile logic.

> **Ask in player terms, recommend an answer.** Lead with the player-facing intent and impact, mark a recommended option, keep file paths and schema out of the question body; add a one-line implementation footnote only if non-obvious.

> **Docs:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [ARMORY.md](./docs/ARMORY.md) (gear data model, board packing, drag FSM) · [RELEASE.md](./docs/RELEASE.md) (Steam shipping) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks and tests) · [PROMPTS.md](./PROMPTS.md) (code-quality audits) · [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md) (save schema migration) · [README.md](./README.md) (human setup)

## Pragmatism and simplicity

- Prefer the smallest coherent change that preserves player-facing behavior and existing architecture.
- Reuse established facades, barrels, helpers, and local patterns before adding new structure.
- Do not add an abstraction for one caller unless it removes real complexity or matches a proven local pattern.
- For broad refactors, first identify the stable seam and propose it before editing.

## Hard NO's

Some codebase rules are enforced by `eslint.config.js`, `lefthook`, and gate scripts; git and release safety rules are agent policy. Stop early if a task asks you to violate one.

### Never without explicit user approval

- No `git reset`, `git checkout --`, `git restore`, `git clean`, `git rebase`, or `git merge`. Ask before `git stash`.
  - **Working-tree files you did not author are not yours to recover.** If `git status` shows changes you did not make, treat them as in-flight work by another agent and leave them alone. The recovery commands above (`git checkout --`, `git restore`, `git clean`, `git stash drop`, `git reset`) are exactly the ones to avoid on those files. Stage and commit only the files you touched. If a foreign file genuinely blocks your task, ask the user — do not discard the file's contents on a guess.
- No commits, pushes, tags, releases, stashes, PRs, version bumps, dependency changes, migrations, or asset regeneration unless the user explicitly asks.
- No destructive or hard-to-reverse actions (deletions, schema migrations, force operations, public releases, dependency changes) without confirming on the **first** attempt.

### Codebase rules

- No hand-edits to `CHANGELOG.md`, `release-notes/`, `package-lock.json`, `src/lib/validation/metadata.generated.ts`, or `src/lib/game-data/assets.generated.ts`.
- No `Math.random()` in battle code (use `state.rng`). No `Math.floor()` in battle (use `Math.round()`). No `React.lazy()` for route screens. No `React.FC`.
- No template literals in `className` (use `cn()`).
- No reads or prints of `.env`, `secrets/**`, or auth tokens. Ask the user if credentials are required.
- TODO/FIXME/XXX/HACK comments must include a reason and target; do not leave bare stale markers.

## Escalation policy

- After three failed attempts with the same approach, run the relevant audit in [PROMPTS.md](./PROMPTS.md) (or [WORKFLOWS](./docs/WORKFLOWS.md) for domain wiring), then ask the user rather than continuing speculative changes.
- Stop and ask when a lint rule or test would need to be weakened to pass, or when this file disagrees with an owner doc and `eslint.config.js` / `package.json` do not clearly resolve it.

## Parallel agents and shared worktree

You may share a working tree with another active agent. Their unstaged edits, stash entries, and uncommitted branches are not stale — they are in-flight work.
- **See a dirty tree at task start?** `git status --porcelain` to enumerate; `git diff <file>` to inspect unfamiliar hunks; `git stash list` for foreign stashes. Do not run formatters, `prettier --write`, or other repo-wide fixers that would rewrite the foreign files.
- **Scope your edits.** Stage and commit only the files you touched. Avoid `git add -A` or `git add .` when the working tree contains uncommitted changes outside your task.
- **Foreign changes intersect your task?** Stop. Confirm with the user before editing, stashing, or restoring them.
- **Foreign changes do not intersect?** Leave them alone. Edit only your own files. Do not `git checkout`, `git restore`, `git stash`, or otherwise move the foreign changes out of the working tree.

## Default execution loop

1. Start with `git status --porcelain`; inspect intersecting diffs before editing.
2. Make the smallest coherent change that fits the current architecture.
3. Run targeted tests from [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change); broaden only when the touched surface warrants it.
4. Report changed files, verification, and anything intentionally left untouched.

## Quick commands

- `npm run typecheck` — TypeScript only
- `npm run lint` — ESLint only
- `npm run lint:ci` — format, TypeScript, ESLint, dead code
- `npm test -- <glob>` — focused Vitest run (e.g. `npm test -- tests/lib/battle`)
- `npm run test:e2e:prepush` — 9-test `@prepush` E2E subset
- `npm run test:e2e:main-gate` — full E2E suite (CI `e2e-full` equivalent)
- `npm run check:push` — local pre-push gate
- `npm run check:ship:full` — release gate
- `npm run balance:sim` — balance simulation report

Change-to-test mapping: [CONTRIBUTING.md](./CONTRIBUTING.md#what-to-run-when-you-change).

## Where to look

| If you are...                                 | Read first                                                                                                                                                                         | Verify with                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Adding content (card, enemy, screen)          | [WORKFLOWS task index](./docs/WORKFLOWS.md#task-index)                                                                                                                             | Targeted tests from [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) |
| Touching run state or stores                  | [ARCHITECTURE](./docs/ARCHITECTURE.md)                                                                                                                                             | `tests/features/stores/` and related integration tests                            |
| Touching the Armory (gear, currencies, board) | [ARMORY](./docs/ARMORY.md)                                                                                                                                                         | `tests/lib/gear/`, `tests/features/screens/armory*`, `tests/architecture/gear-*`  |
| Changing battle or card effects               | [REFERENCE battle rules](./docs/REFERENCE.md#battle-implementation-rules), [BATTLE_HANDLERS.md](./src/lib/game-data/effects/BATTLE_HANDLERS.md)                                    | `tests/lib/battle` and `descriptions-match-effects`                               |
| Changing UI or motion                         | [WORKFLOWS stagger guidance](./docs/WORKFLOWS.md#staggered-screen-enter-motion); stuck on interaction/layout UX → [PROMPTS UI audits](./PROMPTS.md#ui-interaction--feedback-audit) | Targeted UI tests and `npm run lint:ci`                                           |
| Changing saves or releases                    | [WORKFLOWS persistence guidance](./docs/WORKFLOWS.md#change-persisted-save-data), [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md), [RELEASE.md](./docs/RELEASE.md)                                                                  | Ship checks from [CONTRIBUTING](./CONTRIBUTING.md)                                |
| Tuning numbers or balance                     | `game-constants.ts`, `npm run balance:sim` (output: `reports/balance-report.html`)                                                                  | Targeted tests from [CONTRIBUTING](./CONTRIBUTING.md#what-to-run-when-you-change) |
| Desktop / Steam / Electron                    | [RELEASE.md](./docs/RELEASE.md), `desktop/` directory                                                                                                                                | `npm run check:ship:full`                         |

## Branch and commit policy

- Trunk-based. When the user explicitly asks for a commit, commit on the current `main`; do not create PR branches unless asked.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.
- Type → audience mapping: player-facing patch notes get `feat`, `fix`, `balance`, `perf`. Dev-only (`CHANGELOG.md`) get `refactor`, `test`, `chore`, `ci`, `build`, `docs`, `style`.
- The pre-commit hook runs lockfile-check, `typecheck`, and `prettier --write` on staged files. The pre-push hook syncs `CHANGELOG.md` ## [Unreleased] from git history since the latest `v*` tag.

## Architectural invariants

- **Run state:** feature code outside `shared/stores/` accesses run state through `run-session-facade` hooks/readers and transition APIs, not `run-domain-store` directly.
- **Battle:** treat `BattleState` as immutable; use `state.rng` and `Math.round()` (never `Math.random()` / `Math.floor()`); keep tuning in `game-constants.ts`.
- **Content:** card `descriptionLines` must match effects. Run-earned materials flow through `awardMaterialsDuringRun()`.
- **Persistence:** update schemas, migrations or normalization, defaults, hydration/snapshots, and legacy fixtures together as applicable.
- **Routes:** route screens are statically imported through `screen-routes/`; no `React.lazy()`. Game art is eagerly loaded at boot.
- **Imports:** use the established barrels for game data, battle, validation, shared screens, shared utilities, and shared storage. Validation schemas stay imported from `@/lib/validation`. Only `@/*` maps to `src/*` in `tsconfig.json`; use on-disk paths under `src/features/alchemy/`. Import-boundary rules are enforced by `eslint.config.js` — it wins if this summary disagrees.
- **Purity:** keep pure logic out of screens and side effects out of pure modules. Push I/O, storage, clocks, RNG, and shared mutation to the owning seam.

## Test quality defaults

- Prefer behavior tests over implementation tests.
- Add or update tests for bug fixes, persistence changes, battle math, and user-visible flows.
- Do not add trivial existence tests or assertions that only prove a mock was called.

## UI conventions

- Use plain function components with explicit `Props` types, not `React.FC`.

  ```tsx
  type CardProps = { card: Card; onPlay: (id: string) => void };
  function Card({ card, onPlay }: CardProps) { /* ... */ }
  ```

- Build conditional Tailwind classes with `cn()` from `@/lib/utils`; no template literals in `className`.

  ```tsx
  cn("base-card", isSelected && "ring-2", size === "lg" && "p-6");
  ```

- Keep reusable `shared/ui` components isolated from run, battle, and session stores; pass domain data through props.
- Use CSS `active:` for press feedback on buttons; no Framer hover scale. Hover uses background lift from `src/lib/ui/button-hover.ts` plus sound via `Button` or `PressableSound`.
- Use `StaggerGroup` / `StaggerItem` per [the motion workflow](./docs/WORKFLOWS.md#staggered-screen-enter-motion). Do not wrap translate-centered absolute map nodes with `StaggerItem`.
- Initialize cosmetic randomness lazily with `useState(() => ...)`, not `useMemo` plus `Math.random()` during render.

## Generated and heavy files

- **Do not hand-edit:** `src/lib/validation/metadata.generated.ts` (`npm run sync:version`), `src/lib/game-data/assets.generated.ts` (`npm run sync:assets`), `CHANGELOG.md` ## [Unreleased] (`npm run sync:changelog`), optimized assets (see [WORKFLOWS](./docs/WORKFLOWS.md#assets)), or anything under `node_modules/`, `dist/`, `.vite/`, `release-desktop/`, `coverage/`, `reports/`.
- `predev` and `prebuild` run asset optimization and version sync. If generated files change as a side effect of a normal command, report them and leave them unstaged unless the task explicitly requires those outputs.
- **Read-on-demand:** don't re-read large or binary files once seen this session — `Raw Assets/`, `Music/`, `src/assets/optimized/`, `game-constants.ts`, `cards.ts`, `keywords.ts`, `assets.ts`, `assets.generated.ts`, `vite.config.ts`, `metadata.generated.ts`.

## Environment

- Windows / PowerShell 7 (`&&` and `||` work natively). Prefer `&&`/`||`; use `; if ($?) { ... }` only when you need a conditional block.
- Do not `cd` inside commands — use the `workdir` parameter.
- String interpolation gotchas: `"$obj.Prop"` only expands `$obj` (appends literal `.Prop`); use `"$(...)"` for subexpressions, or single quotes for verbatim strings. Call native exes whose path has spaces with the call operator: `& "path with spaces\exe" args`.
- `predev` and `prebuild` run asset optimization and version sync; the first build is slow. Don't try to skip them.
- Node + npm versions: see `package.json` `engines`; install via `npm ci`. First-time Playwright setup: `npx playwright install chromium`.

## Debugging

- Battle warnings use the `[Enemy Turn]` prefix.
- On E2E failure, read `test-results/failures/` for diagnostic markdown (console/runtime logs + DOM snapshot). Run `npm run test:e2e:audit` for flakiness analysis per spec.
