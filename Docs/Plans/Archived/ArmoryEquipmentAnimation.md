---
status: complete
updated: 2026-09-16
---

# Armory equipment movement and inventory ordering

## Summary

Make equipping and unequipping feel like moving items between the inventory and equipment board. Keep the inventory compact, give replaced items predictable destinations, and let players explicitly sort when desired.

Apply the same behavior to Gear and permanent Trinkets. Remember working order separately for each hero and equipment category while Armory is open. Leaving Armory discards that presentation state; equipment and ownership continue saving normally.

## Player-facing behavior

| Action                   | Inventory behavior                                              | Animation                                                                                   |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Replace equipped item    | Replaced item takes the incoming item’s inventory position.     | Both items travel simultaneously between their positions.                                   |
| Equip into an empty slot | Remove the incoming item and close the gap.                     | Item travels to equipment; remaining inventory tiles slide into place.                      |
| Unequip                  | Insert the item at the beginning of the current inventory page. | Item travels to its new tile; existing tiles slide forward.                                 |
| Sort                     | Reorder the full filtered inventory and return to page one.     | Use the existing page transition when changing pages; otherwise animate tile repositioning. |

- Preserve six items per page. Overflow moves onto following pages without leaving holes.
- Stay on the current page after equipment changes, except when removing its last item makes that page cease to exist; then select the preceding valid page.
- Keep existing selection behavior: clicking an unselected equipment slot browses that category; clicking its equipped item while selected unequips it.
- Keep existing compatibility checks, combat restrictions, ownership markers, crafting, and salvage behavior.

### Explicit sorting

Add a compact **Sort** control beside the inventory heading using existing UI primitives:

- Gear: **Rarity** and **Name**.
- Trinkets: **Name**.
- Selecting an option performs a one-time sort, including when choosing the same option again. It does not establish continuously enforced ordering.
- Default Gear ordering on first opening a hero/category is Unique → Astral → Basic, then displayed name A–Z. Unclassified rarity follows Basic. Use instance ID as the final deterministic tie-breaker.
- Default Trinket ordering is displayed name A–Z, then Trinket ID.
- Swaps and unequips modify this working order until the player sorts again.
- Crafting does not automatically move an item after its name or rarity changes.

## Implementation

### Inventory ordering and pagination

Keep the ordering owner within the Armory screen, with a small pure helper for ordering operations and a screen-local hook for state.

- Store ordered item IDs and current page by hero and selected equipment category. Use Gear instance IDs and Trinket IDs, not names or array positions.
- Derive item details and eligibility from the existing screen props. Do not reorder saved inventories or change item ownership.
- Reconcile each working list against current data: remove unavailable IDs, preserve surviving order, and append newly available items deterministically.
- For the active successful equipment action, apply the explicit replacement or insertion rule before generic reconciliation.
- Preserve each visited category’s order and page when switching heroes or slots. Clamp remembered pages when item counts shrink.
- Give the Armory ordering owner control of pagination so insertion positions, visible tiles, and animation destinations use the same list.
- Preserve the current filtering rules, including visibility of items equipped by other heroes and compatibility/reservation feedback.

### Equipment action coordination

Continue using the existing controller callbacks and authoritative equipment state.

1. Before invoking an equipment action, capture the visible source rectangles, relevant equipped items, current page, and incoming item’s inventory position.
2. Invoke the existing mutation immediately.
3. Reconcile the resulting loadout props to confirm what actually changed.
4. Apply working-order changes and animate only confirmed transfers.

Rejected or unchanged actions produce no transfer animation or inventory reorder. Do not infer success merely because a callback ran; several existing callbacks return no result.

No controller, store, save schema, or capability-port changes are required. Internal Armory props will carry controlled pagination, sorting actions, anchor registration, and artwork visibility during transfers.

### Movement rendering

Use the existing `motion/react` dependency with an Armory-local, portaled artwork overlay.

- Animate artwork between measured source and destination rectangles over **220 ms**, using an ease-out curve without bounce, rotation, particles, or new sounds.
- Keep equipment frames, selection borders, and slot backgrounds stationary.
- Match each item’s existing artwork fitting and aspect ratio; animate position and size without stretching the image.
- Hide destination artwork while its flying copy is visible, revealing it on completion. Keep real buttons, layout, and semantics mounted.
- Render overlays as decorative, pointer-transparent elements above the Armory panels.
- Continue the inventory’s existing 200 ms position transitions and add equivalent movement for Trinkets.
- For an empty-slot equip, retain a temporary presentation placeholder during the flight, then close the gap. It must never become a persistent inventory vacancy.
- Suppress stale source tooltips when transfer begins.
- Skip travel and animated reflow under the existing reduced-motion preference; ordering and equipment changes still happen immediately.

Keep animation state separate from saved equipment state. Animation completion must never trigger gameplay mutations or save operations.

### Interruptions and special cases

- **Rapid actions:** finish any previous visual transfer immediately, clear hidden artwork, and start the next accepted action from the current committed layout. Do not queue equipment changes or block input.
- **Navigation, sorting, pagination, resize, or scroll:** settle active transfers before changing context or geometry. Leaving Armory cancels all visual work.
- **Missing or offscreen anchors:** show the correct final state immediately rather than flying toward guessed coordinates.
- **Another hero’s equipped item:** animate from the inventory tile the player clicked. Existing equipment rules handle removal from the other hero.
- **Hand conflicts:** compare all equipment slots before and after the action. A displaced item from the target slot takes the incoming item’s position. Additional displaced items compatible with the current category are inserted immediately after it, in equipment-slot order.
- **Displaced items outside the current category:** preserve the selected category and animate their artwork briefly toward the inventory panel while fading out. They become available in their appropriate category without forcing navigation.
- **Other visited categories affected by equipment changes:** reconcile their contents while preserving existing order; append newly available items. Do not replay transfers when returning to them.
- **Salvage and crafting:** reconcile deleted or changed items through the same ordering owner, preserving their existing feedback and avoiding equipment-flight animations.

Update the Armory and UI documentation with the working-order lifetime, one-time sorting, transfer behavior, and interruption rules.

## Verification and acceptance

### Automated coverage

Extend existing Armory tests and add focused pure ordering tests covering:

- Replacement preserves the clicked inventory position and all unaffected ordering.
- Empty-slot equip compacts inventory without leaving a permanent vacancy.
- Unequip inserts at the current page’s first position, including full-page overflow.
- Removing the final item on the last page clamps pagination correctly.
- Gear and Trinkets follow the same movement rules.
- Sort options produce deterministic ordering and reset to page one.
- Crafting preserves position; salvage removes items; new items append.
- Hero/category switching preserves working order and page while Armory remains mounted; remounting restores default sorting.
- Rejected, reserved, incompatible, and unchanged actions leave order unchanged.
- Hand conflicts and cross-hero transfers reflect the authoritative final loadout.
- Interrupted transfers restore artwork visibility and leave no overlays behind.
- Reduced motion preserves all behavior without travel.

Test visible outcomes and ordering invariants rather than exact intermediate animation coordinates.

### Browser verification

Visually exercise empty-slot equip, replacement, unequip, page boundaries, Trinkets, hand conflicts, rapid repeated clicks, and navigation during movement. Check both side-by-side and stacked Armory layouts.

Confirm there is no duplicate artwork, stale tooltip, clipping, persistent hole, page jump during a normal swap, or interaction delay. Verify reduced motion and keyboard activation.

Use the repository’s verifier workflow and run `npm run check -- <task-owned paths>` before handoff. Preserve the unrelated icon and desktop changes already present in the checkout.

## Defaults and boundaries

- Working order lasts only while Armory is mounted; no persistence migration.
- Existing equipment validation, saving, and combat effects remain authoritative and immediate.
- This includes explicit sorting and animations for Gear and Trinkets.
- Drag-and-drop, manual inventory rearrangement, new sound effects, and persistent custom ordering are outside this change.
