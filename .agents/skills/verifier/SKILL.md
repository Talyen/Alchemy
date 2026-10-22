---
name: verifier
description: Select and run Alchemy verification after edits and before handoff, using the repository's changed-path gates. Applies to documentation as well as executable changes.
---

# Verify Alchemy changes

[CONTRIBUTING.md](../../../CONTRIBUTING.md#what-to-run-when-you-change) owns the task gate, execution permissions, test value, and verification reuse.

1. Review the final diff. Select all task-owned paths, including deletions and incidental fixes; use `--diff` only when the whole dirty set belongs to the task.
2. Run `npm run check -- <paths>`. Add `--plan` to inspect selection without execution. Documentation checks and relevant unit coverage are included automatically. Use focused unit commands only for diagnosis or protection the selector cannot infer.
3. For visible changes, apply [visual review](../../../Docs/UI_VISUAL_REVIEW.md). Report missing rendered review and its limits.
4. Resolve failures using [failure-first triage](../../../Docs/REFERENCE.md#failure-first-triage), or report the remaining limitation. Distinguish local evidence from pending CI validation.

Follow [AGENTS.md](../../../AGENTS.md#review-and-handoff) for integration and reporting, and [workflow hygiene](../../../CONTRIBUTING.md#hooks-and-workflow-hygiene) for task-owned plans.
