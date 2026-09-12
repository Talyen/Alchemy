# Reproducible agent evaluations

Use one or two representative tasks before promoting an instruction change that affects routine coding. Keep this a small set of real coding exercises, not an autonomous benchmark service. Formatting and link repairs need no behavioral trial.

## Fixed setup

[The task catalog](./tasks.json) pins a full base revision and five exact requests. Create separate disposable worktrees from that revision for before and after; never run an eval in the user's working checkout. Install the pinned dependencies with `npm ci`. Use the same model, reasoning effort, tool availability, task prompt and dirty-tree setup. Apply only the workflow change being evaluated to the candidate checkout; record that patch/revision in acceptance evidence. Supply the task prompt from this catalog to both variants, even if the base predates these task files.

When a new cohort includes an uncommitted source snapshot, freeze that snapshot once and apply the candidate change to the frozen copy. Before launching, compare the source inventories and require that only the intended candidate paths differ. Never populate a candidate from live files while another session may be editing them; record the snapshot and candidate patch hashes.

Use different variant names, but identical comparison settings. Put the per-variant instruction patch identity in acceptance evidence, not the shared settings. Run at least two trials per variant before claiming a reliable improvement. Use fresh verification (`ALCHEMY_VERIFY_FRESH=1`) in both variants for discovery comparisons; evaluate cache effectiveness separately with the same warm/cold procedure. Never compare an empty baseline event capture with an instrumented candidate as if that established savings.

## Record and compare

Run `npm run eval:agent -- --init <task> <session>` in the instrumented checkout. It creates a local record and empty event stream under `reports/agent-evals/`. Set `ALCHEMY_AGENT_SESSION` to that session ID on subsequent `context`, `verify` and `check` invocations. Context sections, repository-search excerpts, discovery outcomes and verification attempts/reuse are then recorded automatically, including when `check` invokes `verify`. Keep separate session IDs for concurrent tasks. This environment variable must be set in each shell invocation unless the shell session persists.

The checked-in tools can also summarize records collected from the baseline checkout; use the same event capture method in both variants. Host transcript adapters may append the normalized events below. No agent transcript reader or host-specific storage location is assumed.

Fill the generated record with the actual model, settings (including reasoning effort and capture coverage), acceptance results and evidence locations. `usage` may contain real host `inputTokens`, `cachedInputTokens`, `outputTokens`, and `toolCalls`; input tokens include cached input tokens. Leave unavailable counters null rather than estimating them from file bytes. Never include prompts, source text, secrets or environment values in events.

Pass one record path to `npm run eval:agent -- <record.json>` to summarize, or two paths to compare before/after. Comparisons require matching task, task version, base revision, model and settings; a passing correctness result with evidence is required in both variants before drawing an efficiency conclusion. Token and tool-call deltas remain null when either side lacks host data. Negative numeric deltas mean less observed cost after the change; they do not establish statistical significance.

```json
{
  "correctness": { "passed": true, "evidence": ["focused test result", "reviewed final diff"] },
  "model": "actual model identifier",
  "settings": { "reasoning": "actual effort", "capture": "context-and-verification-only", "freshVerification": true },
  "usage": { "inputTokens": null, "cachedInputTokens": null, "outputTokens": null, "toolCalls": null }
}
```

## Events and interpretation

Events are JSON Lines. A read event has `kind: "read"`, repository-relative `path`, one-based inclusive `start`/`end`, SHA-256 `contentHash` of the emitted excerpt, and UTF-8 `bytes`. Read events may also contain `lines`, an array of `{ line, hash, bytes }` for the emitted lines only. Hashes use SHA-256; line bytes exclude newline delimiters. Never include source text. A verification event has `kind: "verification"`, the exact `command`, and `status: "passed"`, `"failed"`, or `"reused"`. Automatic event records also carry timestamps.

Repeated-read bytes count identical path/range/content reads after the first. `overlappingReadBytes` counts unchanged line content at the same path and line number, compared with the last observed version, even across differently sized excerpts. `observedLineBytes` provides its capture denominator. These two repetition metrics overlap and must not be added together. Partial-line source declarations can undercount overlap; moved lines are not inferred matches. Legacy reads without line hashes invalidate overlapping line observations in their range. Changed content is not waste.

Discovery events have `kind: "discovery"`, an `operation` name, `status: "found" | "not-found" | "failed"`, and boolean `truncated`. They count attempts, empty lookups, command errors and bounded-output truncation separately; they contain no search strings. The context and search commands record these automatically when a measurement session is set.

Diagnostic events have `kind: "diagnostic"`, exact `command`, `inputHash`, and `status: "passed" | "failed"`. `diagnosticReruns` counts a subsequent execution after a failure with the same command and input identity; a pass ends that sequence. Opt-in verifier measurement captures stable identities with the existing verification-input scanner before and after execution; unavailable or changing inputs produce no diagnostic event. This instrumentation adds filesystem work, so compare variants with identical capture settings. Host adapters can supply the same normalized events for other diagnostic tools.

Verification retries count executions after a failed identical command until it passes; cache hits are separate. These are observed events only: direct shell searches outside the wrapper, reasoning and host tools remain unmeasured unless a capture adapter supplies events. Use host usage for total task cost. Require correct game behavior, preserved existing work and complete verification in addition to cheaper execution.

Before splitting a large catalog, correlate repeated-read events with the existing `npm run audit -- --amplification` co-edit report; use source outlines first. Do not impose line-count limits or fragment a coherent owner simply to lower a byte proxy.

## Tasks

- [Battle effect](./tasks/battle-card-effect/README.md)
- [Defaulted save preference](./tasks/save-additive-field/README.md)
- [Shop refresh validation](./tasks/shop-price-refresh/README.md)
- [Button interaction](./tasks/ui-button-default/README.md)
- [Dirty checkout](./tasks/dirty-checkout/README.md)

Keep older baselines immutable. When game evolution requires a new baseline, change the pin and task version together and start a new comparison cohort. Evaluation records under `reports/` follow normal transient-artifact retention; preserve comparison summaries with the instruction-change evidence before cleanup when they need to survive it. Historical instruction and friction evidence lives in [history](../history/README.md); it is not a default preread.

## Recorded results

[September 11 context-efficiency trials](./results/context-efficiency-2026-09-11.md) record category-level measurements, setup exclusions, and the rejected test-navigation prototype.

[September 12 discovery-context trials](./results/context-discovery-2026-09-12.md) record battle/run-state adoption and the excluded concurrent-edit setup.
