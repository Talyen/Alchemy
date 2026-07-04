# Alchemy — Code quality prompts

Copy-paste into an agent with scope context. UI audits require manual dev inspection; measurable audits include quantification commands.

---

## Change-time audits

## Readability & clarity audit

Goal: Make code scannable without changing behavior.

Start here: `npx eslint --rule 'complexity: ["warn", 1]' --rule 'max-lines-per-function: ["warn", 30]' src`

Check:
- Names match domain vocabulary already used in the module
- Functions do one obvious thing; extract only when it improves top-to-bottom reading
- Prefer early returns over deep nesting (>3 levels)
- Prefer plain data structures over clever types when both are correct
- Match surrounding file conventions (imports, export style, error handling)
- React: explicit Props types, plain function components

---

## Behavior hardening audit

Goal: Strengthen correctness at module boundaries.

Start here: `rg -l 'async function|useEffect|onClick=|addEventListener|persist|hydrate|resume' src --type ts -g '!*.test.*'`

Check:
- Null/undefined/empty paths handled explicitly at module boundaries
- State transitions are idempotent where re-entry is possible (resume, retry, double-click)
- No swallowed errors — failures surface or log with context
- Architectural invariants respected in changed code
- Edge cases covered by existing tests; add tests only when fixing a gap

---

## Test quality audit

Goal: Tests protect behavior without adding maintenance burden.

Start here: `rg --no-filename -c -e '^\s*(expect|assert)' tests --type ts | sort -t: -k2 -n | head -50`

Check:
- Assert outcomes, not implementation details
- No trivial assertions (e.g. "function exists", "returns defined")
- Duplicate setup — extract shared fixtures/helpers
- Orphaned or copy-pasted test files
- E2E: no dev-only QA shortcuts — no Skip Combat / Unlock All selectors; prefer winViaCombat() or playCardNamed() over QA shortcuts

---

## UI interaction & feedback audit

Goal: Find bugs desktop players feel but types miss — broken clicks, drag ghosts, stuck modes, missing feedback.

Start here: `rg -l 'setPointerCapture|releasePointerCapture|onDrag|onPointerDown|modal|tooltip|portal' src --type tsx -g '!*.test.*'`

Check:
- Pointer/drag: every setPointerCapture has matching release on up, cancel, and unmount; cursor/body styles restore on exit; no ghost clicks after drag
- One clear interaction mode at a time — drag, modal, targeting, scroll should not fight
- Hover tooltips: show/hide cleanly; do not block clicks on underlying controls
- Feedback: clicks/buttons give visible response; destructive actions need confirm + working cancel/backdrop dismiss
- Keyboard: focusable controls have names; Escape cancels overlays where users expect it

---

## Measurable code-quality criteria

## 1. Type safety density audit

Goal: Drive unsafe typing escapes toward zero in non-test source.

Start here:
- `rg -n '\bany\b' src --type ts -g '!*.test.*' -g '!*.spec.*'` — target 0
- `rg -n '@ts-ignore|@ts-expect-error|eslint-disable|as unknown as' src` — target trending to 0
- `rg -n '!\.' src --type ts -g '!*.test.*'` — target ≤ 1 per ~500 LOC

Check:
- Replace `as` casts with type guards, narrowing, or discriminated unions
- Replace `@ts-ignore` / `@ts-expect-error` by fixing the underlying type mismatch
- Remove `eslint-disable` by fixing the violation; surviving disables must be line-scoped with reason
- Replace non-null assertions with explicit null checks or optional chaining
- Keep Zod/validation at save/load boundaries

---

## 2. Cyclomatic complexity audit

Goal: No function exceeds complexity 10; p90 ≤ 6.

Start here: `npx eslint --rule 'complexity: ["warn", 11]' src`

Check:
- Extract branch-heavy logic into named helpers with a single responsibility
- Replace nested if/else with early returns / guard clauses
- Replace switch or chained if over a discriminant with a lookup table
- Split combinatorial conditions into named boolean predicates
- Do not split a function that reads cleanly at ≤ 10 — splitting for its own sake hurts abstraction hygiene

---

## 3. Dead code ratio audit

Goal: Zero dead exports, imports, types, and files.

Start here: `npm run deadcode:strict`

Check:
- Delete unused exports, types, and files outright
- Inline single-use helpers where inlining reduces total LOC
- Do not delete symbols referenced only from generated files without running sync/asset scripts
- Remove orphaned test files for deleted source

---

## 5. Import coupling & boundary audit

Goal: Zero circular imports; efferent imports per module p90 ≤ 12, max ≤ 20; zero layer-boundary violations.

Start here:
- `npx -y madge --circular --extensions ts --ts-config tsconfig.json src` — target 0
- `rg -c '^import ' src --type ts` — flag files with > 20
- `npm run lint` — boundary violations, target 0

Check:
- Break cycles by inverting the dependency (extract a shared module, depend on interface not concrete store)
- Reduce efferent coupling by depending on a barrel/facade instead of many deep modules
- Move shared code to its owning layer rather than reaching across
- Boundary violations are lint failures — fix the import, do not widen the rule

---

## 6. Change amplification audit

Goal: Feature changes touch a small, predictable set of files — median ≤ 5 per commit; no single change forces edits across > 8 files.

Start here: `node scripts/audit-change-amplification.mjs`

Check:
- For the top 3 hotspots, identify the missing seam (facade, event, interface, colocated data)
- For high co-edit pairs, look for a cross-layer facade that lets one side change without dragging the other
- Remove duplicated responsibility that forces parallel edits across files
- Colocate logic that is always changed together
- Treat the composition root as expected, not a seam target
- Propose the seam to the user before implementing if the fix is non-obvious

---

## 8. Side-effect surface audit

Goal: Side effects (I/O, shared/global mutation, non-deterministic primitives) confined to designated seams; zero in pure logic and UI components.

Start here:
- `rg -n 'Math\.random|Date\.now|new Date\(\)|fetch\(|localStorage|sessionStorage' src --type ts -g '!**/stores/**' -g '!**/storage/**' -g '!**/rng*'`
- `rg -n 'Math\.random' src/lib/battle` — target 0

Check:
- Inject the dependency (RNG, clock, store) as a parameter rather than calling the global
- Push the effect to the seam (store/repository) and keep the function pure
- For Math.random in battle, use state.rng / getBattleRng(state)
- For UI randomness, initialize lazily with useState(() => …)

---

## 10. Meaningful test coverage audit

Goal: High test presence on exported domain logic; branch coverage ≥ 80% on core modules.

Start here: `npm run test:coverage`

Check:
- Review coverage/ for modules with < 80% branch coverage on src/lib/battle, src/lib/gear, src/features/alchemy/shared/storage
- Add behavior-targeted tests for untested exports (assert outcomes, not implementation)
- No trivial assertions ("function exists", "returns defined")
- Prefer fewer strong tests over many weak ones; do not chase line coverage with dead assertions

---

## Periodic sweep

`npm run audit:all`
