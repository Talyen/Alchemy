---
status: blocked
reason: Steam ID verification, Steamworks configuration, physical acceptance, human feedback, and copy approvals remain unresolved.
updated: 2026-10-25
---

# Steam demo release readiness

Approved product scope, edition identity, and transfer behavior belong to
[Steam demo](../STEAM_DEMO.md). This plan tracks the remaining release prerequisites.

Steam ID verification is pending and no store page exists yet. Complete
[AI disclosure](../RELEASE_SETUP.md#steam-ai-disclosure) during page setup using
the confirmed [provenance](../../THIRD_PARTY_NOTICES.md).

## Outstanding work

No published layout IDs, live default assignments, Proton/Deck performance or
suspend/resume evidence have been verified. These prerequisites remain open:

- [ ] Configure real demo/full [App IDs, depots and targets](../RELEASE_SETUP.md#github-secrets-one-time-setup).
- [ ] Qualify the [native overlay binding](../../scripts/steamworks/README.md) in
      packaged Windows/Steam, including custom shortcuts, availability/wishlist
      fallback and Deck, under [physical acceptance](../STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence).
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
