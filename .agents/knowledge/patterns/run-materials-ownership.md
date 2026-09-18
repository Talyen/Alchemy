# Run-Earned Materials Ownership

Status: enforced-rationale
Confidence: high

Why: granting run loot via profile `addMaterialsToStockpile()` bypasses the run ledger, so the run-end recap under-reports.

Owner: [WORKFLOWS.md](../../../Docs/WORKFLOWS.md#grant-materials-during-a-run) owns the call pattern; [Armory write paths](../../../Docs/ARMORY.md#write-paths) distinguishes in-run salvage from meta grants.

Enforcement: `alchemy/no-run-earned-add-materials` lint.
