# Persistent Knowledge Index

Institutional memory for recurring bugs, surprising repo behavior, and rejected approaches. **Not auto-loaded** — consult on-demand when a recurring failure or cross-session lesson is suspected.

## When to consult

- Second occurrence of a failure class, or before proposing a skill/instruction change.
- One-off mistakes stay in session history; do not promote eagerly.

## Patterns

| Pattern                                                                   | Status | Confidence | When to read                                                                      |
| ------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------- |
| [Run-State Command Boundary](./patterns/run-state-command-boundary.md)    | active | high       | Before touching `shared/stores/`, run session, battle, or persistence write paths |
| [Battle Immutability & Seeded RNG](./patterns/battle-immutability-rng.md) | active | high       | Before changing `src/lib/battle/`, damage calc, status ticks, or card effects     |
| [Save Migration Contract](./patterns/save-migration-contract.md)          | active | high       | Before changing any persisted save shape, defaults, or hydration                  |
| [Run-Earned Materials Ownership](./patterns/run-materials-ownership.md)   | active | high       | Before granting materials, homestead currencies, or run-end rewards               |
| [Asset Barrels Are Outputs](./patterns/asset-barrels-are-outputs.md)      | active | high       | Before editing art/sound, `*.generated.ts`, or asset manifests                    |
| [Static Route Imports](./patterns/static-route-imports.md)                | active | high       | Before changing screen routes, lazy loading, or boot/loading gates                |
| [Gear HP-Sync Write Path](./patterns/gear-hp-sync.md)                     | active | high       | Before mutating gear (equip/salvage/craft) during or outside a run                |

## Maintenance

```
one-off failure → leave in session history
recurring or clearly generalizable issue → pattern (this directory)
clear reusable prevention → candidate skill update (validate via ../evals/)
candidate with evidence it improves outcomes → promote to active skill
rule that can be enforced mechanically → encode in types/lint/tests/boundary and remove prose
```

- Merge duplicates; mark superseded/obsolete with reason + successor link.
- Preserve rejected approaches when likely to be re-proposed (see `skill-impact.md`).
- Remove stale active guidance without deleting historical reasoning (status → `superseded`).
- No automated pruning; keep this index browsable without loading every pattern.
- History of instruction changes: [skill-impact.md](./skill-impact.md).
- Evals for skill promotion: [../evals/README.md](../evals/README.md).
