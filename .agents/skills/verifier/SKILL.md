---
name: verifier
description: Select and run Alchemy verification after edits and before handoff, using the repository's changed-path gates. Applies to documentation as well as executable changes.
---

# Verify Alchemy changes

[CONTRIBUTING.md](../../../CONTRIBUTING.md#what-to-run-when-you-change) owns verification tiers, dirty-checkout scope, and completion records.

1. Inspect the final diff and select all task-owned paths, including deletions and incidental fixes. Use `--diff` when the whole diff belongs to the task; otherwise pass explicit paths.
2. During iteration, run `npm run verify -- <paths>` as needed. Add `--plan` to inspect selection when uncertain.
3. Before handoff, run `npm run check -- <paths>`. It includes applicable verification, so a separate identical `verify` run immediately beforehand is unnecessary. Documentation-only changes use documentation and format checks; executable changes receive the broader gates defined by CONTRIBUTING.
4. Resolve failures or report the remaining limitation. If a relevant input changes after a passing run, rerun the affected gate. Follow [failure-first triage](../../../docs/REFERENCE.md#failure-first-triage) for bounded diagnostics.

Green checks do not establish that the requested behavior is complete. Review the result against the request and report what changed, checks actually run, and unresolved limitations. Finalize task-owned plans using [workflow hygiene](../../../CONTRIBUTING.md#hooks-and-workflow-hygiene). Close browser tabs created for the task; leave pre-existing user tabs intact.
