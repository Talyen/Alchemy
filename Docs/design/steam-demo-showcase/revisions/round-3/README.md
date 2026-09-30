# Round 3 showcase drafts

Pending image approval; no game artwork or screen layout has been replaced.

- [Expanded mosaic](./expanded-mosaic.html): eight heroes in a tall fractured mosaic, with a taller boss panel beside them
- [Boss gallery](./boss-gallery.html): full-width boss artwork above an eight-hero mosaic and the feature panels

Regenerate with `node scripts/render-demo-showcase-round3.mjs`. PNG review outputs
are written to `reports/demo-showcase-revisions/expanded-mosaic.png` and
`boss-gallery.png`. The renderer preserves item-image proportions and places the
statistics in their related feature panels instead of a separate footer strip.

## Content and source facts

All eight current hero portraits are included. Bosses remain the seven-entry
shared Campaign pool; Boss Battles does not imply later-act-exclusive types.
[counts.json](./counts.json) records the actual catalogs: eight heroes, 105 cards,
104 offerable/draft cards, 200 Talents, 29 Uniques, 24 Trinkets, and 23 Homestead
building/farm/research entries. The renderer rejects unsupported marketing thresholds.

The proposed stat labels are 8+ Heroes, 200+ Talents, 7+ Bosses, 100+ Cards,
25+ Uniques, 20+ Trinkets, and 20+ Upgrades. These mean at least those quantities;
the item and progression systems also begin in the demo.

Wildwood Draft uses Draw Pile, Discard Pile, Slash, Fireball, Frostbolt, and Poison
Dagger artwork. Items use Brass Censer, Sin-Eater's Lantern, Astral Flail, and
Discordant Dice, with `object-fit: contain` rather than cropped thumbnails.

Homestead uses Wheat Field, Blacksmith's Forge, and **Library temporarily**, as
approved for this draft. Moonlit Observatory artwork was not found in this checkout.
The Wheat Field image is copied losslessly into a review PNG for browser loading;
its original JPEG is unchanged. Other source artwork is unchanged.

## Screen-space evidence

A current production Electron run at maximum game size measured the image at
1091×614 CSS pixels within a 1280×720 window, and 1233×694 within 1280×800.
The image region has essentially the same height as the image, so it already
uses the available vertical space. Compact heading/action spacing could recover
roughly 15–25 pixels; it is not an implemented change in these drafts.

Moving statistics out of the separate footer removes approximately 13% of the
old image canvas overhead, which is redistributed to the feature panels.
Measurement output is retained locally in `reports/demo-copy-review/measurements.json`.
