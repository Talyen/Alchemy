---
status: complete
updated: 2026-09-07
---

# Keep progress unsaved until storage confirms it

## Objective

Prevent a failed autosave from being forgotten, and make save completion mean that local storage accepted the relevant progress. Approved for implementation on 2026-09-07.

The subsystem was selected with a single JavaScript `Math.random()` draw over the repository's 13 context categories: battle, card, ui, audio, tooltip, gear, rewards, shop, save, run-state, assets, browser, tooling. The draw was `0.64955275571228`; `Math.floor(draw * 13)` selected index 8, save. Exploration stopped after finding the write-acknowledgement issue below.

## Evidence and impact

1. In [the autosave hook](../../../src/app/use-app-save-state.ts), `flush()` calls `dropPending()` before building and writing the snapshot. This clears `isDirty` and the timer before a storage result exists.
2. In [storage I/O](../../../src/features/alchemy/shared/storage/io.ts), `writeSaveSnapshot()` logs both reported failures and thrown errors, then resolves normally. `saveAlchemySaveData()` returns no success information. The hook cannot distinguish durable progress from a failed attempt.
3. The exit path only flushes when `isDirty` is true. After a failed ordinary autosave, a player who makes no further changes can close the game without another save attempt. A temporary storage failure can therefore lose progress even if storage becomes available before exit.
4. Simply moving `dropPending()` after the awaited write would introduce another problem: completion of an older snapshot could erase the dirty state of newer progress. Completion must identify which changes were acknowledged.
5. [The write queue](../../../src/features/alchemy/shared/storage/save-write-queue.ts) already owns serialization and snapshot coalescing. Its nested waits currently expose completion without an outcome. Extend that owner instead of adding another queue or retry service.

These findings came from tracing the code during investigation, before failure regressions were added. The existing autosave, queue, and platform-storage tests all pass: 3 files, 12 tests. They exercise normal saving, exit before debounce, maximum wait, coalescing, and cloud behavior, but do not establish failure recovery at the autosave boundary.

Focused history confirms that commit `9627af54` deliberately made enqueue callers wait for in-flight writes. Preserve that guarantee while making its result meaningful.

## Approved behavior

- Keep progress eligible for saving until the corresponding local write succeeds. A newer successfully written snapshot can satisfy an older coalesced request.
- Retry failed automatic saves while the game remains open, using a single timer and a 10-second minimum interval after failure. New progress replaces the pending snapshot; repeated changes must not bypass this failure cooldown. Exit events may attempt an immediate flush.
- A successful write may acknowledge only the progress included in that write. Later changes remain pending.
- Keep browser exit saves synchronous and desktop exit saves on the existing serialized queue. Desktop shutdown remains best effort; this proposal does not guarantee an asynchronous write after process termination.
- Preserve the existing rule that a failed Steam Cloud mirror does not invalidate a successful local save.
- Preserve Save Protected restrictions and deliberate reset behavior. A skipped or cancelled write is not a successful save and must not start a retry loop.

The intended player-visible impact is more reliable persistence after temporary failures. No balance, rewards, run rules, save format, new screens, or notifications are proposed. Any later proposal to block quitting or show a new warning requires separate explicit approval.

## Plan

- [x] Re-read working-tree changes before implementation. The checkout contains extensive unrelated work, including save documentation and run-state owners; preserve that work and keep this implementation separable.
- [x] Add deterministic regression coverage for a failed ordinary autosave followed by storage recovery and exit without another store change. Use the configurable save backend, fake timers, and deferred promises instead of real delays.
- [x] Define a small typed write outcome in the existing storage owner: saved, failed, or skipped. Carry it through normal saves, exit saves, and [explicit flushes](../../../src/features/alchemy/shared/storage/flush-save.ts). For desktop exit, distinguish a queued attempt from synchronous success and allow its actual completion to be observed. Inspect every consumer before changing return types.
- [x] Give queue completion a precise contract: a caller succeeds only when its snapshot or a newer replacement reaches local storage. If the covering write fails, report failure; clearing or write protection cancels pending work. Keep one runner and one replaceable pending snapshot. Simplify the nested waiting logic only as needed to express this contract, with no generic task scheduler or parallel writer.
- [x] Separate timer cancellation from acknowledgement in the autosave hook. Track change and acknowledged revisions, or an equivalently small monotonic token scheme, so an old completion cannot clear new progress. Derive dirty state from that relationship rather than maintaining contradictory flags.
- [x] Reuse the hook's timer for debounce and failure cooldown. Retain the existing successful-path debounce and maximum-wait behavior. Keep failure cooldown independent of the original dirty timestamp so an expired maximum wait cannot cause a zero-delay retry loop. Stop scheduling on cleanup, disabled persistence, reset, or write protection; late completions must not resurrect cancelled work.
- [x] Integrate terminal writes with the same acknowledgement rules. A browser synchronous success acknowledges its revision immediately. A failed exit attempt leaves work retryable for a later lifecycle event while mounted. A queued desktop attempt is not marked saved until it succeeds. Preserve the rule that terminal snapshots supersede queued snapshots that have not started writing.
- [x] Keep error reporting at the I/O seam. Distinguish serialization errors from backend write errors; currently a thrown backend failure is labelled as serialization failure. Avoid duplicate logging at each layer.
- [x] Update the local-first persistence contract in [MIGRATIONS](../../../src/features/alchemy/shared/storage/MIGRATIONS.md#policy-local-is-authoritative) with acknowledgement, retry, cancellation, and exit guarantees. No schema bump or saved revision field is required: all scheduling metadata stays in memory.
- [x] Run the selected save verification and full task-scoped handoff gate, then complete and archive this plan only after the approved implementation is finished.

## Required regression cases

| Case                                          | Required result                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Backend reports failure or throws             | Caller receives failure and progress remains pending                                       |
| Storage recovers without another change       | Scheduled retry saves the latest progress                                                  |
| Failed save followed by page hide             | Immediate exit attempt includes the unsaved progress                                       |
| Older write completes after a new change      | New change remains pending until covered by a successful write                             |
| Several requests coalesce                     | Covered callers receive the replacement write's outcome                                    |
| Sustained storage failure                     | At most one scheduled retry; no zero-delay loop even with animations disabled              |
| New changes during failure cooldown           | Latest snapshot is used without accelerating retries                                       |
| Clear or write protection during pending work | No stale retry restores deleted or protected progress                                      |
| Hook cleanup followed by late completion      | No new timer or unintended write is created                                                |
| Local succeeds and cloud fails                | Save remains locally successful                                                            |
| Successful ordinary and terminal saves        | Existing debounce, maximum wait, ordering, and synchronous browser guarantees remain valid |

Extend [autosave tests](../../../tests/app/autosave-hook.test.ts), [queue tests](../../../tests/features/alchemy/shared/storage/save-write-queue.test.ts), [storage I/O tests](../../../tests/features/alchemy/shared/storage/storage-io.test.ts), and [platform tests](../../../tests/lib/platform-storage.test.ts) where each behavior is owned. Avoid repeating the entire matrix at every layer. Replace the queue test's real 10 ms sleep with a deferred write gate when touching it.

## Verification and scope

Investigation baseline executed successfully:

```sh
npx vitest run tests/app/autosave-hook.test.ts tests/features/alchemy/shared/storage/save-write-queue.test.ts tests/lib/platform-storage.test.ts
```

After implementation, run `npm run check --` with the complete task-owned path list. Save changes select the save/persistence suite, and executable changes add the applicable static, build, and preview checks. Review the failure and cancellation traces as well as test results. A browser E2E test is unnecessary unless implementation changes a user interaction; deterministic integration tests can exercise the storage failure directly.

Keep this work bounded to write outcomes, autosave scheduling, their direct consumers, and supporting tests/docs. Broader candidate recovery, cloud read policy, save migration cleanup, and persistence redesign are outside this proposal.

## Notes

The main implementation risk is misreporting completion when coalescing, clearing, and lifecycle writes overlap. Define and test those transitions before wiring retries. A permanently unavailable disk still cannot save; this change retains pending intent and limits retries rather than promising recovery from permanent storage failure.

The user approved the full plan. Follow [the plan lifecycle](../README.md#task-handoff) after implementation; other tasks' plans remain untouched.

## Completion

Implemented on 2026-09-07. Save outcomes now flow through the coalescing queue, ordinary writes, terminal writes, and explicit flushes. Autosave keeps revision-based pending state, retries failures with a 10-second cooldown, and cancels old work on reset, protection, disabled persistence, and cleanup. Queue tests now use deferred gates instead of real sleeps; overlapping clears remain protected until every clear completes. Save format and gameplay rules are unchanged.

Task-scoped handoff passed in `check-20260907t201235z-3110-e58ac2`: documentation, dependency-related tests, save/persistence tests, changed tests, CI static checks, web build, and preview smoke. Desktop packaging and lockfile checks were not applicable. The checkout's unrelated edits were preserved. Desktop process exit remains best effort.

This work is uncommitted. The current behavior contract is maintained in [MIGRATIONS](../../../src/features/alchemy/shared/storage/MIGRATIONS.md#policy-local-is-authoritative).
