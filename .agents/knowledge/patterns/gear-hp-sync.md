# Gear HP-Sync Write Path

Status: rationale
Evidence: one recorded occurrence at introduction (2026-08-28).

## Observation

Gear equip/unequip/salvage/crafting mutates `GearStore` and must sync live run health via `rebindLiveRunMeta` when a run is active. Callers sometimes use the outer `dispatchGearMutationWithRunHealthSync` wrapper inside an already-open `dispatchRunSessionCommand` draft, or forget HP-sync entirely when mutating gear mid-run.

## Why it matters

`computeGearManifest(...).maxHealth` changes live `activeRun` HP bounds. Without HP-sync, battle `maxHealth` and on-screen HP diverge; autosave writes stale HP. Nested dispatches inside a shop/reward command break atomicity (one draft expected). Metagame-only mutations must not trigger run HP rebinding.

## Evidence

- `docs/ARMORY.md#write-paths` — `dispatchGearMutationWithRunHealthSync` (outside command) vs `mutateGearWithRunHealthSync(draft, ...)` (inside command); `mutate` receives `GearStore` handle for any character.
- `src/features/alchemy/shared/stores/gear-session-command.ts` — HP-sync wrappers + `syncRunHealth ?? draft.session.hasActiveRun`.
- `src/features/alchemy/shared/stores/run-session-write-port.ts` — `rebindLiveRunMeta` call site.
- `src/features/alchemy/run-loop/shop/*-shop-commands.ts`, `src/features/alchemy/run-loop/run/run-flow-rewards.ts` — gear grants inside open command use draft variant.
- `src/app/screen-routes/meta-routes.tsx` via `useArmoryController` — outer dispatch + `flushSaveAfterGearMutation` outside run.

## Resolution

[ARMORY.md](../../../docs/ARMORY.md#write-paths) owns the inside/outside
command decision table and salvage order. The `GEAR_NO_OUTER_DISPATCH` lint
rejects the outer dispatch wrapper inside `run-loop/**` and `shell/**`. The owner document covers health synchronization beyond that lint restriction.
