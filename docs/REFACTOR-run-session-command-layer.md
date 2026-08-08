# Refactor: collapse the run-session command/transaction layer

Status: implemented
Owner: run-session / persistence seam
Touches: `src/features/alchemy/shared/stores/**`, `docs/ARCHITECTURE.md`, `tests/**`

## Why

`gameplay-state-store.ts` sits on **Zustand + Immer middleware** (which already provide
subscriptions and immutable draft updates) and additionally hand-rolls a **third** state
mechanism on top: `transactionDepth`, `transactionDraft`, `transactionAwareSet/Get`,
`rawSet`/`rawGet`, `applyGameplayStateUpdate`, and a manual `gameplayCommitListeners`
set. A parallel module (`run-session-command.ts`) adds `transactionFailed` and a deferred
`transactionEffects` queue. Every slice-action `set` re-produces the whole root draft, so
a command with N mutations runs N full `produce` calls plus a final publish.

The only reason the nesting machinery exists is the call pattern: every write-port helper
is itself a self-dispatching command (`bindWriteAction`, ~40 exports), so compound
operations must nest dispatches:

- `run-setup/run/content-system-navigation.ts:60-76` wraps `applyRunStartSnapshot`
  (itself a dispatch) in an outer dispatch.
- `shell/use-wildwood-gauntlet-flow.ts:147-151` calls `setRunDeck` + `setPendingCharacterId`
  (both dispatches) inside a dispatch.
- `run-session-write-port.ts:209-224` (`commitDestinationClaim`) batches four slice actions.

Remove the nesting and ~100 lines of module-scope stateful transaction code disappears,
along with the per-mutation double-drafting.

A secondary finding in the same layer: the active-run read view is assembled three times
(`pickActiveRunFields`/`pickActiveRunView` in `run-state-init.ts`, `toRunSession` in
`run-session-model.ts`, `useRunOrchestrationPort` in `run-session-react-ports.ts`).

## Target shape

- **One entry, one publish.** `dispatchRunSessionCommand(mutate)` opens a single `produce`
  over the committed root, runs `mutate(draft)` against that draft, and publishes exactly
  once through Zustand. A thrown recipe discards the draft and skips side effects.
- **Draft-mutating write port.** Write-port helpers take `draft` as their first argument
  (`setRunGold(draft, 7)`) and compose freely inside one dispatch body. No command calls
  another command; no nesting; no `transactionDepth`/`transactionDraft`/effect queue.
- **Subscriptions on Zustand.** `subscribeGameplayCommits` becomes a thin wrapper over
  `useGameplayStateStore.subscribe`; the codec subscribers in `gear-store.ts:44`,
  `profile-store.ts:39`, `run-save-readers.ts:60`, and `persistence-coordinator.ts:34`
  are unchanged.
- **One canonical read view.** `pickActiveRunView` is the single active-run projection.

## Contract preserved (from `tests/features/alchemy/shared/stores/run-session-transaction.test.ts`)

| Behavior                                                                      | Fate                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| One commit after multiple mutations in one command                            | Preserved                                                        |
| Rollback: thrown work discards all writes + RNG, no effects run               | Preserved                                                        |
| `afterCommit` runs after the committed snapshot is published, not on rollback | Preserved (runs after `setState`)                                |
| Battle continuation + intermediate state persist in one commit                | Preserved                                                        |
| Unchanged transaction publishes no commit                                     | Preserved (`produce` returns same ref)                           |
| Nested effects defer to outer commit                                          | **Removed** — replaced by "compound mutators publish one commit" |
| Nested commands collapse into one commit                                      | **Removed** — replaced by mutator composition                    |

---

## Phase 1 — Canonical active-run read view (low risk, no behavior change)

Goal: exactly one projection of `activeRun`; delete the parallel spreads.

Files:

- `shared/stores/run-state-init.ts` — keep `pickActiveRunView`; make
  `pickActiveRunFields` an alias or remove it (check callers first: `run-resume-codec.ts:38`,
  `run-session-react-ports.ts`).
- `shared/stores/run-session-react-ports.ts` — `useRunOrchestrationPort` selects through
  the canonical projection instead of `{ ...pickActiveRunFields(...) }`.
- `shared/stores/run-session-model.ts` — `toRunSession` already uses `pickActiveRunView`;
  confirm no second spread.
- `shared/stores/run-session-read-port.ts` — `readActiveRun` already delegates; confirm.

Tests: `run-session-read-port.test.ts`, `run-domain.test.ts`.
Verify: `npm test && npm run lint`.

Exit: one canonical `ActiveRunReadView` projection; `rg "pickActiveRunFields"` returns
only the canonical module.

---

## Phase 2 — Single-produce command boundary (small, internal)

Goal: collapse the three state-update paths to one. Behavior and API unchanged; the
transaction tests stay green.

Files:

- `shared/stores/gameplay-state-store.ts`
  - Aggregate action groups mutate the draft supplied by the command (no per-call
    `produce`); delete `rawSet`/`rawGet` and the manual `gameplayCommitListeners` set.
  - `readGameplayState()` returns the committed aggregate only; command recipes use their
    explicit draft parameter for working-state reads.
  - `subscribeGameplayCommits` = thin wrapper over `useGameplayStateStore.subscribe`.
  - Keep `revision` (incremented on publish) so `getRunSessionRevision` keeps working.
- `shared/stores/run-session-command.ts`
  - `dispatchRunSessionCommand` opens one `produce`, runs `execute()` against the draft,
    publishes once via `setState(next, true)`, then runs `afterCommit`.
  - Keep command options only for post-publish effects; there is no depth counter or effect
    queue because commands cannot nest.
- `applyGameplayStateUpdate` — remains the single committed-root publish seam used after
  `produce`; test facades (`tests/helpers/gameplay-store-test.ts`) and `reset.ts` keep working.

Verify: `npm test` (all transaction tests pass unchanged), `npm run lint:ci`.

Exit: `gameplay-state-store.ts` no longer re-produces per slice action; only
`run-session-command.ts` calls `produce`.

---

## Phase 3 — Draft-mutating write port, remove nesting (implemented)

Goal: no nested commands, no transaction machinery, no effect queue.

Step 0 — inventory: enumerate every write-port call site; classify as "inside a dispatch
body" vs "event-time direct call" (e.g. `setScreen` from navigation timers in
`shell/use-screen-transitions.ts`, `setHasActiveBattle`, `setMaterials` in
`app/use-app-navigation.ts`).

Step 1 — write-port becomes mutators:

- `run-session-write-port.ts`: every `bindWriteAction(...)` export becomes
  `(draft, ...args) => run(draft)(...args)` (delete `bindWriteAction`; add a
  `bindDraftMutator` binder or inline). Compound functions (`commitDestinationClaim`,
  `applyRunStartSnapshot`, `awardMaterialsDuringRun`, `finalizeRunXP`, battle transition
  commands) become draft recipes.
- `profile-store.ts:99-103` migrates to the same mutator binder.
- Codec `hydrate` (run-save-readers, gear-store, profile-store) becomes a draft recipe
  consumed inside the coordinator's dispatch.

Step 2 — convert dispatch bodies:

- `dispatchRunSessionCommand(() => { readGameplayState()... })` → `(draft) => { draft... }`
  in all call sites (`run-loop/run/*`, `run-loop/navigation/*`, `run-loop/shop/*`,
  `run-loop/battle/*`, `shell/*`, `run-setup/run/content-system-navigation.ts`,
  `run-transitions.ts`, `reset.ts`).
- Event-time direct calls get wrapped in one `dispatchRunSessionCommand((draft) => ...)`.
  Rule: inside a dispatch body, call only mutators, never command wrappers.

Step 3 — delete machinery:

- `run-session-command.ts`: remove `transactionFailed`, `transactionEffects`, and the
  `afterCommit` queue; `afterCommit` runs right after the single publish.
- `gameplay-state-store.ts`: remove `transactionDepth`/`transactionDraft` and the
  begin/commit helpers.
- `applyGameplayStateUpdate` is removed or kept only for test facades.

Step 4 — non-rollbackable side effects remain behind the command's `afterCommit` hook or
run after the returned result. They never execute from the draft recipe.

Tests:

- `run-session-transaction.test.ts`: delete the two nesting tests; replace with
  "compound mutators publish one commit"; keep the rest.
- `tests/architecture/run-session-command-boundary.test.ts`: assert dispatch owns the
  produce, `beginGameplayTransaction`/`commitGameplayTransaction` no longer exist, and
  write-port exports mutators.
- `tests/architecture/gameplay-state-aggregate.test.ts`, `persistence-coordinator.test.ts`,
  `content-system-navigation.test.ts`, `run-domain.test.ts`: confirm/update.

Docs (same change): `docs/ARCHITECTURE.md` § Run state + § Persistence API + § Session
capability ports; AGENTS.md invariant bullets on `dispatchRunSessionCommand()` remain
true ("synchronous, no await").

Verify: `npm run lint:ci`, `npm test`, `npm run test:ship:e2e`, then
`npm run test:e2e:prepush` (battle transitions + save/resume).

---

## Risks

- Phase 3 touches ~30 modules. Mitigate by landing Phase 2 first (behavior-identical,
  fully green), then Phase 3 as a mechanical codemod followed by the full gates.
- Draft-vs-committed reads: any dispatch body that still calls `readGameplayState()`
  after Phase 3 would silently read stale committed state. Mitigate with a lint rule or
  codemod check that flags `readGameplayState` inside dispatch bodies; keep the boundary
  test that forbids it.
- Event-time call sites forgotten → navigation/hover regressions. Step 0's inventory
  list is the guardrail; the E2E prepush gate covers it.

## Intentionally untouched

- `gear-actions.ts` remains domain-owned; `gear-session-command.ts` is draft-aware so
  gear mutations and active-run health synchronization commit atomically.
- The armory drag FSM, reward/resume codec logic, and battle effect handlers (complexity
  is domain-justified).
- `run-session-lifecycle-port.ts` barrel (it is the lint-enforced seam that keeps feature
  code off `run-transitions`).
