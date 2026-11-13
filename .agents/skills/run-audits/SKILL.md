---
name: run-audits
description: Run user-requested Alchemy audits from Docs/Audits. Use for a named audit or all audits; do not activate for unrelated cleanup or edits to the guides themselves.
---

# Run Alchemy audits

`Docs/Audits/README.md` is the shared policy source; each audit guide owns its distinct scope, evidence bar, and hard stops.

## Establish scope

1. Read `Docs/Audits/README.md` fully, then each cited guide fully before probing its scope (read large sets incrementally).
2. Resolve citations: "all audits" means every guide directly under `Docs/Audits/` except `README.md`.
3. Inspect the worktree and preserve the intent of existing changes. Surgical edits to an already-modified file are allowed when separable. Check current owner rationale and unresolved choices in the audit README before confirming candidates.

Do not run an uncited sibling audit, broaden into standing cleanup, or manufacture findings — zero confirmed findings is success. A clear issue encountered during the audit may still be fixed under the repository's incidental-fix policy, including its causal neighborhood, without turning it into another audit.

## Investigate

Follow the [shared discovery and confirmation contract](../../../Docs/Audits/README.md#discover-and-confirm) for scope coverage, repeat-pass starting points, evidence, and counterevidence. Choose probes that answer the requested audit question; `npm run audit:all` is an optional measurable sweep, not a prerequisite for each audit. Keep probe output compact, use summaries when the cause is unclear, and open relevant evidence directly for a specific hypothesis. Group connected findings by cause and choose the cheapest matching verification.

## Review and verify

Inspect the final diff against the requested scope and the audit evidence bar; reject speculative growth, forwarding wrappers, duplicate paths, concealed defects, or tests whose cost is unjustified by their distinct protection. Use the shared [test value policy](../../../CONTRIBUTING.md#test-value-and-coverage-strategy) for additions and retirements. Verify per the README verification contract.

Do not edit guides to record results. Move reusable rationale into its canonical owner; keep only unresolved product choices in the audit README, and delete completed records.

## Handoff

Report findings fixed by audit, zero-finding audits, unresolved decisions, verification status, and toolchain limitations. Distinguish scope inspected, sampled and unavailable; do not present sampling as exhaustive proof. Summarize diagnostics; never paste long output.
