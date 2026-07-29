# Strategic Bug Hunting Audit

**Goal:** Find and fix real defects — opportunistic hunt, not a sibling-audit re-run.

## Intent

Confirm candidate defects and fix them. A pass with no confirmed defect is successful. Do not re-run sibling audits’ full suites; defer P4/P5 by default. Significant structural remedies are proposals per [README.md](README.md). If the scope is large, phase the plan.

**Default discovery mode:** hunt the diff. On a repeat cadence, review commits since the last pass (`git log`/`git diff` on authored paths) for defects introduced or exposed by recent work — that is the highest-yield surface. Whole-repo signal greps are the secondary, periodic mode.

This is an **opportunistic defect hunt**. When a hit is clearly owned by a sibling (idempotency → `BehaviorHardeningAudit.md`, lifetime/IPC → `AsyncRaceAudit.md`, unused API → `DeadCodeAudit.md`), hand off rather than duplicating that audit’s full pass.

## Hard stops

- Do not rename/restyle or opportunistically refactor unrelated code. Fix the confirmed bug’s root cause; larger structural remedies are proposals, not unsupervised rewrites.
- Do not expand into speculative backlog or touch manifests/assets/audio unless they directly cause the confirmed defect.

## Confirmation policy

- **Auto-fix** P0–P2 correctness bugs (crashes, data loss, double grants, stuck state, clear wrong behavior).
- **Skip and note** balance retunes, player-facing copy/layout design choices, or ambiguous product intent — do not block waiting for answers.
- Never ask about naming, file structure, or obvious internal guards.

## Severity

| Sev | Criteria                                                 | Default disposition           |
| --- | -------------------------------------------------------- | ----------------------------- |
| P0  | Crash / data loss / double reward / save corruption      | Fix now                       |
| P1  | Wrong battle/progress/UI state                           | Fix now                       |
| P2  | Degraded UX (stuck spinner, missing dismiss, ghost drag) | Fix when confirmed and scoped |
| P3  | Recoverable failure without appropriate diagnostics      | Fix only if trivial           |
| P4  | Maintainability (orphaned state)                         | Defer to `DeadCodeAudit.md`   |
| P5  | Async / effect lifetime risk                             | Defer to `AsyncRaceAudit.md`  |

## Known signals

Optional discovery aids — choose your own probes.

- **Collection bounds:** array index access in `src/lib/battle`, `src/lib/gear`, and stores without length/empty guards.
- **Rapid tap & double-trigger:** `onClick` / pointer handlers for reward claim, shop buy, craft, start battle that lack disable/`isProcessing` guards during async work — if the gap is pure idempotency of grants, prefer `BehaviorHardeningAudit.md`.
- **Leaked timers & listeners:** `setInterval` / `setTimeout` / `addEventListener` without matching clear/remove on unmount (`useEffect` cleanup) — route lifetime issues to `AsyncRaceAudit.md` when that is the bulk of the win.
- **Arithmetic underflow:** unchecked `gold - cost`, `hp - damage` paths that can leave negative progress values without `Math.max(0, …)`.
- **Swallowed errors on orchestration:** empty `catch` on save, resume, battle end, or navigation transitions (allow non-fatal audio).
- **Stale async completion:** `await` after unmount that still calls `setState` / store writes — route to `AsyncRaceAudit.md` when that is the bulk of the win.
