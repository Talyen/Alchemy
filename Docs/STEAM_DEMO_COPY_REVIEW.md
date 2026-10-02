# Steam demo copy review

Status: **Menu, recap, marketing, and lock revisions approved; other notices pending**.
This review records the current implementation and the remaining copy approvals.

## Approved menu, recap, and marketing copy

These revisions were approved in the implementation request. The application
name and notices below remain pending separate copy approval.

| Location                                    | Current copy                                                      |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Packaged application name, pending approval | `Alchemy Demo`                                                    |
| Main menu                                   | No edition label; `Wishlist on Steam` appears above Play/Continue |
| Earned-reward recap                         | `Victory`, no subtitle; action `Continue`                         |
| Standalone marketing screen header          | `The Journey Continues`                                           |
| Marketing actions                           | `Wishlist on Steam` and `Main Menu`                               |
| Marketing image                             | User-supplied Unlock Full Game Demo Promo.jpg                     |
| Excluded mode and hero labels               | Their ordinary names, with no full-game suffix or extra label     |
| Edition-locked tooltip requirement          | `Requires Full Game`, bold and red                                |

Existing earned-hero unlock instructions, ordinary defeat copy, resource labels,
and Collection discoveries are preserved. The menu edition label, previous
`Demo Complete` heading and promotional paragraph, Feedback & Support, and Controls
instructions in Options have been removed.

Sources: [menu](../src/features/alchemy/meta/screens/menu-screen.tsx),
[run-end route](../src/app/screen-routes/run-end-routes.tsx),
[marketing screen](../src/features/alchemy/run-loop/screens/demo-completion-screen.tsx),
[edition policy](../src/lib/game-edition.ts),
[mode selection](../src/features/alchemy/meta/screens/game-mode-select-screen.tsx),
and [hero tooltip](../src/features/alchemy/shared/ui/tooltips/hero-tooltip.tsx).

## Other newly added player-facing notices

| Location                                                      | Exact current copy                                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Full-game startup after successful demo progress import       | `Your earned demo progress has been imported. Start a new adventure in the full game.`                           |
| Import notice action                                          | `Dismiss`                                                                                                        |
| Failed local primary and recovery save writes, either edition | `Progress could not be saved. Keep the game open while saving retries; recent progress may be lost if you quit.` |

Sources: [import notice](../src/App.tsx) and
[save-write notice](../src/app/save-write-notice.tsx).

The Options reset instruction uses the user's requested wording:
`Reset all options to default values`. Other Options explanatory text has had its
sentence-ending periods removed.

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

## Local screen captures

Production demo screenshots are captured under `reports/demo-copy-review/` in an
isolated temporary Electron profile: `menu.png`, `modes.png`, `heroes.png`,
`recap.png`, and `completion.png`. These are ignored review artifacts. The recap uses a seeded Act 1
boss test run through the normal combat, reward, and settlement flow; reward
quantities are illustrative rather than a representative balance sample.

## Archived approved feature showcase

The earlier equal six-panel image used these approved labels: **More Heroes**, **More
Campaign Acts**, **The Labyrinth**, **Wildwood Draft**, **Cards & Talents**, and
**Homestead & Armory**. The last two communicate ongoing depth, not exclusive
full-game access. Later-act bosses are shown as approved.

That composition has been superseded by the [selected user-supplied promo image](#selected-user-supplied-promo-image). The marketing image occupies the largest available screen area beneath the compact
heading. Wishlist on Steam is the primary gold CTA; Main Menu is the secondary
outline button to its right. The earlier composition had no additional headline
or descriptive copy baked into it, and its accessible text repeated those six labels.

Editable composition, original source inventory, and regeneration command:
[showcase source](./design/steam-demo-showcase/README.md).

## Archived showcase revisions

Two earlier alternatives explored a fractured hero ribbon and a fractured hero
mosaic. Proposed panels replaced Cards & Talents with Boons, Trinkets, Uniques,
Crafting, and gave Homestead a separate panel. All seven catalog bosses are
shown under the provisional truthful label Boss Battles: current Campaign boss
selection uses a shared pool, with no Act 1-only exclusion.

Proposed stat labels were **100+ Cards**, **200+ Talents**, **25+ Uniques**, and
**20+ Trinkets**. These refer to overall catalog content, not exclusive demo
unlocks. The retained catalog snapshots counted 105, 200, 29, and 24 respectively; recheck live catalogs before reusing the claims.

These studies are archived alternatives; the selected user-supplied image is the
current game artwork. **Wishlist on Steam** remains the CTA on the menu and marketing screen.

[Draft layouts and source facts](./design/steam-demo-showcase/revisions/README.md).

### Round 3 archived layouts

[Expanded mosaic and boss gallery](./design/steam-demo-showcase/revisions/round-3/README.md)
are archived alternatives. They include all eight heroes and integrated
number-plus statistics. Library was the approved temporary stand-in for the
missing Moonlit Observatory artwork in this round.

### Round 4 archived layouts

[Quiet gallery and editorial collage](./design/steam-demo-showcase/revisions/round-4/README.md)
omit statistics and keep only feature captions. The original artwork, eight heroes,
and seven bosses are preserved. The selected user-supplied promo supersedes these studies.

## Selected user-supplied promo image

The user selected `Raw Assets/Marketing/Unlock Full Game Demo Promo.jpg` as the
in-game marketing artwork. It was moved unchanged from Downloads. Its native
dimensions are 2752×1536, slightly wider than exact 16:9. The screen preserves
the full image and its native ratio with proportional containment at the largest
size fitting between the heading and action row; it never crops or stretches.

Accessible text repeats the supplied image's labels: More Bosses, Wildwood Draft,
The Labyrinth, More Heroes, 200+ Talents, Trinkets & Uniques, Build a Homestead.
Earlier generated/composited designs remain archived proposals; they are no
longer the shipping image. Wishlist on Steam and Main Menu retain their actions.
