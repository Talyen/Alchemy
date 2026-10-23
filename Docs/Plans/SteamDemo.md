---
status: blocked
reason: Native overlay support, Steamworks configuration, physical acceptance, human feedback, and copy approvals remain unresolved.
updated: 2026-10-23
---

# Steam demo release readiness

Approved product scope, edition identity, and transfer behavior belong to
[Steam demo](../STEAM_DEMO.md). This plan tracks the remaining release prerequisites.

## Outstanding work

No published layout IDs, live default assignments, Proton/Deck performance or
suspend/resume evidence have been verified. These prerequisites remain open:

- [ ] Configure real demo/full [App IDs, depots and targets](../RELEASE_SETUP.md#github-secrets-one-time-setup).
- [ ] Resolve the [native overlay binding prerequisite](#native-overlay-prerequisite).
- [ ] Configure and validate [shared Cloud/progress transfer](../STEAM_DEMO.md#save-transfer),
      preserving source saves and initialization receipts.
- [ ] Publish [recommended layouts](../RELEASE_SETUP.md#configuration-and-validation-status)
      and complete [physical Steam acceptance](../STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence),
      including [minimum-spec validation](../RELEASE_SETUP.md#steam-listing-baseline-windows).
- [ ] Obtain unfamiliar-player and listening feedback through the
      [human playtest](../STEAM_DEMO_CHECKLIST.md#human-playtest); verify required fixes.
- [ ] Complete install/update/uninstall and Steamworks build/store review,
      [notices/provenance](../RELEASE_SETUP.md#player-notices-and-asset-provenance),
      [copy approvals](#pending-copy-approvals) and
      [candidate sign-off](../STEAM_DEMO_CHECKLIST.md#9-candidate-evidence-and-release-sign-off).

The checklist owns acceptance procedures, evidence retention and claim limits.
Record results against the exact candidate; remove this plan only after these
prerequisites and sign-off are resolved. Promotion follows [release](../RELEASE.md#agent-release-flow).

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
