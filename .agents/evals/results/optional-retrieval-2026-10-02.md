# Optional retrieval trials — October 2, 2026

## Decision

Retain the requested focused discovery categories, location-only lookup and selected-first diff preview as optional retrieval capabilities. Remove the added startup hint from AGENTS.md: the complete-task trials do not support a token-savings claim. Smaller individual responses are useful retrieval evidence, not proof of cheaper investigations. Large source/test files remain intact because the available reading evidence does not justify splitting them.

The evaluated candidate included that startup hint. Its removal from the final implementation is a subsequent procedural simplification, not a separately measured improvement. Ordinary work still starts with sufficient direct reads and scoped searches; no discovery setup is required.

## Matched setup

Base: `3197567323b80bbd63cbbfe5d301f70a812d59f5` with one frozen working-tree patch and untracked archive. Both disposable checkouts used the same source snapshot and pinned dependencies (`npm ci --ignore-scripts`). Full source inventories differed only in the 11 intended candidate paths and remained unchanged after every investigation.

Two ephemeral CLI trials per variant and scenario used `gpt-6.1-sol`, high reasoning, `--ignore-user-config`, explicit model/effort flags, workspace-write sandboxing, identical prompts, and context-session reset between trials. Order was baseline/candidate/candidate/baseline. These eight investigations ran no test or completion gate. Source confirmation and existing-work preservation were required for acceptance.

The dirty-checkout scenario contained the same intentional reversed `clamp` expression in both disposable copies. The primary checkout was never given that defect. The historical coding-task catalog is unchanged; these are version-5 investigation records.

## Results

| Scenario                     | Baseline input + output | Candidate input + output | Change |
| ---------------------------- | ----------------------: | -----------------------: | -----: |
| Music transitions            |                 361,574 |                  513,170 | +41.9% |
| Scoped dirty-checkout review |                 398,518 |                  426,484 |  +7.0% |

| Trial                  |   Input | Cached input | Output | Tool calls | Seconds |
| ---------------------- | ------: | -----------: | -----: | ---------: | ------: |
| music-baseline-1       | 209,603 |      163,328 |  2,429 |         14 |   103.8 |
| music-candidate-1      | 223,005 |      175,488 |  2,294 |         14 |    93.8 |
| music-candidate-2      | 285,248 |      234,624 |  2,623 |         17 |   110.0 |
| music-baseline-2       | 147,271 |      111,104 |  2,271 |         10 |    99.2 |
| dirty-diff-baseline-1  | 197,854 |      171,392 |  1,616 |         11 |    74.9 |
| dirty-diff-candidate-1 | 202,601 |      181,248 |  1,113 |         12 |    61.7 |
| dirty-diff-candidate-2 | 221,557 |      196,480 |  1,213 |          9 |    67.2 |
| dirty-diff-baseline-2  | 197,638 |      161,664 |  1,410 |         11 |    72.7 |

Input includes cached input; output is counted once. Counters come from actual CLI completion events. Tool calls count completed command/tool events. Source/read-event instrumentation was not enabled, so zero observed reads in normalized records means unobserved reading, not no reading. Parent preparation, implementation, acceptance review and handoff checks are outside these counters.

All eight answers were accepted against the frozen implementation. Music answers correctly distinguished initialization recovery from a later rejected play, active/pending invalidation, pause/resume, timer ownership, and volume/host rules. Diff answers identified the reversed clamp, a concrete input, a reachable combat consumer, and the original-expression correction.

Two trials per variant are limited observations, not statistical significance or repository-wide, billing, allowance, or final-prompt savings. Music candidate pairs increased total usage by about 6.3% and 92.5%; diff candidate pairs increased it by about 2.1% and 11.9%. The scoped-diff candidate was faster in these samples, while token usage still increased.

## Retrieval evidence

| Same selected path          | Baseline emitted bytes | Candidate emitted bytes |
| --------------------------- | ---------------------: | ----------------------: |
| Music                       |                 11,242 |                   7,843 |
| Sound effects               |                  8,042 |                   4,954 |
| Preload                     |                  8,042 |                   3,668 |
| End Turn                    |                 10,561 |                   5,292 |
| Run command                 |                 10,465 |                   6,496 |
| Verification implementation |                 11,675 |                   6,428 |

These byte counts exclude always-loaded instructions. A music location-only lookup emitted 1,159 bytes for six owner locations and no section contents. The frozen scoped-diff preview fell from 11,920 to 1,117 bytes: the old preview omitted the selected patch; the new preview included it. Both retained complete inventories and selected patches in their reports. Regression tests cover unread location/session handling, bounded output, mixed and explicit broad owner selection, unchanged verification, and inventory preservation.

## Exclusions and reproducibility

The initial unpinned cohort was excluded after global reasoning changed from xhigh to high during the run. Its apparently lower token totals must not inform adoption. The corrected cohort pins model/effort in each invocation and ignores mutable user configuration; the evaluation guide now owns that prevention.

Frozen baseline patch SHA-256: `8b1e08fec47d6a46461926283a5a80c9fae89a54e1979e3a9494fb2be29f6274`.
Evaluated candidate patch SHA-256: `21e18105dc68ca4a230bcf639e17e187a6e1c50f9759721fbff87ef770382958`.

Transient evidence under `reports/agent-evals/token-efficiency-1002/` includes prompts, frozen patches, untracked source archive, inventory hashes, raw CLI events, accepted answers, normalized records, paired comparisons, byte measurements, and the separately retained excluded cohort. Full-task results evaluate the combined candidate, not each individual feature.
