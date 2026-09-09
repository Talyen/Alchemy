# Alchemy — Developer Reference

Reference for commands, triage, balance, and file lookup. Strict coding rules: **[AGENTS.md](../AGENTS.md)**. Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). Battle rules + glossary: [GAME_RULES.md](./GAME_RULES.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

## Environment & Commands

- **Node.js `^20.19.0 || >=22.12.0`** — authoritative in `package.json` `engines` (`.node-version` pins 24 for local dev).
- **npm `>=11`** — authoritative in `package.json` `engines` (Node 24 bundles npm 11).
- **Playwright:** `npx playwright install chromium` once before first `npm run test:e2e`.
- **GitHub CLI (`gh`):** optional; PR/CI only when the user asks — do not run `gh auth login`.
- **Git hooks / local gates:** [CONTRIBUTING.md](../CONTRIBUTING.md). Changelog updates happen at release only ([RELEASE.md](./RELEASE.md)).
- **Steam / ship gates:** [RELEASE.md](./RELEASE.md).

### Tooling ownership

`package.json` owns script entry points. `scripts/lib/change-routes.mjs` owns
changed-path selection, and [CONTRIBUTING.md](../CONTRIBUTING.md) owns gate
tiers. Use the catalog below for discovery rather than duplicating command
lists in subsystem docs. Script implementation owners are mapped in
[scripts/README.md](../scripts/README.md); `package.json` is the exhaustive command list.

### Script Command Reference

```sh
npm run dev                 # Vite dev server
npm run build               # Non-mutating Vite build; validates generated outputs first (typecheck is a separate gate; Vercel runs vercel.json buildCommand)
npm run assets:check        # Prepare assets and fail unless the operation is idempotent
npm test                    # Vitest; `npm test -- <path>` for a single file
npm run verify -- --diff    # Related tests plus broad risk escalations (--plan previews)
npm run runs:show -- --last 10    # Recent run IDs, outcomes, counts, and evidence availability
npm run context:hotspots          # Ranked route context and recent command-output exposure (--run-id <id> checks one exact run)
npm run typecheck           # tsc --noEmit (fast; also in check:static)
npm run lint:ci             # Full static gate
npm run check -- --diff     # Source-aware handoff gate with CI static checks and conditional pure builds
npm run check:ship          # Ship gate before tagging/desktop packaging
npm run docs:check          # Validate documentation contracts and plan metadata
npm run docs:check:final    # Repository-wide closure: requires every plan to be finished and archived
npm run plans:check         # Validate active plan metadata only
npm run new:plan -- <Name>  # Scaffold an execution plan under docs/Plans/
npm run archive:plans      # Move all complete/cancelled plans; inspect ownership first
npm run balance:sim         # Headless balance findings (opens reports/balance-findings.html)
npm run perf                # FPS / hitch profiling ([PERFORMANCE.md](./PERFORMANCE.md))
npm run clean               # Remove local diagnostics/artifacts
npm run release             # Full release: gates, commit/tag, push, CI watch ([RELEASE.md](./RELEASE.md))
```

This is the curated agent subset. The full catalog is `package.json` (exhaustive); what each gate includes and when it applies is owned by [CONTRIBUTING.md](../CONTRIBUTING.md#what-to-run-when-you-change).

### Build commands decision tree

| Intent                                                | Command                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| Local web/dev                                         | `npm run dev` / `npm run build`                                 |
| Vercel web                                            | `vercel.json` buildCommand: typecheck + `build`                 |
| Desktop renderer                                      | `npm run build:desktop`                                         |
| Verified web (push/handoff/CI)                        | `npm run build` (validates generated outputs including version) |
| Verified desktop (ship/CI)                            | `npm run build:desktop` (plus `assets:check` at release)        |
| Unpacked Windows app (local iterate)                  | `npm run package:win`                                           |
| Installers for configured targets (currently Windows) | `npm run dist:desktop`                                          |

**Skip flags:**

- `ALCHEMY_SKIP_ASSETS=1` — skip optimization and barrel regeneration when
  invoking the preparation pipeline; ordinary builds do not prepare assets.
  Semantics are owned by
  [`WORKFLOWS-ASSETS.md`](./WORKFLOWS-ASSETS.md).
- `ALCHEMY_ENABLE_CHECKER=1` — opt-in to the in-Vite `vite-plugin-checker` typecheck (off by default so `npm run dev` stays snappy; use `npm run typecheck:watch`, `npm run dev:checked`, or this flag when you need live type errors). `ALCHEMY_SKIP_CHECKER=1` is a hard off used by the Playwright preview server.
- `ALCHEMY_SKIP_SOURCEMAP=1` — opt-out of hidden sourcemaps for `mode=desktop` builds when fast local iterate is preferred; `npm run clean` removes existing maps.
- `ALCHEMY_CHECK_SKIP_BUILD=1` — skip web/desktop builds and preview smoke in `npm run check` for fast local iteration; CI and ship gates still build.

`npm run clean` removes local diagnostics and the Vite cache (explicit reset);
add `-- --builds` to remove build outputs. `npm run clean:all` also stops
Alchemy-owned test-server processes. `npm run prune:transient` removes only stale
files by age. Its exact
options are owned by `scripts/prune-transient-artifacts.mjs`; reset options
belong to `scripts/clean-dev-artifacts.mjs`. Neither command manages shared
Playwright caches.

## Failure-first triage

Verification and audit commands keep full artifacts on disk but print a bounded digest. Start with the digest and open the referenced artifact only when it names the next useful seam. Battle warnings use the `[Enemy Turn]` prefix.

Outer test runners set `ALCHEMY_RUN_ID` once and pass it to child commands; CI derives the same identity from its run, attempt, job, and optional matrix variant. Do not change it within one invocation.

- Unit failures: inspect the first assertion and its nearest fixture; rerun the exact failing path after a fix or when a fresh observation is needed. `reports/vitest-timings.json` is timing data, not default context.
- Playwright failures: read the compact failure summary and `test-results/failures/<run-id>/<name>.md` first. Its bounded accessibility snapshot shows the roles, names, and hierarchy present at failure; open a trace ZIP only when that and the console evidence cannot explain the failure. CI summaries add the changed-path route and any path-filtered focused E2E gate for the failing file.
- Changed-path failures: open the run-specific Markdown digest named by `reports/current-run.md`; the sibling `.log` is secondary evidence when the diagnostic excerpt is insufficient. Check output extracts test names, assertions, compiler locations and lint diagnostics from throughout the stream, with `L` references into the full log; unfamiliar output falls back to a bounded tail.
- E2E audit: `npm run test:e2e:audit` writes `reports/e2e-audit-report.md` and keeps the full JSON report. Use `--verbose` only when the child runner's complete stream is needed.
- Measurable audits: `npm run audit:all` reports one line per passing probe and a bounded failure tail. Full step output is under `reports/audit-all/` after a failure; pass `--verbose` to stream it deliberately.
- Balance: read `reports/balance-findings.html` or its JSON summary first. The full matrix under `reports/balance-full/` is drill-down evidence only.
- Report pointer: `reports/current-run.md` and `.json` point to the latest run-specific record under `reports/runs/<run-id>/`. Start there, or use `npm run runs:show -- --last 10`, instead of recursively listing `reports/`.
- Do not paste complete logs, traces, snapshots, generated bundles, or report directories into agent context when the digest identifies a narrower file or test.
- Local transient artifacts are pruned automatically before dev preparation and remain available for test/performance investigation until explicitly pruned. Copy a failure artifact elsewhere only when an investigation genuinely needs to outlive the grace period; use `npm run prune:transient -- --dry-run` to inspect candidates.
- CI retains failure-only diagnostic artifacts for seven days and retains no successful-run report history.

### Agent discovery

After status inspection, run `npm run context -- <relevant paths>` once for the current scope. Use `--task battle`, `--task ui`, `--task gear`, `--task rewards`, `--task shop`, or another category listed by `npm run context` when paths are unknown. `--diff` is appropriate only when the entire diff belongs to the task. Explicit task selection augments path matches; it does not suppress save or other applicable owners.

The command reads canonical Markdown sections, deduplicates overlapping sections, and prints implementation entry points and verification categories. Default output is bounded to 12 KB; deferred sections retain exact line locations. Read those only when the task needs them. `--json` deliberately returns the complete selection for tooling. Unit and browser work surface the canonical test value policy to guide coverage decisions. This is discovery guidance, not a replacement for required skills or a test-coverage selector. `scripts/lib/agent-context.mjs` owns discovery categories; `scripts/lib/change-routes.mjs` continues to own the broad verification categories.

Before reading a large unfamiliar source module, use `npm run context -- --outline <file>` for declaration locations, then `--outline <file> --symbol <name>` for one declaration. Oversized declarations return a location instead of dumping the file. Use `--outline <file> --entries` to list nested content IDs and object keys, or `--outline <file> --entry <id>` to read matching entries (including duplicate IDs). The parser never executes content; computed IDs and dynamically constructed entries still need a scoped search. Use the existing `npm run audit -- --amplification` report for co-edit evidence and correlate its paths with evaluation read events. Split a file only when observed repeated reads or co-changes expose separable responsibilities; size alone is not a refactoring target.

Optional discovery modes:

- Add `--related` to a path or task request for ranked consumer, test and imported-fixture locations from current static imports, aliases and reexports. Results cover at most two consumer hops and six locations per kind; they are hints, not exhaustive coverage or verification selection. No graph cache or second ownership catalog is maintained.
- Add `--session <unique-id>` to suppress documentation sections actually emitted unchanged earlier in that session. Use a separate ID for each agent. After context loss use `--refresh` with that ID, or start a fresh ID; a remembered read does not prove retained understanding. Changed sections and sections deferred by the output budget remain eligible. Without `--session`, output remains complete within the normal budget. Session state is disposable under `reports/agent-context/`.
- `npm run search -- <literal> [paths...]` wraps `rg` and returns up to 40 matching filenames within 8 KB. Add `--excerpts` for matching source lines, `--regex` for deliberate regular expressions, or `--include-excluded` with an explicit path to inspect normally excluded artifacts. Default searches respect ignore files and exclude raw assets, reports, build output, changelog, dependency lockfiles, dependencies, Git data and worktrees. Truncation is explicit; narrow the path or pattern, or use direct scoped `rg` when more control is needed. Use `--` before positional arguments beginning with `--`.

These options are available on demand, not additional mandatory prereads. Update the discovery catalog when ownership or entry points change. Documentation checks and tooling tests validate every referenced section and entry point, and `verify --plan` displays pointers from the same catalog. Do not copy owner prose into the catalog or reread sections already emitted by `context`.

### Verification reuse

[CONTRIBUTING](../CONTRIBUTING.md#verification-reuse) owns eligible commands,
input identity, receipt expiry, and the `ALCHEMY_VERIFY_FRESH=1` override.

### Context-efficiency measurements

`npm run measure:agent-context -- --path <changed-path>` reports a stable preread byte proxy: always-loaded instructions, owner sections selected by the same discovery catalog as `context`, changed-file bytes, verification/test-path counts, and explicitly named artifact bytes. `--all-routes` compares one canonical fixture per verification route. These byte proxies do not measure reasoning, repeated reads or actual token usage.

Use the pinned [agent evaluations](../.agents/evals/README.md) for completed-task comparisons. With `ALCHEMY_AGENT_SESSION` set to an evaluation session ID, context reads and verification attempts/reuse append local events automatically. Host usage is optional and must come from a real usage report; unavailable values remain null. No prompts, credentials or source text are written to event records. Ordinary tasks do not require telemetry or new bookkeeping.

`npm run context:hotspots -- --last 20` ranks broad category prereads and aggregates captured output from recent runs. It is advisory process evidence, not a correctness gate. Use `--min-bytes 0` for the complete inventory, `--json` for machine-readable output, or `--run-id <id>` for one recorded run. `--verbose` remains an explicit opt-in for complete child output.

## Balance simulation

Headless battle simulator for overpowered or underpowered cards, classes, enemies, talents, companions, trinkets, gear, and individual item affixes. It runs isolated fights through the real battle engine (no browser, no React) using simple play policies. It is a **skill-floor** tool (dump-hand, random wishes, no holds), not a full run/map/shop simulator. Skipped during normal `npm test` runs.

```sh
npm run balance:sim

# Increase iterations per scenario (default: 100)
ALCHEMY_BALANCE_ITERATIONS=500 npm run balance:sim

# Increase independent class-deck seeds (default: 3)
ALCHEMY_BALANCE_DECK_SEEDS=5 npm run balance:sim

# Change the play policy (random-playable, greedy-damage, defensive-random, greedy-effective-damage)
ALCHEMY_BALANCE_POLICY=greedy-effective-damage npm run balance:sim

# Kit + combat talents + talent-point HP only (no homestead / gear / Vitality / core trinkets)
ALCHEMY_BALANCE_LOADOUT=bare npm run balance:sim

# Measure raw kit without hidden fight pacing
ALCHEMY_BALANCE_PACING=off npm run balance:sim

# Run the low-iteration, side-effect-free full-report check
npm run test:balance
```

The simulator covers deterministic early/mid/late progression scenarios using
combat-eligible talents and seeded loadouts. Exact presets, finding bands, and
report grouping are owned by `src/lib/balance/` and the generated report; use
findings as review input rather than applying tunings automatically. The
summary opens `reports/balance-findings.html` and writes a JSON companion.
The enemy, hero, and matchup tables also show average enemy attack actions, card ability uses, triggered trait activations, and the fraction of all battles won before the first enemy attack. Blocked and dodged attacks count; multi-hit attacks count once. Haste and crowd-control skips do not count. Individual `simulateBattle` results retain separate counts by card ability ID and trait ID. Ability uses include defensive cards; passive resistances, starting stats, and difficulty modifiers are excluded from trait counts. These measurements are descriptive evidence, not additional automatic balance thresholds.

Simulation measurements opt into `BattleState.battleMetrics`. Enemy attack and triggered-trait owners update immutable counters without additional RNG draws or combat text. Normal battles omit the field; battle-save normalization strips it. Triggered effects can count even if their damage is blocked or their healing overflows; passive resistances and starting stats do not count.

Numeric environment values must be positive integers. Policy and loadout values
must exactly match the choices above; pacing accepts `on`/`1`/`true` or
`off`/`0`/`false` (anything else fails fast). Invalid configuration fails before report files are written.
`ALCHEMY_BALANCE_FINDINGS_CAP` controls the number of findings in both rendered summaries (default: 100). Scenario seeds derive from tier, class, enemy, depth, replicate, and sweep identity instead of loop position, so adding or reordering unrelated content does not re-key existing comparisons. Core matchups reuse each tier/class deck sample across enemies while retaining distinct fight randomness; isolation sweeps keep baseline and treatment paired.
The report uses paired battle iterations for trinket, talent, companion, gear, and affix sweeps, and independent card-deck samples for isolated-card sweeps. Each isolated-card comparison uses ten non-target cards for its baseline and the same nine non-target cards plus the target for treatment; a target card can never appear in its own baseline. The nine shared cards retain their positions before the paired seeded shuffle so only the replaced card changes the initial draw order.
Hero-versus-enemy rows aggregate every tested depth and deck sample. Durations count rounds actually played (a capped fight reports 30, not 31), including losses and timeouts; a shorter fight can mean an earlier defeat, so read duration alongside win rate. Hero and enemy spread checks cover all three tiers. Paired win and duration findings use their own standard errors, with category medians calculated before filtering noisy results.
Individual affix probes compare one affix against no gear across every hero, tier, gauntlet enemy, and configured deck seed. Basic midpoint rolls are used early/mid, Astral midpoint rolls late, and unique affixes use their fixed rolls. These probes measure sensitivity, including hypothetical early access to unique effects; they do not model acquisition or stacked affixes. The existing rolled-item sweep remains separate.
`balance:sim` generates reports; `test:balance` verifies finite full-report
construction and render purity without touching `reports/`. Changed balance
implementation runs both the focused unit suite and this report check.

---

## Battle Implementation Rules

Canonical rules live in [GAME_RULES.md](./GAME_RULES.md#battle-implementation-rules). Engine tests: `tests/lib/battle/`.

---

## Domain Glossary

Canonical definitions live in [GAME_RULES.md](./GAME_RULES.md#domain-glossary).

---

## Navigation Hints

Lookup for modules not covered in [ARCHITECTURE.md](./ARCHITECTURE.md). Paths are on-disk unless noted.

| Need                                   | Look in                                                                                                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App boot / screen registry             | `src/app/screen-routes/`                                                                                                                                                                                                                     |
| Audio (cache / music / SFX / volume)   | [Audio ownership and runtime contract](./AUDIO.md).                                                                                                                                                                                          |
| Cold-start loading gate                | [ARCHITECTURE.md § Boot](./ARCHITECTURE.md#boot-and-loading)                                                                                                                                                                                 |
| Balance simulation                     | `src/lib/balance/`                                                                                                                                                                                                                           |
| Card corruption                        | `src/lib/corruption/`                                                                                                                                                                                                                        |
| Card library barrel                    | `src/lib/game-data/cards.ts` → `cards/library/cards.ts`                                                                                                                                                                                      |
| Content systems (labyrinth / wildwood) | `src/lib/content-systems/`                                                                                                                                                                                                                   |
| Effect handler registry doc            | `src/lib/game-data/effects/BATTLE_HANDLERS.md`                                                                                                                                                                                               |
| Feature config barrel                  | `src/features/alchemy/shared/config/`                                                                                                                                                                                                        |
| Game-data types                        | `src/lib/game-data/types.ts`                                                                                                                                                                                                                 |
| Homestead data                         | `src/lib/homestead/`                                                                                                                                                                                                                         |
| In-run material grants                 | [WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run)                                                                                                                                                                   |
| UI placement, motion, and interaction  | [UI system](./UI.md)                                                                                                                                                                                                                         |
| Image preload helper                   | `src/lib/image-preload.ts`                                                                                                                                                                                                                   |
| Potion mixing                          | `src/lib/alchemist/potion-mixer.ts`                                                                                                                                                                                                          |
| Platform / Steam                       | `src/lib/platform.ts`, `src/lib/desktop-api.ts`, `src/lib/platform-save-backend.ts`, `desktop/`                                                                                                                                              |
| Reward card sampling                   | `src/features/alchemy/run-loop/navigation/reward-flow.ts`                                                                                                                                                                                    |
| Run lifecycle / capability ports       | [ARCHITECTURE.md](./ARCHITECTURE.md)                                                                                                                                                                                                         |
| Run screen taxonomy                    | `src/lib/routing/run-screen-router.ts`                                                                                                                                                                                                       |
| Save migrations doc                    | `src/features/alchemy/shared/storage/MIGRATIONS.md`                                                                                                                                                                                          |
| Sound ↔ card registry                  | `src/lib/audio/sound-registry.ts`                                                                                                                                                                                                            |
| Startup validation                     | `src/lib/validate-startup.ts`                                                                                                                                                                                                                |
| Talent XP math vs talent data          | `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/`                                                                                                                                                                   |
| Tuning                                 | Topical files under `src/lib/game-constants/` (`combat-rules`, `battle-timing`, `progression`, `run-rewards`, `audio`, `ui-motion`, `enemy-traits`, `homestead-loot`, `storage`, `gear`), exported through `src/lib/game-constants/index.ts` |
