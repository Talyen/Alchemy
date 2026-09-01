---
status: complete
updated: 2026-08-28
---

# Random Exploration — Simplification, Consolidation & Bug Hardening

## Objective

Execute a focused simplification pass discovered via random-entry codebase exploration. No player-visible semantics change, no tech-stack churn. Each initiative is independently shippable and preserves the elegant minimal shape mandated by `ARCHITECTURE.md`.

Discovery: `git status --short` dirty tree at `3a5dc96e` ("refactor: simplification and hardening across stores, battle, routing, CI"). Two parallel sub-agents (stores/lib/routing + scripts/config) + manual spot-checks of `src/features/alchemy/shared/stores/*` (43 files), `src/lib/game-constants/*`, `src/lib/battle/*`, `src/lib/routing/*`, `src/app/*`, `scripts/*` (82 files), `vite/vitest/eslint/knip` configs, `package.json:193`, and `docs/Plans/Archived/Elegant-Simplification-Next-Pass.md` (existing active plan at the time — preserved, not replaced; now archived 2026-08-31). Random sampling continued via `sort -R` into `write-port-run.ts:1-310`, `battle/rng.ts:1-17`, `stop-dev-server.mjs:1-205`, `check-bundle-budget.mjs:1-64`.

This plan covers the _next_ sizable gaps the existing active plan left open — principally shared-singleton correctness, duplicate barrels, wasteful allocations, escape-stack hot-path hygiene, sync-script consolidation, config dedup, and build/lint simplification.

## Plan

### Initiative 1 — Run store session correctness & waste elimination (bug fixes)

**Findings (evidence-backed):**

- `src/features/alchemy/shared/stores/run-domain-types.ts` (69-98) — `const emptyShop = emptyShopState()` (and `emptyAlchemist`, `emptyTrinketShop`, `emptyEquipmentShop`) created once at module load. `createInitialSessionFields():72-107` returns them **by reference** on every call. If any `dispatchRunSessionCommand` draft mutates `session.shopState` shallowly (Immer drafts copy-on-write, but direct reassignment `session.shopState = emptyShop` in reset paths leaks identity) two fresh runs share the same object. Test isolation also shares it.
- `src/features/alchemy/shared/stores/run-domain-types.ts` (92) — `labyrinthMap: generateLabyrinthMap(createSeededRng(0))` runs on **every** session init, even for Campaign/Wildwood runs where the map is never shown. Wasted generation + persisted unless codec strips it.
- `src/features/alchemy/shared/stores/run-state-init.ts` (96-118,209-226) — `createEmptyActiveRunCollections()` allocates 7 collections (3 arrays + object + etc.) just for `runFieldsFromSnapshot:211-224` to use two of them (`lastOfferedDestinations: [...empty.lastOfferedDestinations]` on an empty array, `destinationRoundsSinceOffered: {...empty...}` on `{}`). All other 5 allocations are discarded per call. Same pattern in `createResumeActiveRunFields` where `empty` is created but only `runTalentXP/runMaterialsEarned/runObtainedItems` use their defaults.
- `src/features/alchemy/shared/stores/run-state-init.ts` (67-82) — `pickActiveRunFields(activeRun){ return {...activeRun}}` (identity copy with comment "no second hand-maintained spread" but is a second spread) and `pickActiveRunView(run){ return {...pickActiveRunFields(run.activeRun), initialized}}` delegates to it. Caller could just `{...run.activeRun, initialized}`. Extra allocation + indirection.
- `src/features/alchemy/shared/stores/run-state-init.ts` (121-130) — `createFreshActiveRunFields` spreads `...createEmptyActiveRunCollections()` then overwrites `characterId/runDeck/...`; fine but the explicit `runTalentXP/runMaterialsEarned/runObtainedItems` defaults inside the factory are redundant once fresh path is isolated.
- `src/features/alchemy/shared/stores/write-port-run.ts` (122-130) — `hydrateFromSnapshot` does `Object.assign(draft.run.activeRun, runFieldsFromSnapshot(snapshot), { runTalentXP:{}, ... , lastOfferedDestinations: [], destinationRoundsSinceOffered:{}})` — immediately overwrites the two fields `runFieldsFromSnapshot` just cloned from `empty`. Double work.

**Right shape:**

- `run-domain-types.ts:69-74` — delete module-level `emptyShop` singletons; inside `createInitialSessionFields` call `emptyShopState()` / `emptyAlchemistState()` / etc. **per invocation** (fresh object each run, no shared identity). Keep `emptyInventory()` already called per invocation for `runEndMaterials`. Labyrinth map: lazy — `labyrinthMap` init to `generateLabyrinthMap(createSeededRng(0))` only when needed, or keep eager but document why (codec gating via `contentSystemType !== "labyrinth"` must clear it). Minimal fix is just clone-on-return for shops; labyrinth laziness is follow-up if profiling justifies.
- `run-state-init.ts:209-226` — remove `const empty = createEmptyActiveRunCollections()` from `runFieldsFromSnapshot`; directly set `lastOfferedDestinations: []`, `destinationRoundsSinceOffered: {}`, `encounteredRunEnemyIds: []` (or keep helper but only for true reuse: fresh/resume). Remove redundant override in `hydrateFromSnapshot:127-128`.
- `run-state-init.ts:67-82` — delete `pickActiveRunFields`; make `pickActiveRunView` be `({ activeRun, initialized }) => ({ ...activeRun, initialized })` — single spread, single owner, no delegation. Update `run-session-read-port.ts:13,33` and `run-reads.ts` imports.
- Add regression test: two `createInitialSessionFields()` calls return `shopState !==` same reference; `hydrateFromSnapshot` does not allocate discarded collections (optional perf micro-test).

**Risks:** Shops are structurally shared but Immer drafts isolate — behavioral risk is reset/time-travel sharing, not current hot path. Low regression risk.

**Verification:** `npm run verify:changed -- --diff` ; `npm test -- tests/features/alchemy/shared/stores/` + `tests/lib/active-run-session/` ; `npm run typecheck:all` ; `npm run lint`.

- [ ] Clone empty shops per session init (fix shared singleton); lazily defer or document labyrinth map init
- [ ] Remove wasteful `createEmptyActiveRunCollections` allocation in `runFieldsFromSnapshot` / redundant override in `hydrateFromSnapshot`
- [ ] Delete `pickActiveRunFields` indirection; single `pickActiveRunView`

---

### Initiative 2 — Duplicate barrel & stale-compat shim cleanup

**Findings:**

- `lib/game-constants.ts` (deleted) (1-10) vs `src/lib/game-constants/index.ts` (1-12) — identical re-exports (`export * from "./combat-rules"` etc., one adds comment "Barrel for import stability"). Two entry-points to same constants; `eslint/boundaries.js` must allow both, `knip` must cover both. Every new constant file must be added in two places.
- `lib/persistence-coordinator.ts` (deleted, now `src/features/alchemy/shared/storage/persistence.ts`) (1-9) — 9-line compat re-export (`export { ... } from "./persistence"`) with comment "Deprecated compatibility shim". Same for compat `codec-registry.ts` / `build-save-data-from-stores.ts` noted in audits. `docs/ARCHITECTURE.md` (76,164-165) still links the coordinator as canonical. `knip.config.js:37-68` has `ignoreIssues` entries to silence these shims.

**Right shape:**

- Delete `lib/game-constants.ts` (deleted) (keep the `game-constants/` directory barrel `index.ts` — the canonical barrel per `docs/ARCHITECTURE.md`). Grep for `from "@/lib/game-constants"` — all consumers already use the path alias without trailing `/index` and resolve to the dir barrel; verify with `npm run typecheck:all` and `lint:boundaries`. Single barrel: `src/lib/game-constants/index.ts` stays.
- Delete compat shims (`persistence-coordinator.ts`, `codec-registry.ts`, `build-save-data-from-stores.ts` if present) once `verify:changed` + `knip` confirm no import. Remove their `knip.config.js` `ignoreIssues` entries. Update `docs/ARCHITECTURE.md` (76,164) links to `persistence.ts` (already the composition root per `persistence.ts:36-60` `createDefaultPersistenceFields` / `encodePersistenceFields` / `hydrateAlchemyPersistenceFields`).

**Verification:** `npm run typecheck:all` ; `npm run lint:boundaries` ; `npm run deadcode -- --no-config-hints` (before/after) ; `npm run docs:check`.

- [ ] Delete `lib/game-constants.ts` (deleted) duplicate barrel; verify alias resolution
- [ ] Delete persistence compat shims + knip ignores; update `docs/ARCHITECTURE.md` links

---

### Initiative 3 — Escape stack hot-path & error visibility

**Findings:**

- `src/app/escape-stack.ts` (27-32,34-47) — `getHandlersHighestFirst()` does `[...handlers.values()].sort((a,b)=> b.priority - a.priority || b.seq - a.seq)` on **every `Escape` press** (`handleWindowKeyDown:36`). `handlers.size` ≤ 3 typically, so cost is trivial, but pattern is accidental: sorted list could be cached on `push/delete` instead of sorted per keydown.
- `src/app/escape-stack.ts` (40-41) — `catch { continue; }` silently swallows handler exceptions. Unlike `use-app-effects.ts:200-221` global handlers which log, escape failures are invisible to the error boundary. Debugging overlay dismiss bugs is blind.
- `src/app/escape-stack.ts` (24-25) — `let nextSeq = 0` monotonic, never wraps, `resetEscapeStackForTests:84` resets to 0 — test isolation resets ordering for same-id re-registration but does not reset `handlers` sort stability beyond seq.
- No perf bug in practice, but correctness: silent swallow + per-keydown sort is the most common "accidental inconsistency" between this file and the app's other global-key handlers.

**Right shape:**

- Cache sorted array: on `pushEscapeHandler` and on `delete` path (`unsubscribe` closure) recompute `cachedSorted = [...handlers.values()].sort(...)`; `handleWindowKeyDown` iterates the cached array (no spread/sort). Keep `Map` for O(1) lookup. Invalidate only on mutations — single-line change.
- Replace `catch { continue; }` with `catch (error) { console.error("[escape-stack] handler error", handler.id, error); continue; }` (consistent with `logError` policy elsewhere; `console.error` is allowed per `eslint: no-console allow warn/error` at `eslint.config.js:93`).
- Optional: cap `nextSeq` at `Number.MAX_SAFE_INTEGER` or reset when empty — not load-bearing; keep current `resetEscapeStackForTests` reset.

**Verification:** Unit test for `escape-stack.ts` already exists? Check `tests/app/escape-stack.test.ts` or use-modal-escape-dismiss (example test). Add assertion that handler throwing does not swallow without `console.error` and that sort order is stable after re-register. `npm test -- tests/app/`.

- [ ] Cache sorted handlers on mutation; iterate cached list on keydown
- [ ] Log handler exceptions instead of silently swallowing

---

### Initiative 4 — Screen data & config consolidation (DRY without factory bloat)

**Findings:**

- `src/features/alchemy/shared/stores/use-run-screen-data.ts` (11-121) — 11 hooks each `useGameplayStateStore(useShallow(s=>({ ...})))`. Shop `useShopScreenData:20-28` / Alchemist `30-38` / Trinket `40-47` / Equipment `49-56` duplicate `gold: state.runProfile.gold` + `runDeck` pattern; four shop hooks differ only by one session key (`shopState` vs `alchemistState` vs `trinketShopState` vs `equipmentShopState`). Copy-paste amplification per `docs/WORKFLOWS.md` shop change.
- `src/features/alchemy/shared/stores/run-reads.ts` — content-navigation projections previously duplicated `contentSystemType`, `lastOfferedDestinations`, and `destinationRoundsSinceOffered`; keep the surviving projection as the single field owner.
- `src/features/alchemy/shared/stores/run-presentation-lifecycle.ts` vs `run-lifecycle.ts:85-86` — `teardownRun:75-87` calls `clearTransientUiOnTeardown() + notifyRunTeardown()` imported from presentation lifecycle. Circular conceptual dependency; teardown does both domain + presentation but lives in domain file.

**Right shape (elegant, not over-abstracted):**

- Keep 11 hooks typed via `RunScreenDataByScreen[S]` (current `type ScreenData<S>` alias is good), but extract shared shop projection: `const selectShopBase = (state)=>({ gold: state.runProfile.gold, runDeck: state.run.activeRun.runDeck })` reused in shop/alchemist. Or introduce minimal `createShopScreenHook(screen, shopKey)` factory **only** for the four shop hooks, since their shape is ` { gold, runDeck?, [shopKey] }` — single factory with explicit typing `UseShopHook<ShopKey>`. Other 7 hooks stay hand-written (campfire, rewards, labyrinth, destination, mystery, corruption, game-over, wildwood-removal) where field sets diverge. Avoids collapsing all 11 into one table-driven mega-factory (which would lose per-screen exact return typing).
- Deduplicate selectors: make `selectContentNavigationFields` delegate to `selectOrchestrationFields` projection or extract `selectRunNavigationSubset(state)` base and compose both. Single field list owned in one place; other selector spreads it.
- Document `run-presentation-lifecycle` as presentation-only; `run-lifecycle.teardownRun` is correct to orchestrate both — add JSDoc explaining split, no file merge needed (merge would re-couple domain + UI).

**Verification:** `npm run typecheck:all` (return types must stay `RunScreenDataByScreen[S]`); `npm test -- tests/features/alchemy/shared/stores/use-run-screen-data` (if exists) or manual route smoke; `npm run lint`.

- [ ] Factory only for 4 shop hooks (preserve per-screen types); keep other hooks explicit
- [ ] Single source for the `run-reads` content-navigation field set

---

### Initiative 5 — Sync generated modules: unify `sync-assets` / `sync-gear-art`

**Findings:**

- `scripts/sync-assets.mjs` (1-52) vs `scripts/sync-gear-art.mjs` (1-70) — ~85% duplicate scaffolding: both import `syncGeneratedModule` + `isMainModule` + `kebabToCamel`, both resolve `optimizedDir/.asset-hashes.json` via `join(rootDir,"src","assets","optimized")` (L10-11 vs L10-11), both build via `Object.keys(manifest).filter(...).sort()` then `lines.join("\n")` then `syncGeneratedModule({manifestPath, outputFile, check, build})`, both `console.log(check ? "are current" : wrote ? "Wrote" : "unchanged")` (L38-44 vs L55-61). Only difference is filter (`.webp` vs `gear-*.webp`) and string templating. `scripts/lib/sync-generated-helpers.mjs` (1-15) already extracts `loadManifest + writeTextIfChanged` but not the manifest-path / filter / CLI boilerplate.
- `package.json:54` `check:generated = "node scripts/sync-assets.mjs --check && node scripts/sync-gear-art.mjs --check"` shells two processes where one sync could drive both barrels from one manifest read.
- Constants `SCHEMA_VERSION=3` / `TRANSFORM_CONCURRENCY=6` / `MANIFEST_BASENAME=.asset-hashes.json` duplicated in `optimize-assets.mjs:25-26,31` vs `optimize-sounds.mjs:33-35` vs `optimize-music.mjs:22` — not this initiative but noted for follow-up.

**Right shape:**

- Keep two CLI entry points (so `knip` entry and `change-routes` tracing stay stable), but extract shared sync-asset-helpers (proposed helper) with `manifestPathForOptimized()`, `buildAssetLines(manifest, {filter, map})`, and `runSync({build, outputFile})` wrapping `isMainModule` + `process.argv.includes("--check")` + `catch/log/exitCode`. Each sync script then becomes ~20 lines: import helper, define `build*Content`, call `runSync`. Alternatively merge into single sync-generated (proposed unified script) with one manifest load — evaluate whether single read actually matters (manifest is small JSON; benefit is marginal; keep two files for blame stability).
- Ensure `check:generated` still composes (or replace with single `node scripts/sync-generated.mjs --check` if merged). Keep `lint:ci` path unchanged.

**Verification:** `npm run check:generated -- --check` ; `npm run sync:assets && npm run sync:gear-art` (idempotent) ; `npm run lint:ci` (boundaries unchanged).

- [ ] Extract shared sync helper; reduce each sync script to filter+template only
- [ ] Keep `check:generated` gate green (single or composed — no CI regression)

---

### Initiative 6 — Read-port freeze hygiene & persistence deny-list robustness

**Findings:**

- `src/features/alchemy/shared/stores/run-session-read-port.ts` (1-53) — header comment L8-10 warns "Nested fields … treat as read-only" but `freezeInDev:27-29` is **shallow** `Object.freeze(value)` on the top-level spread. `shopState`, `battleState`, `rewardState`, `runMaterialsEarned` etc. remain mutable nested refs on the imperative hot path (autosave). Dev gets false safety; prod has no guard. Same pattern in `gear-store.ts:75-84` / `profile-store.ts:55-67` shallow copies.
- `src/features/alchemy/shared/storage/persistence.ts` (75-87) — `buildAlchemySaveDataFromStores` deny-lists run fields via destructuring (`const { gold, ... } = ...`) with `eslint-disable` per key. Adding a new run field requires remembering to deny-list it or codec key collides with `runProfile` / `gear` / `settings` envelope. Fragile vs `Omit<SaveData, "runProfile"|...>` type.

**Right shape:**

- Make freeze deep-but-cheap in dev only: `freezeInDev` recurses one level (freeze top + known mutable children: `shopState`, `battleState`, `rewardState`, `runMaterialsEarned`, `labyrinthMap`). Or use `deepFreezeInDev` that walks own keys once on the shallow snapshot — dev-only cost is acceptable (hot path is `readBattle`/`readActiveRun` every render). Document that prod is still zero-cost shallow copy. Add `eslint` comment clarifying shallow vs deep freeze tradeoff.
- Persistence deny-list: replace `eslint-disable` destructuring with typed `Omit` helper `type PersistenceEnvelope = Omit<SaveData, ...>` + explicit `pickRunFields(saveData)` that `Omit`s conflicting keys by construction, not runtime deletion. Type-level guarantee survives field addition.

**Verification:** Dev manual: `readBattle().battleState.hand.push(...)` must throw in `DEV` (frozen). Prod byte-identical. `npm run typecheck:all` ; `npm run lint` (deny-list disables gone) ; `npm test -- tests/features/alchemy/shared/storage/`.

- [ ] Deep-ish freeze in dev for read-port nested refs (one-level); document shallow prod tradeoff
- [ ] Type-level deny-list (`Omit`) instead of `eslint-disable` per-key destructuring

---

### Initiative 7 — Script stubs & config seam consolidation (build/tooling hygiene)

**Findings:**

- `scripts/release.mjs` (9) and `scripts/release-hotfix.mjs` (14) both just `import { release }` from `lib/release-runner.mjs` — stubs. Same pattern `scripts/check-docs.mjs` (26) (delegator to `check-documentation-contract.mjs + check-plans.mjs`), `scripts/optimize-pipelines.mjs` (39) (re-export of `prepare-assets.mjs`). Four files <40 LOC that only re-export or delegate. `package.json:49-54,99-101` then has two scripts pointing at stubs that point at libs — three hops.
- `vite.config.ts:16,82-121,124` — `resolveDevPort` singleton from `scripts/lib/dev-port.mjs` (38) is good but `vite.config.ts:11-13` imports it via `// @ts-ignore no types for vite-aliases.mjs` (fragile across Node `>=24.0.0`). `rolldownOptions.codeSplitting.groups:82-121` is 40 lines of tuning for cache churn that `docs/PERFORMANCE.md` does not prove; `check-bundle-budget.mjs:9-14` already gates `indexMaxBytes 600kB / total 1550kB` with observed `572kB / 1.51MB` — budget alone is sufficient. `chunkSizeWarningLimit:900` (vite) contradicts `indexMaxBytes:600*1024` (budget) — two budgets, one silenced, one enforced.
- `scripts/lib/vite-aliases.mjs` path alias `VITE_ALIAS_PATH/TARGET` vs `tsconfig.json:25-27` `paths: {"@/*":["./src/*"]}` vs `vite.config.ts:126-129` `resolve.alias` vs `vitest.config.ts:11-14` — triplication of `@` mapping (good that vite reuses `vite-aliases.mjs`, but tsconfig still hand-maintains it; drift risk).

**Right shape:**

- Delete stubs: point `package.json` scripts directly at libs — `release` / `release:hotfix` call `lib/release-runner.mjs` with `--hotfix` flag (already exists in runner); `check-docs` inline `Promise.all([reportDocumentationContracts(), reportPlanChecks()])` directly or keep one orchestrator (`check-docs.mjs`) and delete the separate leaf scripts' CLI wrappers if duplicative. Keep `optimize-pipelines.mjs` only if `prepare-assets.mjs:39,58` orchestrator already covers it — measure before deleting (it may be `assets` orchestration alias used by `predev`).
- Vite config: extract `sentryEnabled`, `checkerEnabled`, `codeSplitting` to vite-config-helpers (proposed) if kept, but **remove** `rolldownOptions.codeSplitting.groups` unless bundle audit proves cache-churn benefit — rely on Vite default + `check-bundle-budget` gate. Unify `chunkSizeWarningLimit:900` vs `BUDGETS.indexMaxBytes` — set `chunkSizeWarningLimit` to `BUDGETS.indexMaxBytes/1024` or delete warning limit (budget is the gate).
- Alias: generate `vite-aliases.ts` with types (instead of `.mjs` with `@ts-ignore`) so `vite.config.ts` and `vitest.config.ts` import with type safety; keep `tsconfig.json:paths` as the TS truth but add a check-alias-consistency (proposed) or just `check-docs` reachability that asserts `vite-aliases.mjs:TARGET === tsconfig paths "@/*"` — or inline the `fileURLToPath(new URL(VITE_ALIAS_TARGET,...))` comment explaining triplication.

**Verification:** `npm run release -- --help` / `release:hotfix` still works; `npm run build` + `npm run check:bundle` (budget still passes, no chunk rename); `npm run lint:ci` (boundaries unchanged); `npm run verify:changed -- --diff` over touched scripts.

- [ ] Delete `release.mjs`/`release-hotfix.mjs`/`optimize-pipelines` stubs; point package scripts at `lib/*` directly (or keep single orchestrator)
- [ ] Remove `rolldownOptions.codeSplitting` speculative tuning; rely on bundle budget gate
- [ ] Unify `chunkSizeWarningLimit` with `BUDGETS.indexMaxBytes`; extract vite helpers with types

---

### Initiative 8 — Lint monolith & `exactlyOptional` pragmatism (DX, not behavior)

**Findings (evidence-backed, lower priority — do last or defer):**

- `eslint.config.js:383` — 20+ `tseslint.config(...)` objects: ignores (L36-50), recommended (52-54), strictTypeChecked scoped to `src/**` (56-70), tuned rules (72-106), disableTypeChecked for tests/scripts/desktop (107-112), react-hooks (113-124), react-refresh exceptions (125-134), react-compiler (135-144), prettier (145), global style (147-159), 5 alchemy custom rules (160-190), `no-restricted-types` for `React.FC` (191-209), `...BOUNDARY_CONFIGS:210`, `no-explicit-any` (212-220), `CLASSNAME_NO_TEMPLATE` (221-229) + battle `BATTLE_NO_MATH_*` (230-241) repeating `CLASSNAME_NO_TEMPLATE`, unused-vars (242-248), test relaxations (249-259), `playwright` flat config (260-276), barrel import bans for E2E (277-320), animation `fastBattle` bans (321-353), node `scripts/**/*.mjs` globals (354-377), `desktop/**/*.cjs` (378-383). Single 383-line file mixes type-aware, react, playwright, barrel, battle, node globals — scrolling through 15 unrelated blocks to find a rule.
- `tsconfig.json:16-24` — `exactOptionalPropertyTypes:true` (L19), `noUncheckedIndexedAccess:true` (L22) enabled for `src` but disabled in `tsconfig.test.json:9-10` (`~220` violations unfixed). Indicates over-strictness that had to be walked back for tests — cost without proportional safety in app code (most `noUncheckedIndexedAccess` hits are indexed access on `Record<DifficultyId,...>` where key is validated).
- `knip.config.js:37-68` — 22 `ignoreIssues` to silence false positives; probe instruction `L17-19` says `probe occasionally by running knip with the block emptied` — manual toil.

**Right shape (if justified):**

- Split `eslint.config.js` into `eslint/base.js`, `eslint/typed.js`, `eslint/react.js`, `eslint/e2e.js`, `eslint/node.js` re-exported by a 50-line `eslint.config.js` barrel. Keep `BOUNDARY_CONFIGS` in `eslint/boundaries.js` (already separate). No rule semantics change; purely DX. Do only if `docs/REFERENCE.md#failure-first-triage` shows lint-config churn is a hotspot (`context-hotspots.mjs:125` ranking).
- Relax `noUncheckedIndexedAccess` to `false` in root (tests already off) after measuring `npm run typecheck` delta — keep `strict:true` + `exactOptionalPropertyTypes:true` (legit bug catcher for `SaveData` envelope). Keep `noUnusedLocals:true` + `noUnusedParameters` as is.
- Reduce knip ignores by deleting compat shims (Initiative 2) — ignore count should drop naturally; no need to split knip config further.

**Verification:** `npm run lint` ; `npm run lint:boundaries` ; `npm run deadcode` (ignore count drops) ; `npm run typecheck:all` (no new errors).

- [ ] Split `eslint.config.js` into imports (only if hotspot proof)
- [ ] Evaluate relaxing `noUncheckedIndexedAccess` (measure violation delta)
- [ ] Knip ignore count reduction via shim deletion (Initiative 2)

---

## Sequencing

1. **Initiative 1** (bug fix, no deps) → **Initiative 2** (barrel/shim deletion, no deps) can run in parallel after 1.
2. **Initiative 3** (escape-stack) + **Initiative 6** (read-port freeze) + **Initiative 5** (sync helpers) are independent of 1/2.
3. **Initiative 4** (screen data consolidation) after 1 (depends on `pickActiveRunView` change).
4. **Initiative 7** (stubs/build) after 5 (sync helper shape informs stub decisions).
5. **Initiative 8** (lint DX) last, only if `context:hotspots` justifies.

## Non-goals

- No player-visible rebalancing (fight pacing, crit/dodge split stays unless tuned with data).
- No `React.lazy` on route screens (hitch-safe eager invariant `ARCHITECTURE.md` § Boot).
- No save-migration bump (`MIGRATIONS.md`) unless codec shape changes — shop clone + map laziness are internal.
- No shop pricing table consolidation (`shop-pricing.ts` six `compute*Price` wrappers) — covered by existing active plan Initiative 2; not duplicated here.
- No battle status subdir consolidation (`status-*` 11 files) — existing plan Initiative 4 covers it; this plan focuses on random-entry gaps.

## Risks & Mitigations

- Shop-per-session clone: narrow store init path; guard with `dispatchRunSessionCommand` + Immer invariant; regression test for reference inequality.
- Barrel deletion: grep + `typecheck:all` + `lint:boundaries` catch missed `from "@/lib/game-constants"` import before merge.
- Compat shim deletion: two-step — first verify zero imports via `verify:changed` + `knip`, then delete + remove knip ignores in same commit.
- Escape-stack cache: invalidates correctly on `push/delete` — add unit test for re-register with same `id` (replaces entry, re-sorts).
- Vite group removal: `check:bundle` (600kB/1550kB) is the gate; verified that current `572kB/1.51MB` stays under budget with default chunks.

## Verification (per-initiative)

Each initiative runs `npm run verify:changed -- --diff` + `npm run lint:ci` + its targeted `npm test -- <path>` noted above. Final handoff runs `npm run check:push` if committing to main, then `npm run docs:check:final` to archive this plan. If `Cursor` browser tabs were used, close them.

## Notes

Keep durable policy in its canonical documentation owner. At handoff, set status to complete, refresh the updated date, and run `npm run docs:check:final` to archive this plan. Existing active plan at handoff was `codebase-simplification-hardening.md` + `Elegant-Simplification-Next-Pass.md` (now archived 2026-08-31 to `docs/Plans/Archived/Elegant-Simplification-Next-Pass.md`); this plan does not replace them. `docs:check` reachability already gates orphan plans; `npm run plans:check` warns if >3 active plans or stale `updated`.
