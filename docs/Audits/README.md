# Audits

Re-runnable one-shot guides for coding agents. An audit is neither a project tracker nor standing product requirements. Run one only when the user cites it; do not treat uncited audits as backlog.

Past dispositions live in [decisions.md](decisions.md). Check it before confirming a candidate; do not re-propose a dispositioned item unless the evidence has changed. Rows written before the 2026 pack restructure cite the former numbered audits:

| Former guide                                                                                                                                  | Now                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 01-AsyncRace, 02-BehaviorHardening, 03-BugHunting                                                                                             | [RuntimeCorrectnessAudit.md](RuntimeCorrectnessAudit.md) |
| 04-ChangeLocalityContextEfficiency, 05-DeadCode, 08-DualPathRetention, 09-DuplicateFeatureSurface, 11-InelegantSlop, 14-StateGravityOwnership | [SimplificationAudit.md](SimplificationAudit.md)         |
| 10-E2ETestQuality, 17-UnitTest                                                                                                                | [TestQualityAudit.md](TestQualityAudit.md)               |
| 06-DesignSystemConsistency, 16-UIInteractionFeedback                                                                                          | [UIConsistencyAudit.md](UIConsistencyAudit.md)           |

DocumentationStaleness, SideEffectSurface, Performance, and TypeSafety are new
in the 2026 pack (no former-name mapping).

## Shared contract

Read this contract with the requested guides. The guides offer investigative lenses, not checklists to satisfy or authority to override the user's scope and current repository owners. Reviewing or editing the guides does not itself request execution of the audits.

### Discover and confirm

Choose discovery methods from the question being investigated: player-flow inspection, focused source tracing, existing diagnostics, tests, history, or measurements. Per-guide signals are optional leads, not an exhaustive inventory. A search hit, large file, cast, missing guard, or passing gate alone establishes neither a defect nor correctness. **Zero confirmed findings is a successful result.**

Start where risk and evidence are strongest. On repeat passes, changed paths and previously uncertain areas are useful starting points when a reliable baseline exists; do not assume earlier coverage. For a full audit, inspect every scope area and representative important flows, including unchanged code. Report what was inspected, sampled, or unavailable; do not describe sampling as exhaustive proof.

For each candidate, establish the expected behavior or ownership rule, trace the actual behavior and consumers, and look for counterevidence: intentional variants, compatibility needs, existing validation, framework guarantees, or a ledger disposition. When docs, tests, and implementation disagree, resolve intent through current owners and focused history. A historical ledger row does not override a changed invariant.

A confirmed finding needs concrete evidence (a reachable failure, violated contract, or demonstrated maintenance cost), its impact, a remedy, and verification that would expose the original problem. A deterministic code-path argument can establish a defect when reproduction is impractical; state the remaining uncertainty. Separate unconfirmed leads from findings.

### Prioritize and remedy

Prioritize by consequence, exposure, and confidence: data loss, exploitable boundaries, blocked progress, and wrong outcomes before cosmetic consistency or maintenance friction. Syntax and file location are risk signals, not severity. Do not spend the pass fixing easy low-impact hits while leaving higher-impact evidence unexamined.

Choose the most maintainable complete causal remedy. Consider deletion, reuse, simplification, and restoring an existing owner before adding a mechanism; these are options, not a mandatory sequence. Fewer lines, declarations, casts, or tests are not success criteria. Explain a structural tradeoff when material; small obvious fixes need no design essay or LOC forecast.

Follow confirmed causes through callers, callees, siblings, tests, schemas, docs, and config. Assign one primary audit to a finding; connected fixes and regression coverage stay together even when they cross audit scopes. Do not run an uncited sibling sweep or report the same issue several times. Preserve compatibility, intentional variants, and repository boundaries; never weaken gates or diagnostics to make a finding disappear.

Implement justified fixes within the user's authorization, including structural remedies when supported by evidence and verification. Follow the repository's skill routing for new contracts. If a consequential product, compatibility, or architecture choice remains unresolved, present the evidence and concrete options; continue independent work. Audit headings do not grant authority for unrelated balance, copy, layout, save-policy, or dependency changes, and do not require reapproval of already authorized work.

### Finish and retain useful evidence

Verify the changed behavior as well as running the required gates. Report findings fixed, unresolved confirmed issues, important uncertainty or coverage limits, and checks actually run. Use before/after measures when they substantiate the finding, such as latency or the number of independently maintained rules; do not require metrics for every fix. An unavailable check limits the conclusion, rather than proving success or invalidating all other evidence.

Keep run results in the handoff, not the guides. Rejected/deferred proposals and intentionally kept borderline candidates get a concise row in [decisions.md](decisions.md); routine non-findings do not need entries.

### Automate stable invariants

When a finding has a precise, low-noise rule, consider an existing lint, type, test, or documentation gate before adding audit prose. Choose enforcement at the owning layer and test legitimate exceptions. Human judgment remains useful where a gate cannot establish behavior or intent; a clean gate does not retire that question.

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

Layer import boundaries are continuously enforced by ESLint. Use those diagnostics for mechanical violations; audits investigate semantic ownership, missing enforcement, and defects that still pass the gates. Fix an encountered violation through its cause, not by relaxing enforcement.

## Intentional seams (do not collapse)

Leave alone unless the owning architecture doc changes: battle RNG injection; persistence write coalescing; options/display prefs vs the versioned player-save envelope; authored catalogs vs `assets.generated.ts` / `metadata.generated.ts`; Vite web vs Electron desktop entries; facade-only feature access to run domain; design-system tokens; ESLint `lib` vs `features` import rules; asset/codegen boundaries.

## Verification

Verify with the path-scoped gates for the touched area in [CONTRIBUTING.md](../../CONTRIBUTING.md). Prefer existing gates over invented absolute metrics; audit heuristics are not additional gates. When toolchain pieces are absent, state exactly which checks were skipped and why — never fail an audit solely because Electron, Steam credentials, or a full ship build is unavailable.

Standing conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [AGENTS.md](../../AGENTS.md). Optional measurable sweep: `npm run audit:all` (`npm run content:audit` is a content-catalog check, outside this pack).
