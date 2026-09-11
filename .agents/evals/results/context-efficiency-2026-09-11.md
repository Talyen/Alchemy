# Context-efficiency trials — September 11, 2026

## Method

Base: `55999675d6389e9637299b8d212f597f02d7efb3`. This is a separate version-2 investigation cohort; the existing pinned coding-task catalog remains unchanged. Two independent trials per variant and scenario used the same exact request, installed dependencies (`npm ci`), configured model (`gpt-6-astra`, medium reasoning), and tools. Each candidate isolated the relevant workflow change. Disposable detached worktrees preserved all scenario inputs; no agent edited source.

Actual `codex exec --json` completion counters supply input, cached input, and output tokens. Input includes cached input. The adoption metric is the reduction in summed input plus output tokens across the two trials; tool calls count completed command/MCP/web tool events. Records and comparisons use the existing `agent-eval.mjs` format and functions, with host-token-only capture; unobserved read-event metrics must not be interpreted as zero reading. `ALCHEMY_VERIFY_FRESH=1` was set for both variants. Read-only investigations used a read-only sandbox; static diagnosis allowed ordinary cache/report writes.

Four initial asset pilots were excluded because the candidate agent reviewed the uncommitted workflow patch, introducing installation-only work. The measured requests explicitly excluded reviewing setup diffs in both variants. Three initial static pilots were excluded because an unrelated unit test hit the nested sandbox's localhost-listener restriction before reaching static checks. For measured static trials, the host generated each initial completion report: unit verification passed, then the intentional static faults failed. Both trials for a variant started from that same saved report. Agents investigated it and could run additional static commands; unit reruns were excluded equally.

## Results and adoption

| Investigation | Input + output reduction | Decision                    |
| ------------- | -----------------------: | --------------------------- |
| asset         |                    12.7% | Retained                    |
| test          |                   -44.4% | Rejected; prototype removed |
| static        |                    38.8% | Retained                    |

Negative reduction means increased usage. Asset savings varied from 4.0% to 21.3%; static-diagnosis savings varied from 32.3% to 44.0%. These are observed two-trial totals, not guaranteed savings on every task.

| Investigation | Variant / trial |   Input | Cached input | Output | Tool calls |
| ------------- | --------------- | ------: | -----------: | -----: | ---------: |
| asset         | baseline / 1    | 170,284 |      132,864 |  1,419 |         15 |
| asset         | baseline / 2    | 167,540 |      131,968 |  1,354 |          9 |
| asset         | candidate / 1   | 133,954 |      113,024 |  1,240 |          8 |
| asset         | candidate / 2   | 160,647 |      126,336 |  1,452 |          9 |
| test          | baseline / 1    | 189,633 |      160,128 |  1,253 |         12 |
| test          | baseline / 2    | 192,128 |      177,024 |  1,181 |          9 |
| test          | candidate / 1   | 275,059 |      257,664 |  1,311 |         13 |
| test          | candidate / 2   | 276,694 |      217,216 |  1,644 |         20 |
| static        | baseline / 1    | 262,317 |      221,056 |  1,307 |         16 |
| static        | baseline / 2    | 214,092 |      189,184 |  1,243 |         14 |
| static        | candidate / 1   | 146,518 |       84,096 |  1,049 |          9 |
| static        | candidate / 2   | 144,561 |      104,064 |  1,158 |          9 |

Cached input is a subset of input, not an additional charge in this metric. Cache-hit variation matters: static trials reduced total tokens but increased uncached input plus output from 68,719 to 105,126. These measurements do **not** establish lower billing cost or allowance consumption.

These are completed **investigation** tasks, not coding-task or repository-wide savings. Two trials expose variation but do not establish statistical significance. No claim is made about the combined effect on the existing representative coding tasks; that requires a separate matched coding cohort.

## Acceptance

- Asset answers identified the two production pile PNGs, their core manifest entries, width 420 and quality 82, supported regeneration and curated imports, freshness/idempotence checks, and why Card Back remains a single-card animation asset.
- Save-test answers correctly distinguished foreground recovery to 80 from a shared purse remaining 0 with parked snapshot gold 80, explained fixture overrides, and identified that the minimal-save test explicitly supplies `activeRun: null` while omitting the schema version.
- Static answers must identify the incorrect `clamp` return annotation, unused `obsoleteModuleFlag`, and extra trailing blank lines in the audio documentation; both TypeScript configurations fail from the same root fault. No consumer rewrites or source repairs are needed for the investigation.

The test-navigation prototype passed its regression checks and produced outlines for all 565 test files, but increased completed-task usage. Agents still read surrounding code and setup; listing and looking up tests added context and calls. It was removed under the 10% adoption rule. Existing declaration/entry outlines remain the supported workflow.

## Evaluated patch identities

SHA-256 of each saved candidate diff (the test identity hashes the diff followed by its new helper source):

- Documentation selection: `2d7b99239bd5de251d872e4a628fae87271887b8ca392dacbd3384912013c973`.
- Rejected test navigation: `27a61601f8b0ac96c710ca441bf0d4b8ca8a54b9f4cb7f34ef4a6c5023b075ab`.
- Static collection and diagnostics: `032a23785f3ac912e276399e87c7dc9ca674a0342682d3f351ba07011e0eeb2d`.

Raw CLI streams, scenario requests, candidate patches, normalized evaluation records, and comparison JSON are transient evidence under `reports/agent-evals/efficiency-0911/`. This document preserves measurements and identities after cleanup. Initial integration removed the rejected prototype and preserved filename context for non-aggregate lint output. Subsequent small refinements below were not part of these measured trials.

## Exact requests

### Asset investigation

> Investigate how to replace Alchemy's Draw Pile and Discard Pile art without changing any files. Identify the production raw sources, the manifest entries and quality/width choices, the supported way to regenerate and import the art, and the checks needed before handoff. Explain why the piles must remain separate from the Card Back asset. Use the repository's existing discovery workflow and give a concise, source-grounded answer. Do not edit files, commit, launch other agents, or browse the web.
>
> Evaluation setup: any existing changes to agent tooling or documentation are the installed workflow variant, not work to review. Preserve them and do not inspect their diffs. This read-only investigation needs no verification run.

### Save-test investigation

> Investigate the existing tests for save-schema recovery. Locate the cases that recover a shared purse from a foreground combat snapshot and preserve an already spent purse at zero when only a parked combat snapshot has gold. Explain the fixtures/setup and exact expected behavior, with source locations. Also explain what the existing minimal-save case expects for missing activeRun and saveSchemaVersion. Use the repository's existing discovery workflow. Do not edit files, commit, launch other agents, or browse the web.
>
> Evaluation setup: any existing changes to agent tooling or documentation are the installed workflow variant, not work to review. Preserve them and do not inspect their diffs. This read-only investigation needs no verification run.

### Static investigation

> Investigate all independent static-check failures in this isolated checkout. A host-run completion check has already passed the unit checks and reached the failing static aggregate. Start by reading reports/current-run.json and its linked failure digest. Use additional static-check commands if needed to identify every failing checker, the affected source, and the minimal fix. Do not rerun unit tests or repair files. Do not commit, launch other agents, or browse the web. Diagnostic commands may write normal cache/report artifacts.
>
> Evaluation setup: src/lib/math.ts, scripts/lib/is-main-module.mjs and docs/AUDIO.md contain intentional fault fixtures. Other existing changes to agent tooling or documentation are the installed workflow variant, not work to review. Preserve all setup. Investigate checker output rather than inspecting diffs or historical revisions to identify faults.

## Subsequent small refinements

After the user allowed worthwhile low-complexity changes without a 10% minimum:

- Accept singular/plural task counterparts. All four save-test trials first tried `--task saves`, failed, and retried with `save`. Exact canonical names retain precedence; unsupported names still fail.
- Retain the beginning and end of long diagnostic excerpts within the same output budget. The saved candidate static digest omitted the underlying error in `src/lib/math.ts`, although its full log contained it after downstream errors. A replay with the refinement includes that error alongside the other failed checkers.
- Explain empty source outlines with one short message directing the caller to a scoped search. This adds no test parser or expanded test listing.

Focused regression checks and replay of the retained diagnostics validate these refinements. No additional completed-task token reduction is claimed, and the original trial counters above remain unchanged.
