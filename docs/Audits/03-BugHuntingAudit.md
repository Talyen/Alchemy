# 03. Strategic Bug Hunting Audit

**Goal:** Find and fix real defects — opportunistic hunt, not a sibling-audit re-run.

## Intent

Confirm and fix real defects. Do not re-run sibling audits’ unrelated suites; defer P4/P5 by default.

**Default discovery mode:** start with recent changes, then inspect one rotating high-risk subsystem or invariant family. Review commits since the last pass (`git log`/`git diff` on authored paths) for defects introduced or exposed by recent work, follow confirmed candidates through their causal neighborhoods, and perform a deeper slice such as persistence/resume, battle transitions, reward/shop mutation, routing, or desktop lifecycle. Whole-repo signal greps remain a secondary, periodic mode.

This is an **opportunistic defect hunt**. When a hit is clearly classified by a sibling (idempotency → `02-BehaviorHardeningAudit.md`, lifetime/IPC → `01-AsyncRaceAudit.md`, unused API → `05-DeadCodeAudit.md`), do not duplicate that sibling's unrelated full pass. A connected defect may still be fixed here under the companion-finding policy in [README.md](README.md).

## Hard stops

- Do not rename/restyle or opportunistically refactor unrelated code. Fix the confirmed bug’s complete root cause; bounded structural remedies may ship under [README.md](README.md), while new architecture or product decisions remain proposals.
- Do not expand into speculative backlog or touch manifests/assets/audio unless they directly cause the confirmed defect.

## Confirmation policy

- **Auto-fix** P0–P2 correctness bugs (crashes, data loss, double grants, stuck state, clear wrong behavior).
- **Fix P3 when causal:** missing diagnostics or recovery may be included when it obscures or perpetuates a confirmed higher-impact defect. Otherwise skip it unless trivial.
- **Skip and note** balance retunes, player-facing copy/layout design choices, or ambiguous product intent — do not block waiting for answers.
- Never ask about naming, file structure, or obvious internal guards.

## Severity

| Sev | Criteria                                                 | Default disposition             |
| --- | -------------------------------------------------------- | ------------------------------- |
| P0  | Crash / data loss / double reward / save corruption      | Fix now                         |
| P1  | Wrong battle/progress/UI state                           | Fix now                         |
| P2  | Degraded UX (stuck spinner, missing dismiss, ghost drag) | Fix when confirmed and scoped   |
| P3  | Recoverable failure without appropriate diagnostics      | Fix only if trivial             |
| P4  | Maintainability (orphaned state)                         | Defer to `05-DeadCodeAudit.md`  |
| P5  | Async / effect lifetime risk                             | Defer to `01-AsyncRaceAudit.md` |

## Known signals

Optional discovery aids — choose your own probes.

- **Collection bounds:** array index access in `src/lib/battle`, `src/lib/gear`, and stores without length/empty guards.
- **Rapid tap & double-trigger:** `onClick` / pointer handlers for reward claim, shop buy, craft, start battle that lack disable/`isProcessing` guards during async work — if the gap is pure idempotency of grants, prefer `02-BehaviorHardeningAudit.md`.
- **Leaked timers & listeners:** `setInterval` / `setTimeout` / `addEventListener` without matching clear/remove on unmount (`useEffect` cleanup) — route lifetime issues to `01-AsyncRaceAudit.md` when that is the bulk of the win.
- **Arithmetic underflow:** unchecked `gold - cost`, `hp - damage` paths that can leave negative progress values without `Math.max(0, …)`.
- **Swallowed errors on orchestration:** empty `catch` on save, resume, battle end, or navigation transitions (allow non-fatal audio).
- **Stale async completion:** `await` after unmount that still calls `setState` / store writes — route to `01-AsyncRaceAudit.md` when that is the bulk of the win.
- **State-machine invariants:** impossible or stuck combinations across navigation, targeting, rewards, shops, victory/defeat, and resume.
- **Round-trip divergence:** save → reload, serialize → parse, or web → Electron behavior does not preserve the same valid state.
- **Boundary values:** empty catalogs/decks, maximum upgrades, exhausted options, missing route targets, or stale identifiers violate assumptions.
- **Cross-feature mismatch:** one subsystem changes an invariant that another consumer still interprets under the old rule.
