---
status: complete
updated: 2026-09-21
---

# Armory transfer ownership

## Finding

`use-armory-transfers.ts` mixes equipment commands, inventory placement, DOM
measurement, and animation state. Gear and Trinkets duplicate replacement logic;
animation eligibility decides which inventory operation runs. Three separately
stored animation values can disagree. The ordering hook exposes intermediate
operations, requiring callers to choose and sometimes overwrite them.

## Plan

1. Give ordering one confirmed-equip operation, covering replacement, empty slots,
   and hand conflicts independently of animation availability.
2. Introduce a pure transfer presentation builder shared by Gear and Trinkets.
   Keep browser measurements at a small DOM seam. Derive hidden artwork from
   the active flights rather than maintaining parallel state.
3. Reduce the transfer hook to command orchestration and transfer lifetime.
   Keep existing equipment rules and controller/save contracts.
4. Strengthen ordering tests to assert results after updated inventory props;
   cover presentation eligibility, cancellation, and failed equipment commands.
5. Update the Armory owner documentation, review the diff, and run task-scoped
   verification. Archive this plan at completion.

## Scope

Preserve equipment behavior, pagination, hand conflicts, motion preferences,
combat restrictions, and existing save compatibility. Existing save-storage
changes belong to another task.

## Outcome

Implemented all five steps. Ordering has one equip operation; Gear and Trinkets
share pure flight construction and a DOM measurement seam. Hidden artwork is
derived from flights, and nonanimated operations clear transient placeholders.
Strengthened inventory-refresh assertions and added motion, hand-conflict,
command rejection, missing-artwork, and cancellation coverage. No tests retired.
The focused tests and dependency-selected verification passed. The first handoff
run found one array-type lint violation, corrected before the final gate.
