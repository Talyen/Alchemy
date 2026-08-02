# Dual-Path & Compatibility Retention Audit

**Goal:** Delete confirmed parallel live implementations, migration shims past their window, and “keep both” leftovers that still compile and remain reachable — the over-engineering that is neither unused nor single-path ceremony.

## Intent

Confirm two reachable paths for one behavior (or a reachable shim that only forwards to the surviving owner) and remove the complete superseded path. Once confirmed, inspect its connected callers, tests, docs, configuration, flags, adapters, selectors, commands, and generated inputs. A successful fix reports authored LOC, declarations, branches, configuration, or exported API removed by deleting the superseded path — not by wrapping it again. A clean pass is valid. Planning and phasing: [README.md](README.md).

## What counts as dual-path retention

| Tell                                                                                                              | Why it is a finding candidate                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Forwarding wrapper or rename-only type alias still imported beside the real owner                                 | Extra name preserves a deleted API surface                                                                   |
| Barrel dual-export of old and new names after callers moved                                                       | Side-by-side re-exports keep both names live with no unique behavior                                         |
| Feature API on a hub that duplicates a facade / controller / `src/lib` method                                     | Callers can use either; hubs and owners drift                                                                |
| Migration / legacy bridge still on hot paths after the consumer window is closed                                  | Temporary compatibility became permanent surface                                                             |
| Parallel implementations of the same rule or presentation after a refactor                                        | “Keep both for safety” without a remaining distinct consumer                                                 |
| Deprecated entry that only exists to call the new entry                                                           | Reachable twin with no unique behavior                                                                       |
| Permanent feature-flag or build-time switch that still ships both implementations of one behavior indefinitely    | Loser path has no remaining distinct consumer — temporary rollout flags with an open window are not findings |
| Parallel configuration, command, event, adapter, selector, or test-harness paths select the same product behavior | The alternate route keeps implementation and verification policy duplicated                                  |

**Not this audit:** zero live consumers → `DeadCodeAudit.md`; single intentional entry that is noun theater / ceremony with no second product path → `InelegantSlopAudit.md`; wrong owner (with or without a twin) → `StateGravityOwnershipAudit.md` (move, then delete the old path); duplicate product screens / shells → `DuplicateFeatureSurfaceAudit.md`; twin kept reachable only by test scaffolding → `UnitTestAudit.md` / `E2ETestQualityAudit.md` (this audit still owns product-reachable twins; retarget tests after delete); live mass / mixed jobs on a single path → `InelegantSlopAudit.md`; async races / effect lifetime → `AsyncRaceAudit.md`. Intentional dual seams are listed under Hard stops — leave them alone.

**Shim vs Slop:** this audit owns a reachable twin or reachable no-op shim where callers can retarget to the real owner and delete the shim/name. `InelegantSlopAudit.md` owns a single intentional entry that is ceremony without a second product path to collapse.

## Hard stops

- Do not collapse intentional dual seams listed in [ARCHITECTURE.md](../ARCHITECTURE.md) or sibling audits (battle RNG injection, persistence write coalescing, options/display prefs vs the versioned player-save envelope, authored catalogs vs `assets.generated.ts` / `metadata.generated.ts`, Vite web vs Electron desktop entries, facade-only feature access to run domain).
- Do not delete a migration path while save, resume, or legacy-fixture clients still require the old shape — confirm the consumer window is closed first (`MIGRATIONS.md`, `tests/fixtures/legacy-saves.ts`, migration contract/guard tests). Deprecation comments or “enough time has passed” alone do not close a window.
- Do not rewrite battle pipeline math or save wire format under this audit; prove equivalence via existing `src/lib` / storage owners when a dual rule path is confirmed.
- Do not demote or delete barrel / knip-allowlisted exports that are intentional cross-folder contracts without the same consumer inventory `DeadCodeAudit.md` requires.
- Prefer the owning audit when the hit is primarily unused, ceremony-only (no twin), ownership drift (with or without a twin), duplicate UI, test-portfolio fit, authored mass on a single path, or async isolation.

## Evidence bar

Either:

- **Two reachable paths** for one behavior (both compile-time referenced from product or tests), with one path able to absorb callers; or
- **Reachable no-op shim:** the shim / deprecated entry still has live references (product, tests, or exported API) but adds no unique behavior beyond forwarding to the surviving owner; callers can be retargeted and the shim deleted

Plus a delete-one-path remedy that preserves behavior. Speculative “might need later” is not evidence.

For migration / legacy-bridge tells, also confirm the consumer window is closed: repository-supported save/version policy plus inventory shows no remaining save / resume / schema / fixture consumer of the old shape, or persistence docs mark the bridge obsolete. External telemetry is not implicitly required when repository policy defines the supported window. Speculative “enough time has passed” is not evidence.

`DeadCodeAudit.md` owns symbols with **zero** live consumers. This audit owns reachable twins or reachable no-op shims.

## Remedy preference

Prefer delete the superseded path → retarget callers to the surviving owner → remove forwarding wrappers and rename-only type aliases → demote or delete leftover barrel exports → remove path-specific tests, docs, flags, configuration, and commands. Do not leave a pass-through “for compatibility” after callers move. Bounded structural deletion may ship under [README.md](README.md); uncertain ownership or new seams remain proposals.

## Domain rules

When neither path is marked deprecated, choose the survivor in this order:

1. Architecture / facade / `src/lib` owner over a hub twin
2. Path with unique behavior over a pure forwarder
3. Newer entry only after those; call-site count is a last tie-break, not ownership

Correct owner with leftover twin / shim → this audit; wrong owner with leftover twin → `StateGravityOwnershipAudit.md`.

Successful fixes leave a single owner for the behavior and a net surface reduction.

## Known signals

Optional discovery aids — choose your own probes.

- **Deprecated / compat names:** `legacy`, `compat`, `deprecated`, `shim`, `bridge`, `v1`/`old` suffixes still imported beside a newer owner.
- **Barrel dual-exports:** old and new names re-exported side by side after callers moved to one owner.
- **Parallel rule paths:** two `src/lib` or feature helpers implementing the same battle, gear, or save rule with overlapping callers.
- **Hub + owner twins:** feature methods on `run-domain-store` / controllers that only forward to facade or `src/lib` owners already used elsewhere.
- **Closed migration windows:** inventory via [MIGRATIONS.md](../../src/features/alchemy/shared/storage/MIGRATIONS.md), `tests/fixtures/legacy-saves.ts`, `CURRENT_SAVE_SCHEMA_VERSION`, and migration contract/guard tests — one-shot `localStorage` shims, renamed save fields, or alias re-exports retained after those consumers no longer need the old shape.
- **Flagged dual implementations:** env / Vite / Electron switches that still compile and ship both branches of one behavior indefinitely (open temporary rollout windows are not findings).
- **Parallel infrastructure routes:** duplicate configuration, commands, events, adapters, selectors, or test harness entrypoints that reach the same behavior without distinct consumers.
