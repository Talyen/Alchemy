# Repository efficiency trials — October 2, 2026

## Decision and implemented scope

Implement the six requested improvements as scoped navigation, reuse and enforcement changes. Keep retrieval optional; these trials do not establish reliable whole-task token savings. No additional startup procedure or mandatory measurement is introduced.

- Put a short need-to-command table first in [Agent Discovery](../../../Docs/AGENT_DISCOVERY.md#choose-a-command), with advanced controls below.
- Extend `--related` with direct implementation dependencies and imported test support whose filename need not say fixture. Tests remain ranked by static consumer distance; hints are bounded and are not coverage selection.
- Give card classification its own canonical section and focused discovery category. Mixed work and explicit broad requests retain the broader battle owner. Browser context retains local execution policy and points to manual commands instead of loading them routinely.
- Consolidate browser helper names, owners and behavior in the existing [bootstrap contract](../../../tests/e2e/README.md#navigation-and-bootstrap), rather than add a second helper catalog.
- Remove repeated save-baseline, browser-coverage and hit-order prose while retaining canonical rules. Close literal computed `Math["random"]` and non-rounding-call lint gaps. Compose seeded-RNG and nested-dispatch policies for overlapping run/navigation paths; later flat-config blocks had overwritten RNG enforcement. Redirect obsolete lint knowledge links to canonical owners.
- Evaluate helper discovery and classification independently against one frozen source snapshot, using actual host counters and source-based acceptance.

No gameplay implementation, dependencies, verification selection or core safeguards were removed. The selector-shape test was replaced by behavioral checks of dot/computed access and effective flat configuration, including preservation of nested-dispatch protection.

## Matched setup

Base: `3197567323b80bbd63cbbfe5d301f70a812d59f5`, overlaid with one frozen working-tree snapshot and untracked archive. Each of three detached disposable checkouts installed the pinned lockfile with `npm ci --ignore-scripts`. Source inventories matched except for the exact intended candidate paths and remained unchanged after every investigation.

Helper candidate: `scripts/lib/agent/agent-discovery.mjs`, `scripts/lib/agent/agent-discovery.d.mts`, `scripts/agent-context.mjs`, and `tests/scripts/agent-discovery.test.ts`.

Classification candidate: `Docs/GAME_RULES.md`, `scripts/lib/agent/agent-context.mjs`, and `tests/scripts/agent-context.test.ts`. The browser routing change was excluded from this candidate.

Each scenario ran baseline/candidate/candidate/baseline with `gpt-6.1-sol`, high reasoning, `codex-cli 0.159.2`, explicit model/effort flags, `--ignore-user-config`, ephemeral sessions and workspace-write sandboxing. No network-dependent investigation, source edits, tests or completion gates were requested or executed. Context-session state reset between trials. Outcomes and acceptance criteria were kept separate; discovery was optional in identical prompts. These are version-6 read-only investigation records; the coding-task catalog remains unchanged.

Other command-navigation, browser-documentation and lint changes were source-reviewed and checked independently. They are outside these token comparisons. Final formatting and preservation of the existing fixture-name heuristic after snapshot creation are compatibility corrections, not separately measured improvements.

Frozen baseline patch SHA-256: `8679a51059b83b713f9921e0eea6d6d9c2641603bd3b0507620e8dc84458c09c`.
Helper candidate patch SHA-256: `aa11283f99312290a7d189744b414a0d8ab48650288d6a15766ac14c45eb2b22`.
Classification candidate patch SHA-256: `41c2659020a29ac60fc75f4c197e03ca0a9608b8476220e055c543be1c0e6b89`.
Untracked archive SHA-256: `2ff05d89702147f42a52edeb9c3096550c719a65a78c2bc84968b5ba523494ee`.

## Results

| Scenario       | Baseline input + output | Candidate input + output | Change | Calls baseline / candidate | Seconds baseline / candidate |
| -------------- | ----------------------: | -----------------------: | -----: | -------------------------: | ---------------------------: |
| related        |                 735,238 |                  703,561 |  -4.3% |                    38 / 40 |                249.0 / 270.6 |
| classification |                 631,716 |                  763,241 | +20.8% |                    30 / 22 |                264.2 / 256.1 |

| Trial                      |   Input | Cached input | Output | Tool calls | Seconds |
| -------------------------- | ------: | -----------: | -----: | ---------: | ------: |
| related-baseline-1         | 416,349 |      363,776 |  2,844 |         19 |   131.2 |
| related-candidate-1        | 304,746 |      227,712 |  3,171 |         23 |   141.8 |
| related-candidate-2        | 392,800 |      337,792 |  2,844 |         17 |   128.8 |
| related-baseline-2         | 312,930 |      258,688 |  3,115 |         19 |   117.8 |
| classification-baseline-1  | 281,775 |      228,992 |  3,807 |         11 |   145.2 |
| classification-candidate-1 | 454,790 |      401,408 |  3,605 |         11 |   140.4 |
| classification-candidate-2 | 301,632 |      252,928 |  3,214 |         11 |   115.7 |
| classification-baseline-2  | 343,133 |      286,976 |  3,001 |         19 |   119.0 |

All eight answers passed source-based acceptance. Music answers distinguished initial rejection, later rejected playback and constructor failure; identified retry/volume/host/invalidation owners; and located existing regressions and shared audio setup. Classification answers identified recursive branch/repeat queries, tags versus attacks, effect-identity caching, consumers, regressions, concrete examples and engine invariants.

Input includes cached input; output is counted once. Counters come from real CLI completion events. Preparation, implementation, acceptance review and handoff checks are outside these totals. Per-source read instrumentation was not enabled.

Helper pair changes were opposite in direction. Both candidate investigations used the optional related lookup; neither baseline did. Uncached input increased from 106,815 to 132,042; calls and elapsed time also increased. The summed token reduction is not consistent savings or a billing-cost result.

Classification pair changes also differed in direction. Neither candidate invoked the new focused lookup; one baseline used location lookup for other effect modules. Thus this cohort does not directly establish completed-task effectiveness of the focused retrieval route. Uncached input decreased from 108,940 to 102,086, while total input-plus-output increased. Cached-input variation, two trials per variant and optional tool uptake prevent reliable repository-wide conclusions.

## Retrieval evidence and validation

| Lookup                   | Baseline emitted bytes | Final emitted bytes |
| ------------------------ | ---------------------: | ------------------: |
| Card-classification path |                 10,894 |               2,704 |
| Browser-spec path        |                 11,738 |               8,985 |

These bytes exclude always-loaded instructions and measure retrieval output, not completed-task tokens. Classification retains state/RNG guidance and its own rules; browser guidance retains execution permission and a pointer to invocation details. Helper hints can add output and should be used when they replace searches.

The three focused tooling suites passed 63 tests. Scoped ESLint, documentation contracts and the implementation handoff passed; the local check was `check-20261002t171849z-50958-ac3ce3`. Full static, browser, build and remote CI validation were not run. No material test protection was retired.

Transient reproduction evidence under `reports/agent-evals/token-efficiency-next-1002/` includes frozen patches, untracked archive, source inventories, prompts, raw CLI events, accepted answers, normalized records, uptake and byte measurements. Disposable checkouts are removed after retaining this evidence. This result document preserves interpretation and counters when transient reports are pruned.
