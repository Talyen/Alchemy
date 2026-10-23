# Alchemy Steam demo checklist

Use this checklist for each release candidate under the
[approved scope](./STEAM_DEMO.md). Readiness requires evidence for the candidate being promoted. Earlier local passes
do not certify later gameplay, layouts, packages, or Steam configuration.

Adapted from Marnix Wyns' [Steam Demo Checklist](https://app.notion.com/p/marnixwyns/Steam-Demo-Checklist-38fc5591ef1a803ca510f20ff3d9b1f7),
read on September 29, 2026. Steam configuration follows
[Valve's demo guidance](https://partner.steamgames.com/doc/store/application/demos);
recheck it before release. [Release](./RELEASE.md) and
[release setup](./RELEASE_SETUP.md) own shipping procedures. This checklist does
not authorize publishing. Local execution follows
[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change).

## 1. Approved demo scope

[Steam demo](./STEAM_DEMO.md) owns content limits, languages, edition identity,
marketing, progress transfer and continued availability. Check against that contract;
approved decisions are not completed readiness checks.

In-game feedback/support links, a new tutorial, itch.io and a separate
demo store page are outside the approved implementation. Use the base game's Steam
Discussions for feedback and configure customer-support contact information in
Steamworks. Demo user reviews require the deferred separate demo store page.

## 2. First launch and onboarding

- [ ] An isolated offline production demo opens Play/Continue, Options, Quit and Wishlist on Steam, with developer-only actions hidden.
- [ ] A fresh profile reaches a real starter hand within the three-minute technical budget, without a progression detour. Measure human reading time separately.
- [ ] Card descriptions, Mana/Health, Block, enemy Traits/Abilities, deck/pile inspection and End Turn remain usable.
- [ ] Victory proceeds through rewards and destinations; endings retain earned progress and return to the correct menu/unlock flow.
- [ ] Tab/F7, Enter/Space, Escape, arrows and pointer/scroll input work through essential navigation and Options.
- [ ] **HUMAN:** Observe an unfamiliar player's first run and retry using the [playtest procedure](#human-playtest). Record comprehension, useful progression, perceived difficulty and time to meaningful play.

## 3. Battles, runs, and progression

Use [game rules](./GAME_RULES.md), [run state](./RUN_STATE.md), and
[run workflows](./RUN_WORKFLOWS.md) as behavior owners. Existing
[headless careers](./PLAYTHROUGH_SIMULATION.md) and
[browser journeys](../tests/e2e/README.md) provide complementary evidence.

- [ ] Exercise real Knight/Rogue/Ranger starters and genuinely earned unlocks without hangs or routes into Act 2. Label fixture grants separately from earned progress.
- [ ] Validate descriptions/effects through content validation, affected battle suites and representative seeded runs; report sampling limits.
- [ ] Exercise real card transfer/reflow, inspection, consecutive plays, Wishes, End Turn and playback gates with normal animation timing.
- [ ] Exercise combat, shops, Mystery, Corruption, Campfires and Transmutation, including purchase/reward controls and special-visit restoration/departure.
- [ ] Victory, defeat and abandonment grant progression/unlocks once and show the correct recap. Demo victory grants no full-Campaign difficulty credit.
- [ ] Earn and spend Talent XP, Materials and Gear; exercise crafting and Companion Bonds, then begin another run with the resulting progress.
- [ ] Verify full-game locks and command/resume boundaries, including rejection of an Act 2 active run.
- [ ] Sample the three approved heroes with explicit policies and seeds. Automated strategy results do not establish human win rates or perceived difficulty.

## 4. Save, interruption, and quit

- [ ] Resume current-format battles, pending/claimed rewards, destinations and special visits on an unseeded page or relaunched isolated app. Acknowledged progress, purchases and choices survive.
- [ ] Verify progression/Options persistence, primary/recovery acknowledgement and failed writes. Both-slot failure shows Couldn’t save; Retry saves the original outcome once. Cloud-only failure does not imply local progress loss.
- [ ] Verify menu, Options/Back, keyboard focus recovery and cancellation of automatic playback while the menu is open.
- [ ] Quit opens no store/browser destination. Verify that native shutdown drains admitted file writes under the [write acknowledgement contract](../src/features/alchemy/shared/storage/MIGRATIONS.md#write-acknowledgement); distinguish those writes from unfinished renderer work and already acknowledged progress.
- [ ] Verify offline startup, Options and local saves without Steam, using isolated profiles.
- [ ] Run affected current-save, future-save protection and source-preserving demo-import checks under the [save contract](../src/features/alchemy/shared/storage/MIGRATIONS.md).
- [ ] **EXTERNAL:** Verify real overlay/custom chord/controller paths and shared-Cloud transfer under [physical Steam acceptance](#physical-steam-acceptance-evidence). Preserve the native-binding blocker in [Steam demo](./STEAM_DEMO.md#input-and-release-evidence).

## 5. Readability, feedback, and Options

Follow [UI](./UI.md), [interaction](./UI_INTERACTION.md), and [motion](./UI_MOTION.md).
Use the current [display sizing](./UI.md#display-sizing) bounds, not historical test requests.

- [ ] Inspect battle/hand, enemy/deck inspection and tooltips at 1280×720 and 1280×800, Game Size 80/100/120 and Tooltip Size 90/125. Seven-card hands and End Turn remain usable.
- [ ] Inspect the production menu/footer and Options in isolated Electron at size extremes. Record actual native bounds when the host work area limits the requested size.
- [ ] Verify hover/focus/press/disabled feedback, modal containment/dismissal and controls. Temporary comparison tools remain absent from production.
- [ ] Reduced-motion inspection and consecutive keyboard plays settle and remain usable under the existing accessibility stance.
- [ ] Verify native display modes on the target platform; browser geometry alone does not establish native behavior.
- [ ] Volume/mute and interface sizing controls apply and persist, including background/foreground audio recovery.
- [ ] Store-language claims match qualified catalogs and rendered evidence for the demo; marketing artwork is bundled for every shipped language.

## 6. Audio and performance

Use [audio](./AUDIO.md) and [performance](./PERFORMANCE.md).

- [ ] Verify authored music bytes in the package and affected music/SFX selection, fade, preload, cooldown, failure and volume behavior.
- [ ] **HUMAN:** Listen on speakers or headphones at defaults. Record device/settings, comfort, intelligibility and distracting overlap before changing the mix.
- [ ] Profile cold startup, dense combat and repeated gameplay/screen lifecycles in native Electron. Record environment, repetitions and advisory results; investigate growth without treating a finite soak as proof against all leaks.
- [ ] **EXTERNAL:** Validate advertised minimum-spec Windows assumptions and real Deck performance/suspend-resume. Workstation profiling does not establish a Deck rating.

## 7. Steam packaging and store presence

- [ ] Configure distinct demo/full App IDs and depots. Verify renderer, package and upload targets agree; wishlist actions target the full game.
- [ ] Complete Steamworks build/store review and confirm the base game's page is visible and wishlistable before launch.
- [ ] Test install, launch, update and uninstall through Steam using the exact candidate and a non-developer account. Require no dev server, missing assets, debug UI or developer credentials.
- [ ] Publish recommended Steam Input layouts and validate delivery and a complete physical-controller journey. Record real configuration IDs in release setup.
- [ ] Store text/media accurately state the approved content, languages, platforms, controller behavior and system requirements. Do not claim native gamepad support or a Deck rating without evidence.
- [ ] If a separate demo store page is later approved, supply its required trailer, screenshots, capsule/library assets and content survey under Valve's current rules.
- [ ] Complete [notice and provenance review](./RELEASE_SETUP.md#player-notices-and-asset-provenance), including privacy disclosure and first-public-release license review.

## 8. Ending and launch communication

- [ ] Act 1 ends with Victory and then The Journey Continues; Main Menu exits normally. Defeat/abandonment show Journey's End.
- [ ] Wishlist controls open exactly one usable full-game destination under the [wishlist contract](./STEAM_DEMO.md#input-and-release-evidence); Quit has no promotional side effect.
- [ ] Review completion copy, full-game locks and the [pending copy approvals](./STEAM_DEMO_COPY_REVIEW.md#pending-copy-approvals).
- [ ] Set the release date and event deadlines; prepare a gameplay-led trailer and announcement with checked links and the actual endpoint.
- [ ] If outreach is approved, prepare the build, keys, concise pitch and known limitations. Sending outreach requires its own authorization.
- [ ] Assign feedback/crash monitoring and hotfix/rollback ownership; retain a known-good build under the release procedure.

## 9. Candidate evidence and release sign-off

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
A fake two-device backend is not evidence of live synchronization.

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
verify newer saves across two devices, Cloud unavailable/reconnecting and demo-to-full
import while preserving edition slots and initialization receipts.

Deck evidence includes Proton startup/performance, physical Steam Input/overlay,
1280×800 readability and suspend/resume. Keep those checks open when hardware is
unavailable. Renderer geometry and virtual-display results do not establish a
controller/Deck rating or close the [release blockers](./STEAM_DEMO.md#input-and-release-evidence).
