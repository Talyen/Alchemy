# Steam demo copy review

Status: **Menu, recap, marketing, and lock revisions approved; other notices pending**.
This review records the current implementation and the remaining copy approvals.

Approved menu, recap, marketing, and lock behavior is owned by
[Steam demo](./STEAM_DEMO.md). Keep this review only while the approvals below
remain open; move any enduring decision into its owner when resolved.

## Pending copy approvals

| Location                                                      | Exact current copy                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Packaged application name                                     | `Alchemy Demo`                                                                         |
| Full-game startup after successful demo progress import       | `Your earned demo progress has been imported. Start a new adventure in the full game.` |
| Import notice action                                          | `Dismiss`                                                                              |
| Pending local save, either edition                            | `Saving…`                                                                              |
| Failed local primary and recovery save writes, either edition | `Couldn’t save`                                                                        |
| Failed-save action                                            | `Retry`                                                                                |

Sources: [application identity](../game-edition.mjs), [import notice](../src/App.tsx) and
[save-write notice](../src/app/save-write-notice.tsx).

## Current wishlist flow

1. The player explicitly clicks `Wishlist on Steam` on the demo menu or standalone marketing screen
2. With a valid full-game App ID, the desktop opens the game menu to pause automatic battle actions
3. It requests the Steam store overlay only when the binding reports that the overlay is enabled; unavailable or unknown availability, or a thrown overlay request, uses the fixed full-game Steam store URL in the browser
4. The player uses Steam's own wishlist action on the store page

The game does not automatically add the game to a wishlist. There is no separate
in-game promotional confirmation screen. `Continue` moves from the recap to the marketing screen. `Main Menu` and Escape exit that screen normally; Quit
never invokes a store or promotional action. Invalid or placeholder App IDs do
not open a destination. Actual store screenshots and Steam overlay delivery await
real App IDs and Steamworks setup.

Source: [bounded wishlist bridge](../desktop/wishlist.cjs). The installed binding's
availability limits and required Steam validation are recorded in
[Steam demo](./STEAM_DEMO.md#input-and-release-evidence); a successful request alone
does not prove that Steam displayed the destination.

## Selected user-supplied promo image

The user selected `2d Assets/Game Sources/Branding/Marketing/Unlock Full Game Demo Promo.jpg` as the
in-game marketing artwork. Its native
dimensions are 2752×1536, slightly wider than exact 16:9. The screen preserves
the full image and its native ratio with proportional containment at the largest
size fitting between the heading and action row; it never crops or stretches.

Accessible text repeats the supplied image's labels: More Bosses, Wildwood Draft,
The Labyrinth, More Heroes, 200+ Talents, Trinkets & Uniques, Build a Homestead.
Wishlist on Steam and Main Menu retain their actions.

German, Simplified Chinese, Russian, Spanish–Spain and Brazilian Portuguese use
localized variants of the same illustration. Their source masters sit alongside
the English original as `Unlock Full Game Demo Promo - <locale>.png` in the Asset
Library; the generation prompt set is `Unlock Full Game Demo Promo - localization
prompts.json` in that folder. Built-in image generation replaces only the seven
captions, preserving panel composition, framing, palette and the gold lettering
treatment. Review spelling, accents, quantity, terminology and fit against the
catalog before adoption. Long captions use smaller lettering within their plaques.
The asset manifest selects these masters and commits optimized WebP outputs;
changing language selects the corresponding bundled image immediately. Expanded
English QA uses the English illustration. See [localization](./LOCALIZATION.md)
for the caption freshness gate.
