# Run state

Moved to **[docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)** (run state, capability ports, persistence).

Quick links:

- Authoritative store: `gameplay-state-store.ts` (nested `run`, `session`, `battle`, and `runProfile` regions under `src/features/alchemy/shared/stores/`)
- Capability ports: `run-session-read-port.ts`, `run-session-react-ports.ts`, and `run-session-lifecycle-port.ts`
- Transitions: `src/features/alchemy/shared/stores/run-transitions.ts`
