# Run-State Command Boundary

Status: enforced-rationale
Confidence: high

## Observation

Feature code occasionally bypasses the aggregate command boundary — calling store mutators directly, nesting `dispatchRunSessionCommand` inside an already-open command, reading committed state inside a draft, or performing async/navigation/audio work inside the command body.

## Why it matters

Bypassing the shared command boundary causes inconsistent reads, unpersisted writes, torn autosave, and non-rollbackable side effects. Nested dispatches and async spans break atomicity; battle continuity depends on committing the intermediate state and its continuation together. [Run-state ownership](../../../docs/ARCHITECTURE.md#run-state) defines publication, unchanged-command behavior, and post-commit effects.

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
