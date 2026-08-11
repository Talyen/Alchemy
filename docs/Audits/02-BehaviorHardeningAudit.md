# 02. Behavior Hardening Audit

**Goal:** Strengthen confirmed correctness gaps at persistence, recovery, external-data, and player-state transition boundaries.

## Intent

Fix confirmed boundary issues through the complete invariant: decode/validate → mutate → persist/synchronize → acknowledge → recover. Include boot, import/export, backup, and cloud paths when they participate; reuse the existing persistence or transition owner.

## Hard stops

- Do not run unrelated full-repo async-race or type-safety sweeps here. Include a companion race or type-model fix when it is necessary to make the same boundary invariant safe, and report its sibling classification.
- Audio playback handling belongs to `13-SideEffectSurfaceAudit.md`.
- Lifetime / cancellation / IPC sequencing bugs belong in `01-AsyncRaceAudit.md`; this audit owns idempotency of transitions and silent persistence failures.

## Triage

| Priority | Examples                                                                 |
| -------- | ------------------------------------------------------------------------ |
| P0       | Double reward grant, silent save failure, crash on corrupt save          |
| P1       | Non-idempotent completion, lost persistence error                        |
| P2       | Recovery hides a meaningful failure from both the player and diagnostics |
| P3       | Style-only error handling churn                                          |

Prioritize P0–P1 by impact.

## Domain rules

- Critical save fields validated via Zod schemas under `src/lib/validation/save-schemas/`; corrupt saves fail cleanly or fall back with logging — not silent invalid game state (`parseActiveRun`, migrations under `shared/storage` / `src/lib/validation/migration`).
- Persistence surfaces write failures; silent save failure is data loss. Prefer existing storage owners under `src/features/alchemy/shared/storage/` (including backup and Steam/cloud merge paths such as `storage-io-cloud-merge` / backup helpers).
- Run lifecycle mutations go through `run-session-lifecycle-port.ts` (implemented in `run-transitions.ts`) — not ad-hoc `localStorage` writes from screens.
- Active-run session helpers live under `src/lib/active-run-session/`.
- Stage completion / reward grant / shop purchase / craft: double-click or re-entry must not double-grant; completion flags or idempotent transitions before mutations.
- Suspect empty `catch` / swallowed Promise rejections on save, hydrate, resume, or battle outcome paths. **Allowlist:** non-fatal audio (`src/lib/audio*.ts`, app audio effects).
- Store load failure → default/in-memory recovery + log, not crash.
- Import, export, backup, cloud merge, and boot/hydration paths preserve the same validation, failure-reporting, and recovery guarantees as the primary local save path.
- Multi-store or multi-step mutations must not expose a partially completed durable state. Confirm rollback, ordering, retry, or resume semantics rather than guarding only the first call site.
- Prefer existing coverage. Add a regression only when fixing a confirmed gap; battle edges use seeded RNG; save edges reuse empty/partial/corrupt fixtures under `tests/features/alchemy/shared/storage` and save E2E specs.

## Known signals

Optional discovery aids — choose your own probes.

- **Swallowed async errors:** empty `catch` / no-op `.catch` on save, hydrate, resume, or battle outcome paths.
- **Persistence & hydrate seams:** `persist` / `hydrate` / `resume` / `localStorage` / `parseActiveRun` / `snapshotRun` / `restoreRun` call sites.
- **Schema & session owners:** `src/lib/validation/save-schemas/`, `src/lib/active-run-session/`, `shared/storage/`
- **Cloud / backup edges:** merge and backup helpers under `shared/storage` — confirm conflict/merge failure surfaces errors.
- **Non-atomic multi-step mutations:** multi-field store updates before a single persist without rollback on failure.
- **Silent decode / parse fallbacks:** Zod `.safeParse` or JSON parse paths that discard corrupt data without logging.
- **Idempotency & re-entrancy:** reward claim, shop buy, craft, labyrinth/mystery completion handlers — verify guards before granting.
- **Presentation cleanup:** modal/overlay dismiss that leaves transient run-session flags (`reward`, shop, targeting) uncleared.
- **Boundary divergence:** import/export, backup, cloud, and resume paths enforce different validation or recovery rules for the same persisted model.
- **Partial transaction:** one phase of a multi-step grant, purchase, craft, or save completes while a later phase fails, retries, or resumes inconsistently.
