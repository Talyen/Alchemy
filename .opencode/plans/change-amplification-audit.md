# Change amplification audit — findings + seam plan

Snapshot: `git log --since="3 months ago" --grep="^(feat|fix|balance)"` (161 raw → 148 filtered → 134 clean). Counts as of 2026-06-23.

## Data

| View | n | Median | Mean | p90 | Max |
|---|---|---|---|---|---|
| Raw (all 161) | 161 | 16 | 38.9 | 79 | 1056 |
| Filtered (drop pure-asset/infra commits) | 148 | 16 | 38.1 | 77 | 1056 |
| Clean (drop ≥100-file milestones + `fix(tests)` batches) | 134 | 15 | 22.8 | 66 | 92 |
| → by type: fix median 4, feat median 14, balance 1 | | | | | |

**Verdict:** The 5-file target is realistic for `fix` (already passing) and `balance` (1). `feat` is the pressure point, driven by 40 commits (27% of clean) that co-edit `src/lib/game-data/*` with a screens file.

## Top hotspots (>25% of clean commits)

Only one source file crosses the bar: **`src/App.tsx`** (41/134 = 31%). It is the composition root and is **expected** to be touched by every feat. No new seam needed.

## Near-hotspots (15-25% of clean commits)

| File | Commits | Verdict |
|---|---|---|
| `src/lib/game-constants.ts` | 29 | Balance-tuning touchpoint. Centralized. Keep. |
| `src/index.css` | 24 | Token/style tweaks. Acceptable. |
| `src/features/alchemy/use-alchemy-run-controller.ts` | 23 | Top-level composer. Already thin (272 lines). |
| `src/lib/game-data/assets.ts` | 22 | **Manual 332-line asset barrel.** Real seam candidate — see action 1. |
| `src/features/alchemy/use-battle-controller.ts` | 21 | Already factored via `*Deps` factories. |
| `src/lib/game-data/compendium.ts` | 20 | Content catalog. |
| `src/lib/battle/types.ts` | 19 | Battle types. |
| `src/lib/battle/enemy-turn.ts` | 19 | Battle core. |
| `src/features/alchemy/screens/battle-screen.tsx` | 18 | Screen file. |
| `tests/lib/battle/damage.test.ts` | 17 | **789-line, 17-describe-block mega test.** Seam action 3. |
| `src/lib/game-data/cards.ts`, `types.ts` | 17 each | Content data. |
| `src/features/alchemy/use-run-navigation.ts` | 17 | Flow composer (290 lines). |
| `tests/helpers.ts` | 16 | Test barrel — touching it is a stable surface, not a coupling problem. |
| `src/features/alchemy/ui/collection-ui.tsx` | 15 | UI. |
| `src/features/alchemy/types.ts` | 14 | Shared types barrel. |

**Already-fixed hotspot:** the historical `tests/lib/battle.test.ts` (22 commits at the time) was already split into `tests/lib/battle/` (38 focused files). The 4-occurrence cost shown in current data is the per-subsystem test file, not the old mega file.

## Co-edit signal

40 commits (27% of clean) touch both `src/lib/game-data/*` and a screens file. Most fall into two patterns:

- **Mega milestones** (armory ship, gear armory, boons/migration) — inherent to the milestone
- **Data asset additions** — new art added to `assets.ts` + new screen that consumes it

The latter is the hidden coupling. Proposed seam: a `screen-content-lookup.ts` facade that screens consume instead of reaching into `src/lib/game-data/*` directly. (See action 2.)

## Actions

### Action 1 — Auto-generate `src/lib/game-data/assets.ts` (low risk, high impact) ✓ DONE

**Why:** 332-line manual file holding ~200 named re-exports of `*.webp` files. Hand-edited 20 times. Every new art asset forces this file to grow alongside the screen that consumes it.

**What:**
- Add a barrel-emission step that scans `src/assets/optimized/` and emits the named exports to `src/lib/game-data/assets.generated.ts`
- Hook into the existing `prebuild` step (which already runs asset optimization) — see `scripts/optimize-assets.mjs`
- Treat the generated file per [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)
- Re-export from `src/lib/game-data/assets.ts` if the public surface must stay the same

**Result:** new art = one file placement, no `assets.ts` edit, no forced co-change to a screen commit.

**Trade-off:** adds a build-step dependency. Mitigation — `prebuild` already runs asset optimization; this is one more line in an existing pipeline.

**Verification:** `npm run check:ship:full` (validates prebuild + assets), `npm run lint:ci`.

### Action 2 — Add screen-content facade (deferred)

Investigated — screens import almost exclusively **types** from `@/lib/game-data`, not runtime data. The co-edit signal was dominated by `assets.ts` (action 1 ✓). A facade would add indirection without breaking a real coupling. Deferred until a concrete runtime-data co-edit pattern emerges.

### Action 3 — Split `tests/lib/battle/damage.test.ts` (safe, mechanical) ✓ DONE

789-line file with 17 unrelated `describe` blocks. Split by describe-block family. No test logic change.

9 files created:
- `damage-base.test.ts` — basic physical, equalToBlock/equalToArmor, edge cases
- `damage-forge.test.ts` — forge bonus, forge stun rider, consume forge
- `damage-holy.test.ts` — holy damage variants, holy riders
- `damage-bleed.test.ts` — bleed damage
- `damage-tag-mods.test.ts` — archery, stun, physical vs statuses
- `damage-first-mods.test.ts` — first damage modifiers
- `damage-crit.test.ts` — crit mechanics
- `damage-lifesteal.test.ts` — lifesteal
- `damage-enemy-armor.test.ts` — enemy armor, siphon

## Out of scope (intentionally)

- `src/App.tsx` (composition root) — expected hotspot
- ≥100-file milestone commits — inherent to milestones
- `src/lib/game-constants.ts` — central tuning file
- `src/lib/battle/types.ts` and `enemy-turn.ts` — battle core

## Open questions

1. **Action 1 (auto-generate assets.ts):** OK to add a `prebuild` step or manual script call?
2. **Action 2 (screen-content facade):** approve pilot-first on `mystery-screen.tsx`?
3. **Re-run cadence:** per `check:push` or per release?
