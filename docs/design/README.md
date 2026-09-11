# Design archive

Retained art studies and UI mockups live here with their prompts, comparisons,
and approval records. Production authoring sources live in `Raw Assets/`; the
[asset workflow](../WORKFLOWS-ASSETS.md) owns importing them into the game.
Temporary experiments belong in ignored `output/` or `scratch/` at the repository
root. This archive is versioned and is not a disposable build output.

## Artwork

The September 2026 art studies are grouped under `art/`. Their original version
names and relative links are preserved. Preview pages and prompts reflect the
state when each study was made, including historical “pending approval” text.
The [approval record](./art/approved-art/approval.txt) records the final selections
and their installation into `Raw Assets/`.

| Material                                    | Location                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Approved archival copies and decisions      | [Approval record](./art/approved-art/approval.txt)                                                            |
| First resource icons and card back          | [Art trial 1](./art/art-trial-v1/preview.html)                                                                |
| Detailed card backs and crafting currencies | [Art trial 2](./art/art-trial-v2/preview.html)                                                                |
| Simplified Astral Wheel variants            | [Art trial 3](./art/art-trial-v3/preview.html)                                                                |
| Illustrated card back studies               | [Art trial 4](./art/art-trial-v4/preview.html)                                                                |
| Dark card backs with inset gemstones        | [Art trial 5](./art/art-trial-v5/preview.html)                                                                |
| Remaining resource and crafting icons       | [Icon review](./art/remaining-icons-v1/preview.html)                                                          |
| Deck and Discard Pile composition           | [Pile review](./art/card-piles-v1/preview.html), [production notes](./art/card-piles-v1/production-notes.txt) |

Open the HTML previews directly in a browser. Each art study keeps its local
images and generation prompts or production notes together. The optional
`art/card-piles-v1/build.mjs` reproduces the pile study using the repository's
installed Sharp dependency and the adjacent approved card back; it writes only
the study's pile images and preview files.

## UI mockups

[Crafting currency tooltip preview](./ui/crafting-tooltip-preview.html) is a
standalone wording and presentation study. Current crafting behavior is owned
by [ARMORY](../ARMORY.md), and current interaction conventions by [UI](../UI.md).
