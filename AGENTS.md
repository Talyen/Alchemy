# Alchemy - AGENTS.md

**Alchemy** is a fantasy roguelite deckbuilder: pick a **Character**, fight turn-based battles with cards (**Mana**, **Statuses**, **Block**, companions), earn rewards, and travel to **Destinations** (combat, **Campfire**, shops, **Mystery**, **Corruption**). Between runs, the **Homestead** and **Talent** trees provide permanent progression.

This file is for AI coding agents and the people guiding them. Humans should start at [README.md](./README.md).

> **When in doubt, ask.** A short clarifying question is cheaper than an undo.

> **Pragmatic simplicity.** Proactively ask before implementing complex abstractions or edge-case logic. A simpler behavior trade-off is often better than a complex codebase.

> **Ask in player terms, recommend an answer.** When you need clarification, lead with the design intent and the player-facing impact, and pick a recommended option. Translate technical details into gameplay terms. Implementation notes (files, schemas, abstractions) belong in a short context line at the end, not in the question itself.

> **Docs:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [REFERENCE.md](./docs/REFERENCE.md) (commands, glossary, battle) · [ARMORY.md](./docs/ARMORY.md) (gear data model, board packing, drag FSM) · [RELEASE.md](./docs/RELEASE.md) (Steam shipping) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks and tests) · [PROMPTS.md](./PROMPTS.md) (code-quality audits) · [MIGRATIONS.md](./src/features/alchemy/shared/storage/MIGRATIONS.md) (save schema migration) · [README.md](./README.md) (human setup)

## Contents

- [Hard NO's](#hard-nos)
- [Escalation policy](#escalation-policy)
  - [Question framing](#question-framing)
- [Operating procedure](#operating-procedure)
- [Quick commands](#quick-commands)
- [Where to look](#where-to-look)
- [Branch and commit policy](#branch-and-commit-policy)
- [Commit messages and changelog](#commit-messages-and-changelog)
- [Testing policy](#testing-policy)
- [Subagent and parallel work](#subagent-and-parallel-work)
- [Working safely](#working-safely)
- [Verification](#verification)
- [Sources of truth](#sources-of-truth)
- [Architectural invariants](#architectural-invariants)
- [UI conventions](#ui-conventions)
- [Generated and heavy files](#generated-and-heavy-files)
- [Environment](#environment)
- [Debugging](#debugging)

## Hard NO's

A scannable list of the most common ways to break the repo or violate policy. These are _enforced by_ `eslint.config.js`, `lefthook`, and the gate scripts — see the linked sections. Stop early if you see one of these.

- No `git reset`, `git checkout --`, `git restore`, `git clean`, `git rebase`, or `git merge`. Ask before `git stash`.
- No commits, pushes, tags, releases, stashes, PRs, version bumps, dependency changes, or asset regeneration unless the user explicitly asks.
- No hand-edits to `CHANGELOG.md`, `release-notes/`, `package-lock.json`, `src/lib/validation/metadata.generated.ts`, or `src/lib/game-data/assets.generated.ts`.
- No dev QA controls in E2E specs — no Skip Combat, Unlock All, Error Log, `skipCombatToVictory()`, or their labels. Use `winViaCombat()` or `playCardNamed()`.
- No `React.lazy()` for route screens. No `React.FC`. No `Math.random()` in battle code (use `state.rng`). No `Math.floor()` in battle (use `Math.round()`).
- No template literals in `className` (use `cn()`).
- **Comments:** Avoid "what" comments that narrate the obvious. "Why" comments, file-level summaries, and section markers that genuinely help a reader navigate or understand a non-obvious trade-off are allowed. TODO/FIXME markers must include a reason.
- No reads or prints of `.env`, `secrets/**`, or auth tokens. Ask the user if credentials are required.
- No destructive or hard-to-reverse actions (deletions, schema migrations, force operations, public releases) without confirming on the **first** attempt, not the third.

## Escalation policy

- For destructive or hard-to-reverse actions (deletions, schema migrations, dependency changes, public releases, force operations), confirm with the user before the **first** attempt.
- For non-destructive work, after three failed attempts with the same approach, run the relevant audit in [PROMPTS.md](./PROMPTS.md) — code quality or [UI interaction/layout](./PROMPTS.md#ui-interaction--feedback-audit) (or [WORKFLOWS](./docs/WORKFLOWS.md) for domain wiring), then ask the user rather than continuing speculative changes.
- Stop and ask when the requirement is ambiguous, the change spans more than a handful of files, a lint rule or test would need to be weakened to pass, or this file disagrees with an owner doc and `eslint.config.js` / `package.json` do not clearly resolve it.
- When this file disagrees with an owner doc, stop and ask unless `eslint.config.js` or `package.json` clearly resolves the conflict.
- Stop and ask when a trade-off between exact behavior and code/architectural simplicity is possible. Propose a simpler, more stable compromise (e.g., simplified UI, reduced scope, or alternative flows) and recommend it over implementing complex or fragile logic. Implementation reasoning stays in the chat, not in the question to the user.

### Question framing

When you stop to ask the user, the question should:

- **State the design intent.** What is the player-facing goal or behavior in question? (e.g. "How should Frostbite feel — a slow tick, a brittle debuff, or a one-shot shatter?")
- **Describe the impact in player terms.** What does the player see, choose, feel, or risk under each option? Keep file paths, store names, and schema terms out of the question body.
- **Lead with a recommendation.** Pick the option you think best serves the game, mark it `(Recommended)`, and briefly explain why in player terms. The user can override.
- **List 1–2 alternatives only if materially different.** Skip neutral menus of near-identical options.
- **Add a one-line context footnote** at the end if the implementation is non-obvious (e.g. "this would require a new persistence field" or "this is a breaking change to saved runs"). Keep it out of the question body.

## Operating procedure

The six-step loop for any non-trivial task. Small fixes and obvious typos may skip steps 2–3.

1. **Orient.** Find your row in [Where to look](#where-to-look). Skim the linked doc(s) before touching code — most rules and gotchas live there, not in this file.
2. **Plan.** If the change spans more than three files, alters a store, or touches persistence, state the plan in 1–3 sentences before editing. Use the `question` tool when intent is ambiguous; do not guess. Frame questions per the [Question framing](#question-framing) checklist — lead with design intent and player impact, mark a recommended option, and keep implementation details out of the question body. **Assess simplicity:** Identify any design or behavior trade-offs that could dramatically simplify the code. Propose these options in your plan before writing code.
3. **Edit minimally.** Keep changes as simple and direct as possible. Do not introduce new abstractions, helpers, or complex state logic unless explicitly requested or discussed in the plan. Match the existing style and file layout. Do not refactor unrelated code in the same diff — split it into a follow-up commit. Prefer `Edit` over `Write`. Cite files with `path:line` when discussing them.
4. **Edit precisely.** Always read the file before editing. Provide 3–5 lines of surrounding context in `oldString` to make matches unique. Use `replaceAll: true` when the same change applies to multiple occurrences. After each mutation, re-read the affected region before the next edit — earlier edits change the file and stale matches will fail.
5. **Verify.** Run the narrow test command for the area plus `npm run typecheck`. See [Verification](#verification) for the full gate.
6. **Report.** Summarize what changed, what you didn't change, and anything you noticed that the user should decide on. Flag rule-bending decisions explicitly.

Never disable a lint rule, delete a test, or weaken a type to make something pass — fix the code, or ask.

## Quick commands

- `npm run typecheck` — TypeScript only
- `npm run lint` — ESLint only
- `npm run lint:ci` — format, TypeScript, ESLint, dead code
- `npm run deadcode` — knip (default)
- `npm run deadcode:strict` — knip (strict, includes entry exports)
- `npm test -- <glob>` — focused Vitest run (e.g. `npm test -- tests/lib/battle`)
- `npm run test:e2e:prepush` — 9-test `@prepush` E2E subset
- `npm run test:e2e:prepush:full` — broader `@critical` E2E subset
- `npm run test:e2e:main-gate` — full E2E suite (CI `e2e-full` equivalent)
- `npm run test:e2e:timings` — run E2E suite and export timing JSON to reports/e2e-results.json
- `npm run test:e2e:audit` — run E2E suite and generate timing/flakiness report in reports/e2e-audit-report.md
- `npm run check:push` — local pre-push gate
- `npm run check:ship` — ship/save/desktop unit and build validation
- `npm run check:ship:full` — release gate
- `npm run balance:sim` — balance simulation report

For the change-to-test mapping, see [CONTRIBUTING.md](./CONTRIBUTING.md#what-to-run-when-you-change).

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
| Desktop / Steam / Electron                    | [RELEASE.md](./docs/RELEASE.md), `desktop/` directory                                                                                                                                | `npm run test:ship:desktop` and `npm run check:ship:full`                         |
| Diagnosing E2E failures / slowness            | `test-results/failures/` (DOM & console logs), `reports/e2e-audit-report.md`                                                                                                       | `npm run test:e2e:audit`                                                          |
| Stuck after three attempts                    | Run the relevant audit in [PROMPTS.md](./PROMPTS.md), then follow the [Escalation policy](#escalation-policy) above                                                                | Ask the user after the audit                                                      |

## Branch and commit policy

- Trunk-based. When the user explicitly asks for a commit, commit directly to `main` — no PRs, no feature branches.
- Commit-message format, examples, and type → audience mapping: see [Commit messages and changelog](#commit-messages-and-changelog). Read that before writing the first commit on a task.
- Tag / release flow: [RELEASE.md](./docs/RELEASE.md).
- The pre-commit hook automatically runs lockfile-check, `typecheck`, and `prettier --write` on staged files. Use `npx lefthook run pre-commit` locally to preview.

## Commit messages and changelog

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) with a `type` and optional `scope`: `type(scope): description`.

Type → audience mapping (governs whether a commit appears in player-facing patch notes):

- **Player-facing** (patch notes): `feat`, `fix`, `balance`, `perf`.
- **Dev-only** (`CHANGELOG.md` only): `refactor`, `test`, `chore`, `ci`, `build`, `docs`, `style`.

No body or footer is required. The pre-push hook syncs `CHANGELOG.md` ## [Unreleased] from git history since the latest `v*` tag, with an auto-commit subject like `chore(changelog): sync unreleased (N commits, hhhhh)`. Preview notes: `npm run generate:patch-notes`.

## Testing policy

- **Unit:** Vitest, path-mirrored under `tests/`. Focused runs via `npm test -- <glob>`.
- **E2E:** Playwright. Page objects in `tests/pages/`, helpers in `tests/e2e/`, fixtures in `tests/fixtures/e2e.ts`. On failure, diagnostic markdown summaries containing console/runtime logs and a DOM snapshot are generated under `test-results/failures/`. Prioritize reading these text summaries to diagnose issues.
- **Combat specs:** prefer the `fastBattle` + `runtimeErrors` fixtures from `tests/fixtures/e2e`. Animation canaries must use raw `@playwright/test` and never `enableFastMode` — ESLint enforces this in those files.
- **Gate tiers:** `@prepush` (fast subset) → `@critical` (every push) → `release` (full E2E + ship gate on tag push). See [CONTRIBUTING.md](./CONTRIBUTING.md#what-to-run-when-you-change) for the full mapping.
- **Determinism:** tests must not depend on dev QA bypasses. Combat specs use `winViaCombat()` or `playCardNamed()`.

## Subagent and parallel work

- Use the `explore` subagent for open-ended codebase search. Keep its scope tight: tell it exactly what to find, what to skip, and what to return.
- Use the `general` subagent for multi-step tasks that are clearly independent of the active edit.
- Do not delegate: editing files, running mutating commands, committing, or pushing. The main session owns all writes.
- When parallelizing reads, batch them in a single tool-call message rather than serial calls.
- Subagents must respect the same Hard NO's, import boundaries, and test gates. Pass the relevant doc links in the subagent prompt — do not summarize the rules to them; pass the URLs.
- If a subagent's output disagrees with `eslint.config.js`, `package.json`, or an owner doc, the main session resolves the conflict — do not let a subagent "fix" it.

## Working safely

- Inspect `git status` before editing. Preserve unrelated changes; never alter another agent's in-progress files.
- Scope edits and verification to the task. In a dirty worktree, avoid repo-wide formatters or fix commands that could rewrite unrelated files.
- Prefer `Edit` over `Write` for existing files. Never `Write` a new file unless the task requires it.
- Reference code with the `file_path:line_number` pattern so the user can jump to source.
- When a mistake is realized mid-task, edit the file back rather than invoking destructive git operations.
- If credentials or sensitive values are needed, ask the user — never read `.env` or print secrets.

## Verification

Full change-to-test mapping and the main-gate procedure live in [CONTRIBUTING.md](./CONTRIBUTING.md#before-you-push). In short:

1. While iterating, run the narrow test command for the changed area plus `npm run typecheck` (included in `npm run lint:ci`).
2. Before a requested push, run `npm run check:push`. The pre-push hook runs a 6-stage piped sequence (changelog sync, lockfile dry-run, lint:ci, unit tests, build:ship, prepush E2E) automatically on push to `main` — see [CONTRIBUTING.md](./CONTRIBUTING.md#before-you-push) for details.
3. Before an explicitly requested release, run `npm run check:ship:full`.

## Sources of truth

- `eslint.config.js` is authoritative for import boundaries and lint-enforced coding rules.
- `package.json` is authoritative for npm commands; [CONTRIBUTING.md](./CONTRIBUTING.md) maps changes to checks and documents the Lefthook sequence.
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) owns run-state design; [WORKFLOWS.md](./docs/WORKFLOWS.md) owns implementation checklists; [RELEASE.md](./docs/RELEASE.md) owns release procedure.
- Keep this file focused on durable agent policy. When a documented contract changes, update its owning document instead of copying implementation details here.
- If this file and an owner doc disagree, stop and ask unless `eslint.config.js` or `package.json` clearly resolves the conflict.

## Architectural invariants

- **Pragmatism and Simplicity:** Favor code readability, stability, and low complexity over absolute behavioral fidelity. Avoid over-engineering, extra layers of abstraction, or complex state logic. Propose simpler behavioral compromises to the user when facing complex implementation details.
- **Run state:** route `screen` belongs to the run domain. Feature code outside `shared/stores/` accesses run state through `run-session-facade` hooks/readers and transition APIs, not `run-domain-store` directly.
- **Battle:** treat `BattleState` as immutable; use `state.rng` rather than `Math.random()`; keep tuning in `game-constants.ts`; use `Math.round()` rather than `Math.floor()` in battle code.
- **Content:** card `descriptionLines` must match effects. Run-earned materials flow through `awardMaterialsDuringRun()`.
- **Persistence:** update schemas, migrations or normalization, defaults, hydration/snapshots, and legacy fixtures together as applicable.
- **Routes:** route screens are statically imported through `screen-routes/`; do not use `React.lazy()`. Game art is eagerly loaded at boot.
- **Imports:** use the established barrels for game data, battle, validation, shared screens, shared utilities, and shared storage. Validation schemas remain imported from `@/lib/validation`. The full import-boundary rules are enforced by `eslint.config.js` — if this summary disagrees with it, `eslint.config.js` wins. Only `@/*` maps to `src/*` in `tsconfig.json`; use on-disk paths under `src/features/alchemy/`.

## UI conventions

- Use plain function components with explicit `Props` types, not `React.FC`.

  ```tsx
  type CardProps = { card: Card; onPlay: (id: string) => void };
  function Card({ card, onPlay }: CardProps) {
    /* ... */
  }
  ```

- Build conditional Tailwind classes with `cn()` from `@/lib/utils`; do not use template literals in `className`.

  ```tsx
  cn("base-card", isSelected && "ring-2", size === "lg" && "p-6");
  ```

- Keep reusable `shared/ui` components isolated from run, battle, and session stores; pass domain data through props.
- Use CSS `active:` for press feedback on buttons; no Framer hover scale. Hover uses background lift from `src/lib/ui/button-hover.ts` plus sound via `Button` or `PressableMotion`.
- Use `StaggerGroup` and `StaggerItem` according to [the motion workflow](./docs/WORKFLOWS.md#staggered-screen-enter-motion). Do not wrap translate-centered absolute map nodes with `StaggerItem`.
- Initialize cosmetic randomness lazily with `useState(() => ...)`, not `useMemo` plus `Math.random()` during render.

## Generated and heavy files

### Generated (do not hand-edit)

- `src/lib/validation/metadata.generated.ts` comes from `npm run sync:version`; `src/lib/game-data/assets.generated.ts` from `npm run sync:assets`; `CHANGELOG.md` ## [Unreleased] from `npm run sync:changelog`; optimized assets from the asset scripts documented in [WORKFLOWS](./docs/WORKFLOWS.md#assets). Regenerate by running the script; never hand-edit.
- Never edit dependency, build, coverage, or report output directories: `node_modules/`, `dist/`, `.vite/`, `release-desktop/`, `coverage/`, and `reports/`.

### Read-on-demand (read once, then reference by path)

- Don't re-read large generated, binary, or asset-bundled files you've already seen in this session. Treat `Raw Assets/`, `Music/`, `src/assets/optimized/`, `game-constants.ts`, `cards.ts`, `keywords.ts`, `assets.ts`, `assets.generated.ts`, `vite.config.ts`, and anything under `src/lib/validation/metadata.generated.ts` as read-on-demand. The same applies to `node_modules/`, `dist/`, `.vite/`, `release-desktop/`, `coverage/`, and `reports/`.

## Environment

- Windows / PowerShell 5.1. Chain dependent commands with `; if ($?) { ... }`, not plain `;`.
- Working directory is the repo root. Do not `cd` inside commands — use the `workdir` parameter.
- `predev` and `prebuild` run asset optimization and version sync; the first build is slow. Don't try to skip them.
- Node + npm versions: see `package.json` `engines`; install via `npm ci`. First-time Playwright setup: `npx playwright install chromium` (also in [CONTRIBUTING](./CONTRIBUTING.md)).

## Debugging

- Battle warnings use the `[Enemy Turn]` prefix.
- On E2E failure, read `test-results/failures/` for diagnostic markdown (console/runtime logs + DOM snapshot). Run `npm run test:e2e:audit` for flakiness analysis per spec.
- After three failed attempts with the same approach, follow the [Escalation policy](#escalation-policy) above.
