# Alchemy — Developer Reference

Reference for environment setup, failure triage, simulation, and file lookup.
Use [Commands](./COMMANDS.md) to choose a command and
[Contributing](../CONTRIBUTING.md) to select verification gates.
Optional lookup and measurement tools live in [Agent discovery](./AGENT_DISCOVERY.md).

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
tiers. Use the [command catalog](./COMMANDS.md) for discovery rather than
duplicating command lists in subsystem docs. Script implementation owners are mapped in
[scripts/README.md](../scripts/README.md); `package.json` is the exhaustive command list.

## Failure-first triage

Verification and audit commands keep full artifacts on disk but print a bounded digest. Start with the digest when the cause is unclear; open the most relevant artifact directly when you have a specific hypothesis. Battle warnings use the `[Enemy Turn]` prefix.

For one-shot investigations, `npm run compact -- npm test -- <test-path>` (or `npm run compact -- npm run lint:ci`, or `npm run compact -- npm run test:e2e -- <spec-path>`) preserves command arguments and exit status while printing available test totals and bounded failures. Full stdout/stderr stays under `reports/compact/<run-id>/output.log`; unrecognized totals are not guessed. This command does not replace verification or update its receipts. Keep normal streaming commands for watch, headed debugging, and interactive sessions.

Outer test runners set `ALCHEMY_RUN_ID` once and pass it to child commands; CI derives the same identity from its run, attempt, job, and optional matrix variant. Do not change it within one invocation.

- Unit failures: an assertion and its nearest fixture are useful starting points; rerun the exact failing path after a fix or when a fresh observation is needed. `reports/vitest-timings.json` is timing data, not default context.
- Playwright failures: the compact failure summary and `test-results/failures/<run-id>/<name>.md` are useful starting points. Its bounded accessibility snapshot shows the roles, names, and hierarchy present at failure; use the snapshot, console evidence, or trace ZIP according to the failure being investigated. CI summaries add the changed-path route and any path-filtered focused E2E gate for the failing file.
- Changed-path failures: open the run-specific Markdown digest named by `reports/current-run.md`; the sibling `.log` is secondary evidence when the diagnostic excerpt is insufficient. Check output extracts test names, assertions, compiler locations and lint diagnostics from throughout the stream, with `L` references into the full log; unfamiliar output retains bounded excerpts with links to the full log.
- E2E audit: `npm run test:e2e:audit` writes `reports/e2e-audit-report.md` and keeps the full JSON report. Report-processing and runner errors fail the audit even without failed assertions. `--reuse-timings` analyzes a report less than one hour old without claiming fresh verification; it preserves recorded failures and cannot be combined with Playwright selection arguments. Use `--verbose` for expanded child output; the full command log remains on disk.
- Measurable audits: `npm run audit` (default sweep) / `npm run audit:all` (same sweep via `audit.mjs --all`; `--all` is the periodic sweep, not literally every audit — use `--hotspots` separately) prints bounded findings for successful probes as well as failure diagnostics. Each run retains a findings summary and full probe logs under `reports/runs/<run-id>/audit/`, linked from the current-run pointer. Type-escape and amplification findings remain advisory; `--verbose` expands terminal output.
- Balance: `reports/balance-findings.html` and its JSON summary locate findings; open relevant matrix data under `reports/balance-full/` directly when needed.
- Report pointer: `reports/current-run.md` and `.json` point to the latest run-specific record under `reports/runs/<run-id>/`. Use that pointer or `npm run runs:show -- --last 10` to locate an unknown run; known run artifacts can be opened directly.
- Do not paste complete logs, traces, snapshots, generated bundles, or report directories into agent context when the digest identifies a narrower file or test.
- Local transient artifacts are pruned automatically before dev preparation and remain available for test/performance investigation until explicitly pruned. Copy a failure artifact elsewhere only when an investigation genuinely needs to outlive the grace period; use `npm run prune:transient -- --dry-run` to inspect candidates.
- Browser CI retains JSON results on every run and detailed diagnostics for failures or retries. Retention and other artifact policies are owned by the workflows; see the [E2E diagnostic contract](../tests/e2e/README.md#tags).

## Loot progression report

`npm run balance:loot` writes HTML and JSON to `reports/loot-progression/`. It uses the shared loot policy and Gear generator with deterministic per-cell seeds, comparing source/depth breakpoints, all account-clear tiers, and fresh versus nearly-complete collections. Route definitions are included in both outputs. Counts represent offered items, not acquisitions; ownership stays fixed along each route and no shop refreshes are assumed. Set `ALCHEMY_LOOT_SAMPLES` to a positive integer to change the default 1,000 samples per cell. The same command also writes `materials.html` / `materials.json` with mean homestead-material payouts per enemy and enemy type. Loot rules and tuning ownership: [ARMORY](./ARMORY.md#loot-tuning).

## Balance simulation

For full careers through shops, rewards, progression, and save/resume, use
[headless playthrough testing](./PLAYTHROUGH_SIMULATION.md). The battle simulator
below answers isolated combat questions; neither runner verifies the rendered UI.

Headless battle simulator for overpowered or underpowered cards, classes, enemies, talents, companions, trinkets, gear, and individual item affixes. It runs isolated fights through the real battle engine (no browser, no React) using simple play policies. Its results describe the selected automated play policy, not human skill or a full run/map/shop simulation. Skipped during normal `npm test` runs.

```sh
npm run balance:sim

# Increase iterations per scenario (default: 100)
ALCHEMY_BALANCE_ITERATIONS=500 npm run balance:sim

# Increase independent class-deck seeds (default: 3)
ALCHEMY_BALANCE_DECK_SEEDS=5 npm run balance:sim

# Change the play policy (random-playable, greedy-damage, defensive-random, greedy-effective-damage)
ALCHEMY_BALANCE_POLICY=greedy-effective-damage npm run balance:sim

# Kit + tree-order talents + talent-point HP only (no homestead / gear / Vitality / core trinkets)
ALCHEMY_BALANCE_LOADOUT=bare npm run balance:sim

# Measure raw kit without hidden fight pacing
ALCHEMY_BALANCE_PACING=off npm run balance:sim

# Run the low-iteration, side-effect-free full-report check
npm run test:balance
```

Live autoplay scoring lives in `src/lib/battle/autoplay-policy.ts` and is game-design owned; changing those weights changes autoplay and Wish picks in real runs. `src/lib/balance/play-policy.ts` re-exports that policy so reports match the skill floor — fork sim-local scoring there instead of retuning live. `findings.ts` collects candidates, while `findings-selection.ts` owns deduplication, ranking, matchup clustering, and bucket selection. `report-methodology.ts` supplies shared HTML/JSON methodology without importing the simulation runner. Shared HTML shell, escaping, and JSON stringification live in `report-layout.ts`; gauntlet depths and typical gear-roll depth live in `report-catalog.ts` / `gear-preset.ts`.

Exact presets, finding bands, report grouping, pairing methodology, and measurement semantics are owned by `src/lib/balance/` and the generated report; use findings as review input rather than applying tunings automatically. The summary opens `reports/balance-findings.html` and writes a JSON companion.

Numeric environment values must be positive integers. Policy and loadout values must exactly match the choices above; pacing accepts `on`/`1`/`true` or `off`/`0`/`false` (anything else fails fast). Invalid configuration fails before report files are written. `ALCHEMY_BALANCE_FINDINGS_CAP` controls the number of findings in both rendered summaries (default: 100).
`balance:sim` generates reports; `test:balance` verifies finite full-report
construction and render purity without touching `reports/`. Changed balance
implementation runs both the focused unit suite and this report check.

---

## Navigation Hints

Lookup for modules not covered in [ARCHITECTURE.md](./ARCHITECTURE.md). Paths are on-disk unless noted.

- **App boot / screen registry** — `src/app/screen-routes/`
- **Audio (cache / music / SFX / volume)** — [Audio ownership and runtime contract](./AUDIO.md).
- **Cold-start loading gate** — [ARCHITECTURE.md § Boot](./ARCHITECTURE.md#boot-and-loading)
- **Balance simulation** — `src/lib/balance/`
- **Card corruption** — `src/lib/corruption/`
- **Card library barrel** — `src/lib/game-data/cards/library/cards.ts` (via `@/lib/game-data`)
- **Content systems (labyrinth / wildwood)** — `src/lib/content-systems/`
- **Effect handler registry doc** — `src/lib/game-data/effects/BATTLE_HANDLERS.md`
- **Feature config barrel** — `src/features/alchemy/shared/config/`
- **Game-data types** — `src/lib/game-data/types.ts`
- **Homestead data** — `src/lib/homestead/`
- **In-run material grants** — [WORKFLOWS § Grant materials](./RUN_WORKFLOWS.md#grant-materials-during-a-run)
- **UI placement, motion, and interaction** — [UI system](./UI.md)
- **Image preload helper** — `src/lib/image-preload.ts`
- **Potion mixing** — `src/lib/alchemist/potion-mixer.ts`
- **Platform / Steam** — `src/lib/platform.ts`, `src/lib/desktop-api.ts`, `src/lib/platform-save-backend.ts`, `desktop/`
- **Reward card sampling** — `src/features/alchemy/run-loop/navigation/reward-flow.ts`
- **Reward math (gold / traits)** — `src/features/alchemy/run-loop/navigation/reward-math.ts`
- **Run loop layering** — [ARCHITECTURE.md § Run loop overview](./ARCHITECTURE.md#run-loop-overview)
- **Run lifecycle / capability ports** — [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Run screen taxonomy** — `src/lib/routing/run-screen-router.ts`
- **Save migrations doc** — `src/features/alchemy/shared/storage/MIGRATIONS.md`
- **Save schemas / load gate** — `SaveDataSchema`, `evaluateSaveCandidates` from `@/lib/validation` / `@/features/alchemy/shared/storage`
- **Content validation / audit** — `runContentValidation` from `@/lib/content-validation`, `scripts/content-audit.mjs`
- **Sound ↔ card registry** — `src/lib/audio/sound-registry.ts`
- **Startup validation** — `src/lib/validate-startup.ts`
- **Talent XP math vs talent data** — `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/`
- **Tuning** — Topical files under `src/lib/game-constants/` (`combat-rules`, `battle-timing`, `progression`, `run-rewards`, `audio`, `ui-motion`, `ui-layout`, `settings`, `enemy-traits`, `enemy-balance`, `corruption`, `labyrinth-modifiers`, `materials-economy`, `storage`, `gear`), exported through `src/lib/game-constants/index.ts`. Suffixes: `_FRACTION` is 0-1, `_PERCENT`/`_PCT` is 0-100, `_MULTIPLIER` is a ×N scale, `_MS` is milliseconds, `_SEC` is seconds, `_PX` is pixels. `_CHANCE` is deprecated for new tuning; use fraction helpers. Shared knobs live here; content-owned `amount:` values stay with their card/talent/difficulty definitions.
- **Unique items (signatures/combat)** — [UNIQUE_ITEMS.md](./UNIQUE_ITEMS.md)

## Headless playthrough commands

`npm run balance:playthrough`, `npm run balance:playthrough:replay`,
`npm run balance:playthrough:compare`, and `npm run test:playthrough` provide
career simulation, deterministic action replay, cohort comparisons, and retained
correctness checks. See [Headless playthrough testing](./PLAYTHROUGH_SIMULATION.md)
for options, fixtures, evidence interpretation, and limits.
