# Audits

Re-runnable one-shot guides for coding agents. An audit is neither a project tracker nor standing product requirements. Run one only when the user cites it; do not treat uncited audits as backlog.

## Shared contract

Every finding must state:

- Candidate and confirming evidence
- User or maintenance impact
- **Preferred remedy** — prefer delete, reuse, or local simplify over parameterizing duplicates or adding abstractions when those smaller remedies remove the cause
- **Why this size**: why it is simpler than both a smaller patch that leaves the cause and a larger abstraction that adds unnecessary surface
- Expected authored production/test LOC, declaration, and file/type direction (exact estimates are unnecessary; identify increase, neutral move, or reduction)
- Matching verification

A probe hit is not a finding. **Zero findings is a successful audit result.** Never invent a fix or a structural proposal to satisfy a quota.

Unless the cited audit explicitly owns the behavior, do not change player-facing balance/copy/layout, accessibility test ids, generated output, deterministic battle seeds, or architectural boundaries. Do not add a package/framework or weaken a test/gate to make a finding disappear.

**Agents choose their own discovery and fix strategy.** Each audit’s Known signals and the measurable sweep map below are optional instrumentation — interpret hits through the owning audit; they are not a required runbook. Do not dump or read a directory wholesale or run unrelated full-repo sweeps.

### Right-size policy

Prefer the smallest remedy that removes the confirmed cause. Related hits may justify one cohesive change, but shared ownership alone does not justify a new seam or framework.

- **Ship in-pass:** confirmed local fixes that fully address the finding and do not paper over a larger root cause.
- **Propose and stop:** significant refactors, package moves, new seams, or architecture changes. Do not implement those in the same unsupervised pass; present the proposal and wait for approval.
- **Proposal bar** (all must hold, else do not propose):
  1. Confirmed evidence (a probe hit alone is not enough)
  2. Clear maintenance or correctness win (not taste)
  3. Local patches would leave the same class of problem nearby, or already have
  4. Remedy fits an existing owner and removes the replaced surface
  5. A generic abstraction has at least three current uses or repairs an enforced architectural boundary; predicted reuse is insufficient

### Pass outcomes

Inventory confirmed findings and address them per the right-size policy. If the fix scope is large, break work into distinct phases. Record outcomes in the handoff/commit/PR, never in an audit. Do not append run logs, Done tables, or dated status to these guides.

### Orchestrated runs

When a user requests multiple audits or subagent implementation, keep one root orchestrator responsible for shared prereads, candidate deduplication, finding confirmation, the implementation plan, edit ownership, final review, and integrated verification.

- Delegate only confirmed, independent implementation slices. Use an Explorer only for a bounded investigation that does not repeat the root inventory.
- Never give a subagent the full conversation by default. Use no inherited turns or the smallest useful recent-turn slice; rely on a task brief and repository sources for durable context.
- A task brief must name the owning audit, confirmed evidence, intended remedy, exact files/symbols the agent owns, hard stops, and the cheapest matching verification. Do not ask the agent to rediscover the problem or rerun broad probes.
- Keep concurrent write ownership disjoint. Prefer one or two implementation agents at a time; additional agents must provide a real independent latency win.
- Subagents run targeted checks for their own slice and return only changed paths, behavior, verification status, and blockers. Do not return raw diffs, source dumps, or full build/test logs.
- The root reviews every diff and runs the applicable path-scoped gates from `CONTRIBUTING.md` once across the integrated changed paths. Do not multiply the same full suite across workers and the root.
- Keep command output bounded: pass explicit paths to searches, prefer quiet or summary modes, and inspect focused diagnostics only after a failure. Save or summarize long logs instead of injecting them into agent context.

### Code and test budgets

- Simplification, duplication, dead-code, and test-reduction fixes should reduce authored LOC, declarations, indirection, or executed cases. Moving code without removing the old path is not a reduction.
- Feature/correctness fixes may grow; explain necessity and the simpler rejected alternative when growth is large.
- Verification does not imply new coverage. Extend an existing semantic owner first and remove coverage made redundant.
- Parameterization is not a reduction when it merely hides the same or more expanded cases behind fewer declarations.

### Verification

Verify with the path-scoped gates for the touched area in [CONTRIBUTING.md](../../CONTRIBUTING.md). Prefer existing gates over aspirational absolute metrics. The only absolute-zero target is a failing enforced boundary gate; elsewhere use evidence, explicit allowlists, runtime history, and per-change ratchets. When toolchain pieces are absent, state exactly which checks were skipped and why.

Each audit holds only its distinct scope, confirmation rules, and domain allowlists. Shared agent policy lives in [AGENTS.md](../../AGENTS.md); architecture and testing facts live in [ARCHITECTURE.md](../ARCHITECTURE.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Ownership

| Concern                                                    | Owner audit                               |
| ---------------------------------------------------------- | ----------------------------------------- |
| Dead / unused symbols                                      | `DeadCodeRatioAudit.md`                   |
| Live dual paths / retained compatibility shims             | `DualPathRetentionAudit.md`               |
| Authored mass hotspots (retrospective)                     | `AuthoredMassHotspotAudit.md`             |
| RNG / I/O seams                                            | `SideEffectSurfaceAudit.md`               |
| Persistence / idempotency / swallowed errors               | `BehaviorHardeningAudit.md`               |
| Async races / IPC / effect lifetime                        | `AsyncRaceAudit.md`                       |
| `any` / casts / typing escapes                             | `TypeSafetyAudit.md`                      |
| Unit test value, runtime, redundancy, and tier ownership   | `UnitTestAudit.md`                        |
| Playwright reliability and tier fit                        | `E2ETestQualityAudit.md`                  |
| Opportunistic defect hunt                                  | `BugHuntingAudit.md`                      |
| Doc drift                                                  | `DocumentationStalenessAudit.md`          |
| UI interaction / feedback / keyboard                       | `UIInteractionFeedbackAudit.md`           |
| Design tokens / shared UI chrome                           | `DesignSystemConsistencyAudit.md`         |
| Over-engineered / verbose / inelegant agent slop           | `InelegantSlopAudit.md`                   |
| Copy-paste feature screens / shells                        | `DuplicateFeatureSurfaceAudit.md`         |
| Misplaced logic in stores / controllers / mega-screens     | `StateGravityOwnershipAudit.md`           |
| Change locality / amplification / agent context efficiency | `ChangeLocalityContextEfficiencyAudit.md` |

Layer import boundaries (`src/lib` ↔ `src/features`, facade-only store access) are continuously enforced by ESLint; they are not a user-invoked audit. Fix violations via `npm run lint` / `lint:ci`.

Standing conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [AGENTS.md](../../AGENTS.md). Periodic measurable sweep: `npm run audit:all`.

`npm run content:audit` is a **content catalog** check (cards/gear/copy), not part of this code-quality pack.

### Measurable sweep map (`npm run audit:all`)

Optional instrumentation. Interpret hits through the owning audit — not a mandated first step.

| Probe                                         | Interpret via                                                                                           | Notes                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run deadcode:strict`                     | `DeadCodeRatioAudit.md`                                                                                 | Confirm with call-site evidence; respect `knip.config.js` allowlists                                                               |
| `npm run audit:single-use`                    | `DeadCodeRatioAudit.md` (primary), `InelegantSlopAudit.md` (ceremony)                                   | Supporting signal — not sole evidence                                                                                              |
| madge circular (`audit:all` step)             | `ChangeLocalityContextEfficiencyAudit.md`                                                               | Invert deps / extract shared modules / facades; layer legality → ESLint                                                            |
| ESLint complexity + max-lines-per-function    | `InelegantSlopAudit.md` (ceremony / complexity); `AuthoredMassHotspotAudit.md` (file mass + mixed jobs) | Prefer complexity ≤ 10; do not split clean ≤10 functions; p90 ≤ 6 is directional only; length alone is not an AuthoredMass finding |
| `node scripts/audit-change-amplification.mjs` | `ChangeLocalityContextEfficiencyAudit.md`                                                               | Defaults: `--since=3 months ago`, subjects matching `^feat\|^fix\|^balance`                                                        |

Do not invent standalone audits for complexity, single-use, or import coupling — those probes live in `audit:all` and the guides above.

## Toolchain limits

Local and CI expect **Node 24+**, Vitest, Playwright Chromium, and (for desktop paths) Electron tooling.

| Available                  | Run                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Always                     | Relevant lightweight gates (`typecheck`, path-scoped Vitest, `knip`) and any Known signals you choose         |
| Browser / Electron present | Path-scoped Playwright (`test:e2e:prepush`, tagged specs); optional `test:e2e:electron` / `test:ship:desktop` |
| Toolchain absent           | Correct source/docs fixes still land; state exactly which build/test checks were skipped and why              |

Do not fail an audit solely because Electron, Steam credentials, or a full ship build is unavailable.

**`rg` path required in Cursor cloud shells:** those environments expose a readable stdin socket, so pathless `rg` waits on stdin forever. Pass an explicit path (usually `.`) or scoped directories. Prefer `--type ts` (covers `.ts` and `.tsx`); ripgrep has no `tsx` type.
