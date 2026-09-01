# Shared Stores — Run State Owner

Canonical owner for gameplay run state. See `docs/ARCHITECTURE.md#run-state` and `docs/WORKFLOWS.md`.

## Aggregate

`gameplay-state-store.ts` is the single Zustand aggregate. It is data-only — no logic.

| Region       | Fields                                                                              | Lifetime                                                          |
| ------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `run`        | `activeRun`, `parkedRuns`, `runRecency`, `navigation.screen`                        | live run resets on teardown; parked slots remain                  |
| `session`    | rewards, shops, labyrinth, mystery, corruption, pending selections, run-flow claims | transient per live run; shops/corruption persist via resume codec |
| `battle`     | `battleState`, `battleStartState`, `displayOverrides`, `pendingBattleTransition`    | transient per battle; rebound from live meta on hydrate           |
| `runProfile` | homestead, talent XP/unlocks, derived `effects`, gold purse                         | profile lifetime; top-level save fields via `run-save-readers`    |
| `profile`    | compendium discoveries, `completedDifficulties`                                     | profile lifetime (`profile-store.ts`)                             |
| `gear`       | inventories, loadouts, currencies                                                   | profile lifetime (`gear-store.ts`)                                |

`revision` bumps on every committed command. Autosave and UI subscribe to it.

Other stores remain separate by design: `settings-store.ts` (display/audio), `ui-store.ts` (hover/battle presentation), `error-log-store.ts`. They never hold gameplay progression.

## Command seam

All gameplay mutations go through `dispatchRunSessionCommand()` from `run-session-command.ts`. It opens one Immer draft of the aggregate, bumps `revision` on change, freezes in DEV via `store-utils.ts`, and discards on failure. No second read store.

- Draft mutators take `(draft: GameplayDraft, ...args)` and compose inside one command. Command bodies must not call another command (guarded by `inCommand`).
- `afterCommit` is the only place for non-rollbackable work (audio, timers).
- `createRunSessionCommand(mutator)` is the helper for React callbacks (`store-actions.ts`).

Battle RNG is draft-bound: `createDraftRunRandomSource(draft, stream)` and `withDraftWorldBattleRng(draft, state)` so counters commit/rollback with state. Outside a command, `withRestingWorldBattleRng` throws if drawn.

## Capability ports

Outside `shared/stores/` import capability ports, not the aggregate or `run-lifecycle` internals. Boundary lint enforces it (`eslint/boundaries.js` + `eslint/fragments.js:DOMAIN_STORE_PATTERNS`).

| Kind               | Module                                      | Role                                                                                                                                                       |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reads (imperative) | `run-session-read-port.ts` (`run-reads.ts`) | `readActiveRun()`, `readRunProfile()`, `readBattle()`, etc. `run-session-read-port.ts` is a barrel over `run-reads.ts` — prefer the port from feature code |
| Reads (React)      | `run-reads.ts` + `use-run-screen-data.ts`   | `use*Slice` hooks with `useShallow`; screen routes use exact `RunScreenDataByScreen`                                                                       |
| Writes             | `run-session-write-port.ts`                 | Re-exports `write-port-run.ts` + `write-port-session.ts` (which re-exports homestead/meta). Draft mutators only                                            |
| Lifecycle          | `run-session-lifecycle-port.ts`             | `restoreRun`, `snapshotRun`, `teardownRun`, `hydrateModeRunInDraft`                                                                                        |
| Actions (React)    | `store-actions.ts`                          | `useSettingsActions`, `useHomesteadActions`, `useSetHasActiveBattle`, `useCollectionActions`                                                               |

Gold is the shared purse `runProfile.gold`. Canonical mutators are `setGold`/`addGold`/`deductGold`/`grantStartGold` (`write-port-run.ts`). They keep `battleState.gold` synced via `syncBattleGoldFromPurse` / `syncPurseFromBattleGold`. Do not introduce `setRunGold`-style aliases.

## Persistence

Codecs own defaults/encode/hydrate/subscribe (`persistence-codec.ts:PersistenceCodec`). Gameplay codecs receive a draft on hydrate.

- `runProfilePersistenceCodec` (`run-save-readers.ts`), `profilePersistenceCodec` (`profile-store.ts`), `gearPersistenceCodec` (`gear-store.ts`) → composed in `shared/storage/persistence.ts`
- `ActiveRunData` save/resume boundary: `run-resume-codec.ts` (`encodeRunResumeSnapshot` / `decodeRunResumeSnapshot`) + `encode-interrupted-flow.ts` (`InterruptedFlow` for rewards/destinations). Shops are screen-gated via `encodePersistedShops`. Battle persistence uses `PersistedBattleStateSchema`.
- Parked runs (`parked-runs.ts` + `run-park-restore.ts`) handle mode switching (campaign/labyrinth/wildwood).

## Conventions

- `store-utils.ts:deepFreezeInDev` freezes in DEV only; excluded from prod via `import.meta.env.DEV`.
- `run-meta-rebind.ts:rebindLiveRunMeta` recomputes `runMetaMaxHealth` and battle `gearEffects`/`talentEffects` after gear/talent changes; calls `syncBattleGoldFromPurse`.
- `write-port-homestead.ts` is a draft-aware façade over `homestead-actions.ts` that calls `rebindLiveRunMeta` on success.
- `reset.ts:clearAllPersistentGameData` is the profile wipe path; `resetTransientRunUi` is test-lifecycle helper.

## Testing

- `tests/features/alchemy/shared/stores/` covers transactions, resume codec, park/restore, gold purse, slices, screen data.
- Changes to save shape must update `src/lib/validation/save-schemas` and `MIGRATIONS.md` together.
