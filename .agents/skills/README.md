# Local skill routing

Skills add only the decision named below; repository rules and verification commands stay in their canonical owners. Boundary, intent-recovery, and post-edit review guards live in [AGENTS.md § Change guards](../../AGENTS.md#change-guards), not in skills.

| Change                                      | Pre-edit               | Post-edit  |
| ------------------------------------------- | ---------------------- | ---------- |
| Ordinary TypeScript                         | none                   | `verifier` |
| React/TypeScript logic                      | none                   | `verifier` |
| Existing store/port/save/routing boundary   | AGENTS § Change guards | `verifier` |
| New or structurally revised public contract | `architect`            | `verifier` |
| User-cited audit                            | `run-audits`           | `verifier` |
| Playwright E2E / browser app verification   | `playwright-e2e`       | `verifier` |

Optional: after save, persistence, or battle-rule changes, Cursor Bugbot (`review-bugbot`) can review the commit. It is not a CI gate. See [`.cursor/BUGBOT.md`](../../.cursor/BUGBOT.md).

The routine persistence stack is byte-ratcheted in `tests/scripts/verify-changed.test.ts`.
