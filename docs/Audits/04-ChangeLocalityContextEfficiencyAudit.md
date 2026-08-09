# 04. Change Locality & Context Efficiency Audit

**Goal:** Reduce maintenance and agent-context cost by finding recurring changes that require more authored edits, unrelated context, verification, or output than the behavior warrants.

## Intent

Identify high-friction clusters and simplify them through existing sources of truth or owners. A successful fix reduces at least one stable proxy: authored touchpoints, required preread surface, duplicated declarations or policy, routed verification tiers, or routine command output. Do not use tokenizer-specific token counts. A clean pass is valid. Before shipping, confirm recurrence, demonstrated drift, or one consistently expensive workflow; causality beyond co-change alone; excess avoidable surface; an existing home for the remedy; and a measurable before/after proxy with unchanged correctness coverage. Follow the authoring path through source, tests, fixtures, generated inputs, commands, and docs when they participate in the same friction. If the scope is large, phase the plan.

## What counts as locality or context friction

This audit owns two distinct concerns; a run may scope to either.

### Change amplification (authored edits)

| Tell                                                                         | Why it is a finding candidate                 |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| Comparable changes repeatedly co-touch unrelated authored owners             | The behavior may lack one source of truth     |
| A frequently changed owner requires unrelated code to understand one concern | The semantic change is not locally reviewable |
| Feature median file touch count is high (amplification hotspots)             | Missing facade/seam forces parallel edits     |

### Context & tool-output cost (agent working set)

| Tell                                                                                     | Why it is a finding candidate                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| One policy or command is maintained in several authored sources                          | Every change risks drift and consumes repeated context |
| A local path forces unrelated docs/scripts into the working set                          | Routine work pays avoidable reading or execution cost  |
| Routine successful commands emit repetitive output, or failures require opening raw logs | Useful signal is buried in avoidable tool output       |

**Not this audit:** import legality → ESLint boundaries; wrong semantic ownership → `14-StateGravityOwnershipAudit.md`; local ceremony or file/folder mass without recurring co-touch → `11-InelegantSlopAudit.md`; duplicate UI → `09-DuplicateFeatureSurfaceAudit.md`; unit/E2E portfolio → `17-UnitTestAudit.md` / `10-E2ETestQualityAudit.md`; reachable dual paths / shims → `08-DualPathRetentionAudit.md`. Single-use export cleanup without fan-out evidence → `05-DeadCodeAudit.md`.

## Hard stops

- Do not weaken, skip, or suppress tests, gates, diagnostics, required prereads, or generated-output checks.
- Do not count intentional source/test, authored/generated-output, manifest/catalog, or implementation/fixture companionship as excess fan-out.
- A broad feature change or large file is not itself a finding. Confirm that unrelated context or touchpoints recur.
- Do not mechanically split files, merge unrelated owners, or centralize distinct policies merely to improve a count.
- Do not add routing metadata, a configuration framework, or an abstraction for an isolated low-cost task. One demonstrably expensive workflow may justify reusing or restoring an existing owner without waiting for repeated failures.
- Treat the composition root (`App.tsx`, screen route tables) as expected fan-out, not a seam target by default.

## Remedy preference

Prefer delete duplicated policy or commands and link consumers to the existing source of truth. Narrow verification routing or docs preread using evidence from representative paths. Restore repeated configuration or behavior to its existing semantic owner and remove old copies. A bounded move or split may ship when it restores an established owner, removes the old surface, and makes the selected concern independently reviewable; uncertain ownership or new architecture remains a proposal per [README.md](README.md). Parameterize or add a seam only for at least three current uses, two demonstrated drifting implementations, or an enforced boundary.

## Domain rules

Executable scripts and checked-in configuration own tool behavior; [ARCHITECTURE.md](../ARCHITECTURE.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md) own architecture and testing policy; [AGENTS.md](../../AGENTS.md) owns repository-wide guardrails. Prefer links over copied policy.

Mine history only as a capped discovery tool, then confirm the strongest candidates in their diffs. Count authored inputs separately from generated outputs and assets. For amplification hotspots, prefer an existing capability port, asset barrel, or screen-content owner over a new framework.

Every shipped finding must report its before/after proxy and the unchanged correctness signal (same lint gate, semantic test owner, or E2E journey). LOC may remain neutral when authored touchpoints, prerequisite context, verification breadth, or diagnostic noise materially decreases.

### Circular imports (madge)

When madge (via `npm run audit:all`) reports a cycle, legal remedies include inverting the dependency onto a narrower interface / shared types module, extracting a shared module both sides can import, or routing feature code through an existing facade. Layer-boundary violations remain ESLint failures — fix the import; do not widen the rule.

## Known signals

Optional discovery aids — choose your own probes. See also the [measurable sweep map](README.md#measurable-sweep-map-npm-run-auditall).

- **Change amplification:** `node scripts/audit-change-amplification.mjs` (defaults `--since=3 months ago`, subjects matching `^feat|^fix|^balance`). Empty stats usually mean the since-window or subject filters matched nothing. On repeat runs, prefer `--since` the last dispositioned audit pass over the fixed default, and skip clusters already recorded in [decisions.md](decisions.md).
- **Authored co-change clusters:** capped history samples excluding `dist/`, assets, and generated files; confirm in diffs.
- **Repeated policy and commands:** duplicated rules, versions, flags, or command sequences across `AGENTS.md`, `docs/`, `CONTRIBUTING.md`, and `scripts/` that can link to one owner.
- **Non-local review surface:** frequently changed authored owners whose diffs repeatedly require unrelated sections; route genuine ownership drift to `14-StateGravityOwnershipAudit.md`.
- **Single-use abstractions forcing fan-out:** confirm from concrete call sites and co-change history; one consumer alone is not evidence of harmful fan-out.
- **Test/fixture amplification:** one behavior change requires avoidable updates across parallel fixtures, test harnesses, or tier-specific setup.
- **Generated-source ambiguity:** agents must inspect or edit both authored inputs and generated products because ownership or regeneration guidance is unclear.
