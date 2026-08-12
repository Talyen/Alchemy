# Run state

Moved to **[docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)** (run state, capability ports, persistence).

Quick links:

- Authoritative store: `gameplay-state-store.ts` (nested `run`, `session`, `battle`, `runProfile`, `profile`, and `gear` regions under `src/features/alchemy/shared/stores/`)
- Reads: `run-session-read-port.ts`, `run-session-react-ports.ts`
- Writes: `run-session-write-port.ts`; commits via `dispatchRunSessionCommand()` in `run-session-command.ts`
- Lifecycle: `run-session-lifecycle-port.ts` over `run-transitions.ts`
