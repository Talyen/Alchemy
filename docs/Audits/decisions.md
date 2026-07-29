# Audit Decisions Ledger

Durable dispositions from past audit passes. Check this ledger before confirming a candidate; do not re-propose a dispositioned item unless the evidence has changed (new callers, new drift, changed ownership). This is the only file under `docs/Audits/` that records outcomes — run logs, Done tables, and dated status still do not belong in the audit guides.

## How to use

- Before confirming a finding, search this file for the subject path or symbol.
- When a pass ends with a rejected or deferred proposal, or a borderline candidate is intentionally kept, add one row.
- Keep entries to one line each. Link evidence in the commit or PR, not here.
- Remove a row when its subject is deleted or the disposition no longer applies; note the removal in the commit message.

Dispositions: **keep** (intentional — do not re-flag), **rejected** (proposal declined — do not re-propose), **deferred** (approved but unscheduled — re-raise only when the user asks).

## Ledger

| Date | Audit | Subject (path / symbol) | Disposition | Reason |
| ---- | ----- | ----------------------- | ----------- | ------ |
