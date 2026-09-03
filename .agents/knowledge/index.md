# Persistent Knowledge Index

Institutional memory for recurring bugs, surprising repo behavior, and rejected approaches. **Not auto-loaded** — consult on-demand when a recurring failure or cross-session lesson is suspected.

## When to consult

- Consult the `When to read` entry for your change area (see tables below and skills routing) — not a generic second-occurrence check.
- One-off mistakes stay in session history; do not promote eagerly. Second same-area recurrence in the friction log is a pattern candidate.
- Before proposing a skill/instruction change, check the relevant pattern plus `skill-impact.md`.

## Live patterns

| Pattern                                                              | Status | Confidence | When to read                                                                                                         |
| -------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| [Asset Barrels Are Outputs](./patterns/asset-barrels-are-outputs.md) | active | high       | Before editing art/sound, `*.generated.ts`, or asset manifests                                                       |
| [Static Route Imports](./patterns/static-route-imports.md)           | active | high       | Before changing screen routes, lazy loading, or boot/loading gates                                                   |
| [Gear HP-Sync Write Path](./patterns/gear-hp-sync.md)                | active | medium     | Before mutating gear (equip/salvage/craft) during or outside a run — single occurrence; promote after 2nd recurrence |

## Enforced rationale

Fully enforced by lint/tests/boundaries — retained as the reason the gate exists, not as working procedure. Owner doc plus gate is authoritative.

| Pattern                                                                   | Status             | Confidence | When to read                                                                   |
| ------------------------------------------------------------------------- | ------------------ | ---------- | ------------------------------------------------------------------------------ |
| [Run-State Command Boundary](./patterns/run-state-command-boundary.md)    | enforced-rationale | high       | To understand why the aggregate lint rejects direct store access               |
| [Battle Immutability & Seeded RNG](./patterns/battle-immutability-rng.md) | enforced-rationale | high       | To understand why battle lint bans `Math.floor` / direct RNG                   |
| [Save Migration Contract](./patterns/save-migration-contract.md)          | enforced-rationale | high       | To understand why save-guard tests require fixtures on schema change           |
| [Run-Earned Materials Ownership](./patterns/run-materials-ownership.md)   | enforced-rationale | high       | To understand why the material lint rejects direct `addMaterials` during a run |

## Maintenance

```
one-off failure → friction log Resolved with N/A (one-off) + reason
second same-area recurrence → pattern candidate (this directory)
clear reusable prevention → candidate skill update (evals only if routine coding behavior changes)
candidate with evidence it improves outcomes → promote to active skill
rule that can be enforced mechanically → encode in types/lint/tests/boundary, status → enforced-rationale
```

- Merge duplicates; mark superseded/obsolete with reason + successor link.
- Preserve rejected approaches when likely to be re-proposed (see `skill-impact.md`).
- Enforced patterns keep `enforced-rationale` status with reasoning intact; use `superseded` only for withdrawn guidance.
- No automated pruning; keep this index browsable without loading every pattern.
- History of instruction changes: [skill-impact.md](./skill-impact.md) (advisory, not a gate).
- Evals for skill promotion: [../evals/README.md](../evals/README.md) (required only when routine coding behavior changes).
