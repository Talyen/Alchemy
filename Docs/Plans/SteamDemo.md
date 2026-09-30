---
status: blocked
reason: Steamworks app/depot identifiers, shared Cloud configuration, published layouts and physical controller/Deck release evidence are external prerequisites.
updated: 2026-09-29
---

# Steam demo implementation

Approved decisions: Campaign Act 1, Novice, Knight → Rogue → Ranger with existing
victory/defeat/abandonment unlocks; ordinary content pools and progression costs;
existing onboarding; full-game locks; victory recap followed by a separate marketing screen and wishlist; English;
Steam only; unlimited replay; demo remains available after launch.

## Implementation

- [x] Shared demo/full policy, isolated build/package identity and Steam targets.
- [x] Command and resume restrictions; settle after Act 1 rewards without full-Campaign credit.
- [x] Wishlist above Play/Continue, tooltip-only edition locks, recap followed by The Journey Continues, bounded wishlist bridge.
- [x] Independent local/cloud saves; account-matched one-time permanent-progress import.
- [x] Cloud import with Windows local fallback; no active run or device preference transfer.
- [x] Protect existing full saves, preserve source, acknowledge import writes, retain initialization receipt across resets.
- [x] Dual-edition release artifacts, verification and upload; manual promotion/rollback.
- [x] Focused gameplay, persistence, desktop, tooling and edition browser regression evidence.
- [x] Update checklist and canonical architecture/save/release documents.

## Release prerequisites

Actual demo/full App IDs and depots, shared Steam Cloud (full app targets the
released demo), published recommended Steam Input layouts, Steamworks review,
physical controller and Deck journeys, Proton performance and suspend/resume,
and cross-app/cloud import evidence. No public support/carryover claim until
these pass. Native gamepad polling, glyphs, rumble, new tutorials, localization,
itch.io and a separate demo store page are outside this change.

## Acceptance

Demo cannot create or resume excluded runs or continue to Act 2. Rewards and
unlocks settle once. Full edition remains unrestricted. Transfer selects one
compatible snapshot, keeps earned permanent progress, excludes Campaign win
credit and active activity, never replaces existing full progress, and never
duplicates rewards or reimports after Clear Progress. Both packages must match
their renderer edition and upload App ID. Use [verification](../../CONTRIBUTING.md)
and [release](../RELEASE.md) owners, with hardware checks reported separately.

## Verification evidence

Demo production browser journeys pass, including controller-equivalent forward
and F7 backward focus, full-game locks, Act 1 settlement, and excluded-run resume.
Local Windows x64 demo packaging passes renderer/music/fuse/native/source-map
verification. Full handoff gate results are recorded under ignored reports; no
public Steam upload, hardware journey or cross-app service claim is certified.

Game-only acceptance evidence and remaining human checks are recorded in [game acceptance](../DEMO_GAME_ACCEPTANCE.md). Use `npm run demo:playtest` before Steamworks setup.
