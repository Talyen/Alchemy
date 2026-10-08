# Agent Discovery

Use direct reads and scoped `rg` when the owner is clear. The optional owner
locator returns canonical documentation and implementation entry points:

```sh
npm run context
npm run context -- src/lib/battle/card-play.ts
npm run context -- --task run-state
npm run context -- --diff --json
```

Topics: battle, run-state, ui, audio, content, gear, assets, verification, release.
Explicit topics augment path matches. Text and JSON contain the same pointers;
neither reads owner prose or source bodies, and neither claims test coverage.
Open the cited files and sections as needed. Unknown topics and removed options
fail explicitly. Source/test navigation and related-file lookup use `rg` and
ordinary reads; there are no context sessions, telemetry, or byte budgets.

## Search and review

`rg` respects `.rgignore`, keeping raw media, generated catalogs, asset hashes,
and lockfiles out of ordinary discovery. Use `rg --no-ignore-dot <pattern>
<explicit-path>` when those files are relevant. Git inventories and asset checks
remain complete.

`npm run review:status -- <paths>` inspects task-owned status. `npm run
review:diff -- <paths>` retains selected staged/unstaged patches and a complete
inventory under `reports/agent-diff/`. Directory counts are status information,
not review of unrelated changes. Large patches remain in the linked report;
read omitted material when reviewing it. `--full` includes full generated/media
patches and disables exact-move compaction.

Review commands never stage files. Explicit task paths are appropriate in mixed
checkouts; `--diff` is appropriate when the whole dirty set belongs to the task.

## Verification

[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) owns execution tiers.
`verify` is fixed Node smoke, `verify:unit` selects relevant unit coverage, and
`check` adds selected-file formatting. Full static, browser, build, and broader
local verification remain explicit opt-ins. Owner lookup does not select tests.

[`runs:show`](./REFERENCE.md#failure-first-triage) and compact failure summaries
retain actual execution results and full-log locations. Passing local smoke is
not evidence that edited gameplay or integration passed.
