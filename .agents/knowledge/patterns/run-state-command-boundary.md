# Run-State Command Boundary

Status: active
Confidence: high

## Observation

Feature code occasionally bypasses the aggregate command boundary — calling store mutators directly, nesting `dispatchRunSessionCommand` inside an already-open command, reading committed state inside a draft, or performing async/navigation/audio work inside the command body.

## Why it matters

`gameplay-state-store.ts` is the single Zustand aggregate (`run`, `session`, `battle`, `runProfile`, `profile`, `gear`). `dispatchRunSessionCommand` opens one Immer draft, increments revision on success, discards on failure. Bypasses cause split-brain reads, unpersisted writes, torn autosave, and non-rollbackable side effects. Nested dispatches and async spans break atomicity; `activeCombat.pendingBattleTransition` continuity depends on committing intermediate + continuation together.

## Evidence

- `docs/ARCHITECTURE.md#run-state` — aggregate ownership, ports, anti-patterns.
- `src/features/alchemy/shared/stores/run-session-command.ts` — `dispatchRunSessionCommand`, single draft, `afterCommit` seam.
- `src/features/alchemy/shared/stores/run-session-write-port.ts` + `write-port-*.ts` — draft-first mutators.
- `src/features/alchemy/shared/stores/run-session-read-port.ts` — committed reads only.
- `src/features/alchemy/shared/stores/run-session-lifecycle-port.ts` — `teardownRun`, `finalizeRunEndSession`.
- `eslint/boundaries.js` — `gameplay-state-store.ts` internal; feature code uses ports.
- `docs/ARMORY.md#write-paths` — `dispatchGearMutationWithRunHealthSync` vs `mutateGearWithRunHealthSync`.

## Preferred pattern

- Entry: `dispatchRunSessionCommand((draft) => { ... }, { afterCommit })`. Keep command synchronous, no `await`.
- Pass `draft` explicitly to every gameplay mutator (`setRunGold`, `setBattleState`, etc.).
- Read transactional guards (gold, refresh counts) from `draft`, not committed port.
- Audio/nav/timers/presentation after commit (`afterCommit` or post-command).
- Inside open command: use `mutateGearWithRunHealthSync(draft, ...)` not outer dispatch wrapper.
- Battle transitions: persist `activeCombat.pendingBattleTransition` in same commit as intermediate state.

## Exceptions

- `profile-store.ts` / `gear-store.ts` adapter subscriptions to aggregate commit signal (persistence adapters).
- Restoration: `restoreRun` is the sole hydration path (boot bypasses screen transition policy intentionally).

## Enforcement

Current: boundary lint (`gameplay-state-store.ts` internal via `DOMAIN_STORE_PATTERNS` in `eslint/boundaries.js:58`) + `AGGREGATE_NO_DIRECT_MUTATION` (`no-restricted-syntax` on `useGameplayStateStore.getState`/`setState` outside `src/features/alchemy/shared/stores/**` — `eslint/fragments.js:70`, `eslint.config.js:372`) + code review. Allowed: `src/features/alchemy/shared/stores/**` (`run-session-command.ts` single draft, `gameplay-state-store.ts` `readGameplayState`) and `tests/**` helpers. Feature code must use `dispatchRunSessionCommand` + `run-session-write-port` / `run-session-read-port`.
