# Save Migration Guide

Checklist for a schema change: [WORKFLOWS.md § Change persisted save data](../../../../../docs/WORKFLOWS.md#change-persisted-save-data). This file is the save-compat contract.

This file documents how to change persisted save data without breaking player progress. **CI is the source of truth** — `tests/architecture/save-migration-guard.test.ts` and `tests/architecture/save-migration-contract.test.ts` enforce the contract on every `npm run test:ship:unit`.

## Supported baseline

`LAUNCH_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts` is the
**minimum supported** save shape. Read the current value from that source; do
not copy the number into documentation. `migrateSaveDataToCurrent` stamps
`CURRENT_SAVE_SCHEMA_VERSION`, while Zod defaults and `.catch()` repair the
envelope.

After public launch, treat `LAUNCH_SAVE_SCHEMA_VERSION` as frozen and never remove steps that players can still hold.

## When to increment

Increment `CURRENT_SAVE_SCHEMA_VERSION` when a change requires old saved payloads to be transformed before normal field cleanup can safely load them.

Examples:

- Renaming or moving saved fields.
- Changing the shape of `activeRun`, homestead records, talents, or collection data.
- Replacing array-shaped progress with record-shaped progress.
- Changing meanings or units of saved numeric values.

Do **not** increment for purely additive fields that can safely use defaults in Zod / `defaults.ts` (for example optional shop refresh counters). Replacing the resume claim-surface triad with `activeRun.interruptedFlow` required a floor bump (see below).

## Single-responsibility rule

| Change                                                  | Where                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Schema version stamp at load                            | `migrateSaveDataToCurrent` in `src/lib/validation/migration/index.ts`                                                            |
| Additive fields with defaults                           | Zod `.default()` / `.catch()` and `defaults.ts` — no schema bump                                                                 |
| Deck / content-system soft fixes on already-valid shape | `normalize-active-run-data.ts` (does **not** downgrade labyrinth/wildwood; missing map/draft fails refine and drops `activeRun`) |

**Do not** put rename logic in `save-schemas/active-run.ts` transforms. Zod must only validate the current shape after preprocess migration.

## Required pattern (automated)

When the supported floor and current version are equal, loading is stamp-only;
add step modules when a real post-floor transform is required.

For a schema bump from `N` to `N + 1`:

1. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
2. Add `migrateVNToVNPlus1` to `src/lib/validation/migration/content-steps.ts` or a new topical `steps-*.ts` file (delegate nested work to `migration/` helpers when needed).
3. Chain it from `migrateSaveDataToCurrent` in `src/lib/validation/migration/index.ts`.
4. Update Zod schemas in `src/lib/validation/save-schemas/` and `defaults.ts`.
5. Add a fixture to `CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION` in `tests/fixtures/legacy-saves.ts` (CI fails if any source version `LAUNCH … N-1` is missing).
6. If the change touches `activeRun` nested state, add or extend a scenario in `MIGRATION_SCENARIO_FIXTURES` and assert gameplay outcomes in `save-migration-guard.test.ts`.
7. Run `npm run check:ship` — tests use `normalizeSaveData` → `SaveDataSchema.parse` (test wrapper around the same Zod schema). Production load uses `safeParseWithErrors(SaveDataSchema, …)` in `io.ts`.

## `saveSchemaVersion` vs `contentVersion`

- **`saveSchemaVersion`** — persisted **structure** (field renames, required nested shapes). Bump with a migration step.
- **`contentVersion`** — reserved for **ID or meaning remaps** in game content
  (card/trinket id splits). Only bump when a migration handler exists for the
  remap; the migration steps and tests are the source of truth for current
  remaps.

## Test expectations

Migration tests must verify gameplay progress, not just field presence:

- Collection discoveries remain unlocked.
- Talent XP and unlocked talents remain usable.
- Homestead materials and upgrade tiers remain intact.
- Active campaign, labyrinth, and wildwood runs resume when structurally valid (**`activeRun` must not be silently dropped**).
- Mid-combat snapshots preserve trinket effects, gear effects, and combat flags.
- Active and parked runs preserve Boons, pending reward meaning, and battle Trinket manifests across the schema-11 to schema-12 rename.
- Schema-11 jewelry loadouts map left Ring to left Accessory and Amulet to right Accessory; the old middle right Ring is unequipped but remains in inventory. Permanent Trinket ownership starts empty because discovery does not imply ownership.
- Every fixture is **idempotent** after `normalizeSaveData`.

## Future schema saves

Saves with a schema newer than the current build are intentionally not migrated or overwritten. Candidates are evaluated in authority order; encountering a recognizable future-versioned candidate immediately protects the session instead of falling through to an older backup that autosave could write over it. The load path returns defaults for the session and disables autosave writes so an older build cannot destroy newer progress. The player-facing Save Protected screen offers update guidance plus an explicit “Delete local save and continue” escape hatch. That wipe clears the full candidate set (desktop `save.json` + bak.1–3 + tmp, then Steam Cloud when available) and fails closed if cloud delete fails so a residual mirror cannot re-block boot. Dev builds also accept `?wipeLocalSave=1` to clear before bootstrap.

## Public save contract

The supported floor may move only when the team deliberately drops an
unsupported local shape. Once public saves exist, freeze that floor. Every bump
to `CURRENT_SAVE_SCHEMA_VERSION >= LAUNCH_SAVE_SCHEMA_VERSION` is a
save-compat commitment: a player upgrading from any supported build must be
able to load and play the existing save.

### Policy: local is authoritative

Steam Cloud is a one-way mirror. Writes go local-first (atomic, with backup-ring rotation) and then mirror to Steam Cloud. On load, candidates are walked in preference order (local → bak.1 → bak.2 → bak.3 → cloud). Corrupt candidates fall through to the next recovery source. A recognizable future-versioned candidate stops traversal and opens the Save Protected screen with writes disabled; otherwise the first compatible candidate that Zod-validates is used.

Browser lifecycle exits (`visibilitychange`, `pagehide`, and `beforeunload`) synchronously flush the latest dirty snapshot to `localStorage`. Desktop IPC remains on the serialized asynchronous queue, so the earlier visibility/pagehide signals give it time to finish before the window closes. A terminal browser flush supersedes any queued snapshot that has not started writing.

### Implementation rules

- Schema migration steps cover `LAUNCH_SAVE_SCHEMA_VERSION → CURRENT_SAVE_SCHEMA_VERSION` only. Do not remove a supported step without raising `LAUNCH_SAVE_SCHEMA_VERSION` in the same change.
- Card IDs that disappear from the live catalog must be added to `TOMBSTONED_CARD_IDS` in `src/lib/validation/migration/tombstoned-content-ids.ts`. The guard test in `save-migration-guard.test.ts` fails CI if a fixture references a card ID that is neither in the catalog nor in the tombstone set.
- Saved active-run decks are eagerly hydrated at load time: card IDs are resolved against the live library, and any card whose ID no longer exists is silently dropped from the deck. The run always has a valid, drawable set of cards. No player-facing diagnostics.
- The `SaveLoadStatus` shape has four variants: `ok`, `unsupported-newer-schema`, `unsupported-newer-content`, and `corrupt`. No diagnostic fields surface to the player.

## Progression gate fields

When adding a new saved field that gates features (unlocks, meta screens, game modes):

1. Decide the default for new players — usually empty (`[]`, `{}`, or `false`).
2. List inferrable existing fields for backfill in the migration step only when a real signal exists.
3. Add a fixture at version `N−1` in `tests/fixtures/legacy-saves.ts`.
4. Assert **gameplay outcome** in `save-migration-guard.test.ts` — not only JSON field presence.

## Active-run RNG streams (`activeRun.rng`)

Active runs persist a seed and counters for named run-outcome streams. This is an additive nested field, so it does not require a top-level schema-version bump: `ActiveRunDataSchema` creates a fresh seed with zero counters when loading a legacy active run. After that first load, the normal autosave writes the explicit RNG state and all subsequent resumes continue the same sequence.

## Shop offerings (`activeRun` shop fields)

Shop inventories (`shopState`, `alchemistState`, `trinketShopState`, `equipmentShopState`) persist only while `currentScreen` is that shop. Leaving a shop clears in-memory offerings in the same command as destination advance, so autosave and session state agree. No schema bump: absent shop fields already default to empty.

The schema-12 migration reinterprets a saved Trinket Shop as a permanent vendor. Restore filters its offerings against permanent ownership; an exhausted restored shop is a sold-out state that can still be left safely.

## Mystery visit (`activeRun.mysteryVisit`)

Mystery visit blobs persist only while `currentScreen` is mystery. New choices use random card removal and do not set `pendingRemoval`. A loaded visit with legacy `pendingRemoval: true` keeps that flag until the player finishes the already-open picker; encode writes it only while unresolved so repeated saves cannot bypass the removal.

## Interrupted flow (`activeRun.interruptedFlow`)

Discriminated union (`kind: none | primary-reward | companion-reward | destination`) that records which claim surface the run should resume on. Encode maps live session reward/companion/claim state into one arm; decode switches on `kind` with no legacy inference. Reward payloads live under `pending` on the reward arms; destination-only resume carries destinations and victory metadata on the destination arm. Pre-launch floor raise to schema 11 dropped the prior `resumePhase` + `destinationChoices` + top-level `pendingReward` triad.

## Battle transition continuation

`activeCombat.pendingBattleTransition` is an additive field with a `null` default. New saves use it to carry computed opening-draw and enemy-turn results across presentation delays. Opening draws persist the empty-hand start state plus an `{ kind: "opening-draw" }` result and fast-forward on boot instead of replaying presentation. Enemy-phase battle state without pending transition metadata is recovered on decode as `{ kind: "legacy-enemy-turn" }`; boot resume runs `recoverLegacyEnemyPhase` to force a playable player turn. Persisted `{ kind: "legacy-enemy-turn" }` markers are still accepted by Zod.

## Parked runs and shared gold

`parkedRuns` (`Partial<Record<ContentSystemId, ActiveRunData>>`) and `runRecency` are additive save fields with empty defaults. Load migrates a singular `activeRun` in place and does not hydrate parked slots until that mode is resumed. A corrupt parked slot is dropped; it does not wipe the save.

Gold is the profile purse (`gold`). On load, in-combat `activeCombat.battleState.gold` wins; otherwise a positive leftover `activeRun.runGold` is copied into `gold`. The current wire shape does not persist `activeRun.runGold`. `runMetaMaxHealth` is additive (default 0, treated as `runMaxHealth` when missing) so combat HP bonuses survive a meta rebind.
