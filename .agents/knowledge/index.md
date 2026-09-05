# Knowledge index

Read on demand when a failure, surprising behavior, or proposed approach needs historical context. Implementation instructions belong in the canonical owners linked from [AGENTS.md](../../AGENTS.md#documentation-owners); these notes explain why those instructions exist.

| Lesson                                                                    | When useful                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Asset Barrels Are Outputs](./patterns/asset-barrels-are-outputs.md)      | Generated edits disappear or asset imports break Playwright collection   |
| [Static Route Imports](./patterns/static-route-imports.md)                | Considering lazy routes or another loading gate                          |
| [Gear HP-Sync Write Path](./patterns/gear-hp-sync.md)                     | Gear changes leave stale health or cause nested commands                 |
| [Run-State Command Boundary](./patterns/run-state-command-boundary.md)    | Investigating direct store access, nested commands, or rollback failures |
| [Battle Immutability & Seeded RNG](./patterns/battle-immutability-rng.md) | Investigating nondeterminism, mutation, or rounding rules                |
| [Save Migration Contract](./patterns/save-migration-contract.md)          | Understanding compatibility gates and migration decisions                |
| [Run-Earned Materials Ownership](./patterns/run-materials-ownership.md)   | Rewards disagree with the run ledger or material lint fails              |

## Maintenance

Fix reusable prevention in its canonical owner or an appropriate type, lint rule, or test. Record misleading documentation, surprising behavior, and repeated friction in the [friction log](../FRICTION_LOG.md). Add a knowledge note only when its explanation or rejected approach is useful beyond that fix; a repeated occurrence is evidence, not a requirement to create another file or skill.

Skills own specialized workflows, not copies of implementation rules. For a substantive instruction change, consult relevant entries in [skill change history](./skill-impact.md) to avoid repeating a failed approach, and use [representative evaluations](../evals/README.md) when coding behavior changes. Formatting, link repairs, and removal of duplicated prose do not need behavioral evaluations.

Keep history advisory. Record consequential accepted or rejected strategies, rather than a ledger entry for every documentation edit. Merge duplicated lessons and preserve the reason for decisions that are likely to be challenged again.
