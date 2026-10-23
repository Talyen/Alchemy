# Steam demo edition

Approved scope: Campaign Act 1, Novice only, Knight → Rogue → Ranger, the bundled languages in [localization](./LOCALIZATION.md),
Steam only, unlimited replay, and continued availability after full-game launch.
Existing content pools, progression costs and victory/defeat/abandonment unlocks
remain unchanged. There is no separate tutorial. Excluded choices show full-game
locks. The normal Act 1 reward flow ends in an earned-reward recap. Continue opens
the separate “The Journey Continues” marketing screen with the user-supplied promo artwork,
optional Wishlist on Steam action, and Main Menu exit. This is local victory-route
presentation state, not a persisted activity. No full-Campaign difficulty
completion credit is granted. Edition locks appear only as bold red
“Requires Full Game” tooltip text; names and Collection discoveries stay intact.

Candidate readiness checks and the offline playtest launcher:
[demo checklist](./STEAM_DEMO_CHECKLIST.md).
Player-facing copy awaiting approval: [copy review](./Plans/SteamDemo.md#pending-copy-approvals).
Shipping procedures: [release](./RELEASE.md) and [release setup](./RELEASE_SETUP.md).

## Marketing presentation

Wishlist on Steam is an explicit player action; the game never adds a wishlist
entry automatically. Continue opens marketing after the recap; Main Menu and
Escape leave it normally. Quit never opens a promotional destination. Invalid or
placeholder App IDs open nothing. [Input and release evidence](#input-and-release-evidence)
owns overlay/browser delivery and physical qualification.

The selected master is `2d Assets/Game Sources/Branding/Marketing/Unlock Full Game Demo Promo.jpg`
in Asset Library, 2752×1536. Contain the complete image at its native ratio between
the heading and actions; never crop or stretch it. Accessible text repeats its
seven labels: More Bosses, Wildwood Draft, The Labyrinth, More Heroes, 200+ Talents,
Trinkets & Uniques, Build a Homestead. Wishlist and Main Menu retain their actions.
Localized artwork and caption freshness follow
[localization](./LOCALIZATION.md#qualification-and-steam); source preparation follows
[assets](./WORKFLOWS-ASSETS.md#demo-marketing-artwork).

## Edition contract

[game-edition.mjs](../game-edition.mjs) is the shared policy for renderer,
Electron and tooling. `ALCHEMY_EDITION=full` is the default;
`ALCHEMY_EDITION=demo` selects demo development, builds and uploads. Vite stamps
`edition.json`; packaging stamps `gameEdition`, `steamAppId` and
`steamDepotId` and `fullGameSteamAppId`. Verification rejects renderer/package/target mismatches.

| Edition | Renderer     | Packages                | Steam configuration                        |
| ------- | ------------ | ----------------------- | ------------------------------------------ |
| Full    | `dist/`      | `release-desktop/`      | `STEAM_APP_ID`, `STEAM_DEPOT_ID`           |
| Demo    | `dist-demo/` | `release-desktop-demo/` | `STEAM_DEMO_APP_ID`, `STEAM_DEMO_DEPOT_ID` |

The demo also needs `STEAM_APP_ID` for its full-game wishlist target. Production
App IDs must be distinct, positive and not Spacewar 480. Sentry release names
are `alchemy@version` and `alchemy-demo@version`, using the same source version.

Demo restrictions apply to run creation commands, selection callbacks and
restoration. Out-of-scope activity is dropped without settling it; valid permanent
progress remains. Full-game catalogs and reward rules are shared. Packaging
creates a separate Alchemy Demo application identity and local data directory;
full-game identity and local paths stay unchanged. Explicit isolated test profiles
take precedence and never connect to live Steam saves.

## Save transfer

Each edition has its own local primary/recovery rings. Steam Cloud names are
`save.json` / `save-recovery.json` for full and
`demo-save.json` / `demo-save-recovery.json` for demo. Native writes stamp the
Steam account ID. Local Windows import reads only the fixed Alchemy Demo rings
and requires a matching account; the renderer cannot supply paths.

On genuinely fresh full-game initialization, select one compatible demo snapshot
by the existing freshness rules. Copy permanent profile, Gear and run-profile
fields. Do not add snapshots together. Exclude active runs, pending rewards,
device preferences and full-Campaign difficulty completion. The full profile
must acknowledge its local write before the imported-progress notice appears.
The source remains intact. Existing full-game local/cloud candidates, temporary
writes, unreadable state or protecting newer formats prevent replacement.

`demo-initialization.json` locally and `full-demo-initialization.json` in Cloud
record initialization outside player progress. These receipts survive Clear Save
Data. Clearing full-game progress first preserves its receipt, then removes only
full-game slots. A local wipe requires the local receipt and attempts the Cloud
receipt best-effort; Cloud-first deletion requires both before removing mirrors.
Demo deletion never removes full slots or the full receipt.
Import failures do not block play; later established profiles are never merged
with newly available demo progress.

One-time Steamworks setup: enable Cloud for both apps, configure the full app's
Shared Cloud App ID to the **released demo App ID**, and validate this direction
with separate accounts/devices before making public carryover claims. Valve's
[Cloud documentation](https://partner.steamgames.com/doc/features/cloud) warns
against an unreleased sharing target. This configuration is external to CI.

The save schema adds nullable `steamAccountId` with a safe default. No schema
bump is needed. Existing supported versions remain at the current floor; when
public carryover is promised, freeze that supported baseline under the
[save compatibility owner](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

## Input and release evidence

Steam Input translates controller actions to ordinary keyboard/pointer events.
Use **F7 for previous focus**, avoiding Steam's Shift+Tab overlay shortcut; Tab
remains next focus. F7 traverses existing eligible controls within the active
dialog or screen. Native gamepad polling, glyphs and rumble are outside scope.
Published layouts and hardware validation remain governed by
[release setup](./RELEASE_SETUP.md#steam-input-default-mapping-controller-playable).

Native Steam overlay activation and the default Shift+Tab chord open the game
menu during an active battle, stopping automatic battle actions until the player
dismisses it. Ordinary window blur follows the [focus policy](./UI_INTERACTION.md#keyboard-and-steam-input-navigation)
without opening the menu. Wishlist opening also requests a battle pause; the store
opens in the overlay only when
`client.isOverlayEnabled()` returns true at click time, otherwise it uses the
fixed Steam store URL in the browser. Unknown availability is not success:
overlay activation returns void and can silently do nothing.

Native callback and availability support must be implemented and validated in
packaged Steam builds. The unresolved implementation prerequisite and its dated
upstream evidence live in the [blocked release plan](./Plans/SteamDemo.md#native-overlay-prerequisite).

Complete [physical Steam acceptance](./STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence)
on the packaged Windows game and Deck, including custom overlay shortcuts,
callback-driven pause, wishlist fallback, reconnection and suspend/resume.

Valve documents both
[activation events and delayed overlay availability](https://partner.steamgames.com/doc/features/overlay#communication-from-the-overlay-to-your-game).
Custom shortcuts and Deck paths remain a release blocker until native binding
and hardware evidence are available. Browser or mocked callback tests cannot
close this gate.

Every release builds both editions, retains independent verified artifacts and
uploads to separate App IDs/depots. Public Steam promotion remains manual, with
independent rollback. A failed publishing-job retry downloads the producer's
immutable artifact IDs rather than rebuilding.

Required external evidence: real App IDs/depots, Steam install/update, actual
published layout IDs, controller journeys, Deck Proton performance and 1280×800
readability, suspend/resume, overlay interruption and cross-app cloud import.
No controller/Deck rating or public carryover claim follows from automated tests
alone. Notices/provenance and Steamworks review remain pre-promotion gates.
