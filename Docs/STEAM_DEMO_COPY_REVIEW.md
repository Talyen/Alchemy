# Steam demo copy review

Menu, recap, marketing and lock revisions are approved under
[Steam demo](./STEAM_DEMO.md). This document retains only pending copy approvals;
remove it and repair inbound links when those decisions are resolved.

## Pending copy approvals

| Location                                                      | Exact current copy                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Packaged application name                                     | `Alchemy Demo`                                                                         |
| Full-game startup after successful demo progress import       | `Your earned demo progress has been imported. Start a new adventure in the full game.` |
| Import notice action                                          | `Dismiss`                                                                              |
| Pending local save, either edition                            | `Saving…`                                                                              |
| Failed local primary and recovery save writes, either edition | `Couldn’t save`                                                                        |
| Failed-save action                                            | `Retry`                                                                                |

Sources: [application identity](../game-edition.mjs), [import notice](../src/App.tsx) and
[save-write notice](../src/app/save-write-notice.tsx).
