# Alchemy Steam demo checklist

**Status: Local game verification completed; human playtest/audio sign-off and Steam release checks pending.** Updated September 29, 2026.

Adapted from Marnix Wyns' [Steam Demo Checklist](https://app.notion.com/p/marnixwyns/Steam-Demo-Checklist-38fc5591ef1a803ca510f20ff3d9b1f7), read on September 29, 2026. The sections below turn its generic advice into acceptance checks for Alchemy's card battles, runs, and between-run progression. Steam configuration follows [Valve's demo guidance](https://partner.steamgames.com/doc/store/application/demos); recheck it before release.

Product scope was approved during implementation planning. Checked scope decisions do not certify the demo as ready or authorize publishing. [Release](./RELEASE.md) and [release setup](./RELEASE_SETUP.md) remain the owners of shipping procedures.

## 1. Approved demo scope

These product decisions are approved; readiness checks below remain unchecked
until evidence exists for the release candidate. Implementation and transfer
contracts are owned by [Steam demo](./STEAM_DEMO.md).

- [x] Campaign only, ending after Act 1; Novice only; unlimited replay.
- [x] Knight → Rogue → Ranger through the existing victory, defeat or abandonment unlock chain.
- [x] Existing content pools, Talents, Homestead and Armory rules and costs; existing UI onboarding.
- [x] Excluded characters/modes retain their names and show bold red Requires Full Game tooltips. Victory recap leads to the separate The Journey Continues marketing screen with the feature showcase and primary wishlist CTA.
- [x] English; Steam only; Windows x64; controller play through Steam Input and Deck through Proton.
- [x] Automatic one-time earned permanent-progress import through shared Steam Cloud, with local Windows fallback. Active runs and full-Campaign difficulty credit do not transfer.
- [x] Demo remains available after full launch; demo and full candidates build from one source version.
- [ ] Measure first-run duration and useful progression on unfamiliar-player journeys.
- [ ] Set the release date and any event deadlines; validate Steamworks setup and required hardware evidence.

## 2. First launch and onboarding

Local evidence is recorded in [game acceptance](./DEMO_GAME_ACCEPTANCE.md).
A checked local row does not certify Steam install, physical Steam Input, or
subjective player comprehension. `HUMAN` rows require actual feedback;
`EXTERNAL` rows are deferred release checks.

- [x] An isolated offline production demo opens a main menu with Play, Options, Quit, Wishlist above Play/Continue. Temporary comparison tooling and developer-only actions are hidden in production.
- [x] A fresh-profile browser journey reaches a real starter hand within the three-minute technical budget, with no mandatory cinematics/lore or progression detour. This measurement excludes human reading time.
- [x] Existing UI provides card descriptions, Mana/Health, Block, enemy Traits/Abilities, deck/pile inspection and End Turn. Gameplay Options now lists controls and basic rules without adding a tutorial.
- [x] Victory leads through rewards and destination choices; run endings show earned progress and return to Play. Normal End Run unlocks the next approved hero and progression screens.
- [x] Essential navigation uses layout-independent Tab/F7, Enter/Space, Escape, arrows and pointer/scroll input. Demo browser and native Options journeys verify focus and dismissal.
- [x] In-game feedback/support links are intentionally omitted. Use the base game’s Steam Discussions for demo feedback; demo user reviews require the deferred separate demo store page. Configure customer-support contact information in Steamworks separately.
- [ ] **HUMAN:** Observe an unfamiliar player's first run and retry. Confirm comprehension, useful progression, perceived difficulty and time to meaningful play. Record any confusion; the automated journey is not a substitute.

## 3. Battles, runs, and progression

Use [game rules](./GAME_RULES.md), [run state](./RUN_STATE.md), and [run workflows](./RUN_WORKFLOWS.md) as behavior owners.

- [x] Run the approved slice with real Knight/Rogue/Ranger decks and genuinely earned unlocks: 45 seeded headless runs completed, with no hangs or routes into Act 2. A fresh browser journey independently exercises the earned three-hero chain.
- [x] Validate content descriptions/effects and magnitudes through the content audit (zero errors/warnings), battle regression suites and representative seeded runs. This is bounded evidence, not exhaustive enumeration of all possible builds.
- [x] Exercise real card transfer/reflow, inspection, consecutive plays, Wishes, End Turn and playback gates through existing regressions, actual-animation browser journeys and dense-effect profiling.
- [x] Exercise each included encounter type. Headless runs cover combat, shops, Mystery, Corruption and Campfires; browser journeys separately verify reward/purchase controls and special-visit restoration/departure.
- [x] Victory, defeat and abandonment settle through current owners, grant unlocks once and return to the correct recap/menu. Demo victory does not record full-Campaign difficulty credit.
- [x] Earn and spend Talent XP/materials/Gear through the headless careers, including Talents, buildings/research/farms, equipment, crafting and Companion Bonds; begin subsequent runs with that progress.
- [x] Enforce demo boundaries at command and resume seams; browser regressions cover full-game locks, Act 1 completion and rejection of an Act 2 active run.
- [x] Sample three starter strategies with the archetype policy and an additional fresh Knight minimalist cohort. All five archetype careers per hero reached a victory within their run budget. Balance observations are directional; perceived difficulty remains in the human check above.

## 4. Save, interruption, and quit

- [x] Check current-format battle, enemy-resolution continuation, pending/claimed rewards, destinations and special visits. Fresh-page resumes retain acknowledged progress, purchases and choices; headless careers serialize/validate each production action.
- [x] Verify progression/Options persistence, primary/recovery acknowledgements and failed writes. A real local-write failure now shows an understandable non-modal warning; successful retry clears it. Cloud-only failures do not falsely imply local progress loss.
- [x] Verify battle menu, Options/back, keyboard focus recovery and cancellation of automatic playback while the menu is open.
- [x] Keep Quit independent of wishlist actions. The native explicit-click test verifies no browser action during Quit; save/exit regressions retain the documented best-effort desktop shutdown policy.
- [x] Run offline without Steam; isolated native startup, menu, Options and local save operations remain usable. Tests preserve normal player profiles and skip live Steam.
- [x] Current saves remain compatible across ordinary code/UI updates; fixtures, future-save protection and source-preserving demo import regressions pass. Historical below-baseline support is outside the approved pre-release contract.
- [ ] **EXTERNAL:** Verify actual Steam overlay/custom chord/controller paths and real shared-Cloud transfer on candidate apps. Default Shift+Tab/focus-loss pause logic is implemented; the installed binding lacks overlay activation callbacks.

## 5. Readability, feedback, and Options

Follow [UI](./UI.md), [interaction](./UI_INTERACTION.md), and [motion](./UI_MOTION.md).

- [x] Inspect battle/hand, enemy/deck inspection and card tooltips at exact browser viewports 1280×720 and 1280×800, Game Size 80/100/120 and Tooltip Size 75/125. Seven-card hands and End Turn remain usable; screenshots are retained locally.
- [x] Inspect the production demo menu/footer and Options in isolated Electron at minimum-size/size-extreme cases. Native window dimensions are asserted against the available host work area; exact 1280×800 geometry is independently covered in Chromium.
- [x] Shared hover/focus/press/disabled states, modal focus/dismissal and controls work in browser/native input journeys. Preserve Alchemy's existing surface behavior rather than adding universal squish/scale effects.
- [x] Real card-transfer and tooltip-motion tests pass; temporary comparison controls are absent from the production candidate.
- [x] Reduced-motion inspection and consecutive keyboard card plays settle and remain usable. No expanded accessibility feature set is being claimed.
- [x] Verify native display-mode APIs on the available Mac and record the user's reported Mac/Windows testing. Physical Steam/Deck and minimum-spec listing claims remain external checks.
- [x] Volume/mute and interface sizing controls apply and persist through Options/save regressions; local audio lifecycle tests cover returning/backgrounding and failure behavior.
- [x] Game-side scope is English only. Additional localization is excluded; actual store-language claims are checked in the release section.

## 6. Audio and performance

Use [audio](./AUDIO.md) and [performance](./PERFORMANCE.md).

- [x] Verify authored music bytes in packaged artifacts and music selection/fade/cancel/background behavior in focused tests.
- [x] Verify SFX playback, registry/assets, cooldown/preload/failure behavior and volume bounds: 149 focused audio/save-notice/report tests passed, plus demo browser playback coverage.
- [x] Preserve the existing mix, default 50% controls and selective variation. Ambient layers and pitch changes are not mandatory new features; subjective quality is checked below.
- [x] Profile local cold startup, dense combat effects and repeated screen lifecycle in native Electron. All advisory frame bands were green near 60 FPS; the measured soak showed no working-set/DOM/media-element growth. See the evidence record for measured limits.
- [ ] **HUMAN:** Listen on speakers or headphones at defaults and confirm comfortable loudness, understandable feedback and no distracting overlap. Record device/settings and any needed mix changes.
- [ ] **EXTERNAL:** Revalidate advertised minimum-spec Windows assumptions and real Deck performance/suspend-resume before making those public claims. The user's Mac/Windows testing and this local profile are not a formal Deck rating.

## 7. Steam packaging and store presence

- [ ] Configure a separate demo App ID associated with the full game and the correct demo depots. Verify the packaged runtime and upload both target the demo; wishlist actions target the full game. The repo now provides separate edition artifacts and target checks; actual App IDs and depots are still required. [Valve configuration guidance](https://partner.steamgames.com/doc/store/application/demos).
- [ ] Complete the demo's Steamworks build/store checklists and required review. Confirm the base game's store page is visible and wishlistable before a pre-release demo launch.
- [ ] Test install, launch, update, and uninstall through Steam using the exact candidate package, including a non-developer tester account. Confirm no dev server, missing assets, debug UI, or required developer credentials.
- [ ] If controller play is approved, publish recommended Steam Input layouts for the supported devices and validate their delivery and a complete demo journey on physical controllers. Record actual configuration IDs and evidence in release setup.
- [ ] Store text and media show only approved demo content and accurately state supported languages, platforms, controller behavior, and system requirements. Do not claim native gamepad support or a Deck rating without evidence.
- [ ] If using a separate demo store page, supply its required demo-specific trailer, screenshots, capsule/library assets, and content survey under Valve's current rules.
- [ ] Complete the existing [notice and provenance review](./RELEASE_SETUP.md#player-notices-and-asset-provenance), including privacy disclosure and the unresolved first-public-release license review.

## 8. Ending and launch communication

- [x] Act 1 ends with The Journey Continues and the standard recap. Main Menu returns to Play/Quit; defeat/abandonment use Journey's End and do not pretend the demo was conquered.
- [x] Main menu/completion wishlist controls and the fixed full-game target/fallback are implemented and regression-tested. Actual Steam destination/overlay behavior remains deferred until real App IDs exist; Quit has no promotional side effect.
- [x] Demo completion copy and full-game locks accurately identify further Campaign acts, heroes and modes as full-game content.
- [ ] Prepare a short gameplay-led demo trailer and announcement showing card decisions, rewards, progression, and the actual endpoint. Confirm all links and launch timing before publication.
- [ ] If creator outreach is approved, prepare the candidate build, demo keys, concise pitch, and known limitations about one to two weeks ahead. Sending outreach is a separate authorized action.
- [ ] N/A — initial distribution is Steam only; itch.io is outside the approved scope.
- [ ] Choose who monitors launch feedback and crash reports, where players report issues, and what warrants a hotfix or rollback. Keep a known-good build available under the existing release procedure.

## 9. Candidate evidence and release sign-off

For each completed check, record evidence against the candidate build in the release record: version/commit, Steam build ID, tester, hardware/input, date, result, and issue links. Mark an excluded conditional item `N/A` with the approved reason; do not silently check it off. A new candidate needs affected checks repeated.

- [ ] Approve the scope decisions above and resolve every required failed or unverified item. Optional polish or channels may be deferred with a stated reason.
- [x] Run the task-owned local handoff gate and save/desktop checks; retain source-level and artifact verification evidence. Native packaged Windows startup and public promotion checks remain release prerequisites; local checks do not certify them.
- [ ] Perform a final unaided fresh-profile journey and a saved-run resume through Steam on the exact candidate, covering the demo endpoint and wishlist link.
- [ ] Review known issues, store claims, notices, candidate evidence, and rollback readiness. Record explicit approval of that build before manual public promotion.

## How the generic checklist changed

| Source topic                                 | Alchemy adaptation                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pause and Steam overlay                      | Protect turn-based decisions, autoplay, pending auto-end-turn, and focus.                                                                                              |
| Fast onboarding and ending                   | Teach a card battle quickly, show the reward/run loop, and finish the approved slice cleanly.                                                                          |
| Animated menu, scaling, and tweens           | Preserve existing fantasy presentation and shared UI behavior; readability and reliable input take priority.                                                           |
| Ambient audio, pitch randomness, 50% sliders | Check the actual mix and selective variation; retain current defaults unless listening justifies a change.                                                             |
| Resolution, VSync, and many FPS choices      | Validate Electron display modes and Alchemy's sizing controls. New resolution/VSync/FPS menus need a demonstrated player benefit and an approved implementation scope. |
| Localization, itch.io, creator outreach      | Conditional launch decisions with honest support claims and separate publication/outreach authorization.                                                               |
| Stability and marketing                      | Add Alchemy-specific run/save/progression checks, Steam Wishlist above Play/Continue, release evidence, and optional full-game wishlist links.                         |
