# Alchemy — Code Review Prompts

High-leverage prompts for coding agents. Apply these in order before every PR.

## Quick Reference

- [ ] What code did I **remove** or **compress**? (If none, find some.) — are you adding more than you're deleting?
- [ ] Any `any`, `as`, `!` I could avoid? — each one bypasses the type checker.
- [ ] Run `npm run deadcode && npm run lint && npm test`. — gate before any review.
- [ ] Commit hygiene: no `debugger`, no `console.log` (except intentional), no `TODO`/`FIXME` introduced without tracking.
- [ ] Commit message follows [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`).

> **All sections follow the same pattern:** output findings as a grouped bullet list with file paths and line numbers. Only start editing after the plan is confirmed.

---

## 1. Code Reduction & Compression

Adding code is easy. Removing it is hard.

> **Where to start:** `npm run deadcode` → read the report, then `rg "\.\.\.|identical"` to spot duplication patterns. Sort source files by line count: `Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-Object Name, @{N="Lines";E={@(Get-Content $_.FullName).Count}} | Sort-Object Lines -Descending | Select -First 20`.


- **Dead code.** `npm run deadcode` → delete every unused export. Annotate kept exports with a reason. Also remove commented-out code, dead branches, and orphaned parameters.
- **Duplication.** 3+ identical lines in >1 place? Extract to shared function/component. Similar-but-not-identical functions differing by one param? Unify.
- **Complexity.** File >400 lines? Split. Function >30 lines? Split unless it's a long switch. Nesting >3 levels? Early returns / guard clauses. Switch >8 cases? `Record<Key, Handler>` lookup table.
- **Abstraction audit.** A wrapper that adds 5 boilerplate lines to save 2 isn't worth it. A 3-line function called once should be inlined unless it provides semantic clarity.
- **Consolidation.** Files imported together 90% of the time? Merge them. Magic numbers outside `game-constants.ts`? Move them. Duplicate utility? Unify.
- **Diff audit.** Before committing, review the diff. Are you adding more than you're deleting? Could 50 lines be 15? If every PR grows the codebase, it becomes unmaintainable.

## 2. Type Safety & Error Handling

> **Where to start:** `rg " as " src/ --include "*.ts" --include "*.tsx" | rg -v "import|export|from"` — each hit is potential type escape. Then `rg "\bcatch\b" src/ --include "*.ts" -A 3` for empty catch blocks.


- **`any` creeping in.** Every `any` is a type safety hole. Use ESLint `@typescript-eslint/no-explicit-any` as a floor, not a ceiling.
- **`as` casts.** Each `as` bypasses the type checker. Prefer type guards or narrowing.
- **`!` non-null assertions.** Can the type system prove null-safety instead?
- **Silent failures.** Every `catch {}` should log or recover visibly. No empty catch blocks.
- **Unhandled rejections.** Every async path needs `.catch()` or `try/catch`.
- **`dangerouslySetInnerHTML`.** Verify no user-controlled content is rendered unsanitized.
- **Circular imports.** `npx madge --circular src/` — cycles cause runtime `undefined` errors and break tree-shaking.

## 3. Common Bug Patterns

> **Where to start:** `rg "\{ \.\.\.state" src/` for state spread bugs, then `rg "TalentEffectManifest|TrinketManifest" src/lib/ --include "*.ts" | rg -v "import|type"` for manifest population gaps.


Check for these recurring bugs:

1. **Manifest field added but not populated.** A field in `TalentEffectManifest` or `TrinketManifest` that's never set in `compute*Effects()` is silently `undefined`.
2. **State spread drops fields.** `{ ...state, nested: { newNested } }` drops sibling fields — must be `{ ...state, nested: { ...state.nested, newNested } }`.
3. **Zustand equality misuse.** New object references trigger re-render with default `Object.is`. Use shallow or custom equality.
4. **Save type changed without migration.** Changed a persisted type? Update the Zod schema, migration function, and legacy fixture files together. See `src/features/alchemy/storage/MIGRATIONS.md`.

## 4. Battle Engine Correctness

> **Where to start:** Read `src/lib/battle/card-play.ts` and `src/lib/battle/apply-effects.ts` — the two core reducer functions. Then `rg "\.playerStatuses\[|\.enemyStatuses\[" src/lib/battle/ | rg "\+="` for accidental mutation.


- **Pure reducer.** No function may mutate `BattleState` in place — must always return a new object. Watch for accidental mutation via nested objects (`state.playerStatuses[status] += n`).
- **Seeded RNG.** Never use bare `Math.random()` inside battle logic — always use `state.rng`.
- **`adjustEnemyStatusDelta`.** Any code path that adds enemy status stacks must call this so `null-field` modifier halves it correctly.
- **Combat text emission + deduplication.** Every damage tick, status application, heal, and mana change produces a `CombatTextEvent`. Multi-hit cards deduplicate by `(target, kind, stat)` via `mergeCombatText()`.
- **Death's Door.** 0 HP → grace turn. Healing out of DD. Subsequent zero-health hits. Grace countdown.
- **Status tick ordering.** Enemy DoTs tick → enemy attacks → player DoTs tick → regen. Cross-reference with AGENTS.md turn order.
- **Block decay.** Halved *after* enemy attack. Not at player turn.
- **Card resolution.** Cost validation before play. Multi-effect cards apply sequentially. `consume` cards go to `exhausted[]`, not `discard[]`. Hand clear moves cards to discard, not exhaust.

## 5. New Feature Checklist

> **Where to start:** Identify the kind of feature being added (card/companion/enemy/trinket/screen), then open the matching step-1 file from the list below. Follow the checklist sequentially — each step's outputs feed the next.
> **Plan first:** output all steps you'll take as a checklist, noting which files each step touches. Only start editing after the plan is confirmed.

Adding anything new (card, companion, enemy, trinket, screen, system)?

- [ ] Types updated (`CardId`, `KeywordId`, `PlayerStatusId`, `EnemyStatusId`, `CompanionId`, effect kind, `Screen`, etc.)
- [ ] Data defined (card, companion, enemy, trinket, talent)
- [ ] Art in `assets.ts` + optimized
- [ ] Sound in `sound-registry.ts` (if applicable)
- [ ] Description ↔ effects match (verify with test)
- [ ] Battle logic added (apply-effects, status-ticks, damage)
- [ ] Barrel re-exports updated (index.ts files)
- [ ] Talent manifest updated (if talent-gated)
- [ ] Trinket manifest updated (if trinket-gated)
- [ ] Save schema + migration updated (if persisted)
- [ ] Screen added → `ErrorBoundary` wraps it (if new screen)
- [ ] AGENTS.md updated if workflow/command/convention changed
- [ ] UI/a11y review (keyboard nav, focus, ARIA labels, PressableMotion states)
- [ ] Tests written or updated
- [ ] `npm run balance:sim` (if balance-impacting)
- [ ] `npm run deadcode && npm run lint && npm test` pass

## 6. Test Coverage

> **Where to start:** Find the file being changed, then open the corresponding `tests/` file. If none exists, check `tests/fixtures/` for existing helpers. Run `npm test` first to see the current baseline.
> **Plan first:** output which test file needs new cases, what edge cases you'll cover, and the expected assertions. Only start editing after the plan is confirmed.

- **Deterministic setup.** Use `createBattleState()` with fixture decks, not random opening hands.
- **Edge cases.** Status tick ordering, CC cooldown, Death's Door, draw pile exhaustion (including mid-draw with 1 card left), zero-duration status.
- **Save round-trip.** Serialize run → deserialize → re-serialize → compare. No data loss.
- **Migration.** Load legacy fixture from previous save version → verify clean migration.
- **Barrel integrity.** Every barrel exports expected symbols, no side effects.
- Run `npm test`.

## 7. Performance & Observability

> **Where to start:** `rg "useStore\(" src/features/ --include "*.tsx"` — find full store subscriptions (no `s =>` selector). Then `rg "\.map\(|\.filter\(" src/features/ --include "*.tsx"` for un-memoized chains in render.


- **Zustand selectors.** Always `useStore(s => s.field)`, never `useStore()`. No full store subscriptions in screens.
- **Memoization.** Array `.filter().map()` chains in render → `useMemo`. No expensive computation in render.
- **Dependency arrays.** `useEffect`/`useMemo`/`useCallback` with stale closures? Add deps.
- **Console warnings.** `[Enemy Turn]` warnings for unrecognized attack effects. Handle them or suppress.
- **Dev mode isolation.** `localStorage["alchemy-dev-mode"]` code paths must not affect production builds.
- **Bundle impact.** New imports from heavy libraries? Consider `dynamic import()`. Check `npm run build` output size diff.

## 8. CSS & Tailwind Audit

> **Where to start:** `rg "className=" src/features/ --include "*.tsx" | rg -o '"[^"]*"' | sort | uniq -c | sort -r | head -30` for most-used class strings. Then `rg "style\s*=\s*\{" src/ --include "*.{ts,tsx}"` for inline styles.


- **Unused Tailwind variants.** Scan for `sm:`, `md:`, `lg:` classes that can never trigger (e.g., a fixed-width element that never breaks).
- **Inline styles.** Every `style={{ }}` should have a documented reason. Prefer Tailwind utility classes.
- **Dynamic class construction.** Tailwind's JIT scans for complete class strings. Template literal class names (e.g. `text-${color}-500`) won't be detected — use a map lookup instead.
- **Token consistency.** Hardcoded colors, spacing, or font sizes outside Tailwind's config? Extract to a custom utility or theme token.
- **`cn()` discipline.** No manual ternary class strings — use `cn()` for all conditional class merging.

## 9. Desktop & Electron Safety

> **Where to start:** `rg "contextBridge|ipcRenderer|ipcMain" src/ desktop/ --include "*.{ts,js}"`.


- **contextBridge API.** All `ipcRenderer` invocations from the renderer must go through `contextBridge.exposeInMainWorld`. No `nodeIntegration: true` or `contextIsolation: false`.
- **IPC channel validation.** Server-side `ipcMain.handle` channels must validate their arguments. No raw eval or dynamic require.
- **File system access.** Any `fs` calls from the main process must sanitize paths (no `../../` traversal).
- **Platform paths.** Use `app.getPath()` for user data, logs, and temp files. No hardcoded paths.
- **Window management.** New windows should use `BrowserWindow` with `sandbox: true` where possible.
