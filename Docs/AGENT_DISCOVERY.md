# Agent Discovery

Canonical detail linked from [REFERENCE.md](./REFERENCE.md).

## Choose a command

Use direct reads and scoped `rg` when the owner is clear. These optional commands
replace a broader read or search; ordinary edits need no discovery setup.

| Need                                          | Command                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Find owner ranges, consumers, tests and setup | `npm run context -- --locate --related <path>`                         |
| Read selected owner sections                  | `npm run context -- <path>`                                            |
| Locate source declarations                    | `npm run context -- --outline <file>`                                  |
| Read one declaration or content entry         | Add `--symbol <name>` or `--entry <id>` to the outline command         |
| Find matching files                           | `npm run search -- <literal> <directory>`                              |
| Inspect task status or patches                | `npm run review:status -- <paths>` or `npm run review:diff -- <paths>` |

Use [operation selection](#select-the-operation) for topic names and
[source excerpts](#read-a-source-declaration-or-content-entry) for test lookup.
[Session controls](#optional-context-controls) and
[measurements](#context-efficiency-measurements) are for longer investigations.

## Agent discovery

Use direct reads and scoped `rg` when the owner is clear. The optional `context`
command helps locate owner sections and entry points when it is not:

```sh
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

`--locate` emits headings and source ranges instead of section prose. Add
`--related` when consumers, tests and fixture locations help answer the current
question. Location-only output records no content reads and never marks a
section as read in a context session; `--json` exposes these pointers as
`locations`, with an empty `sections` array. `--locate` cannot be combined with
source outlines or `--full`.

Discovery is not a prerequisite, a replacement for required skills, or a test
coverage selector. `scripts/lib/agent/agent-context.mjs` owns its catalog;
`scripts/lib/verification/change-routes.mjs` separately owns verification selection. Keep
catalog entries as references to canonical prose, not copies of that prose.
Documentation checks validate those references, and `verify --plan` uses them.

Use the [operation catalog](#select-the-operation), [source excerpts](#read-a-source-declaration-or-content-entry),
[optional controls](#optional-context-controls), and [bounded search](#bounded-search)
when more specific discovery is needed.

## Select the operation

Use the narrow topic when a subsystem has several owners:

- Assets: `assets-art`, `assets-gear`, `assets-sound`, `assets-music`, or `assets-pipeline`.
- Saves: `save-load`, `save-write`, `save-delete`, or `save-compatibility`.
- Battle: `battle` for engine rules; `battle-controller` for route/controller wiring.
- Card classification: `battle-classification` for effect-derived attack, damage-type and keyword queries.
- Damage calculation: `battle-damage` for damage packets, modifiers, pacing and rounding; hit orchestration outside this scope retains the broader battle owner.
- Browser fixtures: `browser-fixture` for page objects, browser seeding and shared assertions; mixed spec work retains the broader browser contract.
- End Turn: `battle-end-turn` for commit/playback, phase order, Block, and RNG rules.
- Audio: `audio-sfx`, `audio-music`, or `audio-preload` for their runtime lifetimes;
  each includes shared host, volume and failure rules. `audio` reads the full guide.
- Run commands: `run-command` for atomic writes and post-commit feedback;
  `run-state` supplies the broader aggregate and ownership contract.
- Verification: `verification` for running gates; `verification-tooling` for implementation.
- Overlays: `overlay` for input, focus and lifetime; screen-specific guidance is in the [UI index](./UI.md#guide-index).

Paths also select relevant owners. Mixed requests retain applicable safety
owners. Use the command's task listing for the complete current catalog rather
than guessing names.

Focused categories replace their broader parent only when they cover every
matching path. An explicit broad category or a path outside the focused concern
retains the parent contract. Verification selection is independent and unchanged.

## Read a source declaration or content entry

```sh
npm run context -- --outline src/lib/battle/card-play.ts
npm run context -- --outline src/lib/battle/card-play.ts --symbol playBattleCardResolved
```

An outline locates declarations; `--symbol <name>` reads one. Oversized symbols
return locations instead of full dumps. Destructured bindings use their local
names, including aliases and nested object or array bindings. `--entries` lists literal content IDs
and top-level keyed entries; `--entry <id>` reads matches, including duplicate
IDs. Talent and affix builders are recognized, but computed IDs and dynamic
entries still need scoped search. Parsing never executes content.

For tests, `--tests` lists suite-qualified names and `--test "suite > case"`
reads matches with pointers to imports, shared setup and hooks. Parameterized
names remain unexpanded; dynamic names are labeled. Read surrounding code when
those pointers are insufficient. Targeted excerpts can increase total reading; use this option only when it
helps the investigation.

## Optional context controls

- `--related` adds ranked consumers, tests and imported fixtures from current
  static imports, aliases and reexports. Direct implementation dependencies appear
  as helpers; imported test support appears as fixtures even without a fixture-like
  filename. Tests are ranked by consumer distance, then path. At most two consumer
  hops and six locations per kind are shown. These are hints, not exhaustive coverage.
- `--session <unique-id>` suppresses unchanged sections actually emitted earlier
  in that session. Use a separate ID per agent. After context loss, use `--refresh`
  with that ID or start a new one. Changed and budget-deferred sections remain
  eligible; disposable session state lives under `reports/agent-context/`.

Reread when needed to restore understanding or inspect changes, not merely
because another guide links the same section. Split a large file only when
repeated reads or co-changes demonstrate separable responsibilities; file size
alone is not a refactoring target.

For a longer investigation, reuse a unique `--session` when more owner sections
become relevant, and use `--symbol` or `--entry` when only one implementation is
needed. Use these controls when they replace broader or repeated reads; small
edits require no discovery setup. Refresh the session after context loss.

## Bounded search

`npm run search -- <literal> [paths...]` wraps `rg`, returning up to 40 filenames
within 8 KB. Use `--excerpts` for matching lines and `--regex` for intentional
regular expressions. Truncation is explicit; narrow the search or use scoped
`rg` for more control. Use `--` before positional arguments beginning with `--`.

Default searches respect ignore files and exclude raw assets, reports, build
outputs, changelog, lockfiles, dependencies, Git data and worktrees. Explicit
paths plus `--include-excluded` allow those artifacts. Broad searches also omit
generated source and asset hashes; an explicit
path into those categories includes them without the flag. Current plans,
canonical docs and authored manifests remain searchable. Dependency-hint
inventories remain complete.

Paths resolve inside the checkout, including absolute paths and equivalent
relative spellings. Results always use repository-relative paths, with the same
behavior when ripgrep is unavailable. Outside selections are rejected.

## Verification reuse

[CONTRIBUTING](../CONTRIBUTING.md#verification-reuse) owns eligible commands,
input identity, receipt expiry, and the `ALCHEMY_VERIFY_FRESH=1` override.

## Context-efficiency measurements

`npm run measure:agent-context -- --path <changed-path>` reports a stable preread byte proxy: always-loaded instructions, owner sections selected by the same discovery catalog as `context`, changed-file bytes, verification/test-path counts, and explicitly named artifact bytes. `--all-routes` compares one canonical fixture per verification route. These byte proxies do not measure reasoning, repeated reads or actual token usage.

Use the pinned [agent evaluations](../.agents/evals/README.md) for completed-task comparisons. With `ALCHEMY_AGENT_SESSION` set to an evaluation session ID, context reads and verification attempts/reuse append local events automatically. Host usage is optional and must come from a real usage report; unavailable values remain null. No prompts, credentials or source text are written to event records. Ordinary tasks do not require telemetry or new bookkeeping.

`npm run context:hotspots -- --last 20` reports verification-route preread proxies alongside every named discovery category and representative content/verification paths. Route rows distinguish selected owner-section bytes from emitted preread bytes; budgets apply to emitted context, while deferred material remains visible as a diagnostic. Discovery rows separate selected owner-section bytes, emitted owner-section bytes, total emitted output (including navigation), and deferred section names; they exclude always-loaded instructions, which the route preread proxy includes. Command hotspots rank cumulative exposed bytes, retaining raw output as supporting evidence. `--min-bytes` continues to filter on raw bytes so compacted commands remain inspectable. It is advisory process evidence, not a correctness gate. Use `--min-bytes 0` for the complete inventory, `--json` for machine-readable output, or `--run-id <id>` for one recorded run. One-shot lint, typecheck, deadcode, build, audit, E2E, performance, and ship commands are compact by default; pass `--live` (or `--verbose` where supported) for interactive output.

Direct `lint`, `typecheck`, `typecheck:all`, and `deadcode` commands retain full logs and child exit codes through the compact wrapper. Their `:verbose` counterparts expose raw output; `typecheck:watch` remains interactive. Outer verification capture retains the raw diagnostics without nested summaries.

## Terminal search and change review

`.rgignore` keeps raw media, generated catalogs, asset hashes, lockfiles out of ordinary `rg` discovery. Use `rg --no-ignore-dot <pattern> <explicit-path>` to inspect them. Git inventories, asset validation and the custom discovery import graph remain complete; the wrapper owns its exclusions independently.

`npm run review:diff -- [paths...]` prints selected patches first, then changed-path counts by top-level directory. It retains the complete working-tree inventory and selected patches under `reports/agent-diff/`; unrelated filenames no longer consume the patch preview budget. Staged and unstaged changes remain separate, including reversals between the two. Generated/media patches are summarized by path; use `npm run review:diff -- --full <path>` to retain their full patches too. Large patches remain in the linked report rather than filling the terminal. Omitted output is not completed review. Directory counts do not establish review of unrelated changes; read the complete inventory when reviewing the whole checkout.

Use `--task verification` for running gates and `--task verification-tooling` for their implementation. Direct verification implementation paths select both.

## Compact status

`npm run review:status -- [paths...]` uses the same uncached Git inventory as
`review:diff`. Without paths it groups changes by top-level directory; explicit
task paths show bounded status entries, including both status columns and rename
sources. The complete inventory remains in the linked report. This is status
inspection, not patch review; expand the inventory for a whole-checkout task.
