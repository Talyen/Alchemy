# Retrieval follow-up trials — October 2, 2026

## Decision

The initial implementation added compact status, review checkpoints, richer failure
summaries, focused damage/browser-fixture lookup and shorter root guidance.
The trials below evaluate that implementation and demonstrate no reliable
whole-task token savings.

After reviewing these results, the user authorized removing review checkpoints
and the added failure-summary layer. Their runtime modules, flags, buffer-only
Git support and feature-specific tests were retired; existing bounded diagnostics,
complete diff review and full-log preservation remain. Compact status, shorter
root guidance and optional focused lookup are retained. No further categories or
startup steps are added, and the original measurements and exclusions stay intact.
The tables do not evaluate the final retained set.

## Matched setup

Base: `3197567323b80bbd63cbbfe5d301f70a812d59f5`, plus one frozen working-tree patch and untracked
archive. Baseline patch SHA-256: `83129ceac748e4605182655013aa9ac9e3081406a942529745c311a37984b64a`; untracked archive
SHA-256: `8f4a59936dad9510f3fad4753972d89092f154568a8383f99e28c64ed178444e`. Separate disposable checkouts differed only in
the recorded candidate paths before identical scenario fixtures were seeded.
Primary-checkout source was never used as an evaluation workspace.

Twenty retained read-only investigations used `gpt-6.1-sol`, high reasoning,
`codex-cli 0.159.2`, `--ephemeral`, `--ignore-user-config`, workspace-write sandboxing
with tool-network access disabled, and identical prompts/tool availability.
Each feature ran baseline/candidate/candidate/baseline, with two trials per variant.
Pinned dependencies were installed once with `npm ci --ignore-scripts --no-audit --no-fund`; candidates shared that immutable dependency tree through ignored
package symlinks. Context-session state was cleared between trials.

Status and checkpoint variants include the same diff/checkpoint module dependency;
only the requested operation was investigated. The failure variant changes only
the diagnostic formatter. Routing changes only damage/browser-fixture selection
and the browser execution-policy heading. Instruction changes only `AGENTS.md`.
The coding-task catalog is unchanged; these are version-6 investigation records.
No participant ran tests, builds or implementation gates.

## Results

Input includes cached input; output is counted once. Values below sum the two
trials for each variant. Negative change means less observed usage.

| Investigation           | Baseline input + output | Candidate input + output | Change | Tool calls | Seconds       |
| ----------------------- | ----------------------: | -----------------------: | -----: | ---------- | ------------- |
| Scoped status           |                 159,140 |                  120,537 | -24.3% | 24 → 15    | 78.3 → 65.3   |
| Incremental review      |                 208,363 |                  227,303 |  +9.1% | 11 → 15    | 94.5 → 113.2  |
| Failure diagnosis       |                 176,387 |                  199,446 | +13.1% | 18 → 17    | 89.1 → 100.7  |
| Damage investigation    |                 568,620 |                  592,460 |  +4.2% | 39 → 33    | 230.9 → 248.4 |
| Save-rule investigation |                 418,003 |                  421,649 |  +0.9% | 23 → 17    | 175.3 → 168.8 |

The status participants used direct Git commands in every trial; none adopted
`review:status`. Its lower totals cannot be attributed to the new helper.
Checkpoint participants also used direct snapshot comparisons in every trial;
none adopted `--since`. Command adoption is retained in the local evidence. Smaller available output
and fewer tool calls do not establish a causal improvement. Two trials per variant
are limited observations, not statistical significance, billing or allowance
savings, repository-wide efficiency, or final-prompt savings.

The failure scenario uses a simulated unit log with an intentionally wrong test
expectation. Damage results apply only to that investigation; browser-fixture
retrieval has regression and byte evidence, not a matched whole-task result.
Source/read-event capture was not enabled: empty normalized event streams mean
unobserved reading, not zero reading or repetition. Parent implementation,
preparation, review and verification are outside these counters.

| Trial                    |   Input | Cached input | Output | Tool calls | Seconds |
| ------------------------ | ------: | -----------: | -----: | ---------: | ------: |
| status-baseline-1        |  89,025 |       77,696 |    808 |         14 |    41.4 |
| status-baseline-2        |  68,667 |       58,624 |    640 |         10 |    36.9 |
| status-candidate-1       |  68,829 |       58,240 |    864 |         13 |    39.0 |
| status-candidate-2       |  50,326 |       45,056 |    518 |          2 |    26.3 |
| checkpoint-baseline-1    |  98,056 |       68,480 |  1,166 |          6 |    47.5 |
| checkpoint-baseline-2    | 107,964 |       86,784 |  1,177 |          5 |    47.0 |
| checkpoint-candidate-1   | 131,328 |      111,232 |  1,621 |         10 |    65.0 |
| checkpoint-candidate-2   |  93,136 |       76,288 |  1,218 |          5 |    48.2 |
| failure-baseline-1       |  97,747 |       71,552 |    600 |          9 |    44.4 |
| failure-baseline-2       |  77,202 |       67,968 |    838 |          9 |    44.7 |
| failure-candidate-1      |  95,439 |       82,048 |    701 |          9 |    52.6 |
| failure-candidate-2      | 102,690 |       87,040 |    616 |          8 |    48.1 |
| routing-baseline-1       | 325,919 |      264,704 |  2,687 |         17 |   120.1 |
| routing-baseline-2       | 236,932 |      172,928 |  3,082 |         22 |   110.8 |
| routing-candidate-1      | 358,238 |      304,640 |  3,441 |         16 |   125.3 |
| routing-candidate-2      | 227,656 |      179,968 |  3,125 |         17 |   123.1 |
| instructions-baseline-1  | 214,108 |      176,640 |  2,514 |         13 |    93.2 |
| instructions-baseline-2  | 199,308 |      160,128 |  2,073 |         10 |    82.1 |
| instructions-candidate-1 | 262,106 |      222,592 |  2,441 |          8 |    89.1 |
| instructions-candidate-2 | 154,830 |      119,808 |  2,272 |          9 |    79.7 |

## Acceptance and retrieval evidence

Every retained answer passed manual source-based acceptance and preserved its
working-tree/index state. Status answers retained rename sources, deletions,
untracked files and a staged edit reversed in the working file. Checkpoint answers
identified exactly one index edit and two subsequent working-file edits, excluding
the earlier rename/deletion. Diagnostic answers identified the working value,
smallest expectation correction and exact focused unit command. Damage answers
preserved staged rounding, source-specific hit recipes and RNG constraints.
Save-rule answers identified schema/default/codec/fixture ownership, false-preserving
fallbacks, additive migration policy and the resource-light local gate.

The compact status default is 4 KB, with complete inventories retained on disk.
The evaluated snapshot implementation retained index and working contents
separately without Git writes, rejected scope widening and unsupported states,
and required complete final review. It has since been removed.
Initial operation probes emitted about 6.6 KB for damage and 6.0 KB for browser
fixtures versus 10.9 KB and 11.9 KB for their broad selections. These are retrieval
proxies from the same sources, not agent-token measurements. Shared guidance was
subsequently revised concurrently and preserved in the final checkout.

Implementation checks: 137 tests in 10 focused tooling suites passed; scoped
ESLint, documentation contracts, `git diff --check`, and the explicit task-owned
local `check` passed. Local validation is not full CI evidence. No tests were
retired for this task.

## Exclusions and reproduction

Four initial checkpoint trials are excluded in full: fallback review directories
omitted delete.ts from the index snapshot even though its working file was absent.
That incomplete baseline evidence caused a false subsequent-change report. Both
variants were rerun from fresh checkouts with complete independent layer snapshots.
The excluded counters do not contribute to the tables.

An initial routing candidate copy contained concurrent classification edits without
its newly referenced owner heading. It was reconstructed from frozen originals plus
only this task's intended routing changes; catalog validation passed before any
routing trial. Early setup failures involving the host Python archive API and source
inventory comparison occurred before trials and contribute no usage evidence.

Candidate runtime/instruction content hashes (ordered path names plus file bytes):

- Scoped status: `f816b3ae3191ed2eb0844dba5d3538398687168f6ac81d773d35cbc3025d6647`; candidate patch SHA-256 `130507213a98e03537d655e078089dfb09b0a783c0ee5496b3330280db9fa95e`.
- Incremental review: `f0d8ee5f54984b56d54d3cf68de55e10eb353dd09e4e768fdd6bb6de369811db`; candidate patch SHA-256 `9f0a920c7b158d95c0f9c193ff7ca12a20223f2921619dd8435161955674eb7a`.
- Failure diagnosis: `1cad5f72f89c78a92f554e2ab15d5bb746428c5097227cfa5f7e2c6234bbb99d`; candidate patch SHA-256 `fc736c0df4c5624e038b57ac6dedbd75042d46ac51387a41ea79aa3e784e307b`.
- Damage investigation: `a1225a534d8bfdd8774de104c84eb06a1bcd7bd08e3c5414bf02652bd04d72d7`; candidate patch SHA-256 `de7bf981a49a1abddaa9e679bc0e8a7f77798e2f6d2f73a25a8696056794c4d0`.
- Save-rule investigation: `635c4d615bee2a1a6fc5882164501eaeed7fb771164e2a1dfa257ed91c81ad5c`; candidate patch SHA-256 `16d3d2bd4546fb859cad0ed60087baff46677db17c6c6fda1feee544b3ee28d0`.

Transient evidence under `reports/agent-evals/efficiency-followup-1002/` includes
frozen patches/archive, setup scripts, manifests, exact requests, CLI events,
accepted answers, normalized records, per-pair comparisons, adoption counts,
totals and excluded trials. The baseline/candidate sources were checked for drift
around every trial. Preserve this summary when transient artifacts are pruned.
