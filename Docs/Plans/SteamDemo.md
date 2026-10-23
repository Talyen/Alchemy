---
status: blocked
reason: Native overlay support, Steamworks configuration, physical acceptance, human feedback, and copy approvals remain unresolved.
updated: 2026-10-23
---

# Steam demo release readiness

Approved product scope, edition identity, and transfer behavior belong to
[Steam demo](../STEAM_DEMO.md). This plan tracks the remaining release prerequisites.

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

The recorded blocker is steamworks.js 0.4.0 lacking native overlay activation callbacks and
availability detection. [The pause listener](../../desktop/steam-overlay.cjs) uses
`SteamCallback.GameOverlayActivated` when supported, pauses on `active: true`,
and leaves the game menu open when the overlay closes. `steamworks.js.init()`
owns callback pumping; do not add a second timer or call
`client.callback.runCallbacks()`, which the installed binding does not expose.

The complete solution is a binding with both native capabilities, followed by
physical Steam validation. The upstream
[activation callback patch](https://github.com/ceifa/steamworks.js/pull/205) and
[availability patch](https://github.com/ceifa/steamworks.js/pull/203) were open
when last checked on 2026-10-02; recheck upstream before choosing a binding. If a supported release is unavailable when shipping,
maintain a minimal fork pinned to an exact commit with those two changes. Exclude
the availability patch's unrelated workshop declaration. Rebuild and verify its
native binaries for Windows and Linux/Deck (and macOS if shipped); editing
JavaScript or declarations in the npm package cannot add a native callback.
Keep its current Steam/cloud APIs and package layout unchanged.

This item remains blocked until native capability and physical Steam evidence
exist, including custom overlay shortcuts and Deck paths. Browser tests and
mocked callbacks cannot establish acceptance.
