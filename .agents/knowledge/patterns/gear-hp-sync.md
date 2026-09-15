# Gear HP-Sync Write Path

Status: rationale
Evidence: one recorded occurrence at introduction (2026-08-28).

Why: mid-run Gear mutations must sync live run health, using the draft variant inside an open command and the outer wrapper outside it.

Owner: [ARMORY.md](../../../docs/ARMORY.md#write-paths) owns the inside/outside decision table.

Enforcement: `GEAR_NO_OUTER_DISPATCH` lint rejects the outer wrapper inside `run-loop/**` and `shell/**`.
