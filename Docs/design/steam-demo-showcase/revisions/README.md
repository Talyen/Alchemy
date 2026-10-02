# Archived showcase layout drafts

These proposals were awaiting review when created. The [selected user-supplied promo](../README.md)
is now the shipping source; these drafts remain historical alternatives.
The artwork is assembled from existing originals through clipping and positioning;
no original source artwork is repainted. Hero head crops use per-portrait scaling
so Warlock does not dominate the group.

- [Ribbon composition](./ribbon.html): wide fractured hero banner, tall split-column bosses, stacked mode and progression panels
- [Mosaic composition](./mosaic.html): tall fractured hero portrait mosaic, wide split-column bosses, paired modes and progression panels

Regenerate source HTML, count snapshot, and review PNGs with
`node scripts/render-demo-showcase-drafts.mjs`. PNGs are written under
`reports/demo-showcase-revisions/`, outside the shipping asset pipeline.

## Source facts

[counts.json](./counts.json) records the runtime catalogs when the renderer last ran. It counts
cardLibrary, talentPool, uniqueItemList, trinketLibrary, and bossEnemies. The
24-entry trinket catalog is also the shared effect source for run Boons; counts
must not be added together to suggest 48 distinct entries.

Retained counts: 105 cards, 200 Talents, 29 Uniques, 24 Trinkets, and 7 bosses.
Draft copy: 100+ Cards, 200+ Talents, 25+ Uniques, 20+ Trinkets. Each threshold
means at least that quantity, not an inflated estimate or full-game-only count.
Regenerate and verify live counts before reusing those claims.

Campaign `rollFreshBossId` selects from the shared seven-boss catalog without
filtering by act. Act 1 is not fixed to Blight Treant. The draft label Boss Battles
avoids promising additional exclusive boss types; a different boss distribution
would require a separate gameplay decision.

## Source artwork

The five additional heroes use their original portraits in `Raw Assets/Heroes`.
All seven bosses use their named portraits in `Raw Assets/Enemies`.
The Labyrinth and Wildwood Draft use the existing mode paintings.

The item panel uses Brass Censer, Sin-Eater's Lantern, Astral Flail, Astral Emerald
Amulet, Discordant Dice, and Smith's Whetstone. These cover run Boons/persistent
Trinkets, Gear imagery used for Uniques, and crafting materials. No new item is implied.

The Homestead panel uses Alchemy Lab, Companion Sanctuary, and Orchard artwork.
These item/progression systems also begin in the demo and are presented as overall
build depth, not unavailable unlocks.

## Next review round

[Round 3](./round-3/README.md) includes all heroes, integrated statistics,
uncropped item art, card/deck imagery for Wildwood Draft, and more boss space.

## Quieter treatments

[Round 4](./round-4/README.md) tests a stat-free gallery and editorial collage
with fewer frames and a coordinated 3–2–3 hero mosaic.
