# Agent Discovery

Read known owners directly. Optional lookup returns canonical documentation
ranges and implementation entry points without printing their contents:

```sh
npm --silent run context
npm --silent run context -- src/lib/battle/card-play.ts
npm --silent run context -- --task run-state --task rewards
npm --silent run context -- --diff --json
```

No arguments lists topics, including focused settings, shop, progression and
reward owners. Repeat `--task` to combine topics with path matches in one lookup;
duplicate owners are printed once. Text and JSON give the same current, 1-based
inclusive ranges. Canonical document paths match their topics; a whole-document
pointer suppresses its subsections. Unknown topics and removed options fail.

Gameplay tests follow gameplay owners; test infrastructure selects verification,
and headless playthrough paths select simulation guidance. Focused owners retain
applicable run-state and UI contracts. Unmatched paths retain the architecture
fallback, including mixed selections. Script lookup starts at verification policy
and implementation map sections; follow links for specific test/cache/browser/CI
details. Owner lookup does not claim test coverage.

Find filenames before searching contents, then read relevant sections/symbols and
consumers. Expand as the contract requires; reuse unchanged reads:

```sh
rg --files src/lib/battle -g '*damage*'
rg -n 'dealDamageToEnemy' src/lib/battle
sed -n '<start>,<end>p' Docs/GAME_RULES.md # use the current range from context
```

For a large guide, locate headings before reading prose:
`rg -n '^#{1,3} ' Docs/UI.md`, then read the relevant range and linked contracts.
Use `rg -l '<pattern>' <owner-directory>` when only filenames are needed;
`rg -n` is for matching lines. Narrow a truncated search rather than repeating it
with a larger dump.

No context session or separate search index needs maintaining. Use `npm --silent
run <command>` to omit npm banners from discovery, review and verification.

## Search and review

`rg` respects `.rgignore`, keeping raw media, generated catalogs, asset hashes,
and lockfiles out of ordinary discovery. Use `rg --no-ignore-dot <pattern>
<explicit-path>` when those files are relevant. Git inventories and asset checks
remain complete.

Start mixed checkouts with `npm --silent run review:status`: directory counts show
other work without unrelated filenames. Add paths for task-owned status.

```sh
npm --silent run review:diff -- --summary <task-owned paths>
npm --silent run review:diff -- <task-owned paths>
```

Use `--summary` for large selections: it prints filenames and exact patch ranges
without bodies. Ordinary review previews fitting patches. Both retain the same
selected staged/unstaged patches, complete inventory and patch index under
`reports/agent-diff/`. The footer locates the complete index if terminal rows no
longer fit. Read needed patches with `sed -n '<start>,<end>p' <report>`, in chunks
when large. Summary/status output alone is not a patch review.

`--full` expands generated/media patches and disables exact-move compaction;
terminal output stays bounded, including with `--summary`. Read omitted material
before treating a review as complete.

Review commands never stage files. Explicit task paths are appropriate in mixed
checkouts; omit paths to review the whole dirty set. Review commands do not accept
`--diff`; that selector belongs to owner lookup and verification commands.

## Verification

[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) owns execution tiers.
`verify` is fixed Node smoke, `verify:unit` selects relevant unit coverage, and
`check` adds selected-file formatting. Full static, browser, build, and broader
local verification remain explicit opt-ins. Owner lookup does not select tests.

[`runs:show`](./REFERENCE.md#failure-first-triage) includes primary evidence paths
so a failed run's digest can be opened directly. Compact failure summaries
collapse identical selected lines with occurrence counts and first/last log
locations, preserving space for distinct causes. Passing local smoke is
not evidence that edited gameplay or integration passed.
