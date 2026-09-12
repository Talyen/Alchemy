---
status: complete
updated: 2026-09-11
implementation: c2d06be6
---

# Asset cache integrity

## Decision and rationale

Implemented in `c2d06be6`. Asset freshness hashes source bytes with transform
settings and verifies output bytes. Size and timestamp shortcuts could conceal
same-size source replacements; removing them also removed machine-specific
manifest metadata. Streaming bounds individual file buffers without adding a
second cache or changing media transforms.

Missing or malformed cache manifests remain cache misses. Other filesystem
failures retain their code and path. Processing failures preserve the previous
manifest and skip orphan deletion; workers settle before prepared-output checks
restore files. Standalone cleanup after publication does not promise rollback.
The [asset workflow](../../WORKFLOWS-ASSETS.md#content-freshness-and-filesystem-failures)
owns the current contract.

## Compatibility

Digest algorithms, schema salt, media selection, dimensions, quality, and sound
normalization were unchanged. Existing object manifests normalize to content
hash, output hash, and optional sound ownership. Legacy entries without output
hashes regenerate. The migration changed 450 manifest entries; all content and
output hashes and sound ownership values remained identical, and 453 other
output/barrel/metadata files were byte-identical.

## Verification recorded at implementation

The baseline passed 46 focused tests; the final five-file suite passed 62,
covering timestamp-preserving replacements in each media pipeline, digest
compatibility, old manifests, and filesystem failures. Full preparation and a
subsequent `assets:check` passed with unchanged media.

One local warm-check sample before/after took 0.55 s / 0.76 s and used
277,397,504 / 330,661,888 bytes maximum resident memory. The selected inputs were
398 files totaling 669,199,547 bytes, plus fallback reads. These observations
include snapshot and npm overhead and establish no speed or memory improvement;
the measured correctness cost was about 0.21 s.

Task-scoped handoff `check-20260907t193656z-58120-e938c5` passed related verification,
CI static checks, the web build, and preview smoke.
