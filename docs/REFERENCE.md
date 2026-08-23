# Alchemy — Developer Reference

Reference for commands, glossary, battle rules, and file lookup. Strict coding rules: **[AGENTS.md](../AGENTS.md)**. Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

## Environment & Commands

- **Node.js `>=24`** — authoritative in `package.json` `engines`.
- **npm `>=11`** — authoritative in `package.json` `engines` (Node 24 bundles npm 11).
- **Playwright:** `npx playwright install chromium` once before first `npm run test:e2e`.
- **GitHub CLI (`gh`):** optional; PR/CI only when the user asks — do not run `gh auth login`.
- **Git hooks / local gates:** [CONTRIBUTING.md](../CONTRIBUTING.md). Changelog updates happen at release only ([RELEASE.md](./RELEASE.md)).
- **Steam / ship gates:** [RELEASE.md](./RELEASE.md).

### Script Command Reference

```sh
npm run dev                 # Vite dev server
npm run build               # vite build (typecheck is a separate gate; Vercel runs vercel.json buildCommand)
npm test                    # Vitest; `npm test -- <path>` for a single file
npm run verify:changed -- --diff  # Changed-path verification route (--plan previews; --e2e <route> escalates)
npm run typecheck           # tsc --noEmit (fast; also in lint:ci / check:push)
npm run lint:ci             # Full static gate
npm run check:push          # Local pre-push gate
npm run check:ship          # Ship gate before tagging/desktop packaging
npm run docs:check          # Validate plan metadata (--final at handoff)
npm run new:plan -- <Name>  # Scaffold an execution plan under docs/Plans/
npm run balance:sim         # Headless balance findings (opens reports/balance-findings.html)
npm run perf                # FPS / hitch profiling ([PERFORMANCE.md](./PERFORMANCE.md))
npm run clean               # Remove local diagnostics/artifacts
npm run release             # Version bump, changelog, tag ([RELEASE.md](./RELEASE.md))
```

This is the curated agent subset. The full catalog is `package.json` (exhaustive); what each gate includes and when it applies is owned by [CONTRIBUTING.md](../CONTRIBUTING.md#before-you-push).

### Build commands decision tree

| Intent                                                  | Command                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Local web/dev                                           | `npm run dev` / `npm run build` (hooks run asset prep)                  |
| Vercel web                                              | `vercel.json` buildCommand: `ALCHEMY_SKIP_ASSETS=1` + typecheck + build |
| Desktop renderer + version/steam/asset sync             | `npm run build:desktop`                                                 |
| Fast desktop renderer (committed assets / CI ship-gate) | `ALCHEMY_SKIP_ASSETS=1 npm run build:desktop`                           |
| Unpacked Windows app (local iterate)                    | `npm run package:win`                                                   |
| Windows/mac/linux installers (CI desktop + release)     | `npm run dist:desktop`                                                  |

**Skip flag:** `ALCHEMY_SKIP_ASSETS=1` — semantics and regeneration rules are owned by [`WORKFLOWS-ASSETS.md`](./WORKFLOWS-ASSETS.md).

`npm run clean` removes local diagnostics and build artifacts. Its exact
options are owned by `scripts/clean-dev-artifacts.mjs`; do not use it to prune
shared Playwright caches.

## Failure-first triage

Verification and audit commands keep full artifacts on disk but print a bounded digest. Start with the digest and open the referenced artifact only when it names the next useful seam. Battle warnings use the `[Enemy Turn]` prefix.

- Unit failures: rerun the exact path from the report, then inspect the first assertion and its nearest fixture. `reports/vitest-timings.json` is timing data, not default context.
- Playwright failures: read the compact failure summary and `test-results/failures/<name>.md` first. Open a trace ZIP only when the DOM/console artifact cannot explain the failure; use `npx playwright show-trace` for that one test.
- E2E audit: `npm run test:e2e:audit` writes `reports/e2e-audit-report.md` and keeps the full JSON report. Use `--verbose` only when the child runner's complete stream is needed.
- Measurable audits: `npm run audit:all` reports one line per passing probe and a bounded failure tail. Full step output is under `reports/audit-all/` after a failure; pass `--verbose` to stream it deliberately.
- Balance: read `reports/balance-findings.html` or its JSON summary first. The full matrix under `reports/balance-full/` is drill-down evidence only.
- Report pointer: report-producing summaries overwrite `reports/current-run.md` and `reports/current-run.json`; start there instead of recursively listing `reports/`.
- Do not paste complete logs, traces, snapshots, generated bundles, or report directories into agent context when the digest identifies a narrower file or test.
- Local transient artifacts are pruned automatically before dev/build preparation and remain available for test/performance investigation until explicitly pruned. Copy a failure artifact elsewhere only when an investigation genuinely needs to outlive the grace period; use `npm run prune:transient -- --dry-run` to inspect candidates.
- CI retains failure-only diagnostic artifacts for seven days and retains no successful-run report history.

### Context-efficiency measurements

`npm run measure:agent-context -- --path <changed-path>` reports a stable preread byte proxy: always-loaded instructions, route-selected owner sections, changed-file bytes, verification/test-path counts, and explicitly named artifact bytes. `--all-routes` compares one canonical fixture per route.

## Balance simulation

Headless battle simulator for overpowered or underpowered cards, classes, enemies, talents, companions, and trinkets. It runs isolated fights through the real battle engine (no browser, no React) using simple play policies. It is a **skill-floor** tool (dump-hand, random wishes, no holds), not a full run/map/shop simulator. Skipped during normal `npm test` runs.

```sh
npm run balance:sim

# Increase iterations per scenario (default: 100)
ALCHEMY_BALANCE_ITERATIONS=500 npm run balance:sim

# Change the play policy (random-playable, greedy-damage, defensive-random, greedy-effective-damage)
ALCHEMY_BALANCE_POLICY=greedy-effective-damage npm run balance:sim

# Kit + combat talents + talent-point HP only (no homestead / gear / Vitality / core trinkets)
ALCHEMY_BALANCE_LOADOUT=bare npm run balance:sim

# Measure raw kit without hidden fight pacing
ALCHEMY_BALANCE_PACING=off npm run balance:sim
```

The simulator covers deterministic early/mid/late progression scenarios using
combat-eligible talents and seeded loadouts. Exact presets, finding bands, and
report grouping are owned by `src/lib/balance/` and the generated report; use
findings as review input rather than applying tunings automatically. The
summary opens `reports/balance-findings.html` and writes a JSON companion.

---

## Battle Implementation Rules

Operational rules for `src/lib/battle/` that deviate from typical CCG assumptions. Term definitions: [Domain Glossary](#domain-glossary). Tests: `tests/lib/battle/`.

- **1-on-1 targeting** — one enemy per battle; attacks/debuffs go to the enemy, blocks/heals/buffs to player/companions; no target selectors.
- **Turn order** — Player (companion attacks → play cards) → Enemy (enemy DoTs → attack → player DoTs → regen) → reset (draw 4, restore mana, halve player block). Enemy block halves when the next enemy phase begins.
- **Mana** — resets to `maxMana` each turn; unspent mana is lost (Wellspring talent excepted).
- **Companions** — invulnerable; act at player turn start; persist indefinitely.
- **Draw / deck** — draw 4 per turn, max hand 7 (overflow skipped); hand cleared before draw; discard reshuffles when draw pile empties; only `consume` cards leave permanently.
- **Block** — absorbs incoming damage first; halved (not cleared) at the start of the owner's next turn, after the opposing side had a chance to attack into it.
- **Death's Door** — [Domain Glossary](#domain-glossary).
- **Fight pacing** — hidden combat scaler, not a player-facing status. [Domain Glossary](#domain-glossary). Balance simulator: `ALCHEMY_BALANCE_PACING=off` measures raw kit.
- **State and arithmetic** — treat `BattleState` as immutable. Combat magnitudes use nearest-integer `Math.round()`, never `Math.floor()`; the battle-engine lint boundary enforces this convention.
- **Battle RNG** — live combat draws the persisted `world` run stream (`withDraftWorldBattleRng` inside a command). Pure engine code uses `state.rng` / `getBattleRng(state)`, never `Math.random()`. Tests and the balance simulator use `createRunStreamRng` (same mixer as `nextRunRngValue`). `createBattleState` may pass explicit RNG in unit tests.
- **Enemy status** — stack changes go through `addEnemyStatus()` / `setEnemyStatus()` in `src/lib/battle/types.ts`; `braced` enemy trait halves incoming stun.
- **Static enemy actions** — `enemyAttackEffects` resolve sequentially every turn; no randomized intents.

---

## Domain Glossary

Definitions of common terms used in the Alchemy codebase.

| Term                     | Definition                                                                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Block**                | Damage absorption on player/enemy; halves at the start of the owner's next turn after one opposing attack window.                                                                                                                                                                                              |
| **Burn**                 | DoT status; deals its stack as damage, then normally decays by half.                                                                                                                                                                                                                                           |
| **Death's Door**         | Prevents fatal damage once per battle, leaving the player at 1 HP with 2 grace turns (extendable). Healing does not end the window. While active, lethal hits floor at 1 HP (multi-hit and DoT ticks included). The enemy phase that spends the last grace still floors; damage becomes lethal on a later hit. |
| **Fight pacing**         | Hidden combat scaler (not a player-facing rule). Live default on; `ALCHEMY_BALANCE_PACING=off` measures raw kit.                                                                                                                                                                                               |
| **Homestead**            | Between-run hub; spend **Materials** on permanent upgrades.                                                                                                                                                                                                                                                    |
| **Mana**                 | Resource to play cards; resets to `maxMana` each turn (unspent lost unless Wellspring).                                                                                                                                                                                                                        |
| **Materials**            | Meta currency for homestead upgrades.                                                                                                                                                                                                                                                                          |
| **Screen**               | Route union (`menu`, `battle`, `rewards`, …) on `navigation.screen` — not a map node.                                                                                                                                                                                                                          |
| **Companion Bond**       | Per-companion talent level; boosts companion damage each turn.                                                                                                                                                                                                                                                 |
| **Content System**       | `campaign`, `labyrinth`, or `wildwood` — map generation and encounter rules.                                                                                                                                                                                                                                   |
| **Corruption**           | Altar event that mutates a card with a random harmful effect/tag. Leave without corrupting returns to the same Choose Destination picker and does not consume the destination.                                                                                                                                 |
| **Damage type**          | `physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature` — enemies may resist or be vulnerable per type.                                                                                                                                                                                      |
| **Potion**               | Consumable with temporary effect from the Alchemist shop.                                                                                                                                                                                                                                                      |
| **Regen / Regeneration** | Enemy trait: heal each turn at end of enemy phase.                                                                                                                                                                                                                                                             |
| **Reward route**         | Internal post-rewards destination (`REWARD_ROUTES`), not a `Screen` — see **Screen** above. Combat rewards: normal → card, elite → trinket, boss → gear; Wildwood rolls 1/3 card/trinket/gear.                                                                                                                 |
| **Run materials earned** | Materials collected during the current run and included in the run-end summary. See [WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run).                                                                                                                                                |
| **Status**               | Temporary player/enemy effect with tick/expiry (Burn, Freeze, Poison, Stun, …).                                                                                                                                                                                                                                |
| **Summon**               | Brings a companion into battle.                                                                                                                                                                                                                                                                                |
| **Gear**                 | Permanent unique items stored in the Armory and equipped per character. Gear effects are snapshotted when battle begins.                                                                                                                                                                                       |
| **Wish**                 | Card choices from full library; `wishQueue`.                                                                                                                                                                                                                                                                   |

---

## Navigation Hints

Lookup for modules not covered in [ARCHITECTURE.md](./ARCHITECTURE.md). Paths are on-disk unless noted.

| Need                                   | Look in                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App boot / screen registry             | `src/app/screen-routes/`                                                                                 |
| Audio (cache / music / SFX / volume)   | `src/lib/audio-*.ts`, `src/lib/audio.ts`                                                                 |
| Cold-start loading gate                | [ARCHITECTURE.md § Boot](./ARCHITECTURE.md#boot-and-loading)                                             |
| Balance simulation                     | `src/lib/balance/`                                                                                       |
| Card corruption                        | `src/lib/corruption/`                                                                                    |
| Card library barrel                    | `src/lib/game-data/cards.ts` → `cards/library/cards.ts`                                                  |
| Content systems (labyrinth / wildwood) | `src/lib/content-systems/`                                                                               |
| Effect handler registry doc            | `src/lib/game-data/effects/BATTLE_HANDLERS.md`                                                           |
| Feature config barrel                  | `src/features/alchemy/shared/config/`                                                                    |
| Game-data types                        | `src/lib/game-data/types.ts`                                                                             |
| Homestead data                         | `src/lib/homestead/`                                                                                     |
| In-run material grants                 | [WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run)                               |
| Motion UI (`FadeSlot`, `TiltSurface`)  | [WORKFLOWS § Screen fade](./WORKFLOWS.md#screen-fade-motion); files in `src/features/alchemy/shared/ui/` |
| Image preload helper                   | `src/lib/image-preload.ts`                                                                               |
| Potion mixing                          | `src/lib/alchemist/potion-mixer.ts`                                                                      |
| Platform / Steam                       | `src/lib/platform.ts`, `src/lib/platform-save-backend.ts`, `desktop/`                                    |
| Reward card sampling                   | `run-loop/navigation/reward-flow.ts`                                                                     |
| Run lifecycle / capability ports       | [ARCHITECTURE.md](./ARCHITECTURE.md)                                                                     |
| Run screen taxonomy                    | `src/lib/routing/run-screen-router.ts`                                                                   |
| Save migrations doc                    | `shared/storage/MIGRATIONS.md`                                                                           |
| Sound ↔ card registry                  | `src/lib/sound-registry.ts`                                                                              |
| Startup validation                     | `src/lib/validate-startup.ts`                                                                            |
| Talent XP math vs talent data          | `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/`                               |
| Tuning                                 | Topical files under `src/lib/game-constants/`, exported through `src/lib/game-constants.ts`              |
