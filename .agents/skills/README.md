# Local skill routing

Skills are short, task-oriented, and auto-triggered. Routine edits need none. Repository rules and verification commands stay in their canonical owners (`AGENTS.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`). Knowledge is opt-in — see [knowledge/index.md](../knowledge/index.md); do not auto-load during routine work.

| Change                                      | Pre-edit                                                                              | Post-edit  |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| Ordinary TypeScript                         | none                                                                                  | `verifier` |
| React/TypeScript logic                      | none                                                                                  | `verifier` |
| Store/port write path                       | AGENTS § Change guards + `knowledge/patterns/run-state-command-boundary.md` rationale | `verifier` |
| Battle engine / card effect                 | `knowledge/patterns/battle-immutability-rng.md` rationale                             | `verifier` |
| Save shape / defaults / hydration           | `knowledge/patterns/save-migration-contract.md` rationale                             | `verifier` |
| Run-earned materials / rewards              | `knowledge/patterns/run-materials-ownership.md` rationale                             | `verifier` |
| Asset manifest / generated barrel           | `knowledge/patterns/asset-barrels-are-outputs.md`                                     | `verifier` |
| Screen route / boot gate                    | `knowledge/patterns/static-route-imports.md`                                          | `verifier` |
| Gear mutation during / outside run          | `knowledge/patterns/gear-hp-sync.md`                                                  | `verifier` |
| New or structurally revised public contract | `architect`                                                                           | `verifier` |
| User-cited audit                            | `run-audits`                                                                          | `verifier` |
| Playwright E2E / browser app verification   | `playwright-e2e`                                                                      | `verifier` |
| Recurring failure / surprising behavior     | `knowledge/index.md` `When to read` entry for your area                               | `verifier` |

Optional: after save, persistence, or battle-rule changes, Cursor Bugbot (`review-bugbot`) can review the commit. It is not a CI gate. See [`.cursor/BUGBOT.md`](../../.cursor/BUGBOT.md).

The routine persistence stack is byte-ratcheted in `tests/scripts/verify-changed.test.ts`.
