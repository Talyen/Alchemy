---
name: run-audits
description: Run one or more Alchemy codebase audits from docs/Audits, including evidence gathering, finding triage, token-efficient subagent implementation, root review, and path-scoped verification. Use when a user asks to run, execute, carry out, or rerun a named audit or all audits in docs/Audits. Do not treat an uncited audit as backlog merely because it resembles the current task.
---

# Run Alchemy audits

Execute audit guides as repeatable evidence-led passes. Keep `docs/Audits/README.md` as the shared policy source; keep each audit file as the source for its distinct scope, evidence bar, ownership, and hard stops.

## Establish scope

1. Read the applicable `AGENTS.md` instructions.
2. Read `docs/Audits/README.md` fully.
3. Resolve the audits the user cited. “All audits” means every audit Markdown file directly under `docs/Audits/` except `README.md`.
4. Read each selected audit fully before probing its scope. Read large sets incrementally rather than dumping the directory into one tool result.
5. Inspect the existing worktree and preserve unrelated changes.

Do not run an uncited sibling audit, broaden an audit into a standing cleanup effort, or manufacture findings. Zero confirmed findings is a successful result.

## Investigate once

- Read only the subsystem documents from the `AGENTS.md` Docs table that match confirmed candidate paths or ownership areas.
- For multi-audit or all-audit runs, use `npm run audit:all` once as optional shared instrumentation when it will materially reduce duplicate discovery. It is not a required first step, and `npm run content:audit` is outside this code-quality audit pack.
- Prefer scoped `rg` searches with explicit paths, compiler/linter diagnostics, existing gates, and targeted source reads.

For multiple findings, publish a concise implementation plan before edits. Assign disjoint file or symbol ownership and identify the cheapest matching verification for each slice.

## Delegate implementation efficiently

Follow the orchestration and task-brief contract in `docs/Audits/README.md`. For a single audit, stay in the root unless the user requests delegation or multiple disjoint confirmed fixes make it materially useful.

- Use the Worker role for implementation.
- Keep the root as final reviewer. Use the Reviewer role only when the user requests independent review or a high-risk cross-cutting change warrants a second pass.
- Let Codex configuration choose each role’s model and reasoning effort; do not override them in the spawn request unless the user asks.
- Set `fork_turns` to `none` or the smallest useful positive turn count. Never inherit the full thread by default.
- Agents share the worktree, so warn each worker not to alter unrelated or concurrently owned files.

## Review and verify

Inspect each worker diff against the task brief and audit evidence bar. Reject speculative growth, forwarding wrappers, duplicate paths, weakened gates, or tests that violate the README budgets. Resolve overlaps centrally, then follow the README verification contract across the integrated change.

Do not edit audit guides to record results. Put shipped findings, deferred proposals, verification, and skips in the handoff, commit, or PR requested by the user.

## Handoff

Lead with the outcome and report:

- Confirmed findings fixed, grouped by owning audit
- Audits with zero findings
- Proposals awaiting approval
- Changed authored paths
- Verification commands and pass/fail/skip status
- Any Node, Vitest, Playwright, Electron, or other toolchain limitation

Keep the handoff concise. Summarize diagnostics; never paste long build, test, search, or diff output.
