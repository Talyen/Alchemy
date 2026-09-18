# Local skill routing

Use a skill when its workflow applies. [AGENTS.md](../../AGENTS.md#documentation-owners) owns discovery requirements and [verification](../../AGENTS.md#verification--environment). Ordinary implementation needs no skill.

| When                                                                                                                                                                      | Skill                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Add or structurally redesign a contract across a feature boundary (e.g. new capability port, store schema, or persistence contract; not ordinary use or a private helper) | [`architect`](./architect/SKILL.md)           |
| Write/debug Alchemy Playwright tests or use its browser fixtures/page objects                                                                                             | [`playwright-e2e`](./playwright-e2e/SKILL.md) |
| Run a user-cited audit or all audits                                                                                                                                      | [`run-audits`](./run-audits/SKILL.md)         |
| Verify edits during work and before handoff                                                                                                                               | [`verifier`](./verifier/SKILL.md)             |

Load order: for authoring/debugging browser tests use `playwright-e2e`; for gating edited work use `verifier`. `architect` designs the contract; `run-audits` proposes findings against it.

[AGENTS.md](../../AGENTS.md#documentation-owners) routes implementation work to canonical owners. In particular, use [asset workflows](../../Docs/WORKFLOWS-ASSETS.md) for generated assets, [boot and loading](../../Docs/ARCHITECTURE.md#boot-and-loading) for route loading, and [Armory write paths](../../Docs/ARMORY.md#write-paths) for gear mutations.

[Knowledge](../knowledge/index.md) preserves failure explanations and rejected approaches; it is not an additional implementation checklist. Read it when the current task needs that context.
