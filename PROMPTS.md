# Alchemy — Code quality audits

Agent prompts for **code quality and UI/UX** — readability, hardening, interaction/layout review, and measurable code-quality criteria. Each section is designed to be copy-pasted into an agent with no extra context: the audit itself tells the agent where to start. For domain wiring (cards, saves, screens, gear), use [WORKFLOWS.md](./docs/WORKFLOWS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) instead.

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks & tests)

**Verification tiers:** narrow area tests from [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change) · **Default gate:** `npm run lint:ci && npm test` · **Pre-push parity:** `npm run check:push` · **Save/ship:** `npm run check:ship` (full release: `npm run check:ship:full` — also runs `npm run test:ship:e2e` and `npm run test:ship:desktop`)

## How to use

Each audit has the shape **Goal** · **Start here** · **Check** · **When done**. The **Start here** block is a concrete `rg` query (or named tool) the agent runs first to discover candidates across the codebase — you do not need to pre-select paths. If a diff or path is already in scope, hand it to the agent and tell it to **prefer that scope** but still use **Start here** to find adjacent issues.

> **Token efficiency:** every **Start here** query is a candidate-list query, not a full-file read. Open files only for the top hits, batch reads by file (one open → many checks), and stop as soon as the candidates look clean. Do not read every match line — the line number is enough to navigate.

Audits are split into two groups:

- **[Change-time audits](#change-time-audits)** — run while iterating on a feature, fix, or refactor. Qualitative review with bounded scope.
- **[Periodic audits](#periodic-audits)** — run on a schedule (nightly, post-milestone). Repository-wide health checks that are slow or noisy enough to gate the loop.

Measurable audits live in [Measurable code-quality criteria](#measurable-code-quality-criteria) and add a **Measure** field (a quantification command and numeric target) before **Check**.

### Quick reference

| Audit                                                                 | Trigger                                     | Speed            | Scope                              |
| --------------------------------------------------------------------- | ------------------------------------------- | ---------------- | ---------------------------------- |
| [Readability & clarity](#readability--clarity-audit)                  | Touching complex code; before opening a PR  | seconds          | top 5 complexity offenders or diff |
| [Behavior hardening](#behavior-hardening-audit)                       | Touching async/store/IO/modal boundaries    | seconds          | handler/persist hits or diff       |
| [Test quality](#test-quality-audit)                                   | Weak-test signals; before opening a PR      | seconds          | low-assertion files or diff        |
| [UI interaction & feedback](#ui-interaction--feedback-audit)          | Touching drag/modal/tooltip/portal surfaces | minutes (manual) | hits or diff                       |
| [Layout & visual containment](#layout--visual-containment-audit)      | Touching popover/stage/scroll layout        | minutes (manual) | hits or diff                       |
| [TODO/FIXME & runtime warning](#todofixme--runtime-warning-audit)     | Before pushing; periodic sweep              | seconds          | `src/**`                           |
| [Accessibility](#accessibility-audit)                                 | Touching interactive screens                | minutes (manual) | hits or diff                       |
| [Type safety density](#1-type-safety-density-audit) (#1)              | Before pushing                              | seconds          | `src/**`                           |
| [Cyclomatic complexity](#2-cyclomatic-complexity-audit) (#2)          | Before pushing                              | seconds          | `src/**`                           |
| [Dead code ratio](#3-dead-code-ratio-audit) (#3)                      | Before pushing                              | seconds          | `src/**`                           |
| [Function & file length](#4-function--file-length-audit) (#4)         | Before pushing                              | seconds          | `src/**`                           |
| [Import coupling & boundary](#5-import-coupling--boundary-audit) (#5) | Before pushing                              | seconds          | `src/**`                           |
| [Side-effect surface](#8-side-effect-surface-audit) (#8)              | Before pushing                              | seconds          | `src/**`                           |
| [Change amplification](#6-change-amplification-audit) (#6)            | Nightly / post-milestone / pre-refactor     | minutes          | git history                        |
| [Single-use abstraction](#7-single-use-abstraction-audit) (#7)        | Nightly / post-milestone / pre-refactor     | minutes          | `src/**`                           |
| [Code duplication density](#9-code-duplication-density-audit) (#9)    | Nightly / post-milestone / pre-refactor     | minutes          | `src/**`                           |
| [Meaningful test coverage](#10-meaningful-test-coverage-audit) (#10)  | Nightly / post-milestone / pre-refactor     | minutes          | `src/**`                           |

---

## Change-time audits

Run these while iterating on a feature, fix, or refactor. Each is qualitative review with a concrete starting query the agent uses to find candidates across the codebase.

---

## Readability & clarity audit

**Goal:** Make code scannable without changing behavior.

**Start here:** rank files by cyclomatic complexity and length — the offenders are usually the worst-readable too. Use file lists, not per-line output:

```sh
npx eslint --rule 'complexity: ["warn", 1]' --rule 'max-lines-per-function: ["warn", 30]' src
```

Open the top 5 files from the output and scan for the checks below. If a diff is in scope, start with the touched files and only widen if the touched files are already clean.

**Check:**

- Names match domain vocabulary already used in the module
- Functions do one obvious thing; extract only when it improves top-to-bottom reading
- Prefer early returns over deep nesting (>3 levels)
- Prefer plain data structures over clever types when both are correct
- Match surrounding file conventions (imports, export style, error handling)
- React: explicit `Props` types, plain function components (per [AGENTS.md — UI conventions](./AGENTS.md#ui-conventions))

**Docs:** [AGENTS.md — UI conventions](./AGENTS.md#ui-conventions)

**When done:** `npm run lint:ci`

---

## Behavior hardening audit

**Goal:** Strengthen correctness at boundaries without defensive overkill.

**Start here:** find module boundaries and re-entry points — async handlers, store actions, modal/overlay open/close, save/resume. Use `-l` so the agent gets a candidate file list (one read per file, many checks per read), not a per-line dump:

```sh
rg -l 'async function|useEffect|onClick=|addEventListener|persist|hydrate|resume' src --type ts -g '!*.test.*'
```

For each candidate file, walk the matches looking for the checks below. If a diff is in scope, prefer the touched files.

**Check:**

- Null/undefined/empty paths at module boundaries handled explicitly (not silently ignored)
- State transitions are idempotent where re-entry is possible (resume, retry, double-click)
- No swallowed errors; failures surface or log with context
- Invariants from [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) respected in changed code (immutable battle state, materials via facade, etc.) — verify adherence, do not re-document wiring
- Edge cases covered by existing tests; add tests only when fixing a real gap

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change)

**When done:** targeted tests from [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change)

---

## Test quality audit

**Goal:** Tests protect behavior without adding maintenance burden.

**Start here:** find the lowest-assertion-density test files. The Measure command returns a per-file count without reading contents — the agent only opens a file when its count is unusually low. Cap the result with `head` so a giant tree doesn't print thousands of paths:

```sh
rg --no-filename -c -e '^\s*(expect|assert)' tests --type ts | sort -t: -k2 -n | head -50
```

Open the bottom 10–20 files from the list and apply the checks below. If a diff is in scope, prefer the touched test files.

**Check:**

- Assert outcomes, not implementation details
- No trivial assertions (e.g. "function exists", "returns defined")
- Duplicate setup — extract shared fixtures/helpers
- Orphaned or copy-pasted test files
- E2E: no dev-only QA shortcuts — no Skip Combat / Unlock All selectors or strings in specs; `enableFastMode` not in animation canary or animation-focused specs; `BattlePage.endTurn` works with animations on and off; prefer `winViaCombat()` or `playCardNamed()` over dev-only QA shortcuts

**Docs:** [CONTRIBUTING — E2E helpers](./CONTRIBUTING.md#e2e-helpers)

**When done:** relevant `npm test` paths + `npm run test:e2e:prepush` if battle/page helpers changed

---

## UI interaction & feedback audit

**Goal:** Find bugs desktop players feel but types miss — broken clicks, drag ghosts, stuck modes, missing feedback. **Desktop keyboard + mouse only** — hover tooltips and cursor feedback are fine.

**Start here:** find the surfaces where drag, modal, targeting, or pointer capture are used. Scope to interactive components only (`tsx`, not `ts`) and skip tests so the result is small enough to read in one pass:

```sh
rg -l 'setPointerCapture|releasePointerCapture|onDrag|onPointerDown|modal|tooltip|portal' src --type tsx -g '!*.test.*'
```

For each candidate, run the checks below manually in dev. If a diff is in scope, prefer the touched screens.

**Check:**

- Pointer/drag: every `setPointerCapture` has matching release on up, cancel, and unmount; cursor/body styles restore on exit; no ghost clicks after drag
- One clear interaction mode at a time — drag, modal, targeting, scroll should not fight each other
- Hover tooltips: show/hide cleanly (no stuck tooltip after drag/mode change); do not block clicks on underlying controls
- Feedback: clicks/buttons give visible response; destructive actions need confirm + working cancel/backdrop dismiss
- Keyboard: focusable controls have names; Escape cancels overlays where users expect it
- After changes: note a 30s manual repro; ask the user if visual behavior is unclear

**When done:** relevant screen/unit tests + `npm run lint:ci`

---

## Layout & visual containment audit

**Goal:** Find clipping, overflow, and mis-scaled UI from structure/CSS — not pixel-perfect polish.

**Start here:** find popovers, tooltips, drag visuals, and stage containers — these are the surfaces most prone to clip/scale. A small candidate list (file paths only) keeps the audit cheap:

```sh
rg -l 'overflow-hidden|portal|vr-stage' src --type tsx -g '!*.test.*'
```

For each candidate, walk ancestors and check the rules below. If a diff is in scope, prefer the touched components.

**Check:**

- Walk ancestors of popovers/tooltips/drag visuals for `overflow-hidden`, `transform`, and scroll containers that clip floats
- Flex/grid scroll areas need `min-h-0` / `min-w-0` on the scrolling child
- Floats stay on-screen (flip/clamp/portal) and do not block clicks on underlying controls unintentionally
- In-stage UI (`#vr-stage`): prefer `cqh`/`cqw` over `vw`/`vh` so scaled layouts stay consistent
- Check narrow + wide desktop viewports when layout changed; ask the user if clipping is uncertain

**When done:** `tests/features/ui/` or relevant `tests/*.spec.ts` if placement/layout logic changed; `npm run lint:ci`

---

## TODO/FIXME & runtime-warning audit

**Goal:** No stale markers, no `console.log` left in production code, and no swallowed warnings.

**Start here:** run the three discovery queries below in order. Each one returns a file list (`-l`); open files only when the count is small (a 5-file list reads in 5 reads, not 50):

```sh
# 1. Stale markers
rg -l 'TODO|FIXME|XXX|HACK' src --type ts

# 2. console noise
rg -l 'console\.(log|debug|info|trace)' src --type ts -g '!*.test.*'

# 3. Swallowed errors
rg -l 'catch\s*(\(\)\s*=>\s*\{\s*\}|{\s*\})' src --type ts
```

**Check:**

- `TODO` and `FIXME` markers must include a reason and a target — per [AGENTS.md — Codebase rules](./AGENTS.md#codebase-rules). Every hit must be paired with a `(reason: ...)` or `// because ...` clause; bare markers are violations
- `console.log` / `console.debug` calls in `src/**` (eslint `no-console` allows only `console.warn` / `console.error` per `eslint.config.js:74`). Strip before merging; surviving calls need a `// eslint-disable-next-line` with a reason
- Swallowed errors: empty `catch {}` blocks or `.catch(() => {})` lambdas that drop the error. Every silent catch must log the error or document why silence is intentional
- Unused `// @ts-expect-error` / `// @ts-ignore` — these should appear with a comment justifying the escape; bare ones are caught by [Type safety density audit](#1-type-safety-density-audit) but flag any without context here

**When done:** `rg -l 'TODO|FIXME|XXX|HACK|console\.(log|debug|info|trace)|catch\s*(\(\)\s*=>\s*\{\s*\}|{\s*\})' src --type ts -g '!*.test.*'` (manual review) + `npm run lint:ci`

---

## Accessibility audit

**Goal:** Keyboard, screen-reader, and motion-sensitive users can complete core flows. **Desktop keyboard + screen reader only.**

**Start here:** find the most-touched interactive screens and any custom controls (modals, drawers, popovers, drag surfaces). A small, scoped list keeps the audit cheap; sort by file size only after a candidate set exists:

```sh
rg -l '<button|<a |<div[^>]*tabIndex|role=' src --type tsx -g '!**/*.test.*'
```

Open the top 10–15 files (whichever fits in context). If a diff is in scope, prefer the touched screens.

**Check:**

- Every interactive element (button, link, focusable div) has an accessible name — `aria-label`, visible text, or `aria-labelledby`. Quick scan: re-run the Start-here query and check for missing `aria-label` on icon-only controls
- Focus order matches visual order; modals trap focus while open and restore focus to the trigger on close
- Visible focus ring on every focusable element — no `outline: none` without a replacement `:focus-visible` style
- Color is never the only signal (statuses, error states) — pair with icon or text
- `prefers-reduced-motion` respected for stagger / shake / particle effects (see [WORKFLOWS — Staggered screen enter motion](./docs/WORKFLOWS.md#staggered-screen-enter-motion))
- Escape closes overlays (menus, modals, drawers) where users expect it — see [UI interaction & feedback audit](#ui-interaction--feedback-audit)
- After changes, run a 30s manual pass with keyboard only (Tab, Shift+Tab, Enter, Escape) on the touched screen; ask the user if focus order or motion behavior is unclear

**When done:** relevant `tests/features/screens/` and `tests/*.spec.ts` for the touched screen + `npm run lint:ci`

---

## Measurable code-quality criteria

The audits below each target a single measurable criterion with a target and a quantification command. Run **Measure** to find violations, **Check** to fix them, **When done** to verify. Targets are directionals to drive toward across passes — reduce the count each pass, not necessarily to zero in one pass. Criteria #7 and #9 are deliberate counterweights to #2/#4/#5: do not optimize complexity, length, or coupling by over-abstracting.

> **Tooling note:** audits that use `madge` or `jscpd` invoke them via `npx -y`, which fetches the package on first run. Expect a ~30–60s cold start; subsequent runs in the same `node_modules` cache are fast. knip runs through the repo scripts (`deadcode` / `deadcode:strict`) and is already warmed by `npm run lint:ci`.

---

## 1. Type safety density audit

**Goal:** Drive unsafe typing escapes toward zero in non-test source.

**Start here:** run the three Measure queries in order. Each returns a per-line list — group hits by file before reading (one open per file beats 50 small reads). If the total count is under ~20, do not pre-filter; read them in one pass.

**Measure:**

- `any` in src (already `error` via `@typescript-eslint/no-explicit-any`): `rg -n '\bany\b' src --type ts -g '!*.test.*' -g '!*.spec.*'` — target 0
- Type escapes: `rg -n '@ts-ignore|@ts-expect-error|eslint-disable|as unknown as' src` — target trending to 0; each survivor needs a line-scoped reason
- Non-null assertions (`expr!.prop`): `rg -n '!\.' src --type ts -g '!*.test.*'` — target ≤ 1 per ~500 LOC

**Check:**

- Replace `as` casts with type guards, narrowing, or discriminated unions
- Replace `@ts-ignore` / `@ts-expect-error` by fixing the underlying type mismatch
- Remove `eslint-disable` by fixing the violation; a surviving disable must be line-scoped with a reason
- Replace non-null assertions with explicit null checks or optional chaining
- Keep Zod/validation at save/load boundaries (see [WORKFLOWS — persisted save data](./docs/WORKFLOWS.md#change-persisted-save-data))

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants)

**When done:** `npm run typecheck && npm run lint:ci`

---

## 2. Cyclomatic complexity audit

**Goal:** No function exceeds complexity 10; p90 ≤ 6.

**Start here:** run the Measure command at threshold 11. The warning list is the offender list — sort by warning count descending and open the top 5 files first; the rest can wait for the next pass.

**Measure:**

- Flag offenders by layering the ESLint `complexity` rule over the existing config:
  `npx eslint --rule 'complexity: ["warn", 11]' src`
  (Every warning is a function with complexity > 10. Record the list; re-run at threshold 7 to gauge p90.)
- Target: zero warnings at threshold 11.

**Check:**

- Extract branch-heavy logic into named helpers with a single responsibility
- Replace nested `if/else` with early returns / guard clauses
- Replace `switch` or chained `if` over a discriminant with a lookup table / record map
- Split combinatorial conditions into named boolean predicates
- Do not split a function that reads cleanly top-to-bottom at ≤ 10 — splitting for its own sake hurts [single-use abstraction audit](#7-single-use-abstraction-audit)

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants)

**When done:** `npm run typecheck && npm run lint:ci && npm test -- <touched paths>`

---

## 3. Dead code ratio audit

**Goal:** Zero dead exports, imports, types, and files.

**Start here:** `npm run deadcode:strict`. The knip output is grouped by category. Start with `Unused files` (cheapest), then `Unused exports` — both can be deleted outright. `Unused types` last because some are exported for downstream type-only consumers.

**Measure:**

- `npm run deadcode:strict` (knip, strict, includes entry exports) — target 0 findings
- For context, total exports: `rg -c 'export ' src --type ts`

**Check:**

- Delete unused exports, types, and files outright (prefer deleting over commenting)
- Inline single-use helpers where inlining reduces total LOC
- Do not delete symbols referenced only from generated files (`metadata.generated.ts`, optimized assets) without running the sync/asset scripts — see [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)
- Remove orphaned test files for deleted source

**Docs:** [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)

**When done:** `npm run typecheck && npm run deadcode:strict && npm run lint:ci && npm test`

---

## 4. Function & file length audit

**Goal:** No function > 50 executable lines; no source file > 300 lines (excluding tests and generated files).

**Start here:** run both Measure commands. ESLint warnings are the per-function offenders; the PowerShell snippet gives the top 20 files. Tackle the file-length list first (often dead code), then the per-function list. Cap both reads with `head`/`Select-Object -First` so the agent never loads more than 20 candidates.

**Measure:**

- Function length: `npx eslint --rule 'max-lines-per-function: ["warn", 50, { skipComments: true }]' src` — target zero warnings (threshold matches the goal exactly; `skipComments: true` excludes file-level summaries and section markers so they don't inflate the count)
- File length (top offenders in PowerShell):
  `Get-ChildItem -Recurse -File -Include *.ts,*.tsx -Path src | ForEach-Object { [PSCustomObject]@{ Name=$_.Name; Lines=(Get-Content $_.FullName).Count } } | Sort-Object Lines -Descending | Select-Object -First 20`
- Target: zero source files > 300 lines (exclude `*.test.*`, `*.spec.*`, and generated files from judgement)

**Check:**

- Split long functions by responsibility (not by arbitrary line count)
- Split long files by cohesive concern; run [dead code ratio audit](#3-dead-code-ratio-audit) first since length is often dead code
- For UI components, extract subcomponents only when reused or genuinely independent
- Do not split if it worsens [single-use abstraction audit](#7-single-use-abstraction-audit)

**Docs:** [AGENTS.md — Pragmatism and Simplicity](./AGENTS.md#pragmatism-and-simplicity)

**When done:** `npm run typecheck && npm run lint:ci && npm test -- <touched paths>`

---

## 5. Import coupling & boundary audit

**Goal:** Zero circular imports; efferent imports per module p90 ≤ 12, max ≤ 20; zero layer-boundary violations.

**Start here:** run the Measure commands in order. Circular imports are blocking — fix those first (small set, high signal). Then `npm run lint` boundary violations. Efferent-count outliers are last and lowest priority; only read the top 5 files by count.

**Measure:**

- Circular imports: `npx -y madge --circular --extensions ts --ts-config tsconfig.json src` — target 0 (look for "Circular dependencies found" or listed cycles)
- Efferent imports per file: `rg -c '^import ' src --type ts` — flag files with > 20; target p90 ≤ 12
- Boundary violations: `npm run lint` (enforced by `eslint.config.js` `no-restricted-imports`) — target 0

**Check:**

- Break cycles by inverting the dependency (extract a shared module, or depend on an interface/type, not the concrete store)
- Reduce efferent coupling by depending on a barrel/facade instead of many deep modules
- Move shared code to its owning layer rather than reaching across
- Boundary violations are lint failures — fix the import, do not widen the rule

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [eslint.config.js](./eslint.config.js)

**When done:** `npx -y madge --circular --extensions ts --ts-config tsconfig.json src && npm run typecheck && npm run lint:ci`

---

## 6. Change amplification audit

> **Periodic audit.** Do not run mid-feature. Schedule as nightly CI or run after a milestone. See [Running all periodic audits](#running-all-periodic-audits) for the wrapper command.

**Goal:** Feature changes touch a small, predictable set of files — median ≤ 5 per `feat`/`fix`/`balance` commit; no single behavior change forces edits across > 8 files.

**Start here:** run the script and read the `clean` view report — that's the "what developers actually author" sample. If `clean.n < 30`, widen `--since=3 months ago` to `6 months ago` (or `12 months ago`) before enforcing the target; below 15 commits, treat the audit as directional only.

**Measure:**

Use `scripts/audit-change-amplification.mjs` (run with `node scripts/audit-change-amplification.mjs`) which handles the encoding issues PowerShell's `>` redirect introduces (UTF-16 LE, not UTF-8). The script writes a `.tmp-audit/` directory at the repo root and removes it on completion; if the run is interrupted, clean it up with `Remove-Item -Recurse -Force .tmp-audit` (it is not in `.gitignore`).

The script produces three views:

- **Raw view** — all `feat`/`fix`/`balance` commits, every file counted
- **Filtered view** — drop pure-asset/sound/webp commits and pure-infra commits (no `src/` or `tests/` files)
- **Clean view** — filtered minus ≥100-file milestone commits and `fix(tests)` type-cleanup batches (the "what developers actually author" view)

For each view the script reports: count, median, mean, p90, max, a histogram, and a list of files exceeding 25% (hotspots). It also prints a **co-edit signal**: count how many commits touch both `src/lib/game-data/*` and a `screens/*` file — to detect parallel-edit coupling that a single-file hotspot count misses.

Target: median ≤ 5 in clean view. No source file in > 25% of clean-view commits without a clear owning seam.

> **Sample-size guard:** median and p90 are unreliable when the clean-view count is small. If `clean.n < 30`, widen the script's `--since=3 months ago` to `6 months ago` (or `12 months ago`) before enforcing the target; below 15 commits, treat the audit as directional only.

**Check:**

- For the top 3 hotspots (true or near), identify the missing seam (facade, event, interface, colocated data) and introduce it so the next change is localized
- For high co-edit pairs that don't show up as single-file hotspots, look for a cross-layer facade that lets one side change without dragging the other
- Remove duplicated responsibility that forces parallel edits across files
- Colocate logic that is always changed together (e.g. one mega test file covering 17 unrelated subsystems → split by subsystem)
- Treat the composition root (e.g. `src/App.tsx`) as expected, not a seam target
- Treat ≥100-file milestone commits as inherent to the milestone, not as bugs to fix
- This is a pattern audit — propose the seam to the user before implementing if the fix is non-obvious (per [AGENTS.md — Escalation policy](./AGENTS.md#escalation-policy))

**Docs:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)

**When done:** `npm run typecheck && npm run lint:ci && npm test -- <touched paths>`

---

## 7. Single-use abstraction audit

**Goal:** < 15% of abstractions (interfaces, generic helpers, factories, wrapper functions) have exactly one call site.

**Start here:** `node scripts/audit-single-use.mjs` (or `npm run audit:single-use`). Read the top 25 single-use symbols — those are the highest-signal candidates. Pair with `npm run deadcode:strict` to catch the zero-use half.

**Measure:**

Run `node scripts/audit-single-use.mjs` (or `npm run audit:single-use`). The script scans every `src/**/*.{ts,tsx}` file (skipping tests, generated, and declaration files) for `export function|const|class|interface|type` declarations, then for each name counts non-definition references across the same tree. It reports the total number of exports, the number with ≤ 1 caller, the ratio, and a status of `OK` or `REVIEW`. The top 25 single-use symbols are listed with their declaring file.

- Total exports: same line in script output
- Single-use (≤ 1 caller): same line
- Ratio: target < 15%
- Status: `REVIEW` exits with code 1 so CI/cron can flag regressions

Pair with `npm run deadcode:strict` (knip) — knip catches zero-use, the script catches single-use. Together they cover the "no future-proofing" half of the audit.

**Check:**

- Inline an abstraction with exactly one caller and no near-term second caller
- Remove "future-proof" parameters, config objects, and strategy/factory layers with one implementation
- Collapse indirection chains where the caller could use the underlying API directly
- Counterweight to #2/#4/#5: do not extract a helper unless it has ≥ 2 call sites with identical intent
- Heuristic caveats: barrel re-exports inflate the reference count; the script subtracts one reference per definition site to compensate, so legitimate re-exports still count. Inline `console.log` debug statements can also match — the report is a starting point, not a verdict

**Docs:** [AGENTS.md — Pragmatism and Simplicity](./AGENTS.md#pragmatism-and-simplicity)

**When done:** `node scripts/audit-single-use.mjs && npm run typecheck && npm run lint:ci && npm test`

---

## 8. Side-effect surface audit

**Goal:** Side effects (I/O, shared/global mutation, non-deterministic primitives) confined to designated seams (stores, storage, RNG injectors); zero in pure logic and UI components.

**Start here:** run the Measure commands. The first `rg` returns a per-line list — group by file before opening; one read per file beats many small reads. Triage by file location (stores, storage, rng are allowed seams; everything else is a candidate). The battle-RNG second query is the hard rule — every hit is a violation.

**Measure:**

- Non-deterministic primitives outside seams:
  `rg -n 'Math\.random|Date\.now|new Date\(\)|fetch\(|localStorage|sessionStorage' src --type ts -g '!**/stores/**' -g '!**/storage/**' -g '!**/rng*'`
- Battle RNG (eslint-enforced): `rg -n 'Math\.random' src/lib/battle` — target 0
- Target: zero hits in `src/lib/**` pure logic and `src/features/**/screens` components (excluding designated seams).

**Check:**

- Inject the dependency (RNG, clock, store) as a parameter rather than calling the global
- Push the effect to the seam (store/repository) and keep the function pure
- For `Math.random` in battle, use `state.rng` / `getBattleRng(state)` — see [REFERENCE — battle rules](./docs/REFERENCE.md#battle-implementation-rules)
- For UI randomness, initialize lazily with `useState(() => …)` per [AGENTS.md — UI conventions](./AGENTS.md#ui-conventions)

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [REFERENCE.md](./docs/REFERENCE.md#battle-implementation-rules)

**When done:** `npm run typecheck && npm run lint:ci && npm test -- <touched paths>`

---

## 9. Code duplication density audit

> **Periodic audit.** jscpd cold start is ~30–60s and the output is noisy on small samples. Run as nightly CI or before a refactor PR, not mid-feature.

**Goal:** < 3% duplicated blocks (≥ 6 lines) across non-test source.

**Measure:**

- `npx -y jscpd --path src --min-lines 6 --format typescript --ignore '**/*.test.*,**/*.spec.*' --reporters json,console`
- Read the console summary line ("Total duplicated lines: X (Y%)") or `jscpd-report.json` `duplicates.percentage` — target < 3%.
- List the top duplicated blocks by size from the report.

> **Sample-size guard:** if the candidate set is small (e.g. one stale duplicate), do not extract a helper for it. The "Counterweight" check explicitly says "do not over-DRY coincidental similarity" — apply it before any extraction. The 3% target is a directional ceiling, not a quota.

**Check:**

- Extract a shared helper **only** when ≥ 2–3 sites share identical intent (counterweight to #2/#4 — do not over-DRY coincidental similarity)
- For near-duplicates that diverge by a value, parameterize the value rather than copying the block
- For duplicates that diverge by behavior, leave them separate and note the intentional divergence
- Do not extract duplicates that are only superficially similar

**Docs:** [AGENTS.md — Pragmatism and Simplicity](./AGENTS.md#pragmatism-and-simplicity)

**When done:** `npx -y jscpd --path src --min-lines 6 --format typescript --ignore '**/*.test.*,**/*.spec.*' && npm run typecheck && npm run lint:ci && npm test`

---

## 10. Meaningful test coverage audit

> **Periodic audit.** `npm run test:coverage` is slow and the export-presence heuristic is fragile. Run as nightly CI, not mid-feature.

**Goal:** High test presence on exported domain logic; branch coverage ≥ 80% on core modules.

**Start here:** `npm run test:coverage`. Open `coverage/index.html` and sort modules by branch coverage ascending — the lowest-coverage modules are the candidates. Pair the export-presence check (the second Measure bullet) by spot-checking a few low-coverage files manually.

**Measure:**

- Coverage: `npm run test:coverage` — review `coverage/` for modules with < 80% branch coverage on `src/lib/battle`, `src/lib/gear`, `src/features/alchemy/shared/storage`
- Export presence (heuristic): for each export in `src/lib/**`, search for the symbol in `tests/` (`rg -l 'exportName' tests`) — target ≥ 90% on domain logic. **Caveat:** JSDoc/comments and re-exports produce false positives/negatives; treat the number as directional, not a gate.

**Check:**

- Add behavior-targeted tests for untested exports (assert outcomes, not implementation)
- No trivial assertions ("function exists", "returns defined") — see [Test quality audit](#test-quality-audit)
- Prefer fewer strong tests over many weak ones; do not chase line coverage with dead assertions

**Docs:** [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change) · [Test quality audit](#test-quality-audit)

**When done:** `npm run test:coverage && npm run typecheck && npm run lint:ci`

---

## Periodic audits

Run on a schedule — nightly CI, post-milestone, or before opening a refactor PR. These are repository-wide pattern audits that are slow, noisy, or measure history rather than current code. Do not run them mid-feature.

The measurable periodic audits are: [#6 — change amplification](#6-change-amplification-audit), [#7 — single-use abstraction](#7-single-use-abstraction-audit), [#9 — code duplication density](#9-code-duplication-density-audit), [#10 — meaningful test coverage](#10-meaningful-test-coverage-audit). Each carries a `> **Periodic audit.**` banner at the top.

---

## Running all periodic audits

For a periodic sweep (nightly CI, post-milestone cleanup, or before a refactor), run every periodic audit in one shot:

```sh
npm run audit:all
```

This wraps `scripts/audit-all.mjs`, which runs in order:

1. `npm run deadcode:strict` (knip)
2. `node scripts/audit-single-use.mjs` ([#7](#7-single-use-abstraction-audit))
3. `npx -y madge --circular …` ([#5](#5-import-coupling--boundary-audit))
4. `npx eslint --rule complexity --rule max-lines-per-function …` ([#2](#2-cyclomatic-complexity-audit), [#4](#4-function--file-length-audit))
5. `node scripts/audit-change-amplification.mjs` ([#6](#6-change-amplification-audit))

Total wall-clock time: ~3–5 minutes cold, ~30–60s warm. Any failed audit prints a non-zero exit code so CI can gate on it.

> **Token note:** the wrapper invokes all five audits in sequence. If you only need a subset (e.g. just #6 and #7 for a refactor check), invoke the script commands directly from the matching **Start here** block — most return a single report file you can read once.

The wrapper is **not** a pre-push gate — use `npm run check:push` for that. It is intentionally broader and slower, intended for one of:

- a manual sweep before opening a refactor PR
- a scheduled nightly CI job
- a post-milestone cleanup pass

To run a single audit in isolation, use `npm run audit:single-use` for #7, or invoke the exact command from that audit's **Start here** block.

`#1` (type safety), `#3` (dead code), and `#8` (side-effect surface) are excluded from the wrapper because they are already part of `npm run lint:ci`. `#2` (cyclomatic complexity) and `#4` (function/file length) are excluded because the layered ESLint rules conflict with the project ESLint config in surprising ways — invoke them directly from their **Start here** blocks. `#9` (duplication) and `#10` (coverage) are excluded due to `jscpd` / `vitest --coverage` cold-start cost.
