# Alchemy Steam store-page assets

This directory retains the selected working set for the full-game Steam store page.
The player selected the images on November 1, 2026. They have not been uploaded,
previewed in Steamworks, or approved by Valve. Do not interpret selection as final
release qualification. The user is producing trailers separately.

## Graphical uploads

`capsules/` contains the chosen upload-size images, copied without alteration from
the reviewed exports. Filenames identify dimensions. Use the exact files below;
`references/small-capsule-preview-120x45.png` is only a readability preview.

| Steam asset            | File                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| Store header           | `capsules/store-header-920x430.png`                                              |
| Small capsule          | `capsules/store-small-462x174.png` — composite A                                 |
| Main capsule           | `capsules/store-main-1232x706.png` — proportional crop of the header             |
| Store vertical capsule | `capsules/store-vertical-748x896.png`                                            |
| Library capsule        | `capsules/library-capsule-600x900.png`                                           |
| Library header         | `capsules/library-header-920x430.png`                                            |
| Library hero           | `capsules/library-hero-3840x1240.png` — text-free                                |
| Library logo           | `capsules/library-logo-reconstruction-2160x720.png` — transparent reconstruction |
| App icon               | `capsules/app-icon-184.jpg`                                                      |
| Shortcut icon          | `capsules/shortcut-icon-256.png`                                                 |

The transparent `masters/wordmark-reconstruction-2172x724.png` is an AI-assisted
reconstruction, not a pixel-exact extraction. The selected hero has important
figures outside Steam's central safe area. Review the hero crops, logo placement,
small-capsule readability, and lettering consistency before submission. Steamworks
preview and review remain outstanding. Preserve proportions: no stretching.

`masters/` retains the four selected Sunburst image masters, the earlier selected
header B reference, and the reusable transparent wordmark. `references/` retains
sanitized generation prompts and the small-capsule preview. The Sunburst masters
are inputs to the selected exports; the header B reference is the earlier creative
reference, not the final header. See the [asset workflow](../../Docs/WORKFLOWS-ASSETS.md)
for canonical in-game asset sources. These marketing files are not game-build inputs.

## Gameplay screenshots

`screenshots/` contains all eleven selected 1920 × 1080 PNGs. Their numbered names
identify files and preserve the selection sequence; they do **not** prescribe the
final Steam gallery order. Five show battle:

| File                               | Selected scene                                             |
| ---------------------------------- | ---------------------------------------------------------- |
| `01-labyrinth.png`                 | Labyrinth, Fire Imp encounter tooltip                      |
| `02-battle-rogue-fox.png`          | Rogue and Fox, Blackjack                                   |
| `03-battle-warlock-phoenix.png`    | Warlock and Phoenix, corrupted Fangs, Frostfire/Venomflash |
| `04-battle-druid-bear.png`         | Druid and Bear, corrupted Grasping Vines, Thunderclap      |
| `05-homestead.png`                 | Hunter's Lodge upgrade                                     |
| `06-talent-categories.png`         | Talent categories, Burn highlighted                        |
| `07-talent-tree.png`               | Burn talent tree with seven nodes unlocked                 |
| `08-unique.png`                    | Armory, Kingbreaker Unique                                 |
| `09-trinket.png`                   | Armory, Lucky Clover                                       |
| `10-battle-wizard-frost-whelp.png` | Wizard and Frost Whelp, Wishing Frostbolt, normal damage   |
| `11-battle-ranger-wolf.png`        | Ranger and Wolf, Leeching Venom Arrow, normal damage       |

These are actual game captures, not composited UI. Prepared profiles and battle
states were used for setup; card alterations used game logic, and floating combat
feedback came from actions in the game. Recheck that the depicted state and content
are attainable and accurate in the final release build. Check screenshot freshness
against later gameplay, balance, art, or UI changes; recapture rather than edit
screenshots to conceal changes. Select the final order and review at least four
for Steam's all-ages flag if appropriate. The earlier Homestead companion-bond
screenshot was discussed but not selected.

## Publishing decisions and remaining work

- [Store copy review](./store-copy-review.md) retains the unapproved English draft
  and points to the existing canonical full-game/demo source and localizations.
- [Release setup](../../Docs/RELEASE_SETUP.md#steam-ai-disclosure) owns the current
  draft AI disclosure. [Third-party notices](../../THIRD_PARTY_NOTICES.md) owns
  provenance; sound effects are not AI-generated and their source/rights review
  remains open.
- Confirm final full-game scope, supported languages, screenshot suitability,
  rights and notices, and current Steam requirements. Once the Steam page exists,
  upload and preview the assets, complete the content survey, and submit for review.
- `SHA256SUMS.txt` records the retained images for copy-integrity checks; it is not
  Steam or Valve approval. From this directory, run `shasum -a 256 -c SHA256SUMS.txt`.

Steam's [graphical asset overview](https://partner.steamgames.com/doc/store/assets),
[screenshot guidance](https://partner.steamgames.com/doc/store/assets/standard#screenshots),
and [library asset guidance](https://partner.steamgames.com/doc/store/assets/libraryassets)
are the source for current upload and content requirements.
