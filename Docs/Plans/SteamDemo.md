---
status: blocked
reason: Native overlay support, Steamworks configuration, and physical controller/Deck and Cloud acceptance remain unresolved.
updated: 2026-10-14
---

# Steam demo release readiness

Approved product scope, edition identity, and transfer behavior belong to
[Steam demo](../STEAM_DEMO.md). This plan tracks the remaining release prerequisites.

## Outstanding work

- [ ] Configure real demo/full App IDs and depots and verify renderer, package,
      upload, and wishlist targets under [release setup](../RELEASE_SETUP.md#github-secrets-one-time-setup).
- [ ] Resolve the [native overlay binding prerequisite](../STEAM_DEMO.md#input-and-release-evidence):
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
- [ ] Complete Steam install/update/uninstall and build/store review, resolve
      [notice and provenance requirements](../RELEASE_SETUP.md#player-notices-and-asset-provenance)
      and [pending copy approvals](../STEAM_DEMO_COPY_REVIEW.md#pending-copy-approvals),
      then perform [candidate sign-off](../STEAM_DEMO_CHECKLIST.md#9-candidate-evidence-and-release-sign-off).

Keep results with the exact candidate's release evidence, following the
[demo checklist](../STEAM_DEMO_CHECKLIST.md); older automated passes do not
qualify a new candidate or establish physical/service acceptance. Remove this
plan after the outstanding prerequisites are resolved and sign-off is recorded.
Public controller/Deck and carryover claims still require that evidence;
promotion follows the [release procedure](../RELEASE.md#agent-release-flow).
