---
name: run-audits
description: Run one or more Alchemy codebase audits from docs/Audits, including evidence gathering, finding triage, token-efficient subagent implementation, root review, and path-scoped verification. Use when a user asks to run, execute, carry out, or rerun a named audit or all audits in docs/Audits. Do not treat an uncited audit as backlog merely because it resembles the current task.
---

# Run Alchemy audits

`docs/Audits/README.md` is the shared policy source; each audit guide owns its distinct scope, evidence bar, and hard stops.

## Establish scope

1. Read `docs/Audits/README.md` fully, then each cited guide fully before probing its scope (read large sets incrementally).
2. Resolve citations: "all audits" means every guide directly under `docs/Audits/` except `README.md` and `decisions.md`.
3. Inspect the worktree and preserve the intent of existing changes. Surgical edits to an already-modified file are allowed when separable. Check [decisions.md](../../../docs/Audits/decisions.md) before confirming candidates.

Do not run an uncited sibling audit, broaden into standing cleanup, or manufacture findings — zero confirmed findings is success. A clear issue encountered during the audit may still be fixed under the repository's incidental-fix policy, including its causal neighborhood, without turning it into another audit.

## Investigate

Follow the README discovery policy: start from paths changed since the prior pass, follow confirmed candidates through their causal neighborhood, prefer scoped `rg`, compiler/linter diagnostics, existing gates, and targeted reads. Keep probe output compact (`npm run audit:all`; bounded failure tail first). For multiple findings, publish a concise plan with disjoint file/symbol ownership and the cheapest matching verification per slice.

## Delegate implementation efficiently

Delegate only when confirmed independent slices justify it; a single finding usually stays in the root. Give each worker the evidence, expected outcome, owned files, hard stops, and focused verification. Use isolated worktrees per [AGENTS.md](../../../AGENTS.md#working-style), with disjoint ownership; integrate and review worker changes before the final gate. Supply the relevant context rather than the entire conversation.

## Review and verify

Inspect each worker diff against its brief and the audit evidence bar; reject speculative growth, forwarding wrappers, duplicate paths, weakened gates, or budget-violating tests. Resolve overlaps centrally, then verify per the README verification contract.

Do not edit guides to record results. Rejected/deferred proposals and intentionally kept borderline candidates get one row in `decisions.md`.

## Handoff

Report findings fixed by audit, zero-finding audits, proposals awaiting approval, verification status, and toolchain limitations. Summarize diagnostics; never paste long output.
