---
status: complete
updated: 2026-09-07
---

# Asset cache integrity and simplification

## Objective and approval boundary

Make asset preparation reliably detect changed source content and report filesystem failures, while simplifying the shared cache used by art, sound, and music. Approved and completed on 2026-09-07.

No intended changes to asset selection, image dimensions or quality, sound normalization, music, preload behavior, or game rules. If regeneration reveals differences in actual media, inspect and explain them before accepting any significant player-visible change. No dependency or tech-stack change is justified by these findings.

## Random selection and investigation scope

Selected with `Math.floor(Math.random() * sections.length)` from the repository's context categories, in this order: battle, card, ui, audio, tooltip, gear, rewards, shop, save, run-state, assets, tooling. The draw was `0.8415313072968689`, index `10`: assets.

Read the asset workflow owner, the shared cache, its three optimizer consumers, preparation checking, nearest tests, and focused history. Existing checkout changes were inspected; the cache and optimizer files had no existing edits. Stop exploration here: the two reproduced defects below provide sufficient implementation scope.

## Findings

### 1. File metadata can conceal changed source content

In [asset-manifest-cache.mjs](../../../scripts/lib/asset-manifest-cache.mjs), `resolveSourceHash()` trusts a stored content hash when source size, modification time, and settings signature match. `isOutputFresh()` then validates the old output against that reused hash. Restoring timestamps on a same-size source replacement can therefore leave old art or audio accepted as current.

A temporary-file reproduction using the actual exported helpers:

1. Write source `AAAA`, set its timestamp to a fixed date, and create a cached output.
2. Replace the source with `BBBB` and restore the same timestamp.
3. Resolve the source hash with the stored entry and check output freshness.

Observed: the old source hash was reused, it disagreed with a direct content hash of the new bytes, and the old output was accepted as fresh. This was a helper-level reproduction; no production media was changed and a full optimizer reproduction has not yet been run.

The current tests cover changed size and changed settings, but not changed bytes with both size and timestamp preserved. The test titled “skips re-hashing” checks result equality rather than observing filesystem reads.

The metadata shortcut also adds complexity to committed manifests. `processManifestEntries()` deliberately retains old timestamps to keep fresh checkouts from dirtying those manifests. When local timestamps differ, repeated runs keep reading source bytes because the old fingerprint remains committed. This behavior follows directly from the code and its timestamp-preservation test; its runtime cost has not been measured.

### 2. Cache and cleanup helpers suppress real filesystem failures

`loadManifest()` catches all read and parse errors and returns an empty manifest. `removeOrphanOutputs()` catches every directory-read error and returns zero removals. `pathExists()` similarly turns every access error into “missing,” followed by a separate output read if access succeeds.

Temporary-file reproductions with the actual helpers confirmed:

- A directory supplied as the manifest path produces `{}` instead of exposing the read failure.
- A regular file supplied as the cleanup directory produces `0` instead of exposing `ENOTDIR`.

The consequence is misleading success or an unnecessary rebuild attempt, with the useful original error lost. Source discovery already propagates filesystem errors, so these output-side helpers are inconsistent with the surrounding pipeline. Permission and I/O failures follow the same catch branches but were not independently reproduced.

## Proposed implementation

### 1. Make content the single freshness authority

- [x] Remove the timestamp/size fast path from the shared source-hash operation. Every freshness decision must use source bytes plus the existing canonical transform settings and schema salt, and verify output bytes.
- [x] Simplify persisted entries to content hash, output hash, and optional sound ownership. Remove the redundant settings signature, filesystem metadata, and old-fingerprint preservation branch.
- [x] Continue reading existing object manifests and legacy string hashes. Normalize object entries to the reduced shape; entries without output hashes remain stale. Keep the existing digest algorithm and schema salt, since transformation behavior does not change.
- [x] Adapt art, music, generated sounds, curated sounds, and MP3 fallbacks to the same simplified contract. Preserve curated ownership and their role as committed source files.
- [x] Stream file bytes into the existing hash algorithm instead of holding each whole file in a buffer. Reuse a small private hashing helper for source and output hashing; preserve byte-for-byte digest compatibility. Retain current bounded worker concurrency.
- [x] Regenerate the three hash manifests once through their pipeline owners. Expected committed changes are removed metadata fields, with identical content/output hashes. Unchanged media should not be re-encoded just to migrate cache metadata.

The tradeoff is additional source reads on machines where the old metadata shortcut currently hits. The raw asset tree occupies about 2.5 GB locally, including files that may not be active inputs. Measure actual selected-input bytes and warm preparation time before and after, plus peak memory where practical. Do not claim a speed improvement without measurements. Prefer this deterministic implementation over adding a second local cache, watcher, or strict-versus-fast mode.

### 2. Handle expected absence separately from operational errors

- [x] In `loadManifest()`, preserve cache-miss recovery for a missing file and malformed JSON, while propagating read errors such as permission failures, invalid path types, and I/O errors with their original code and path.
- [x] Replace the access-then-read freshness check with a single output-hash read. Treat `ENOENT` as stale; propagate other errors. This also removes the redundant filesystem access.
- [x] In orphan cleanup, tolerate an absent output directory only as an explicit no-op; propagate other directory-read errors. Keep deletion failures visible.
- [x] Verify these errors reach the existing pipeline failure handling. Preserve the established rule that failed processing skips manifest publication and orphan deletion, and that started workers settle before preparation checking restores files.

Cleanup currently runs after manifest publication. This proposal makes cleanup failures visible; it does not promise transactional rollback for the standalone optimizers or introduce a new transaction framework.

### 3. Add focused regression coverage and update the owner

- [x] Replace metadata-policy tests with behavioral tests: same-size/same-time byte replacement invalidates the cache; timestamp-only changes do not dirty a manifest; settings/schema changes invalidate; output corruption is detected.
- [x] Cover reading and normalizing old manifests, deterministic repeated writes, and preserving generated/curated sound ownership.
- [x] Use small temporary-file fixtures for real wrong-path-type failures. Use targeted error injection for permission/I/O errors so tests are portable and do not depend on the process user.
- [x] Cover missing versus unreadable manifest/output/cleanup paths, malformed JSON recovery, and preservation of the original error.
- [x] Extend the existing optimizer fixture tests with a same-time/same-size source replacement and a failure that verifies publication/cleanup are skipped. Reuse current mocked converters; no large-media unit fixtures or additional browser tests.
- [x] Keep the current preparation restoration and worker-settlement tests passing.
- [x] Update [WORKFLOWS-ASSETS.md](../../WORKFLOWS-ASSETS.md) with content-based freshness, the one-time metadata migration, and explicit filesystem-error behavior. Resolve the corresponding active friction entry after implementation.

## Verification and acceptance

- [x] First establish the relevant existing cache/optimizer/preparation test baseline and capture the current warm preparation timing in an isolated fixture or checkout so unrelated work is preserved.
- [x] Run focused regressions during implementation, then `npm run check -- <all task-owned paths>` using the verifier skill. Include cache helpers, all changed optimizer consumers/tests, manifests, and documentation in that scope. The route adds the required tooling/static checks and prepared-asset validation.
- [x] Run the full asset preparation after the intended manifest migration and `npm run assets:check`; a second unchanged run must leave manifests and media byte-identical.
- [x] Compare generated media hashes and review any real media differences individually. Report measured timing/memory changes and any remaining limitation.
- [x] Approval acceptance: changed source bytes cannot be hidden by timestamps, operational filesystem failures are actionable, manifests contain no machine-specific metadata, unchanged transforms retain their outputs, and no intended player-facing behavior changes.

Implementation is complete; archive this plan through the repository's explicit plan workflow.

## Implementation evidence

- Baseline: all 46 focused cache/optimizer/preparation tests passed. Used the existing restoration-based `assets:check` in the shared checkout to measure preparation without changing outputs, rather than creating an isolated checkout.
- Regression run: all 62 tests across the same five files passed, including digest compatibility across stream chunks, timestamp-preserving replacement in all media pipelines, old-manifest migration without conversions, and filesystem errors.
- Actual unique authoring inputs: 398 files, 669,199,547 bytes (about 638 MiB), including curated OGG sources. Fallback derivation also reads generated OGG outputs.
- Baseline versus updated warm `assets:check`, one local sample each: 0.55 s / 277,397,504 bytes maximum resident memory versus 0.76 s / 330,661,888 bytes. These include output snapshots and npm overhead, are not a stable benchmark, and show no overall speed or memory improvement. The correctness tradeoff is approximately 0.21 s in these samples. Streaming bounds individual file buffers; it does not guarantee lower process RSS.
- Full preparation migrated 450 entries across three manifests. All content hashes, output hashes, and sound ownership values remained identical; 453 other output/barrel/metadata files were byte-identical. The subsequent `assets:check` passed without mutations.

- Full task-scoped handoff gate passed: `check-20260907t193656z-58120-e938c5`, including changed-path verification, CI static checks, web build, and preview smoke. No code or asset changes were needed after the passing gate.
