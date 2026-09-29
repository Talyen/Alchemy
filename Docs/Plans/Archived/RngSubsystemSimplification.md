---
status: complete
updated: 2026-09-28
---

# RngSubsystemSimplification

## Objective

Modernize, consolidate, and optimize the `@/lib/rng` subsystem and its consumers without changing any player-visible game behavior or breaking reproducible seed sequences. Ensure `@/lib/rng` is strictly the sole door for all random number operations, eliminate intermediate heap allocations in hot run-stream draws, standardize mutable-state RNG bindings, deduplicate save validation fallback state, fix non-deterministic E2E run seeding, and strengthen architecture and unit test coverage.

## Findings & Motivation

1. **Leaky Canonical Door & Accidental Inconsistency in `src/lib/utils.ts`**:
   - `Docs/RUN_STATE.md` states: _"Run-luck helpers live in `@/lib/rng` (the single door), small math in `@/lib/math`, and class-name/string/id helpers in `@/lib/utils`."_
   - Yet `src/lib/utils.ts` re-exports `createSeededRng`, `shuffle`, `sampleItems`, `pickRandom`, and `takeRandomItem`.
   - 6 gameplay/config files (`enemies.ts`, `wildwood/gauntlet.ts`, `corruption/index.ts`, `reward-selection.ts`, `gear/affix-pool.ts`, `gear/generation.ts`) and 12 test files import RNG helpers from `@/lib/utils`.
   - `src/lib/audio/music.ts` and `src/lib/audio/sfx.ts` use relative imports (`"../rng"`).
   - `tests/architecture/rng-canonical-doors.test.ts` failed to prevent `@/lib/utils` re-exports or enforce that all non-rng files import from `@/lib/rng`.

2. **Garbage Collection Pressure in `stepRunRng`**:
   - `stepRunRng` currently calls `nextRunRngValue`, which allocates `{ value, nextCounter }` on every draw, only to extract `draw.value` and discard the object.
   - During combat simulation, balance sweeps, and runs, this generates unnecessary short-lived heap allocations.

3. **Missing Standard Abstraction: `createRunStateRng`**:
   - `createRunStreamRng(seed, stream, startCounter)` exists for static seeds, but no factory exists for mutable `RunRngState` objects.
   - Callers currently duplicate ad-hoc closures (`() => stepRunRng(rngState, stream)` in tests and `normalize-active-run-data.ts`, and `createDraftRunRandomSource` in `run-progress.ts`).

4. **Duplication in Validation Schema**:
   - `src/lib/validation/save-schemas/run-progress.ts` hardcodes a private `createFallbackRunRngState` object with all stream keys manually written out instead of calling `createRunRngState(1)`.

5. **E2E Run Seeding Flaw in `tests/e2e/rng.ts`**:
   - `seedRandom(page, seed)` only patches `Math.random`. However, `generateRunSeed()` in `run-state-init.ts` uses `crypto.getRandomValues(new Uint32Array(1))[0]`.
   - As a result, E2E tests attempting to seed runs deterministically (e.g. `contiguous-run.spec.ts`) still get random run seeds.

## Plan

### Phase 1: Core RNG Subsystem (`src/lib/rng/index.ts`)

- [x] Optimize `stepRunRng` to mutate `state.counters[stream]` in-place and return the calculated float directly without allocating an intermediate object. Keep `nextRunRngValue` for non-mutating peek operations.
- [x] Add `createRunStateRng(state: RunRngState, stream: RunRngStream): Rng` returning `() => stepRunRng(state, stream)`.

### Phase 2: Consolidation of Mutable RNG Callers

- [x] In `src/features/alchemy/shared/stores/write/run-progress.ts`, simplify `createDraftRunRandomSource` to use `createRunStateRng(draft.run.activeRun.rng, stream)` with return type `Rng`.
- [x] In `src/lib/validation/normalize-active-run-data.ts`, replace private `createRepairRng` with `createRunStateRng`.
- [x] In `tests/features/alchemy/run-loop/navigation/destination-flow.test.ts`, `victory-flow.test.ts`, and `tests/lib/content-systems/wildwood/gauntlet.test.ts`, use `createRunStateRng(rngState, "world")`.
- [x] In `src/lib/validation/save-schemas/run-progress.ts`, replace the hardcoded `createFallbackRunRngState` shape with `createRunRngState(1)`.

### Phase 3: Enforce Canonical Import Doors & Eliminate Re-exports

- [x] Remove `createSeededRng`, `shuffle`, `sampleItems`, `pickRandom`, and `takeRandomItem` re-exports from `src/lib/utils.ts`.
- [x] Update imports in `src/features/alchemy/shared/config/enemies.ts`, `src/lib/content-systems/wildwood/gauntlet.ts`, `src/lib/corruption/index.ts`, `src/lib/game-data/reward-selection.ts`, `src/lib/gear/affix-pool.ts`, and `src/lib/gear/generation.ts` to import directly from `@/lib/rng`.
- [x] Update relative imports in `src/lib/audio/music.ts` and `src/lib/audio/sfx.ts` to `@/lib/rng`.
- [x] Update 12 test files importing RNG helpers from `@/lib/utils` to import from `@/lib/rng`.
- [x] In `tests/architecture/rng-canonical-doors.test.ts`:
  - Assert `src/lib/utils.ts` does not re-export RNG symbols.
  - Assert no file outside `src/lib/rng` imports RNG helpers from `utils`.
  - Assert no file outside `src/lib/rng` uses relative imports to `rng`.

### Phase 4: Deterministic E2E Seeding & Fixtures

- [x] In `tests/e2e/rng.ts`, enhance `seedRandom` to also intercept `crypto.getRandomValues` and populate arrays deterministically from the seeded LCG generator.
- [x] In `tests/fixtures/rng.ts`, type `seededRng` return value as `Rng`.

### Phase 5: Verification & Testing

- [x] Add unit tests in `tests/lib/run-rng.test.ts` for `createRunStateRng`, `stepRunRng` error throwing on invalid stream names, and parity with `nextRunRngValue`.
- [x] Add tests in `tests/lib/rng.test.ts` for edge cases in `sampleItemsExcluding` and `sampleItems`.
- [x] Run full test suite for affected areas: vitest on `tests/lib/rng.test.ts`, `tests/lib/run-rng.test.ts`, `tests/architecture/rng-canonical-doors.test.ts`, balance, and affected gameplay tests.
- [x] Run `npm run typecheck:all`, `npm run lint`, and `npm run check:static`.
- [x] Run `npm run docs:check` to ensure plan integrity.

## Invariants & Non-Goals

- **Preserve gameplay draws**: Do not change the PRNG algorithms (SplitMix32 for `createSeededRng`, MurmurHash3 mix for run streams), salts, constants, or Fisher-Yates draw order in `shuffle`/`sampleItems`. All existing run replay sequences must remain byte-for-byte identical.
- **No changes to player-visible gameplay**: Combat mechanics, reward offerings, shop catalogs, and map generation retain identical outcomes for any given seed.
