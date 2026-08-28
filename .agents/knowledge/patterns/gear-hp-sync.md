# Gear HP-Sync Write Path

Status: active
Confidence: medium — single occurrence at introduction (2026-08-28); promote to high after second independent recurrence per `index.md:When to consult`

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

## Preferred pattern

- **Outside a run-session command** (Armory screen, dev spawn): `dispatchGearMutationWithRunHealthSync({ mutate: (g) => g.equip(...) })` (+ `flushSaveAfterGearMutation` when needed).
- **Inside an open `dispatchRunSessionCommand((draft) => ...)`** (shop buy, reward claim, mystery): `mutateGearWithRunHealthSync(draft, { mutate: (g) => g.addInstance(...) })`; never nest the outer dispatch.
- Salvage: freeze `computeSalvageYield` before dispatch; grant materials in same command via `awardMaterialsDuringRun` (active) / `addMaterials` (meta).
- Read-only Armory views use `useGearArmorySlice`; don't call gear mutations from presentation leaves.

## Exceptions

- Meta-only bulk mutations when no run is active — `syncRunHealth: false` is acceptable (draft check already guards).
- Persistence adapters subscribe to aggregate commit; they do not use gear dispatch directly.

## Enforcement

Lint: `GEAR_NO_OUTER_DISPATCH` (`no-restricted-syntax` on `dispatchGearMutationWithRunHealthSync`/`dispatchGearSalvageWithMaterialGrant` in `src/features/alchemy/run-loop/**` + `shell/**` — `eslint/fragments.js:70`, `eslint.config.js:372`) — use `mutateGearWithRunHealthSync(draft, ...)`. Part of `run-state-command-boundary.md:Enforcement` draft-variant rule; this pattern stays as `medium` until second independent recurrence proves generalizability (see `index.md:When to consult`).
