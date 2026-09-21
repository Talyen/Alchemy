---
status: complete
updated: 2026-09-20
implementation: 4089a95168e7271f750526f04313ce9d407c2b97
---

# Headless playthrough simulation — implementation record

Implemented in `4089a95168e7271f750526f04313ce9d407c2b97`. The original proposal,
illustrative archetypes, and completed implementation checklist remain in that
commit. This record preserves the final decisions and evidence; current usage
and supported behavior belong to [Headless playthrough testing](../../PLAYTHROUGH_SIMULATION.md).

## Implementation record — 2026-09-19

Implemented the operational framework and retained correctness suite. The canonical
usage and scope owner is now [Headless playthrough testing](../../PLAYTHROUGH_SIMULATION.md).
The runner lives under `src/app/playthrough/`; shared production battle and autosave
operations are consumed by both the UI and the harness. No shipping save schema
changes were needed.

Implementation decisions made under the task's authorization to revise this plan:

- Use sequential isolated child processes immediately. Startup is inexpensive
  relative to the correctness benefit; no global-reset protocol is added to the
  game. The fixed suite proves fresh-process replay and combat checkpoint resume.
- Keep the archetype catalog data-driven from each hero's production keywords,
  with random and minimalist alternatives and all four existing combat policies.
  The illustrative named profile catalog is not implemented as a duplicate content
  catalog. All eight heroes, all three modes, and all three difficulties have
  retained targeted scenarios.
- Compare saved report manifests rather than automatically checking out Git
  revisions. Report paired career metrics and uncertainty within cohorts; no
  balance thresholds gate CI without calibration and explicit design goals.
- HTML uses the shared report shell with expandable cohort/career details,
  mortality meters, boss reach denominators, economy tables, card opportunities,
  combat maxima, and reached/unreached progression milestones.
- Count card observation/playability opportunities accurately. Defer exact draw
  and passive-item-trigger attribution until production supplies a suitable event
  stream; snapshot differencing can miscount redraws and automatic plays. Reports
  explicitly disclose this measurement limit. This is a telemetry expansion,
  not a blocker to automated playthrough correctness testing.
- Freeze wall time because current covered progression uses actions and resources,
  not elapsed-time completion. No pacing claim is made without a recorded cadence.
- The in-memory transport exercises shipping persistence orchestration. Existing
  browser/desktop backend checks remain the storage integration owners; the
  headless suite does not claim physical durability or UI coverage.

Measured two-run fresh Knight careers for seeds 1 and 2 completed in approximately
2.1 and 1.8 seconds inside the worker, including per-action loader validation,
acknowledged writes at supported save points, policy decisions, telemetry, and
journal writes. The retained suite takes about 40 seconds including isolated
process startup. Budgets remain configurable; incomplete scenarios fail CI.

Retained evidence includes earned equipment/talent spending, targeted homestead
upgrades, Campaign victory and defeat, Wildcard drafts, finite endless horizons,
execution rollback and post-commit failure replay, stale/duplicate/rejected
choices, interrupted persistence, and duplicate-settlement protection. Runtime
and coverage vary with policy/content; the fixed seeds are correctness evidence,
not calibrated player win-rate estimates.
