# Local skill routing

Skills add only the decision named below; repository rules and verification commands stay in their canonical owners.

| Change                                      | Pre-edit       | Conditional                                     | Post-edit             |
| ------------------------------------------- | -------------- | ----------------------------------------------- | --------------------- |
| Ordinary TypeScript                         | none           | none                                            | `verifier`            |
| React/TypeScript logic                      | none           | none                                            | `unslop` → `verifier` |
| Existing store/port/save/routing boundary   | `blast-radius` | `why` only if docs/tests leave intent ambiguous | `unslop` → `verifier` |
| New or structurally revised public contract | `architect`    | `why` only if docs/tests leave intent ambiguous | `unslop` → `verifier` |
| User-cited audit                            | `run-audits`   | audit-specific                                  | `verifier`            |

`architect` and `blast-radius` are mutually exclusive for one change. `why` never triggers from a path alone. The routine persistence stack is byte-ratcheted in `tests/scripts/verify-changed.test.ts`.
