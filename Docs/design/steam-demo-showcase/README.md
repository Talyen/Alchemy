# Selected promo and archived studies

The current game image is the user-supplied
`Raw Assets/Marketing/Unlock Full Game Demo Promo.jpg`, moved unchanged from
Downloads. The marketing manifest owns that source and its optimized WebP.
The selected image is 2752×1536 and displays uncropped at its native aspect ratio.

The composition and renderer below are **archived studies**, not the current
shipping source. Running their renderer updates only the old PNG master; it
does not replace the user-supplied promo or change the manifest.

# Archived composed showcase studies

Approved direction: six equal panels, Alchemy's dark/gold palette, existing art
assembled directly without AI redraw, short labels, and visible later-act bosses.
Cards, Talents, Homestead, and Armory are ongoing game depth, not full-game-only claims.

The editable composition is [index.html](./index.html). Render the 2560×1440 PNG
master with `node scripts/render-demo-showcase.mjs`. The renderer waits
for the local Inter font and every source image to decode before capture.
The master is `Raw Assets/Marketing/Demo Feature Showcase.png`.

## Source inventory

All source files are unchanged originals under `Raw Assets/`:

| Panel              | Sources                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| More Heroes        | Heroes/Wizard.jpeg, Heroes/Alchemist.jpeg, Heroes/Warlock.jpeg, Heroes/Druid.jpeg, Heroes/Wildcard.jpeg                                                   |
| More Campaign Acts | Enemies/The Frostwarden.jpeg, Enemies/The Blight Treant.jpeg                                                                                              |
| The Labyrinth      | Game Modes/The Labyrinth.jpeg                                                                                                                             |
| Wildwood Draft     | Game Modes/Wildwood Draft.jpeg                                                                                                                            |
| Cards & Talents    | Cards/Fireball.jpeg, Cards/Frostbolt.jpeg, Cards/Poison Dagger.jpeg; Talents/Burn.jpeg, Talents/Freeze.jpeg, Talents/Poison.jpeg                          |
| Homestead & Armory | Homestead/Alchemy Lab.jpeg, Homestead/Blacksmith's Forge.jpeg; Gear/Longsword - Astral.jpeg, Gear/Plate Armor - Astral.jpeg, Gear/Spellbook - Astral.jpeg |

The manifest uses the marketing preset: width 2560, WebP quality 90. Run art
optimization and generated export synchronization through the normal
[asset workflow](../../WORKFLOWS-ASSETS.md). The game imports the optimized image
through its curated asset map; accessible image text repeats only the six approved labels.

## Pending alternatives

The [revised layout drafts](./revisions/README.md) are for review only. They do
not replace this approved master or the optimized in-game image.
