# Alchemy Steam demo checklist

Use this checklist for each release candidate under the
[approved scope](./STEAM_DEMO.md). Readiness requires evidence for the candidate being promoted. Earlier local passes
do not certify later gameplay, layouts, packages, or Steam configuration.

Adapted from Marnix Wyns' [Steam Demo Checklist](https://app.notion.com/p/marnixwyns/Steam-Demo-Checklist-38fc5591ef1a803ca510f20ff3d9b1f7).
Steam configuration follows
[Valve's demo guidance](https://partner.steamgames.com/doc/store/application/demos);
recheck it before release. [Release](./RELEASE.md) and
[release setup](./RELEASE_SETUP.md) own shipping procedures. This checklist does
not authorize publishing. Local execution follows
[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change).

## Outstanding release prerequisites

Steam ID verification and store setup are pending. Configure the demo and full
App IDs, depots, shared Cloud and AI disclosure, then complete the physical
Steam acceptance, minimum-spec validation, unfamiliar-player and listening
feedback, copy review, Steamworks review and candidate sign-off below. Publish
recommended controller layouts and record their configuration IDs with the
candidate evidence. Do not claim controller, Deck or carryover support before
the applicable checks pass.

## Pending copy approvals

| Location                                                      | Exact current copy                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Packaged application name                                     | `Alchemy Demo`                                                                         |
| Full-game startup after successful demo progress import       | `Your earned demo progress has been imported. Start a new adventure in the full game.` |
| Import notice action                                          | `Dismiss`                                                                              |
| Pending local save, either edition                            | `Saving…`                                                                              |
| Failed local primary and recovery save writes, either edition | `Couldn’t save`                                                                        |
| Failed-save action                                            | `Retry`                                                                                |

Sources: [application identity](../game-edition.mjs), [import notice](../src/App.tsx)
and [save-write notice](../src/app/save-write-notice.tsx). Menu, recap, marketing
and lock revisions remain approved under the demo contract.

## 1. Approved demo scope

[Steam demo](./STEAM_DEMO.md) owns scope, locks, progress transfer and marketing.
The base game's Steam Discussions is the feedback channel; configure support
contact information in Steamworks. A separate demo store page, in-game support
links, a new tutorial and itch.io remain outside the approved implementation.

## 2. Player journey

Use [game rules](./GAME_RULES.md), [demo scope](./STEAM_DEMO.md),
[headless careers](./SIMULATION.md#headless-careers) and
[browser journeys](../tests/e2e/README.md) for the expected behavior and evidence.

- [ ] Start an isolated offline production demo with no developer controls. A fresh profile reaches a real starter hand within the three-minute technical budget; measure human reading separately.
- [ ] Exercise each approved hero and genuinely earned unlock, combat input and feedback, shops, Mystery, Corruption, Campfires and Transmutation, including resume and departure. Label fixture grants and sampled seeds separately from earned progress and human results.
- [ ] Exercise rewards, victory, defeat, abandonment, progression, purchases, crafting and Companion Bonds through another run. Verify the correct recap and demo ending, full-game locks and rejection of out-of-scope active runs under the demo contract.
- [ ] Exercise keyboard, pointer and scrolling across navigation, inspection, Options and dialogs; verify pause and focus recovery. Follow [interaction](./UI_INTERACTION.md) and [motion](./UI_MOTION.md).
- [ ] **HUMAN:** Observe an unfamiliar player's first run and retry under [human playtest](#human-playtest); record comprehension, difficulty, progression and time to meaningful play.

## 3. Save, interruption and quit

- [ ] Resume battles, rewards, destinations and special visits on an unseeded page or relaunched isolated app. Verify progression, Options, purchases and choices survive, including offline startup and local saves.
- [ ] Test failed primary/recovery writes and Retry: the original outcome saves once. Verify future-save protection, damaged-primary recovery and source-preserving demo import under the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md).
- [ ] Before promising persistent progress, freeze the supported save baseline; verify each candidate upgrades supported distributed saves. Retain source saves and record their versions.
- [ ] Verify native shutdown drains admitted writes; distinguish them from unfinished renderer work and acknowledged progress. Quit must not open a store or browser destination.
- [ ] **EXTERNAL:** Verify overlay, controller and shared-Cloud transfer under [physical Steam acceptance](#physical-steam-acceptance-evidence).

## 4. Presentation, audio and performance

- [ ] Inspect battle, inspection and tooltips at 1280×720 and 1280×800 with Game Size 80/100/120 and Tooltip Size 90/125. Inspect menu and Options at size extremes in Electron, record actual native bounds, and validate native display modes on the target platform. Follow [display sizing](./UI.md#display-sizing).
- [ ] Check hover, focus, disabled and modal behavior, reduced motion, consecutive keyboard plays, persisted sizing and volume/mute, and background/foreground audio recovery. Temporary comparison tools must be absent.
- [ ] Match store-language claims to qualified catalogs and rendered evidence; bundle marketing artwork for each shipped language.
- [ ] Verify packaged music and affected audio behavior under [audio](./AUDIO.md). **HUMAN:** Listen at defaults and record device, settings, comfort and overlap.
- [ ] Profile cold startup, dense combat and repeated lifecycles in native Electron under [performance](./PERFORMANCE.md). **EXTERNAL:** Validate minimum-spec Windows and actual Deck performance and suspend/resume; workstation results do not establish a Deck rating.

## 5. Steam packaging and launch

- [ ] Configure distinct demo/full App IDs, depots, shared Cloud, AI disclosure and recommended Steam Input layouts. Validate renderer, package and upload targets; record actual layout IDs with candidate evidence.
- [ ] Complete Steamworks build/store review; verify the base game page is visible and wishlistable. Test install, launch, update and uninstall of the exact candidate through Steam on a non-developer account without dev services or credentials.
- [ ] **EXTERNAL:** Install and launch the unsigned candidate through Steam on clean Windows 11 with Smart App Control enabled; record the build, setting and result. Validate physical input and Cloud under [physical acceptance](#physical-steam-acceptance-evidence).
- [ ] Ensure store text and media match approved content, languages, platforms, controller behavior and system requirements. Review [pending copy](#pending-copy-approvals), [notices and provenance](./RELEASE_SETUP.md#player-notices-and-asset-provenance), and any approved separate demo page requirements.
- [ ] Verify the [wishlist contract](./STEAM_DEMO.md#input-and-release-evidence), prepare launch communication and checked links, and assign feedback, crash monitoring, hotfix and rollback ownership. Sending outreach requires separate authorization.

## 6. Candidate evidence and release sign-off

Keep completed results with the candidate's release artifacts and handoff, not as
another completed task report in this repository. Record version/commit, Steam
build ID, tester, hardware/input, date, result and issue links. Local reports follow
[transient cleanup](../scripts/README.md#cleanup-clean--explicit-reset-prunetransient--expiry);
retain required release evidence externally before it expires.
A new candidate requires affected checks repeated. Mark conditional exclusions
N/A with the approved reason; do not infer success from an older checklist.

- [ ] Resolve required failures, unverified checks and pending decisions. Optional polish/channels may be deferred explicitly; approved scope does not need routine reapproval.
- [ ] Run the required candidate gates, including packaged Windows startup. A task-scoped documentation/local smoke pass is not release validation.
- [ ] Perform a final unaided fresh-profile journey and saved-run resume through Steam, covering the endpoint and wishlist.
- [ ] Review known issues, claims, notices, evidence and rollback readiness; approve the exact build before manual public promotion.

## Human playtest

When local playtesting is requested, run `npm run demo:playtest` for the production
demo without Steamworks. The launcher ensures Electron is installed, validates
committed outputs and builds the demo desktop renderer. It preserves normal
profiles and Steam Cloud; progress uses `scratch/demo-playtest-profile`.
Clear Save Data in Options starts a fresh playtest. Prepare changed assets through
[asset authoring](./WORKFLOWS-ASSETS.md) first; the launcher does not regenerate them.

1. Let an unfamiliar player begin without coaching. Observe whether Mana/Block,
   enemy inspection, End Turn, rewards, destinations and earned unlocks make sense.
2. Observe a first run and retry. Record confusing labels, missed controls,
   unexpected difficulty and whether affordable upgrades feel useful.
3. Listen to menu, combat, boss and reward sounds at defaults on speakers or
   headphones. Record the device, changed settings and any mix problems.

Keep subjective checks open until actual feedback exists. Automated journeys
exclude human reading time and cannot certify comprehension or audio comfort.

## Physical Steam acceptance evidence

Automated controller tests send Steam Input's intended keyboard/pointer events;
isolated Electron tests do not connect to Steamworks or real Cloud profiles.
A fake two-device backend is not evidence of live synchronization. Browser input,
mocked callbacks and workstation FPS cannot qualify mapping delivery, native
controller/PlayStation support, Proton, suspend/resume, Deck ratings or public
carryover claims. Keep those claims unqualified until the relevant device/service
evidence below exists.

For a Windows candidate launched through Steam, record package version/hash,
Windows and Steam client versions, and published controller layout ID. Exercise
menu, battle, Wish, rewards, shops, Armory, inspection and modal Back. Repeat held
Confirm, reconnect the controller and switch between pointer/controller input.
Open default and remapped overlay shortcuts during autoplay; require the native
activation event, paused actions and a menu that stays open until the player resumes.

Exercise Wishlist with the overlay enabled, disabled and not yet ready. Require
exactly one usable full-game store destination and the game menu in each case.
Record the shortcut/layout, native callback evidence and result with the package hash.

Repeat after sleep/resume and Steam reconnection. With isolated acceptance accounts,
verify newer saves across two devices, offline progress followed by reconnection,
Cloud unavailable/reconnecting and demo-to-full import while preserving edition
slots and initialization receipts. Record which device and save version won at
each step; do not overwrite a real player's profile to perform these checks.

Deck evidence includes Proton startup/performance, physical Steam Input/overlay,
1280×800 readability and suspend/resume. Keep those checks open when hardware is
unavailable. Renderer geometry and virtual-display results do not establish a
controller/Deck rating or close the [release prerequisites](#outstanding-release-prerequisites).
