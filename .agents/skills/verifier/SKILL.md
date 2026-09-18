---
name: verifier
description: Select and run Alchemy verification after edits and before handoff, using the repository's changed-path gates. Applies to documentation as well as executable changes.
---

# Verify Alchemy changes

[CONTRIBUTING.md](../../../CONTRIBUTING.md#what-to-run-when-you-change) owns verification tiers, dirty-checkout scope, and completion records.

1. Inspect the final diff and select all task-owned paths, including deletions and incidental fixes. Use `--diff` when the whole diff belongs to the task; otherwise pass explicit paths.
2. During iteration, run `npm run verify -- <paths>` as needed. Add `--plan` to inspect selection and owner pointers when uncertain. Set `ALCHEMY_VERIFY_FRESH=1` when investigating nondeterminism or requesting a fresh run.
3. Before handoff, run `npm run check -- <paths>`. It includes applicable verification. Documentation-only changes use documentation and format checks; executable changes receive the broader gates defined by CONTRIBUTING.
4. Resolve failures or report the remaining limitation. Follow [failure-first triage](../../../Docs/REFERENCE.md#failure-first-triage) for bounded diagnostics.

For test changes, apply the [test value policy](../../../CONTRIBUTING.md#test-value-and-coverage-strategy), including verification scope for surviving protection and deleted paths.

Follow [AGENTS.md](../../../AGENTS.md#handoff) for completion review and reporting. Finalize task-owned plans using [workflow hygiene](../../../CONTRIBUTING.md#hooks-and-workflow-hygiene).
