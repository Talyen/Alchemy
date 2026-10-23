---
status: blocked
reason: Steam ID verification, Steamworks configuration, physical acceptance, human feedback, and copy approvals remain unresolved.
updated: 2026-10-23
---

# Steam demo release readiness

Approved product scope, edition identity, and transfer behavior belong to
[Steam demo](../STEAM_DEMO.md). This plan tracks the remaining release prerequisites.

Steam ID verification is pending and no store page exists yet. The original
AI-created assets' commercial-use entitlement and absence of third-party source
material were confirmed by the owner on October 23, 2026; see
[provenance](../../THIRD_PARTY_NOTICES.md). Complete the future
[AI disclosure](../RELEASE_SETUP.md#steam-ai-disclosure) during page setup.

## Outstanding work

Steam Input layouts remain a specification: no exported configuration IDs or
live default assignments have been verified. Windows under Proton, Deck performance
and suspend/resume also remain unverified. Record real identifiers and candidate
evidence when closing these items.

- [ ] Configure real demo/full App IDs and depots and verify renderer, package,
      upload, and wishlist targets under [release setup](../RELEASE_SETUP.md#github-secrets-one-time-setup).
- [ ] Resolve the [native overlay binding prerequisite](#native-overlay-prerequisite):
      activation callbacks and availability detection must work in the packaged game.
      Verify pause/resume and wishlist behavior through Steam, including custom
      shortcuts and Deck paths; browser or mocked callbacks cannot close this item.
- [ ] Configure and validate [shared Cloud and progress transfer](../STEAM_DEMO.md#save-transfer),
      including the released demo sharing target, separate accounts/devices,
      offline/reconnection, and preservation of source saves and initialization receipts.
- [ ] Publish and verify [recommended Steam Input layouts](../RELEASE_SETUP.md#configuration-and-validation-status)
      with real configuration IDs. Complete [physical Windows/controller and Deck acceptance](../STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence),
      including Proton performance, 1280×800 readability, and suspend/resume; validate
      the advertised [minimum-spec assumptions](../RELEASE_SETUP.md#steam-listing-baseline-windows).
- [ ] Obtain unfamiliar-player and listening feedback through the
      [human playtest procedure](../STEAM_DEMO_CHECKLIST.md#human-playtest).
      Keep comprehension, perceived difficulty, useful progression and audio comfort
      unqualified until feedback is reviewed and any required fixes are verified.
- [ ] Complete Steam install/update/uninstall and build/store review, resolve
      [notice and provenance requirements](../RELEASE_SETUP.md#player-notices-and-asset-provenance)
      and [pending copy approvals](#pending-copy-approvals),
      then perform [candidate sign-off](../STEAM_DEMO_CHECKLIST.md#9-candidate-evidence-and-release-sign-off).

Keep results with the exact candidate's release evidence, following the
[demo checklist](../STEAM_DEMO_CHECKLIST.md); older automated passes do not
qualify a new candidate or establish physical/service acceptance. Remove this
plan after the outstanding prerequisites are resolved and sign-off is recorded.
Public controller/Deck and carryover claims still require that evidence;
promotion follows the [release procedure](../RELEASE.md#agent-release-flow).

## Pending copy approvals

| Location                                                      | Exact current copy                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Packaged application name                                     | `Alchemy Demo`                                                                         |
| Full-game startup after successful demo progress import       | `Your earned demo progress has been imported. Start a new adventure in the full game.` |
| Import notice action                                          | `Dismiss`                                                                              |
| Pending local save, either edition                            | `Saving…`                                                                              |
| Failed local primary and recovery save writes, either edition | `Couldn’t save`                                                                        |
| Failed-save action                                            | `Retry`                                                                                |

Sources: [application identity](../../game-edition.mjs), [import notice](../../src/App.tsx) and
[save-write notice](../../src/app/save-write-notice.tsx).

Menu, recap, marketing and lock revisions remain approved under the demo contract.

## Native overlay prerequisite

Alchemy builds the missing callback and availability exports from steamworks.js
0.4.0 plus two pinned upstream patches. The [native build recipe](../../scripts/steamworks/README.md)
owns exact revisions, source checksums, platform prerequisites and export qualification.
It excludes the availability patch's unrelated workshop declaration. Windows
depots must use a Windows x64 native build; Proton uses that Windows build.

[The pause listener](../../desktop/steam-overlay.cjs) pauses on native activation
and leaves the menu open on deactivation. `steamworks.js.init()` owns callback
pumping; no second timer or callback pump is added. Electron overlay GPU setup
runs before app readiness.

Physical packaged Windows/Steam acceptance is still required, including custom
overlay shortcuts, availability/wishlist fallback and Deck. Browser/mocked
callbacks and native export qualification cannot close this gate.
