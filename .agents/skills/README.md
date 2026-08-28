# Local skill routing

Skills are short, task-oriented, and auto-triggered. Routine edits need none. Repository rules and verification commands stay in their canonical owners (`AGENTS.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`). Knowledge is opt-in — see [knowledge/index.md](../knowledge/index.md); do not auto-load during routine work.

| Change                                      | Pre-edit               | Post-edit  |
| ------------------------------------------- | ---------------------- | ---------- |
| Ordinary TypeScript                         | none                   | `verifier` |
| React/TypeScript logic                      | none                   | `verifier` |
| Existing store/port/save/routing boundary   | AGENTS § Change guards | `verifier` |
| New or structurally revised public contract | `architect`            | `verifier` |
| User-cited audit                            | `run-audits`           | `verifier` |
| Playwright E2E / browser app verification   | `playwright-e2e`       | `verifier` |
| Recurring failure / surprising behavior     | `knowledge/index.md`   | `verifier` |

Optional: after save, persistence, or battle-rule changes, Cursor Bugbot (`review-bugbot`) can review the commit. It is not a CI gate. See [`.cursor/BUGBOT.md`](../../.cursor/BUGBOT.md).

The routine persistence stack is byte-ratcheted in `tests/scripts/verify-changed.test.ts`.
