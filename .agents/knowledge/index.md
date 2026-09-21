# Knowledge index

Read on demand when a failure, surprising behavior, or proposed approach needs historical context. Implementation instructions belong in the canonical owners linked from [AGENTS.md](../../AGENTS.md#find-the-owner); these notes explain why those instructions exist.

## Lessons and owners

These short rationales belong together; follow the linked owner for the actual
implementation contract and its enforcement.

| Problem                                          | Why the rule exists                                                                                                                                                | Current owner                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Generated asset edits disappear                  | Preparation replaces generated barrels; raw files and manifests are the authoring source.                                                                          | [Asset workflow](../../Docs/WORKFLOWS-ASSETS.md)                                |
| Lazy routes introduce another loading state      | Static screen imports preserve one cold-start loading experience.                                                                                                  | [Boot and loading](../../Docs/ARCHITECTURE.md#boot-and-loading)                 |
| Gear changes leave stale Health or nest commands | Gear mutation must rebind live Health; an existing command needs the draft wrapper, not another dispatch. The original note recorded one occurrence on 2026-08-28. | [Armory write paths](../../Docs/ARMORY.md#write-paths)                          |
| Gameplay publishes partial changes               | One synchronous draft boundary keeps reads, rollback, RNG and persistence consistent; side effects follow commit.                                                  | [Run commands](../../Docs/RUN_STATE.md#command-atomicity)                       |
| Combat replay diverges                           | Immutable snapshots, seeded world RNG and consistent rounding make saved and uninterrupted combat agree.                                                           | [Engine invariants](../../Docs/GAME_RULES.md#engine-invariants)                 |
| Supported saves lose progress                    | Schemas, defaults, codecs and fixtures must agree on both compatibility and recovery.                                                                              | [Save contract](../../src/features/alchemy/shared/storage/MIGRATIONS.md)        |
| Material rewards disagree with the recap         | Stockpile-only writes bypass the run earnings ledger.                                                                                                              | [Run material grants](../../Docs/RUN_WORKFLOWS.md#grant-materials-during-a-run) |

## Maintenance

Fix reusable prevention in its canonical owner or an appropriate type, lint rule, or test. Use the [friction log](../FRICTION_LOG.md) for unresolved recurring friction and consequential lessons; ordinary corrections and one-off environment issues need no historical record. Preserve useful evidence from existing entries when resolving them. Add a knowledge note only when its explanation or rejected approach is useful beyond that fix; a repeated occurrence is evidence, not a requirement to create another file or skill.

Skills own specialized workflows, not copies of implementation rules. For a substantive instruction change, consult relevant entries in [skill change history](./skill-impact.md) to avoid repeating a failed approach, and use matched [representative evaluations](../evals/README.md) for uncertain workflow changes, consequential safeguard changes, or claims of improved agent performance. Straightforward contradiction removal and procedural simplification can use source review and documentation checks.

Keep history advisory. Record consequential accepted or rejected strategies, rather than a ledger entry for every documentation edit. Merge duplicated lessons and preserve the reason for decisions that are likely to be challenged again.
