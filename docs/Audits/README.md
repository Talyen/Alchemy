# Audits

Re-runnable one-shot guides for coding agents. An audit is neither a project tracker nor standing product requirements. Run one only when the user cites it; do not treat uncited audits as backlog.

Past dispositions live in [decisions.md](decisions.md). Check it before confirming a candidate; do not re-propose a dispositioned item unless the evidence has changed. Rows written before the 2026 pack restructure cite the former numbered audits:

| Former guide                                                                                                                                  | Now                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 01-AsyncRace, 02-BehaviorHardening, 03-BugHunting                                                                                             | [RuntimeCorrectnessAudit.md](RuntimeCorrectnessAudit.md) |
| 04-ChangeLocalityContextEfficiency, 05-DeadCode, 08-DualPathRetention, 09-DuplicateFeatureSurface, 11-InelegantSlop, 14-StateGravityOwnership | [SimplificationAudit.md](SimplificationAudit.md)         |
| 10-E2ETestQuality, 17-UnitTest                                                                                                                | [TestQualityAudit.md](TestQualityAudit.md)               |
| 06-DesignSystemConsistency, 16-UIInteractionFeedback                                                                                          | [UIConsistencyAudit.md](UIConsistencyAudit.md)           |

## Shared contract

Every finding states: candidate and confirming evidence; user or maintenance impact; a preferred remedy (delete → reuse → local simplify before parameterizing or abstracting); why this size beats both a smaller patch that leaves the cause and a larger abstraction; expected authored LOC/declaration direction; and matching verification.

A probe hit is not a finding. **Zero findings is a successful audit result.** Never invent a fix to satisfy a quota. Unless the cited audit owns the behavior, do not change player-facing balance/copy/layout, accessibility test ids, generated output, deterministic battle seeds, or architectural boundaries; do not add packages or weaken gates to make a finding disappear.

Agents choose their own discovery and fix strategy — per-guide signals are optional instrumentation, not a runbook. Start from the highest-yield evidence, follow confirmed candidates through their causal neighborhood (callers, callees, siblings, tests, schemas, docs, config), and on repeat runs start from paths changed since the prior pass. A user-requested full audit still covers the audit's complete ownership area.

### Right size

Ship the smallest complete causal remedy. Local confirmed fixes ship in-pass; structural fixes ship when they restore an existing documented owner, remove the old surface, need no product/persistence/public-contract decision, and have focused verification. Propose and stop for new frameworks/seams, save-format changes, player-facing decisions, or anything not adequately verifiable — propose only with confirmed evidence, a real maintenance win, local patches demonstrably leaving the same problem class, and an owner that removes more surface than it adds.

For a finding cluster, record primary finding, causal neighborhood, included companions, and exclusions in the handoff — never in audit guides. The one durable exception: rejected/deferred proposals and intentionally kept borderline candidates get one ledger row in [decisions.md](decisions.md).

### Promote stable checks to lint gates

When a class of finding is fully mechanical and has stayed clean for several passes, propose promoting it to an ESLint/no-restricted-syntax gate and delete the signal from the audit. This is how the pack shrinks over time.

## Ownership

| Concern                                                                         | Owner audit                                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Async lifetime / races / persistence hardening / defect hunt                    | [RuntimeCorrectnessAudit.md](RuntimeCorrectnessAudit.md)         |
| Dead code, dual paths, duplication, slop/mass, ownership drift, change locality | [SimplificationAudit.md](SimplificationAudit.md)                 |
| Unit + E2E portfolio trust, gaps, runtime, tiers                                | [TestQualityAudit.md](TestQualityAudit.md)                       |
| Design tokens, semantic states, interaction/feedback defects                    | [UIConsistencyAudit.md](UIConsistencyAudit.md)                   |
| Doc drift / harmful omissions / duplicated policy                               | [DocumentationStalenessAudit.md](DocumentationStalenessAudit.md) |
| RNG / I/O / environment seams and effect quality                                | [SideEffectSurfaceAudit.md](SideEffectSurfaceAudit.md)           |
| Startup / latency / render / memory performance                                 | [PerformanceAudit.md](PerformanceAudit.md)                       |
| Typing escapes / invalid-state models                                           | [TypeSafetyAudit.md](TypeSafetyAudit.md)                         |

Layer import boundaries (`src/lib` ↔ `src/features`, facade-only store access) are continuously enforced by ESLint — fix via `npm run lint`, not an audit.

## Intentional seams (do not collapse)

Leave alone unless the owning architecture doc changes: battle RNG injection; persistence write coalescing; options/display prefs vs the versioned player-save envelope; authored catalogs vs `assets.generated.ts` / `metadata.generated.ts`; Vite web vs Electron desktop entries; facade-only feature access to run domain; design-system tokens; ESLint `lib` vs `features` import rules; asset/codegen boundaries.

## Verification

Verify with the path-scoped gates for the touched area in [CONTRIBUTING.md](../../CONTRIBUTING.md). Prefer existing gates over aspirational absolute metrics; the only absolute-zero target is a failing enforced boundary gate. When toolchain pieces are absent, state exactly which checks were skipped and why — never fail an audit solely because Electron, Steam credentials, or a full ship build is unavailable.

Standing conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [AGENTS.md](../../AGENTS.md). Optional measurable sweep: `npm run audit:all` (`npm run content:audit` is a content-catalog check, outside this pack).

**`rg` path required in Cursor cloud shells:** pathless `rg` waits on stdin forever there; pass an explicit path (usually `.`) and prefer `--type ts`.
