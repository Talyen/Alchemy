# Alchemy — Code quality audits

Agent prompts for **code quality and UI/UX** — readability, hardening, interaction/layout review, and measurable code-quality criteria. Copy a section into your agent with target paths or a diff attached. For domain wiring (cards, saves, screens, gear), use [WORKFLOWS.md](./docs/WORKFLOWS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) instead.

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks & tests)

**Verification tiers:** narrow area tests from [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change) · **Default gate:** `npm run lint:ci && npm test` · **Pre-push parity:** `npm run check:push` · **Save/ship:** `npm run check:ship`

Qualitative audits use: **Goal** · **Check** · **Docs** · **When done**. Measurable criteria audits (in [Measurable code-quality criteria](#measurable-code-quality-criteria)) add a **Measure** field with a quantification command and numeric target.

---

## Readability & clarity audit

**Goal:** Make code scannable without changing behavior.

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

**Check:**

- Walk ancestors of popovers/tooltips/drag visuals for `overflow-hidden`, `transform`, and scroll containers that clip floats
- Flex/grid scroll areas need `min-h-0` / `min-w-0` on the scrolling child
- Floats stay on-screen (flip/clamp/portal) and do not block clicks on underlying controls unintentionally
- In-stage UI (`#vr-stage`): prefer `cqh`/`cqw` over `vw`/`vh` so scaled layouts stay consistent
- Check narrow + wide desktop viewports when layout changed; ask the user if clipping is uncertain

**When done:** `tests/features/ui/` or relevant `tests/*.spec.ts` if placement/layout logic changed; `npm run lint:ci`

---

## Measurable code-quality criteria

The audits below each target a single measurable criterion with a target and a quantification command. Run **Measure** to find violations, **Check** to fix them, **When done** to verify. Targets are directionals to drive toward across passes — reduce the count each pass, not necessarily to zero in one pass. Criteria #7 and #9 are deliberate counterweights to #2/#4/#5: do not optimize complexity, length, or coupling by over-abstracting.

---

## 1. Type safety density audit

**Goal:** Drive unsafe typing escapes toward zero in non-test source.

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

**When done:** `npm run lint:ci && npm test -- <touched paths>`

---

## 3. Dead code ratio audit

**Goal:** Zero dead exports, imports, types, and files.

**Measure:**

- `npm run deadcode:strict` (knip, strict, includes entry exports) — target 0 findings
- For context, total exports: `rg -c 'export ' src --type ts`

**Check:**

- Delete unused exports, types, and files outright (prefer deleting over commenting)
- Inline single-use helpers where inlining reduces total LOC
- Do not delete symbols referenced only from generated files (`metadata.generated.ts`, optimized assets) without running the sync/asset scripts — see [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)
- Remove orphaned test files for deleted source

**Docs:** [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)

**When done:** `npm run deadcode:strict && npm run lint:ci && npm test`

---

## 4. Function & file length audit

**Goal:** No function > 50 executable lines; no source file > 300 lines (excluding tests and generated files).

**Measure:**

- Function length: `npx eslint --rule 'max-lines-per-function: ["warn", 51, { skipComments: true }]' src` — target zero warnings
- File length (top offenders in PowerShell):
  `Get-ChildItem -Recurse -File -Include *.ts,*.tsx -Path src | ForEach-Object { [PSCustomObject]@{ Name=$_.Name; Lines=(Get-Content $_.FullName).Count } } | Sort-Object Lines -Descending | Select-Object -First 20`
- Target: zero source files > 300 lines (exclude `*.test.*`, `*.spec.*`, and generated files from judgement)

**Check:**

- Split long functions by responsibility (not by arbitrary line count)
- Split long files by cohesive concern; run [dead code ratio audit](#3-dead-code-ratio-audit) first since length is often dead code
- For UI components, extract subcomponents only when reused or genuinely independent
- Do not split if it worsens [single-use abstraction audit](#7-single-use-abstraction-audit)

**Docs:** [AGENTS.md — Pragmatism and Simplicity](./AGENTS.md#pragmatism-and-simplicity)

**When done:** `npm run lint:ci && npm test -- <touched paths>`

---

## 5. Import coupling & boundary audit

**Goal:** Zero circular imports; efferent imports per module p90 ≤ 12, max ≤ 20; zero layer-boundary violations.

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

**When done:** `npx -y madge --circular --extensions ts --ts-config tsconfig.json src; npm run lint:ci`

---

## 6. Change amplification audit

**Goal:** Feature changes touch a small, predictable set of files — median ≤ 5 per `feat`/`fix`/`balance` commit; no single behavior change forces edits across > 8 files.

**Measure:**

Use `scripts/audit-change-amplification.mjs` (run with `node scripts/audit-change-amplification.mjs`) which handles the encoding issues PowerShell's `>` redirect introduces (UTF-16 LE, not UTF-8). The script produces three views:

- **Raw view** — all `feat`/`fix`/`balance` commits, every file counted
- **Filtered view** — drop pure-asset/sound/webp commits and pure-infra commits (no `src/` or `tests/` files)
- **Clean view** — filtered minus ≥100-file milestone commits and `fix(tests)` type-cleanup batches (the "what developers actually author" view)

For each view the script reports: count, median, mean, p90, max, a histogram, and a list of files exceeding 25% (hotspots). It also prints a **co-edit signal**: count how many commits touch both `src/lib/game-data/*` and a `screens/` file — to detect parallel-edit coupling that a single-file hotspot count misses.

Target: median ≤ 5 in clean view. No source file in > 25% of clean-view commits without a clear owning seam.

**Check:**

- For the top 3 hotspots (true or near), identify the missing seam (facade, event, interface, colocated data) and introduce it so the next change is localized
- For high co-edit pairs that don't show up as single-file hotspots, look for a cross-layer facade that lets one side change without dragging the other
- Remove duplicated responsibility that forces parallel edits across files
- Colocate logic that is always changed together (e.g. one mega test file covering 17 unrelated subsystems → split by subsystem)
- Treat the composition root (e.g. `src/App.tsx`) as expected, not a seam target
- Treat ≥100-file milestone commits as inherent to the milestone, not as bugs to fix
- This is a pattern audit — propose the seam to the user before implementing if the fix is non-obvious (per [AGENTS.md — Escalation policy](./AGENTS.md#escalation-policy))

**Docs:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)

**When done:** `npm run lint:ci && npm test -- <touched paths>`

---

## 7. Single-use abstraction audit

**Goal:** < 15% of abstractions (interfaces, generic helpers, factories, wrapper functions) have exactly one call site.

**Measure:**

- `npm run deadcode:strict` flags zero-use abstractions; for single-use, scan the rest:
  for each interface/factory/generic helper, count non-definition references with `rg -l 'Name' src`
- Track total abstractions vs. single-use abstractions — target < 15% single-use.

**Check:**

- Inline an abstraction with exactly one caller and no near-term second caller
- Remove "future-proof" parameters, config objects, and strategy/factory layers with one implementation
- Collapse indirection chains where the caller could use the underlying API directly
- Counterweight to #2/#4/#5: do not extract a helper unless it has ≥ 2 call sites with identical intent

**Docs:** [AGENTS.md — Pragmatism and Simplicity](./AGENTS.md#pragmatism-and-simplicity)

**When done:** `npm run lint:ci && npm test`

---

## 8. Side-effect surface audit

**Goal:** Side effects (I/O, shared/global mutation, non-deterministic primitives) confined to designated seams (stores, storage, RNG injectors); zero in pure logic and UI components.

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

**When done:** `npm run lint:ci && npm test -- <touched paths>`

---

## 9. Code duplication density audit

**Goal:** < 3% duplicated blocks (≥ 6 lines) across non-test source.

**Measure:**

- `npx -y jscpd --path src --min-lines 6 --format typescript --ignore '**/*.test.*,**/*.spec.*' --reporters json,console`
- Read the console summary line ("Total duplicated lines: X (Y%)") or `jscpd-report.json` `duplicates.percentage` — target < 3%.
- List the top duplicated blocks by size from the report.

**Check:**

- Extract a shared helper **only** when ≥ 2–3 sites share identical intent (counterweight to #2/#4 — do not over-DRY coincidental similarity)
- For near-duplicates that diverge by a value, parameterize the value rather than copying the block
- For duplicates that diverge by behavior, leave them separate and note the intentional divergence
- Do not extract duplicates that are only superficially similar

**Docs:** [AGENTS.md — Pragmatism and Simplicity](./AGENTS.md#pragmatism-and-simplicity)

**When done:** `npx -y jscpd --path src --min-lines 6 --format typescript --ignore '**/*.test.*,**/*.spec.*' && npm run lint:ci && npm test`

---

## 10. Meaningful test coverage audit

**Goal:** High test presence on exported domain logic; mutation score ≥ 60% on core modules.

**Measure:**

- Coverage: `npm run test:coverage` — review `coverage/` for modules with < 80% branch coverage on `src/lib/battle`, `src/lib/gear`, `src/features/alchemy/shared/storage`
- Export presence: for each export in `src/lib/**`, confirm ≥ 1 test references it (`rg -l 'exportName' tests`) — target ≥ 90% on domain logic
- Mutation (expensive — one module per pass): `npx -y @stryker-mutator/core init` to configure once, then run per module targeting `src/lib/<module>/*.ts` — target mutation score ≥ 60% on battle/state/validation core

**Check:**

- Add behavior-targeted tests for untested exports (assert outcomes, not implementation)
- Strengthen assertions that mutation testing shows are weak (a surviving mutation means the test does not catch the change)
- No trivial assertions ("function exists", "returns defined") — see [Test quality audit](#test-quality-audit)
- Prefer fewer strong tests over many weak ones; do not chase line coverage with dead assertions

**Docs:** [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change) · [Test quality audit](#test-quality-audit)

**When done:** `npm run test:coverage && npm run lint:ci`
