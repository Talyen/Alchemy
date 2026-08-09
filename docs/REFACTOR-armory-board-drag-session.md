# Refactor: one Armory board-drag session

Status: implemented
Owner: Armory UI interaction
Touches: `src/features/alchemy/meta/screens/armory-screen.tsx`,
`src/features/alchemy/meta/screens/armory/`, Armory unit and E2E tests

Completion note: implemented in August 2026. Gear and currency now enter one
`useArmoryBoardDrag` owner backed by one explicit primary-session union. The cyclic
`beginHeldCurrencyRef` bridge, separate active flags, duplicated clear paths,
`FsmDragRefs` synchronization bundle, and the two domain wrapper hooks are removed.
Pure placement/magnet math and all existing interaction semantics remain intact.

## Finding

The Armory has one inventory board and permits one carried item at a time, but it
models that interaction with two independent instances of `useBoardDrag`: one in
`useArmoryGearDrag` and one in `useArmoryCurrencyDrag`.

The two machines are then coupled in both directions to support displacement:

- a gear drop can hand a displaced currency to the currency machine through
  `onHoldCurrency`;
- a currency drop can hand displaced gear to the gear machine through
  `onSwapWithItem`;
- because the gear hook is declared first, `ArmoryScreen` stores
  `beginHeldCurrency` in `beginHeldCurrencyRef` solely to break the declaration-order
  cycle;
- the screen separately combines `isDraggingActive` and
  `isCurrencyDraggingActive`, clears two drag states, and renders two primary drag
  visual shapes.

This is accidental complexity rather than two independent user interactions. A
gear/currency collision is one continuous drag session whose carried item changes.
Representing it as a hand-off between machines creates states the product does not
have (both machines active), spreads cancellation and cleanup across owners, and
makes cross-type swaps harder to reason about and test.

The shared machine has a second, related problem. One logical session is manually
mirrored among React state (`activeId`, `dragVisual`) and mutable refs
(`pendingDragRef`, `activeDragRef`, `pendingCommitRef`, `heldCleanupRef`,
`beginHeldRef`, and `cleanupTimerRef`). Transition helpers in
`board-drag-lifecycle.ts` receive an 11-field `FsmDragRefs` bundle and must update
both the ref and React-state copies of the visual. The history shows that blur,
unmount, aliasing, cursor, and flyover fixes have repeatedly needed special-case
synchronization in this area. Splitting the large hook into files reduced file size,
but did not reduce the number of states or owners.

The domain complexity is legitimate and should remain:

- pointer activation threshold;
- inventory magnet snap and hysteresis;
- equipment-slot destinations for gear;
- gear and currency displacement, including cross-type held-item chaining;
- cancelled-drop reversion;
- double-click equip/unequip flyovers and secondary displaced-item animations;
- blur, visibility, Escape, editability-change, and unmount cleanup.

The refactor should simplify ownership, not remove those behaviors.

## Target shape

- One `useArmoryBoardDrag` owner for the board's primary drag session.
- One discriminated carried-item type:

  ```ts
  type ArmoryDragItem =
    | { kind: "gear"; instance: GearInstance; origin: GearDragOrigin }
    | { kind: "currency"; currencyId: CraftingCurrencyId; origin: CurrencyDragOrigin };
  ```

- One explicit session union whose phases make illegal combinations unrepresentable:
  `idle`, `armed`, `dragging`, `held`, and `animating`.
- A single synchronous session update seam. Pointer handlers need immediately current
  state, so the implementation may keep one session ref paired with one render
  snapshot, but callers must not manually synchronize individual fields.
- Timers, document listeners, and Escape registration are effects derived from the
  current phase. They are resources owned by the hook, not fields passed through a
  generic state bundle.
- Destination geometry remains in pure modules (`board-drag-math.ts` and
  `board-drag-destination.ts`). Gear/currency commit policy remains explicit and
  domain-specific, selected by `item.kind`.
- Secondary gear flyovers may remain a separate visual concern; they must not become
  additional primary drag sessions.

Expected result: cross-type displacement becomes an in-machine transition from one
`ArmoryDragItem` to another; the screen no longer coordinates two FSMs or uses a
callback ref to connect them.

## Plan

### Phase 1 — Lock the behavior at the public seam

Add focused coverage before restructuring:

- gear dropped onto currency commits the gear move and continues holding the
  displaced currency;
- currency dropped onto gear commits the currency move and continues holding the
  displaced gear;
- a second displacement can continue the same held chain;
- Escape, blur, visibility loss, editability loss, and unmount cancel a held item
  without committing it;
- flyover commits only after natural animation completion and is not lost on blur;
- only one primary drag visual/session can be active.

Keep pure magnet and placement coverage in `board-drag-math.test.ts`. Prefer testing
the new combined hook for lifecycle behavior instead of preserving tests that assert
the implementation details of two wrappers.

### Phase 2 — Introduce the unified item and session model

Define `ArmoryDragItem`, `ArmoryDragOrigin`, and an explicit `ArmoryDragSession`
discriminated union near the new hook. Derive `activeItem`, `dragVisual`,
`isDraggingActive`, and `isAnimating` from the phase instead of storing them as
independently mutable values.

Create one private session-update helper that synchronously publishes the whole next
session to event handlers and React. Route all begin, move, finish, cancel, hold, and
flyover transitions through it. Remove `FsmDragRefs` and helpers whose signatures are
mostly React setters/refs; keep or rewrite helpers that are genuinely pure state or
geometry transformations.

Do not introduce a general-purpose FSM library. This machine is local, small in its
number of phases, and has Armory-specific effects; a typed union plus explicit
transition functions is the simpler fit.

### Phase 3 — Merge gear and currency primary-drag ownership

Build `useArmoryBoardDrag` around the unified session:

- `getFootprint` switches on item kind (gear footprint vs. 1x1 currency);
- external equipment-slot resolution applies only to gear;
- inventory destination and magnet behavior remain shared;
- commit dispatch switches on item kind and delegates to focused gear/currency drop
  functions;
- collision results return `ArmoryDragItem | null` as the next held item, so gear ↔
  currency swaps never leave the machine;
- gear double-click flyovers enter the same `animating` phase;
- secondary displaced-gear visuals remain separately derived and cleaned up.

Keep mutation callbacks (`onEquip`, `onUnequip`, and `onMoveBoardItem`) supplied by the
screen/controller boundary. The drag hook owns interaction state, not gear-store
mutation authority.

### Phase 4 — Simplify `ArmoryScreen` and consumers

Replace `useArmoryGearDrag` plus `useArmoryCurrencyDrag` with the unified hook. Delete:

- `beginHeldCurrencyRef` and its synchronization effect;
- `onHoldCurrency` / `onSwapWithItem` cross-hook adapters;
- separate primary clear-state callbacks;
- separate gear/currency active flags where a single board-drag flag is sufficient.

Expose typed gear/currency pointer starters if tile props benefit from those names,
but implement them as thin entry points into the same session. Render a discriminated
primary visual through `ArmoryOverlays`; retain secondary gear visuals as their own
array.

Update `ArmoryWorkspaceGrid`, tile props, and interaction suppression to consume one
active-session flag. This should make the invariant “one board, one carried item”
visible in the component contract.

### Phase 5 — Remove obsolete machinery and update docs

Once callers and tests have migrated, delete or collapse:

- `use-armory-gear-drag.ts`;
- `use-armory-currency-drag.ts`;
- `use-board-drag.ts` if it has no non-Armory consumer;
- `FsmDragRefs` and lifecycle helpers that only synchronize duplicated state;
- obsolete visual/type aliases and wrapper-specific tests.

Keep file boundaries for cohesive pure concerns rather than line-count targets. Update
`docs/ARMORY.md` so its layout and Drag FSM sections describe one primary session and
cross-type displacement as a state transition.

## Verification

Run the focused interaction suite during each phase:

1. `npm test -- tests/features/alchemy/meta/screens/armory/ tests/features/alchemy/meta/screens/armory-screen.test.tsx`
2. `npm run typecheck:all`
3. `npm run lint`
4. `npx playwright test tests/armory-drag-animations.spec.ts tests/armory-crafting.spec.ts tests/gear-equip.spec.ts tests/gear-drag-positions.spec.ts --project chromium`

Before landing, also run the complete path-scoped Gear gate from `CONTRIBUTING.md` and
`npm run deadcode` because multiple hook/type modules should disappear.

## Risks and guardrails

- **Pointer-event timing:** React state alone may be stale within a pointer sequence.
  Keep one synchronous session cell; do not regress to multiple manually paired refs.
- **Deferred flyover mutation:** cancellation and unmount must not accidentally run a
  pending commit. Preserve the existing “natural completion only” tests.
- **Held-item listener leaks:** derive listener installation/cleanup from the `held`
  phase and verify it across Escape, blur, editability changes, and unmount.
- **Cross-type collision semantics:** lock both gear → currency and currency → gear
  behavior before deleting the old wrappers.
- **Scope creep:** do not combine this with gear-store, grid-packing, targeting, salvage,
  or Armory layout changes. Those are separate ownership domains.
- **Dirty worktree:** the current run-session and route-command refactors touch nearby
  controller/routing files. This plan should be implemented after those changes are
  stable, and should preserve any intersecting user work.

## Intentionally untouched

- Pure grid packing and magnet math under `src/lib/gear/` and
  `board-drag-math.ts`.
- Gear mutation commands, HP synchronization, persistence, and save flushing.
- Salvage/currency targeting and transfer-menu workflows.
- Armory visual design, motion timings, and interaction semantics.
