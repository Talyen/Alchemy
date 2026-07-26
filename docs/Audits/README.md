# Audits

Re-runnable one-shot guides for coding agents. An audit is neither a project tracker nor standing product requirements. Run one only when the user cites it; do not treat uncited audits as backlog.

## Shared contract

Every finding must state:

- Candidate and confirming evidence
- User or maintenance impact
- **Preferred remedy**, following delete → reuse → simplify locally → parameterize a confirmed duplicate → add an abstraction
- **Why this size**: why it is simpler than both a smaller patch that leaves the cause and a larger abstraction that adds unnecessary surface
- Expected authored production/test LOC, declaration, and file/type direction (exact estimates are unnecessary; identify increase, neutral move, or reduction)
- Matching verification

A probe hit is not a finding. **Zero findings is a successful audit result.** Never invent a fix or a structural proposal to satisfy a quota.

Unless the cited audit explicitly owns the behavior, do not change player-facing balance/copy/layout, accessibility test ids, generated output, deterministic battle seeds, or architectural boundaries. Do not add a package/framework or weaken a test/gate to make a finding disappear.

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

### Pass shape

Inventory all findings identified during the audit and write an implementation plan to address all of them. Start with cheap, targeted probes to uncover candidates, then inspect the relevant source to confirm them. If the overall scope of fixes is large, break the implementation plan into distinct, manageable phases. Do not dump or read a directory wholesale or run unrelated full-repo sweeps.

Record outcomes in the handoff/commit/PR, never in an audit. Do not append run logs, Done tables, or dated status to these guides.

### Code and test budgets

- Simplification, duplication, dead-code, and test-reduction fixes should reduce authored LOC, declarations, indirection, or executed cases. Moving code without removing the old path is not a reduction.
- Feature/correctness fixes may grow; explain necessity and the simpler rejected alternative when growth is large.
- Verification does not imply new coverage. Extend an existing semantic owner first and remove coverage made redundant. Prefer path-scoped commands in [CONTRIBUTING.md](../../CONTRIBUTING.md).
- Parameterization is not a reduction when it merely hides the same or more expanded cases behind fewer declarations.

### Verification

After edits, run the path-scoped unit/E2E commands for the touched area from [CONTRIBUTING.md](../../CONTRIBUTING.md). Prefer `npm run typecheck` and focused Vitest over full-suite sweeps during iteration. Use Playwright tags (`@prepush`, `@critical`) when UI flows change. Do not substitute bare smoke or broad suites when a narrower gate covers the change.

Prefer existing gates over aspirational absolute metrics. The only absolute-zero target is a failing enforced boundary gate; elsewhere use evidence, explicit allowlists, runtime history, and per-change ratchets.

Each audit holds only its distinct scope, confirmation rules, and domain allowlists. Shared agent policy lives in [AGENTS.md](../../AGENTS.md); architecture and testing facts live in [ARCHITECTURE.md](../ARCHITECTURE.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md). Agents choose their own probes and process.

## Ownership

| Concern                                                    | Owner audit                               |
| ---------------------------------------------------------- | ----------------------------------------- |
| Dead / unused symbols                                      | `DeadCodeRatioAudit.md`                   |
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

Approved-only architecture proposals (not runnable audits): [ProgressLifetimeSplitProposal.md](./ProgressLifetimeSplitProposal.md).

Layer import boundaries (`src/lib` ↔ `src/features`, facade-only store access) are continuously enforced by ESLint; they are not a user-invoked audit. Fix violations via `npm run lint` / `lint:ci`.

Standing conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [AGENTS.md](../../AGENTS.md). Periodic measurable sweep: `npm run audit:all`.

`npm run content:audit` is a **content catalog** check (cards/gear/copy), not part of this code-quality pack.

### Measurable sweep map (`npm run audit:all`)

| Probe                                         | Interpret via                                                         | Notes                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run deadcode:strict`                     | `DeadCodeRatioAudit.md`                                               | Confirm with `rg`; respect `knip.config.js` allowlists                                        |
| `npm run audit:single-use`                    | `DeadCodeRatioAudit.md` (primary), `InelegantSlopAudit.md` (ceremony) | Supporting signal — not sole evidence                                                         |
| madge circular (`audit:all` step)             | `ChangeLocalityContextEfficiencyAudit.md`                             | Break cycles by inverting deps / extracting shared modules / facades; layer legality → ESLint |
| ESLint complexity + max-lines-per-function    | `InelegantSlopAudit.md`                                               | Prefer complexity ≤ 10; do not split clean ≤10 functions; p90 ≤ 6 is directional only         |
| `node scripts/audit-change-amplification.mjs` | `ChangeLocalityContextEfficiencyAudit.md`                             | Defaults: `--since=3 months ago`, subjects matching `^feat\|^fix\|^balance`                   |

Do not invent standalone audits for complexity, single-use, or import coupling — those probes live in `audit:all` and the guides above.

## Toolchain limits

Local and CI expect **Node 24+**, Vitest, Playwright Chromium, and (for desktop paths) Electron tooling.

| Available                  | Run                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Always                     | The cited audit’s static probes and relevant lightweight gates (`typecheck`, path-scoped Vitest, `knip`)      |
| Browser / Electron present | Path-scoped Playwright (`test:e2e:prepush`, tagged specs); optional `test:e2e:electron` / `test:ship:desktop` |
| Toolchain absent           | Correct source/docs fixes still land; state exactly which build/test checks were skipped and why              |

Do not fail an audit solely because Electron, Steam credentials, or a full ship build is unavailable.

**`rg` path required in Cursor cloud shells:** those environments expose a readable stdin socket, so pathless `rg` waits on stdin forever. Always pass an explicit path (usually `.`) or scoped directories. Prefer `--type ts` (covers `.ts` and `.tsx`); ripgrep has no `tsx` type.
