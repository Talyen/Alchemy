# Discovery-context trials — September 12, 2026

## Method and adoption

This version-3 investigation cohort uses base `80d22fcb542515c12acdeb8908ac311018e3215a` plus a frozen working-tree snapshot. The original coding-task catalog remains unchanged. Two fresh trials per variant and scenario used `gpt-6-astra`, medium reasoning, identical prompts, read-only sandboxing, `--ignore-user-config`, and ephemeral CLI sessions. Both worktrees installed the pinned dependencies using `npm ci --ignore-scripts`; `ALCHEMY_VERIFY_FRESH=1` was identical, though these investigations required no verification.

Each trial completed an independent investigation with implementation evidence. Host `codex exec --json` completion counters provide the actual usage below. Input includes cached input; output is counted once. Tool calls count completed command/tool events. Records and comparisons use the existing `agent-eval.mjs` functions with host-token-only capture; unobserved read-event counters are not evidence of zero reading.

The adoption rule was correct conclusions and lower summed input-plus-output usage across the two trials. Both changes meet that rule:

| Investigation | Baseline total | Candidate total | Reduction | Decision |
| ------------- | -------------: | --------------: | --------: | -------- |
| Battle        |        558,741 |         537,914 |      3.7% | Retained |
| Run state     |        344,386 |         307,351 |     10.8% | Retained |

Battle varied from a 21.1% increase to a 21.4% reduction between matched pairs; its evidence is modest and mixed. Run-state reductions were 2.9% and 17.5%. Two trials do not establish statistical significance, guaranteed savings, billing/allowance savings, or repository-wide coding-task improvements. Direct content/verification routing repairs were source-checked and regression-tested separately; these totals do not establish their token savings.

| Trial                 |   Input | Cached input | Output | Tool calls |
| --------------------- | ------: | -----------: | -----: | ---------: |
| battle-baseline-1     | 230,445 |      188,288 |  2,261 |         11 |
| battle-candidate-1    | 279,776 |      246,272 |  1,963 |         12 |
| battle-baseline-2     | 324,152 |      285,056 |  1,883 |         13 |
| battle-candidate-2    | 254,299 |      217,216 |  1,876 |         13 |
| run-state-baseline-1  | 156,877 |      132,864 |  1,334 |          7 |
| run-state-candidate-1 | 152,097 |      128,512 |  1,568 |         11 |
| run-state-baseline-2  | 184,613 |      158,720 |  1,562 |         10 |
| run-state-candidate-2 | 152,158 |      130,048 |  1,528 |         10 |

## Acceptance

All eight retained answers were reviewed against the implementation:

- Battle: synchronous commit before discard/playback; normal enemy statuses → ability → player statuses → regeneration → next-hand/reset → Companion ordering; Haste preserves both Blocks, with ordinary halving resuming at phase boundaries; persisted world RNG, immutable state, and rounded combat magnitudes. Source checks included turn orchestration, End Turn UI, enemy-turn, player-turn-transition, and shared RNG/decay helpers. The prompt did not require an exhaustive listing of every talent exception.
- Run state: one aggregate draft/command for both writes; transactional guards read that draft; thrown execution rolls back and skips feedback; returning false does not itself roll back; no-op commands preserve root/revision but still invoke afterCommit; nested and asynchronous command bodies are rejected; reads and writes use capability seams. Answers also correctly distinguish post-commit failures from rollback. The command implementation and shop guards support these conclusions.

## Setup exclusions and reproducibility

Initial attempts were excluded after source comparison found unrelated concurrent architecture edits in the candidate. The initially reported 3.2% battle increase came from that invalid setup and is superseded; it must not inform adoption. The candidate architecture document was rebuilt from the frozen baseline with only the intended heading promotions, and all trials were restarted. A complete repository-file comparison then established that the variants differed only in the intended catalog and architecture files.

Snapshot identities:

- Baseline working-tree patch SHA-256: `c289d1f4c115718fe2feb208a529d9da0c5397396bcab1d4a27e043c9f0f7d67`.
- Evaluated candidate diff SHA-256: `583d714ff1ac9267bb41ac91640fc71f2be0afb44de4c4dcb19102c9d0f2a46f`.

Raw streams, exact prompts, snapshots, inventory validation, answers, normalized records and comparison JSON are transient evidence under `reports/agent-evals/context-discovery-0912/`. The discarded attempts are separated under its `excluded-setup-drift/` directory. The recorded counters above exclude setup, parent-agent work, discarded attempts, implementation and integration verification. Later fixture-validation and hotspot path-fixture additions do not alter the evaluated context output. Concurrent changes to the main checkout were preserved and are outside the frozen evaluation comparison.

## Exact requests

### Battle

> Investigate Alchemy's End Turn behavior. Explain when battle results are committed relative to visual playback, the enemy/status/next-hand order, how Block halving behaves during Haste, and which RNG and rounding conventions a change to this flow must preserve. Confirm the key ordering and commit behavior in implementation, not just documentation. Use the repository's existing discovery workflow and support your conclusions with source locations. Investigate only; do not edit files, commit, launch other agents, browse the web, or run verification. Existing working-tree changes are the installed evaluation setup: preserve them and do not inspect their diffs or historical revisions. Give a concise, complete answer. This is a read-only investigation, so no completion gate is needed.

### Run state

> Investigate how an Alchemy gameplay action should atomically change two run-owned fields and trigger a sound only after success. Explain the mutation owner, which state transactional guards should read, failure rollback, no-op command behavior, and whether nesting commands or awaiting inside them is allowed. Confirm these rules in the command implementation and identify the feature-facing read/write seams. Use the repository's existing discovery workflow and support your conclusions with source locations. Investigate only; do not edit files, commit, launch other agents, browse the web, or run verification. Existing working-tree changes are the installed evaluation setup: preserve them and do not inspect their diffs or historical revisions. Give a concise, complete answer. This is a read-only investigation, so no completion gate is needed.
