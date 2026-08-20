# Audits

Re-runnable one-shot guides for coding agents. An audit is neither a project tracker nor standing product requirements. Run one only when the user cites it; do not treat uncited audits as backlog.

Past dispositions live in [decisions.md](decisions.md). Check it before confirming a candidate; do not re-propose a dispositioned item unless the evidence has changed.

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

**Agents choose their own discovery and fix strategy.** Each audit’s Known signals and the measurable sweep map below are optional instrumentation — interpret hits through the owning audit; they are not a required runbook. Per-guide `## Known signals` lists omit the shared opener; do not dump or read a directory wholesale or run unrelated full-repo sweeps.

### Discovery breadth

Start from the highest-yield evidence, but follow a confirmed candidate through its **causal neighborhood**: callers, callees, sibling implementations, tests, schemas, fixtures, docs, configuration, and generated inputs that participate in the same behavior. A recent diff or selected live flow is a starting point on repeat runs, not an automatic stopping boundary. When the user explicitly requests a full audit, inspect the audit's applicable ownership area rather than limiting discovery to recent changes.

Audit ownership classifies findings; it does not forbid completing a connected remedy. A cited audit may include a **companion finding** normally classified under a sibling audit when it shares the same root cause, authored paths, or verification path and including it makes the remedy complete. Report both classifications and do not silently turn the pass into the sibling audit's unrelated full sweep.

### Right-size policy

Prefer the smallest **complete causal remedy** that removes the confirmed cause. Related hits may justify one cohesive change, but shared ownership alone does not justify a new seam or framework. Bound scope by causal coherence and verification, not by an arbitrary file count.

- **Ship in-pass:** confirmed local fixes that fully address the finding and do not paper over a larger root cause.
- **Ship bounded structural fixes:** a refactor may ship in the same pass when it restores an existing documented owner, removes rather than mirrors the old path, requires no product/balance/persistence-compatibility/public-contract decision, and has focused verification. Phase large but separable fixes into reviewable slices.
- **Propose and stop:** new packages or frameworks, new architectural seams, save-format or supported-migration changes, player-facing product decisions, broad module relocations with uncertain ownership, or changes that cannot be adequately verified. Present the proposal and wait for approval.
- **Proposal bar** (all must hold, else do not propose):
  1. Confirmed evidence (a probe hit alone is not enough)
  2. Clear maintenance or correctness win (not taste)
  3. Local patches would leave the same class of problem nearby, or already have
  4. Remedy fits an existing owner, or justifies a new owner with a real lifetime/boundary, and removes the replaced surface
  5. A generic abstraction has at least three current uses, two demonstrated drifting implementations, or repairs an enforced architectural boundary; predicted reuse is insufficient

### Pass outcomes

Inventory confirmed findings and address them per the right-size policy. For a finding cluster, record the primary finding, causal neighborhood, included companion findings, intentionally excluded issues, and why the implementation boundary is cohesive. If the fix scope is large, break work into distinct phases. Record outcomes in the handoff/commit/PR, never in an audit guide. Do not append run logs, Done tables, or dated status to these guides. The one durable exception is [decisions.md](decisions.md): when a pass ends with a rejected or deferred proposal, or a borderline candidate is intentionally kept, add one ledger row so future passes do not re-litigate it.

### Repeat runs

Run audits only when cited. Check [decisions.md](decisions.md) first, start repeat discovery with paths changed since the prior pass, and follow confirmed candidates through their causal neighborhood. A user-requested full audit still covers the audit's complete ownership area.

### Promote stable checks to lint gates

When a class of finding is fully mechanical (expressible as an ESLint rule or `no-restricted-syntax`/import pattern) and has stayed clean for several consecutive passes, propose promoting it to a lint gate and deleting the corresponding signal from the audit. Enforced boundaries belong in `eslint.config.js`, not in re-run prose. This is how the audit pack should shrink over time.

### Orchestrated runs

For multiple audits or delegated implementation, one root owns deduplication, the integrated plan, disjoint edit ownership, final review, and the path-scoped gate. Delegate only confirmed independent slices with a brief naming the evidence, remedy, owned files, hard stops, and focused verification. Report the relevant before/after proxy; moving or parameterizing the same surface is not automatically a reduction.

### Verification

Verify with the path-scoped gates for the touched area in [CONTRIBUTING.md](../../CONTRIBUTING.md). Prefer existing gates over aspirational absolute metrics. The only absolute-zero target is a failing enforced boundary gate; elsewhere use evidence, explicit allowlists, runtime history, and per-change ratchets. When toolchain pieces are absent, state exactly which checks were skipped and why.

Each audit holds only its distinct scope, confirmation rules, and domain allowlists. Shared agent policy lives in [AGENTS.md](../../AGENTS.md); architecture and testing facts live in [ARCHITECTURE.md](../ARCHITECTURE.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md).

### Intentional seams (do not collapse)

Leave these alone unless the owning architecture doc changes: battle RNG injection; persistence write coalescing; options/display prefs vs the versioned player-save envelope; authored catalogs vs `assets.generated.ts` / `metadata.generated.ts`; Vite web vs Electron desktop entries; facade-only feature access to run domain; design-system tokens; ESLint `lib` vs `features` import rules; asset/codegen boundaries.

### Cross-cutting signals → owner

Interpret hits through the owning audit. A probe hit is not a finding.

| Signal                                                                                 | Owner                                                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Double-submit / overlapping in-flight writes (`isProcessing`, unguarded rapid confirm) | `01-AsyncRaceAudit.md` (lifetime) and/or `02-BehaviorHardeningAudit.md` (idempotency) |
| Swallowed save / persistence errors                                                    | `02-BehaviorHardeningAudit.md`                                                        |
| Rapid-tap UI / missing press feedback                                                  | `16-UIInteractionFeedbackAudit.md`                                                    |
| Await after unmount / stale subscription                                               | `01-AsyncRaceAudit.md`                                                                |

## Ownership

| Concern                                                    | Owner audit                                  |
| ---------------------------------------------------------- | -------------------------------------------- |
| Dead / obsolete authored surface                           | `05-DeadCodeAudit.md`                        |
| Live dual paths / retained compatibility shims             | `08-DualPathRetentionAudit.md`               |
| RNG / I/O / environment seams and effect quality           | `13-SideEffectSurfaceAudit.md`               |
| Persistence / recovery / transition-boundary correctness   | `02-BehaviorHardeningAudit.md`               |
| Async lifetime / ordering / concurrency / IPC              | `01-AsyncRaceAudit.md`                       |
| Typing escapes / dishonest or invalid-state models         | `15-TypeSafetyAudit.md`                      |
| Unit-test trust, gaps, runtime, redundancy, and ownership  | `17-UnitTestAudit.md`                        |
| Playwright reliability, signal, coverage, isolation, tiers | `10-E2ETestQualityAudit.md`                  |
| Opportunistic defect hunt                                  | `03-BugHuntingAudit.md`                      |
| Doc drift / harmful omissions / duplicated policy          | `07-DocumentationStalenessAudit.md`          |
| UI interaction / feedback / responsive / keyboard / focus  | `16-UIInteractionFeedbackAudit.md`           |
| Design tokens / semantic states / shared UI chrome         | `06-DesignSystemConsistencyAudit.md`         |
| Over-engineered / verbose / inelegant agent slop           | `11-InelegantSlopAudit.md`                   |
| Authored mass hotspots (file / folder, mixed jobs)         | `11-InelegantSlopAudit.md`                   |
| Startup / latency / render / memory / payload performance  | `12-PerformanceAudit.md`                     |
| Copy-paste feature screens / shells / state families       | `09-DuplicateFeatureSurfaceAudit.md`         |
| Misplaced rules/transforms in stores/controllers/screens   | `14-StateGravityOwnershipAudit.md`           |
| Change locality / amplification / agent context efficiency | `04-ChangeLocalityContextEfficiencyAudit.md` |

Layer import boundaries (`src/lib` ↔ `src/features`, facade-only store access) are continuously enforced by ESLint; they are not a user-invoked audit. Fix violations via `npm run lint` / `lint:ci`.

Standing conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [AGENTS.md](../../AGENTS.md). Periodic measurable sweep: `npm run audit:all`.

`npm run content:audit` is a **content catalog** check (cards/gear/copy), not part of this code-quality pack.

### Measurable sweep map (`npm run audit:all`)

Optional instrumentation. Interpret hits through the owning audit — not a mandated first step.

| Probe                                         | Interpret via                                                               | Notes                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run deadcode:strict`                     | `05-DeadCodeAudit.md`                                                       | Confirm with call-site evidence; respect `knip.config.js` allowlists                                                      |
| madge circular (`audit:all` step)             | `04-ChangeLocalityContextEfficiencyAudit.md`                                | Invert deps / extract shared modules / facades; layer legality → ESLint                                                   |
| ESLint complexity + max-lines-per-function    | `11-InelegantSlopAudit.md` (ceremony / complexity / file mass + mixed jobs) | Prefer complexity ≤ 10; do not split clean ≤10 functions; p90 ≤ 6 is directional only; length alone is not a mass finding |
| `node scripts/audit-type-escapes.mjs`         | `15-TypeSafetyAudit.md`                                                     | Trend counts (`any`, `as unknown as`, suppressions, `!.`); compare run-over-run, never a gate                             |
| `node scripts/audit-change-amplification.mjs` | `04-ChangeLocalityContextEfficiencyAudit.md`                                | Defaults: `--since=3 months ago`, subjects matching `^feat\|^fix\|^balance`                                               |

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
