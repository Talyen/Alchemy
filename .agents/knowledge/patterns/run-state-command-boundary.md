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

## Resolution

[ARCHITECTURE.md](../../../docs/ARCHITECTURE.md#run-state) owns the
aggregate, ports, and command contract. Boundary lint (`DOMAIN_STORE_PATTERNS`,
`AGGREGATE_NO_DIRECT_MUTATION`) keeps `gameplay-state-store.ts` internal and
rejects direct `getState`/`setState` outside `shared/stores/`.
