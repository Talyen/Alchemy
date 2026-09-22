# Agent Discovery

Canonical detail linked from [REFERENCE.md](./REFERENCE.md).

## Agent discovery

Use direct reads and scoped `rg` when the owner is clear. The optional `context`
command helps locate owner sections and entry points when it is not:

```sh
npm run context -- src/lib/battle/card-play.ts
npm run context -- --task save-write
npm run context -- --diff
```

`--diff` is appropriate only when the whole diff belongs to the task. File and
directory arguments accept relative or absolute paths inside the checkout.
`npm run context` lists task names; singular/plural counterparts resolve when
available, and unknown names fail. Explicit task selection augments path matches
without suppressing applicable save or other owners.

The output includes deduplicated canonical sections, implementation entry points,
and verification categories. Its default 12 KB budget removes Markdown table
padding, preserving cells, fences and source locations. Oversized sections
provide an overview and locations; deferred content has not been read. Follow
those pointers when needed. `--json` has the same budget; `--json --full` is for
tools that need all selected sections.

Discovery is not a prerequisite, a replacement for required skills, or a test
coverage selector. `scripts/lib/agent/agent-context.mjs` owns its catalog;
`scripts/lib/verification/change-routes.mjs` separately owns verification selection. Keep
catalog entries as references to canonical prose, not copies of that prose.
Documentation checks validate those references, and `verify --plan` uses them.

### Select the operation

Use the narrow topic when a subsystem has several owners:

- Assets: `assets-art`, `assets-gear`, `assets-sound`, `assets-music`, or `assets-pipeline`.
- Saves: `save-load`, `save-write`, `save-delete`, or `save-compatibility`.
- Battle: `battle` for engine rules; `battle-controller` for route/controller wiring.
- Verification: `verification` for running gates; `verification-tooling` for implementation.
- Overlays: `overlay` for input, focus and lifetime; screen-specific guidance is in the [UI index](./UI.md#guide-index).

Paths also select relevant owners. Mixed requests retain applicable safety
owners. Use the command's task listing for the complete current catalog rather
than guessing names.

### Read a source declaration or content entry

```sh
npm run context -- --outline src/lib/battle/card-play.ts
npm run context -- --outline src/lib/battle/card-play.ts --symbol playBattleCardResolved
```

An outline locates declarations; `--symbol <name>` reads one. Oversized symbols
return locations instead of full dumps. `--entries` lists literal content IDs
and top-level keyed entries; `--entry <id>` reads matches, including duplicate
IDs. Talent and affix builders are recognized, but computed IDs and dynamic
entries still need scoped search. Parsing never executes content.

For tests, `--tests` lists suite-qualified names and `--test "suite > case"`
reads matches with pointers to imports, shared setup and hooks. Parameterized
names remain unexpanded; dynamic names are labeled. Read surrounding code when
those pointers are insufficient. Earlier [investigation trials](../.agents/evals/results/context-efficiency-2026-09-11.md)
found that targeted test excerpts could increase total reading; use this option
only when it helps the investigation.

### Optional context controls

- `--related` adds ranked consumers, tests and imported fixtures from current
  static imports, aliases and reexports. At most two consumer hops and six
  locations per kind are shown. These are hints, not exhaustive coverage.
- `--session <unique-id>` suppresses unchanged sections actually emitted earlier
  in that session. Use a separate ID per agent. After context loss, use `--refresh`
  with that ID or start a new one. Changed and budget-deferred sections remain
  eligible; disposable session state lives under `reports/agent-context/`.

Reread when needed to restore understanding or inspect changes, not merely
because another guide links the same section. Split a large file only when
repeated reads or co-changes demonstrate separable responsibilities; file size
alone is not a refactoring target.

### Bounded search

`npm run search -- <literal> [paths...]` wraps `rg`, returning up to 40 filenames
within 8 KB. Use `--excerpts` for matching lines and `--regex` for intentional
regular expressions. Truncation is explicit; narrow the search or use scoped
`rg` for more control. Use `--` before positional arguments beginning with `--`.

Default searches respect ignore files and exclude raw assets, reports, build
outputs, changelog, lockfiles, dependencies, Git data and worktrees. Explicit
paths plus `--include-excluded` allow those artifacts. Broad searches also omit
archived plans, agent history, generated source and asset hashes; an explicit
path into those categories includes them without the flag. Current plans,
canonical docs and authored manifests remain searchable. Dependency-hint
inventories remain complete.

## Verification reuse

[CONTRIBUTING](../CONTRIBUTING.md#verification-reuse) owns eligible commands,
input identity, receipt expiry, and the `ALCHEMY_VERIFY_FRESH=1` override.

## Context-efficiency measurements

`npm run measure:agent-context -- --path <changed-path>` reports a stable preread byte proxy: always-loaded instructions, owner sections selected by the same discovery catalog as `context`, changed-file bytes, verification/test-path counts, and explicitly named artifact bytes. `--all-routes` compares one canonical fixture per verification route. These byte proxies do not measure reasoning, repeated reads or actual token usage.

Use the pinned [agent evaluations](../.agents/evals/README.md) for completed-task comparisons. With `ALCHEMY_AGENT_SESSION` set to an evaluation session ID, context reads and verification attempts/reuse append local events automatically. Host usage is optional and must come from a real usage report; unavailable values remain null. No prompts, credentials or source text are written to event records. Ordinary tasks do not require telemetry or new bookkeeping.

`npm run context:hotspots -- --last 20` reports verification-route preread proxies alongside every named discovery category and representative content/verification paths. Route rows distinguish selected owner-section bytes from emitted preread bytes; budgets apply to emitted context, while deferred material remains visible as a diagnostic. Discovery rows separate selected owner-section bytes, emitted owner-section bytes, total emitted output (including navigation), and deferred section names; they exclude always-loaded instructions, which the route preread proxy includes. Command hotspots rank cumulative exposed bytes, retaining raw output as supporting evidence. `--min-bytes` continues to filter on raw bytes so compacted commands remain inspectable. It is advisory process evidence, not a correctness gate. Use `--min-bytes 0` for the complete inventory, `--json` for machine-readable output, or `--run-id <id>` for one recorded run. One-shot lint, typecheck, deadcode, build, audit, E2E, performance, and ship commands are compact by default; pass `--live` (or `--verbose` where supported) for interactive output.

Direct `lint`, `typecheck`, `typecheck:all`, and `deadcode` commands retain full logs and child exit codes through the compact wrapper. Their `:verbose` counterparts expose raw output; `typecheck:watch` remains interactive. Outer verification capture retains the raw diagnostics without nested summaries.

## Terminal search and change review

`.rgignore` keeps raw media, generated catalogs, asset hashes, archived plans and lockfiles out of ordinary `rg` discovery. Use `rg --no-ignore-dot <pattern> <explicit-path>` to inspect them. Git inventories, asset validation and the custom discovery import graph remain complete; the wrapper owns its exclusions independently.

`npm run review:diff -- [paths...]` prints bounded authored patches and retains the complete working-tree inventory and selected patches under `reports/agent-diff/`. Staged and unstaged changes remain separate, including reversals between the two. Generated/media patches are summarized by path; use `npm run review:diff -- --full <path>` to retain their full patches too. Large patches remain in the linked report rather than filling the terminal. Omitted output is not completed review. Path selection never hides unrelated changes from the retained inventory.

Use `--task verification` for running gates and `--task verification-tooling` for their implementation. Direct verification implementation paths select both.
