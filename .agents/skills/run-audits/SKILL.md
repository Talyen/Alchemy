---
name: run-audits
description: Run user-requested Alchemy audits from Docs/Audits. Use for a named audit or all audits; do not activate for unrelated cleanup.
---

# Run Alchemy audits

`Docs/Audits/README.md` is the shared policy source; each audit guide owns its distinct scope, evidence bar, and hard stops.

## Establish scope

1. Read `Docs/Audits/README.md` fully, then each cited guide fully before probing its scope (read large sets incrementally).
2. Resolve citations: "all audits" means every guide directly under `Docs/Audits/` except `README.md` and `decisions.md`.
3. Inspect the worktree and preserve the intent of existing changes. Surgical edits to an already-modified file are allowed when separable. Check [decisions.md](../../../Docs/Audits/decisions.md) before confirming candidates.

Do not run an uncited sibling audit, broaden into standing cleanup, or manufacture findings — zero confirmed findings is success. A clear issue encountered during the audit may still be fixed under the repository's incidental-fix policy, including its causal neighborhood, without turning it into another audit.

## Investigate

Follow the [shared discovery and confirmation contract](../../../Docs/Audits/README.md#discover-and-confirm) for scope coverage, repeat-pass starting points, evidence, and counterevidence. Keep probe output compact (`npm run audit:all`); use summaries when the cause is unclear and open relevant evidence directly for a specific hypothesis. For multiple findings, publish a concise plan with disjoint file/symbol ownership and the cheapest matching verification per slice.

## Review and verify

Inspect each worker diff against its brief and the audit evidence bar; reject speculative growth, forwarding wrappers, duplicate paths, concealed defects, or tests whose cost is unjustified by their distinct protection. Use the shared [test value policy](../../../CONTRIBUTING.md#test-value-and-coverage-strategy) for additions and retirements. Resolve overlaps centrally, then verify per the README verification contract.

Do not edit guides to record results. Rejected/deferred proposals and intentionally kept borderline candidates get one row in `decisions.md`.

## Handoff

Report findings fixed by audit, zero-finding audits, proposals awaiting approval, verification status, and toolchain limitations. Summarize diagnostics; never paste long output.
