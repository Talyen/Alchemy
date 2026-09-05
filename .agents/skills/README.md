# Local skill routing

Use a skill when its workflow applies. Ordinary implementation needs no pre-edit skill; every edit uses `verifier` before handoff.

| When                                                              | Skill                                         |
| ----------------------------------------------------------------- | --------------------------------------------- |
| Add or structurally redesign a contract across a feature boundary | [`architect`](./architect/SKILL.md)           |
| Write or debug Playwright tests, or verify the game in a browser  | [`playwright-e2e`](./playwright-e2e/SKILL.md) |
| Run a user-cited audit or all audits                              | [`run-audits`](./run-audits/SKILL.md)         |
| Verify edits during work and before handoff                       | [`verifier`](./verifier/SKILL.md)             |

[AGENTS.md](../../AGENTS.md#documentation-owners) routes implementation work to canonical owners. In particular, use [asset workflows](../../docs/WORKFLOWS-ASSETS.md) for generated assets, [boot and loading](../../docs/ARCHITECTURE.md#boot-and-loading) for route loading, and [Armory write paths](../../docs/ARMORY.md#write-paths) for gear mutations.

[Knowledge](../knowledge/index.md) preserves failure explanations and rejected approaches; it is not an additional implementation checklist. Read it when the current task needs that context.
