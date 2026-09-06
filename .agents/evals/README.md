# Reproducible agent evaluations

Use one or two representative tasks before promoting an instruction change that affects routine coding. Keep this a small set of real coding exercises, not an autonomous benchmark service. Formatting and link repairs need no behavioral trial.

## Fixed setup

[The task catalog](./tasks.json) pins a full base revision and five exact requests. Create separate disposable worktrees from that revision for before and after; never run an eval in the user's working checkout. Install the pinned dependencies with `npm ci`. Use the same model, reasoning effort, tool availability, task prompt and dirty-tree setup. Apply only the workflow change being evaluated to the candidate checkout; record that patch/revision in acceptance evidence. Supply the task prompt from this catalog to both variants, even if the base predates these task files.

Use different variant names, but identical comparison settings. Put the per-variant instruction patch identity in acceptance evidence, not the shared settings. Run at least two trials per variant before claiming a reliable improvement. Use fresh verification (`ALCHEMY_VERIFY_FRESH=1`) in both variants for discovery comparisons; evaluate cache effectiveness separately with the same warm/cold procedure. Never compare an empty baseline event capture with an instrumented candidate as if that established savings.

## Record and compare

Run `npm run eval:agent -- --init <task> <session>` in the instrumented checkout. It creates a local record and empty event stream under `reports/agent-evals/`. Set `ALCHEMY_AGENT_SESSION` to that session ID on subsequent `context`, `verify` and `check` invocations. Context sections and verification attempts/reuse are then recorded automatically, including when `check` invokes `verify`. Keep separate session IDs for concurrent tasks. This environment variable must be set in each shell invocation unless the shell session persists.

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

Events are JSON Lines. A read event has `kind: "read"`, repository-relative `path`, one-based inclusive `start`/`end`, SHA-256 `contentHash` of the emitted excerpt, and UTF-8 `bytes`. A verification event has `kind: "verification"`, the exact `command`, and `status: "passed"`, `"failed"`, or `"reused"`. Automatic event records also carry timestamps.

Repeated-read bytes count identical path/range/content reads after the first. Changed content is not waste. Verification retries count executions after a failed identical command until it passes; cache hits are separate. These are observed events only: arbitrary shell searches, overlapping partial reads, reasoning and host tools remain unmeasured unless the capture adapter supplies them. Use host usage for total task cost. Require correct game behavior, preserved existing work and complete verification in addition to cheaper execution.

Before splitting a large catalog, correlate repeated-read events with the existing `npm run audit -- --amplification` co-edit report; use source outlines first. Do not impose line-count limits or fragment a coherent owner simply to lower a byte proxy.

## Tasks

- [Battle effect](./tasks/battle-card-effect/README.md)
- [Defaulted save preference](./tasks/save-additive-field/README.md)
- [Shop refresh validation](./tasks/shop-price-refresh/README.md)
- [Button interaction](./tasks/ui-button-default/README.md)
- [Dirty checkout](./tasks/dirty-checkout/README.md)

Keep older baselines immutable. When game evolution requires a new baseline, change the pin and task version together and start a new comparison cohort. Evaluation records under `reports/` follow normal transient-artifact retention; preserve comparison summaries with the instruction-change evidence before cleanup when they need to survive it. Historical instruction and friction evidence lives in [history](../history/README.md); it is not a default preread.
