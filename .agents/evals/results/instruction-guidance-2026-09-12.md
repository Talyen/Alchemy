# Instruction-guidance trials — September 12, 2026

## Decision

Retain proportional discovery, narrower Playwright/audit descriptions, and links to canonical verification/test policy instead of duplicated instructions. All eight retained coding trials completed correctly and passed their task-owned gates. This supports the observed behavior, not a universal efficiency claim: small-edit token usage increased 5.1%, while save-task usage decreased 29.8%.

The article motivating this review is [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra). Game invariants, save compatibility, existing-work preservation, completion requirements, and verification gate selection remain unchanged. Installed plugins were not modified.

## Method and measurements

This separate version-4 coding cohort pins `c20c9bee369fa33ebfc3725e23893e8ae6d17f58`. The historical task catalog and earlier results remain unchanged. The old catalog baseline predates context tooling, so it cannot test today’s discovery instructions. Each trial used a fresh detached worktree and `npm ci`; source inventories confirmed that only the six intended instruction files differed between variants. The candidate patch SHA-256 is `305489412bf351b88583f071eb8ab0568084c124ca94e48a5ee57a0f6017ff2b`.

Two trials per variant and scenario used `gpt-6-astra`, medium reasoning, ephemeral CLI sessions, `--ignore-user-config`, workspace-write sandboxing, and `ALCHEMY_VERIFY_FRESH=1`. Runs were sequential in baseline/candidate/candidate/baseline order. Small-edit trials used the default disabled sandbox networking; all retained save trials enabled networking for local gate listeners. Settings match within each scenario.

| Scenario                 | Baseline input + output | Candidate input + output | Change |
| ------------------------ | ----------------------: | -----------------------: | -----: |
| Small README edit        |                 212,001 |                  222,849 |  +5.1% |
| Additive save preference |               1,920,504 |                1,347,749 | −29.8% |

| Trial             |     Input | Cached input | Output | Tool events | Seconds |
| ----------------- | --------: | -----------: | -----: | ----------: | ------: |
| small-baseline-1  |    95,347 |       86,144 |    476 |           9 |    36.8 |
| small-candidate-1 |   102,502 |       90,496 |    554 |          12 |    34.2 |
| small-candidate-2 |   119,294 |      108,288 |    499 |           5 |    28.9 |
| small-baseline-2  |   115,682 |      106,240 |    496 |          10 |    36.0 |
| save-baseline-1   |   793,570 |      750,080 |  3,393 |          22 |   190.0 |
| save-candidate-1  |   647,504 |      606,464 |  2,836 |          19 |   154.7 |
| save-candidate-2  |   694,453 |      650,496 |  2,956 |          21 |   163.6 |
| save-baseline-2   | 1,119,951 |    1,072,896 |  3,590 |          23 |   245.9 |

Input includes cached input; output is counted once. Tool events count completed command, file-change, and MCP events. Counters come from actual host completion events. Read/discovery instrumentation was not enabled, so empty normalized event streams do not establish zero reading. Setup, parent review, independent acceptance checks, and the excluded trial are outside these counters. Durations exclude worktree creation and dependency installation.

Both candidate small-edit trials skipped the context command; both baseline trials ran it. The candidate still performed other reads and checks, so skipping one command did not lower completed-task token usage. Save candidates read the relevant ownership and migration guidance before implementation. One retained save baseline needed a formatting correction and gate rerun; that real task work is included in its cost. Two trials do not establish statistical significance, billing savings, or repository-wide improvement, and these tasks do not isolate each instruction change’s contribution.

## Acceptance and exclusions

- All four small-edit results matched the exact requested replacement with no other content changes. Each ran the README-scoped documentation/format gate.
- All four save results updated the existing settings default, field selection/codec, read/write access, schema, relevant fixtures, and compatibility documentation. Production changes were confined to the settings store, save schema, and migration documentation; schema version 18, migration code, UI, and battle rendering remained unchanged.
- Every save trial passed its complete task-owned gate, including selected unit/save/architecture suites, CI static checks, build, bundle budget, and preview smoke. Independent tests added only after each trial also passed: old active-run preservation, missing/malformed fallback to true, false round-trip through the production codec, and repeated load/save stability. These acceptance tests were removed from disposable checkouts afterward and were not added to the game suite.
- All eight trials preserved the installed instruction files and unstaged user-owned README note. No trial staged or committed changes. The note’s full pre-task README SHA-256 was `6c00b70751e2dcc588eab742dc34bc14230e232c45ec85e8ebf8be35f65ac916`; save trials retained that exact hash, and small trials matched only the requested replacement.
- An initial save baseline was stopped and excluded after its sandbox denied loopback listeners, producing tooling-test `EPERM` failures despite passing save tests. A loopback preflight passed with networking enabled before the save comparison restarted. The [evaluation guide](../README.md#fixed-setup) now records this prerequisite.

Transient evidence under `reports/agent-evals/instructions-0912/` includes the frozen candidate patch, cohort manifest and prompts, source inventories, raw host events, normalized records/comparisons, final patches and changed files, gate output, and independent acceptance tests/logs. Ephemeral checkout locations are recorded in the manifest. No evaluation implementation was integrated into the game.

## Exact requests

Each scenario received the following request plus the identical shared boundary paragraph.

### Small edit

> In the root README introduction, replace "fight 1v1 card battles" with "fight one-on-one card battles". Preserve the rest of the content.

### Save preference

> Add a persisted boolean preference named `showEnemyIntentDetails`, defaulting to true, to the existing settings store and save pipeline. Missing or malformed values restore as true; explicit false must survive saving and loading. Expose it through the existing settings read/write pattern. This task adds no settings-screen control and changes no battle rendering.

> Update the canonical schema, owning defaults, hydration/serialization and relevant fixtures together. This is a compatible additive field and must not bump the save schema version or add a migration step.

### Shared boundary

> Work only in this disposable evaluation checkout. The existing README note and any instruction-file changes are installed evaluation inputs: preserve them and leave them unstaged. Complete the requested edit and applicable task-owned verification. Do not commit, stash, revert, change branches, launch other agents, browse the web, or modify files outside this checkout. Do not modify agent instructions or evaluation records. Give a concise report of the result, checks actually run, and remaining limitations.
