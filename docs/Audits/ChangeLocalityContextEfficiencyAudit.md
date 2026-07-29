# Change Locality & Context Efficiency Audit

**Goal:** Reduce maintenance and agent-context cost by finding recurring changes that require more authored edits, unrelated context, verification, or output than the behavior warrants.

## Intent

Identify repeated high-friction clusters and simplify them through existing sources of truth or owners. A successful fix reduces at least one stable proxy: authored touchpoints, required preread surface, duplicated declarations or policy, routed verification tiers, or routine command output. Do not use tokenizer-specific token counts. A clean pass is valid. Before shipping, confirm recurrence (or demonstrated drift), causality beyond co-change alone, excess avoidable surface, an existing home for the remedy, and a measurable before/after proxy with unchanged correctness coverage. If the scope is large, phase the plan.

## What counts as locality or context friction

| Tell                                                                                     | Why it is a finding candidate                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| One policy or command is maintained in several authored sources                          | Every change risks drift and consumes repeated context |
| Comparable changes repeatedly co-touch unrelated authored owners                         | The behavior may lack one source of truth              |
| A local path forces unrelated docs/scripts into the working set                          | Routine work pays avoidable reading or execution cost  |
| Routine successful commands emit repetitive output, or failures require opening raw logs | Useful signal is buried in avoidable tool output       |
| A frequently changed owner requires unrelated code to understand one concern             | The semantic change is not locally reviewable          |
| Feature median file touch count is high (amplification hotspots)                         | Missing facade/seam forces parallel edits              |

**Not this audit:** import legality → ESLint boundaries; wrong semantic ownership → `StateGravityOwnershipAudit.md`; local ceremony → `InelegantSlopAudit.md`; duplicate UI → `DuplicateFeatureSurfaceAudit.md`; unit/E2E portfolio → `UnitTestAudit.md` / `E2ETestQualityAudit.md`; retrospective file/folder mass without recurring co-touch → `AuthoredMassHotspotAudit.md`; reachable dual paths / shims → `DualPathRetentionAudit.md`. Single-use export cleanup without fan-out evidence → `DeadCodeRatioAudit.md`.

## Hard stops

- Do not weaken, skip, or suppress tests, gates, diagnostics, required prereads, or generated-output checks.
- Do not count intentional source/test, authored/generated-output, manifest/catalog, or implementation/fixture companionship as excess fan-out.
- A broad feature change or large file is not itself a finding. Confirm that unrelated context or touchpoints recur.
- Do not mechanically split files, merge unrelated owners, or centralize distinct policies merely to improve a count.
- Do not add routing metadata, a configuration framework, or an abstraction for an isolated task.
- Treat the composition root (`App.tsx`, screen route tables) as expected fan-out, not a seam target by default.

## Remedy preference

Prefer delete duplicated policy or commands and link consumers to the existing source of truth. Narrow verification routing or docs preread using evidence from representative paths. Restore repeated configuration or behavior to its existing semantic owner and remove old copies. Move or split only when it restores an established owner and makes the selected concern independently reviewable; significant moves remain proposals per [README.md](README.md). Parameterize / add a seam only for confirmed repetition with at least three current uses, or propose the seam when non-obvious.

## Domain rules

Executable scripts and checked-in configuration own tool behavior; [ARCHITECTURE.md](../ARCHITECTURE.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md) own architecture and testing policy; [AGENTS.md](../../AGENTS.md) owns repository-wide guardrails. Prefer links over copied policy.

Mine history only as a capped discovery tool, then confirm the strongest candidates in their diffs. Count authored inputs separately from generated outputs and assets. For amplification hotspots, prefer an existing facade (`run-session-facade`, asset barrels, screen-content owners) over a new framework.

Every shipped finding must report its before/after proxy and the unchanged correctness signal (same lint gate, semantic test owner, or E2E journey).

### Circular imports (madge)

When madge (via `npm run audit:all`) reports a cycle, legal remedies include inverting the dependency onto a narrower interface / shared types module, extracting a shared module both sides can import, or routing feature code through an existing facade. Layer-boundary violations remain ESLint failures — fix the import; do not widen the rule.

## Known signals

Optional discovery aids — choose your own probes. See also the [measurable sweep map](README.md#measurable-sweep-map-npm-run-auditall).

- **Change amplification:** `node scripts/audit-change-amplification.mjs` (defaults `--since=3 months ago`, subjects matching `^feat|^fix|^balance`). Empty stats usually mean the since-window or subject filters matched nothing.
- **Authored co-change clusters:** capped history samples excluding `dist/`, assets, and generated files; confirm in diffs.
- **Repeated policy and commands:** duplicated rules, versions, flags, or command sequences across `AGENTS.md`, `docs/`, `CONTRIBUTING.md`, and `scripts/` that can link to one owner.
- **Non-local review surface:** frequently changed authored owners whose diffs repeatedly require unrelated sections; route genuine ownership drift to `StateGravityOwnershipAudit.md`.
- **Single-use abstractions forcing fan-out:** `npm run audit:single-use` as a supporting signal (not sole evidence).
