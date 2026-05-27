# Alchemy — Code Review Prompts

High-leverage prompts for coding agents. Apply these in order before every PR.

## Quick Reference

- [ ] What code did I **remove** or **compress**? (If none, find some.)
- [ ] Any `any`, `as`, `!` I could avoid?
- [ ] Run `npm run deadcode && npm run lint && npm test`.

---

## 1. Code Reduction & Compression

Adding code is easy. Removing it is hard.

> **Where to start:** `npm run deadcode` → read the report, then `rg "\.\.\.|identical"` to spot duplication patterns. Sort source files by line count: `Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-Object Name, @{N="Lines";E={@(Get-Content $_.FullName).Count}} | Sort-Object Lines -Descending | Select -First 20`.
> **Plan first:** output all findings as a grouped bullet list (delete / refactor / investigate) with file paths and line numbers. Only start editing after the plan is confirmed.

- **Dead code.** `npm run deadcode` → delete every unused export. Annotate kept exports with a reason.
- **Duplication.** 3+ identical lines in >1 place? Extract to shared function/component. Similar-but-not-identical functions differing by one param? Unify.
- **Complexity.** File >400 lines? Split. Function >30 lines? Split unless it's a long switch. Nesting >3 levels? Early returns / guard clauses. Switch >8 cases? `Record<Key, Handler>` lookup table.
- **Zombie code.** Commented-out code, dead branches, orphaned parameters. Delete them.
- **Abstraction audit.** A wrapper that adds 5 boilerplate lines to save 2 isn't worth it. A 3-line function called once should be inlined unless it provides semantic clarity.
- **Consolidation.** Files imported together 90% of the time? Merge them. Magic numbers outside `game-constants.ts`? Move them. Duplicate utility? Unify.

## 2. Type Safety & Error Handling

> **Where to start:** `rg " as " src/ --include "*.ts" --include "*.tsx" | rg -v "import|export|from"` — each hit is potential type escape. Then `rg "\bcatch\b" src/ --include "*.ts" -A 3` for empty catch blocks.
> **Plan first:** output all findings as a grouped bullet list (delete / refactor / investigate) with file paths and line numbers. Only start editing after the plan is confirmed.

- **`any` creeping in.** Every `any` is a type safety hole. Use ESLint `@typescript-eslint/no-explicit-any` as a floor, not a ceiling.
- **`as` casts.** Each `as` bypasses the type checker. Prefer type guards or narrowing.
- **`!` non-null assertions.** Can the type system prove null-safety instead?
- **Silent failures.** Every `catch {}` should log or recover visibly. No empty catch blocks.
- **Unhandled rejections.** Every async path needs `.catch()` or `try/catch`.
- **`dangerouslySetInnerHTML`.** Verify no user-controlled content is rendered unsanitized.

## 3. Common Bug Patterns

> **Where to start:** `rg "Math\.random" src/lib/battle/` (item 3), then `rg "catch\s*\{[^}]*\}" src/lib/battle/ -U"` (item 1 triggers). Then scan the diff for any state spreads via `rg "\{ \.\.\.state"`.
> **Plan first:** output all findings as a grouped bullet list (delete / refactor / investigate) with file paths and line numbers. Only start editing after the plan is confirmed.

Check for these 7 known recurring bugs:

1. **Missing `adjustEnemyStatusDelta`.** Any new code path that adds enemy status stacks must call this so `null-field` modifier halves it correctly.
2. **Combat text deduplication.** Effects must push through `mergeCombatText()` — multi-hit cards deduplicate by `(target, kind, stat)`.
3. **`Math.random()` instead of `state.rng`.** Never use bare `Math.random()` inside battle logic.
4. **Manifest field added but not populated.** A field in `TalentEffectManifest` or `TrinketManifest` that's never set in `compute*Effects()` is silently `undefined`.
5. **Block decay direction.** Block decays at *end of enemy turn* (halved), not start of player turn.
6. **State spread drops fields.** `{ ...state, nested: { newNested } }` drops sibling fields — must be `{ ...state, nested: { ...state.nested, newNested } }`.
7. **Zustand equality misuse.** New object references trigger re-render with default `Object.is`. Use shallow or custom equality.

## 4. Battle Engine Correctness

> **Where to start:** Read `src/lib/battle/card-play.ts` and `src/lib/battle/apply-effects.ts` — the two core reducer functions. Then `rg "\.playerStatuses\[|\.enemyStatuses\[" src/lib/battle/ | rg "\+="` for accidental mutation.
> **Plan first:** output all findings as a grouped bullet list (delete / refactor / investigate) with file paths and line numbers. Only start editing after the plan is confirmed.

- **Pure reducer.** No function may mutate `BattleState` in place — must always return a new object. Watch for accidental mutation via nested objects (`state.playerStatuses[status] += n`).
- **Combat text emission.** Every damage tick, status application, heal, and mana change produces a `CombatTextEvent`. No silent state changes.
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
> **Plan first:** output all findings as a grouped bullet list (fix / investigate / skip) with file paths and line numbers. Only start editing after the plan is confirmed.

- **Zustand selectors.** Always `useStore(s => s.field)`, never `useStore()`. No full store subscriptions in screens.
- **Memoization.** Array `.filter().map()` chains in render → `useMemo`. No expensive computation in render.
- **Dependency arrays.** `useEffect`/`useMemo`/`useCallback` with stale closures? Add deps.
- **Console warnings.** `[Enemy Turn]` warnings for unrecognized attack effects. Handle them or suppress.
- **Dev mode isolation.** `localStorage["alchemy-dev-mode"]` code paths must not affect production builds.
