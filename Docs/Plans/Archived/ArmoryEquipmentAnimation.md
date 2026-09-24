---
status: complete
updated: 2026-09-24
---

# Armory equipment movement and inventory ordering

The Armory gives Gear and permanent Trinkets one transient working order per hero and slot. A confirmed equipment change updates that order immediately; artwork then travels between inventory and equipment, while nearby tiles reflow. Replacement occupies the incoming item's position, empty-slot equips close the gap, and unequips insert at the current page's first position. Sorting is a one-time action rather than a persistent inventory preference.

This design keeps saved ownership and authoritative equipment rules separate from presentation, including hand conflicts, interruption, and reduced motion. No save migration was needed. The implementation commit includes Armory ordering and transfer coverage; the former plan did not retain a browser-verification result.

Implementation: `7a50006b`. Current owners: [Armory ordering](../../ARMORY.md#inventory-ordering-and-equipment-movement) and [UI motion](../../UI_MOTION.md#equipment-movement-animations).
