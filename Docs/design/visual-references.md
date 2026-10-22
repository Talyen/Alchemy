# Current visual references

Use these references for the stated qualities, not as permission to copy every
feature. Acceptance and promotion follow [visual acceptance](../UI_VISUAL_REVIEW.md).
Artwork masters remain in the external Asset Library; these links use their
committed optimized counterparts.

## Approved artwork anchors

These are the canonical style references already named by
[asset workflows](../WORKFLOWS-ASSETS.md#art-style-and-generation-prompts).
They establish art treatment, not approved screen layouts.

| Reference                                                                   | Qualities to compare                                                       | Scope                              |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| [Knight](../../src/assets/optimized/knight.webp)                            | Bold silhouette, angular pose, confident ink contours, hard shading planes | Character identity and portraits   |
| [Wizard](../../src/assets/optimized/wizard.webp)                            | Exaggerated perspective, graphic color blocking, integrated environment    | Character/environment relationship |
| [Fireball](../../src/assets/optimized/fireball.webp)                        | Dominant action motif, directional energy, readability at card size        | Ability art                        |
| [Discordant Dice](../../src/assets/optimized/crafting-discordant-dice.webp) | Large object, broad features, quiet surrounding field                      | Crafting currency                  |
| [Ascension Seal](../../src/assets/optimized/crafting-ascension-seal.webp)   | Distinct object silhouette and controlled small-scale detail               | Crafting currency                  |

Inspect the actual images and the relevant destination crop; this table alone is
not reference review. An asset's presence here does not approve new generated
variants or a screen containing it.

## Screen composition calibration

No screen screenshot is designated as user-approved by this process change.
The next substantial UI task must supply the pilot comparison described in
[visual acceptance](../UI_VISUAL_REVIEW.md#calibrate-on-one-screen).
Until then, name baseline screenshots and proposed references explicitly as
unapproved for composition; use the artwork anchors only for their stated scope.
Do not treat current code, an agent's score, or a successful check as approval.

After explicit user selection, keep a small current set here. Each screen entry
must link the actual approved image, identify the screen/state/viewport, record
who approved it and when, and state which composition, typography, density,
artwork-to-chrome balance or materials may be reused. Capture provenance must be
specific enough to distinguish a screenshot selection from general task approval.
Replace superseded entries rather than accumulate a design history.

## Rejected patterns

These are concrete review examples, not screenshots of existing screens:

| Treatment                                                                                                | Why it fails                                                               | Required correction                                                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A resource count, "Upgrade" button, and a paragraph saying "Use your resources to upgrade this building" | The paragraph repeats the control and visible state                        | Keep necessary cost/consequence information; remove the narration       |
| Every item wrapped in a panel with its own heading, subtitle, badge and divider                          | Repeated chrome competes with artwork and makes every element equally loud | Group by the actual player decision; reuse quieter shared surfaces      |
| Dim art and an unclear action, patched with arrows, glowing borders and instructions                     | Decoration and prose compensate for a weak affordance                      | Make the action, availability and outcome legible in the control itself |

Add rejected screenshot examples only from material the user has actually
rejected, with the specific visible failure and intended lesson. Do not invent
user feedback or preserve arbitrary bad screenshots as a permanent archive.
