# Alchemy — Developer Reference

Static reference for commands, glossary, battle rules, and file lookup. Strict coding rules: **[AGENTS.md](../AGENTS.md)**. Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

## Quick Reference

- [Environment & Commands](#environment--commands)
- [Failure-first triage](#failure-first-triage)
- [Balance simulation](#balance-simulation)
- [Battle Implementation Rules](#battle-implementation-rules)
- [Domain Glossary](#domain-glossary)
- [Navigation Hints](#navigation-hints)

---

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
npm run build:desktop       # vite desktop build (runs prebuild:desktop sync)
npm run package:win         # unpacked Windows app via dist-desktop.mjs (ALCHEMY_PACKAGE_DIR=1)
npm run dist:desktop        # installers via dist-desktop.mjs (steam/platforms.json targets)
npm run smoke:preview       # start vite preview; assert HTML plus emitted JS/CSS resources (CI/release)
npm run typecheck           # tsc --noEmit (fast; also in lint:ci and pre-commit)
npm test                    # Vitest
npm test -- <path>          # Single test file
npm run verify:changed -- --diff  # Changed-path unit/boundary/E2E route
npm run verify:changed -- --plan --diff  # Print the route without running it
npm run verify:changed -- --diff --e2e shop  # Add one route-specific E2E flow
npm run verify:changed -- --diff --plan --verbose-plan  # Show full argv deliberately
npm run measure:agent-context -- --path src/lib/battle/damage.ts  # Stable context/route proxy
npm run measure:agent-context -- --all-routes  # Compare canonical route prereads
npm run new:plan -- TokenEfficiencyPlan  # Scaffold a short-lived docs/Plans execution plan
npm run docs:check                    # Validate plan metadata and expiry
npm run docs:check:final              # Final handoff check; active plans must be removed
npm run prune:transient               # Remove local diagnostics older than one day (dry-run with -- --dry-run)
npm run ci:routing           # Check high-cost CI path filters against their local ownership contract
npm run lint:ci             # docs:check + ci:routing + format:check + typecheck:all + lint + boundaries + architecture-smoke + deadcode
npm run lint:boundaries     # dependency-cruiser phase / lib edges
npm run lint:architecture-smoke  # Cold ESLint smoke over representative screens; included in lint:ci
npm run deadcode            # knip (lint:ci / CI; not default pre-push; in check:push:full via check)
npm run deadcode:strict     # knip --strict, entry exports, deps excluded (nightly)
npm run format / format:check  # Prettier via scripts/run-prettier.mjs (shared globs)
npm run check               # npm ci --dry-run + lint:ci + test + build
npm run check:push          # format + typecheck:all (src + tests) + lint + build + @prepush E2E gate
npm run check:push:full     # lint:ci + Vitest + build + @prepush E2E (not CI E2E parity)
npm run check:ship          # lint:ci + ship unit tests + ALCHEMY_SKIP_ASSETS=1 build:desktop
npm run check:ship:full     # check:ship + save E2E + Electron E2E
npm run sync:version        # package.json → metadata.generated.ts
npm run sync:changelog      # optional / release prerelease: git log → CHANGELOG ## [Unreleased]
npm run generate:patch-notes    # git/changelog → release-notes/UNRELEASED.md (or vX.Y.Z on tag)
npm run test:e2e:prepush    # Fast @prepush subset (pre-push hook)
npm run test:e2e:prepush:full  # @critical|@prepush on preview (CI e2e job)
npm run test:e2e:full         # Full suite on preview (broader CI/release tier)
npm run test:e2e:nightly      # Full suite + nightly-only coverage
npm run test:e2e:electron     # Electron Playwright suite
npm run balance:sim         # Balance findings summary (opens reports/balance-findings.html)
npm run clean               # Remove local test/report/.vite artifacts
npm run clean:all           # clean + dist/release-desktop + stop stale E2E preview ports (4173/4175)
```

### Build commands decision tree

| Intent                                                  | Command                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Local web/dev                                           | `npm run dev` / `npm run build` (hooks run asset prep)                  |
| Vercel web                                              | `vercel.json` buildCommand: `ALCHEMY_SKIP_ASSETS=1` + typecheck + build |
| Desktop renderer + version/steam/asset sync             | `npm run build:desktop`                                                 |
| Fast desktop renderer (committed assets / CI ship-gate) | `ALCHEMY_SKIP_ASSETS=1 npm run build:desktop`                           |
| Unpacked Windows app (local iterate)                    | `npm run package:win`                                                   |
| Windows/mac/linux installers (CI desktop + release)     | `npm run dist:desktop`                                                  |

**Skip flag:** `ALCHEMY_SKIP_ASSETS=1` skips only `prepare-assets.mjs` (sharp/ffmpeg/codegen). Version sync, steam app id sync, and the Vite build still run via `prebuild` / `prebuild:desktop`.

CI, Vercel, and release builds set `ALCHEMY_SKIP_ASSETS=1` because optimized outputs are committed. When you change `Raw Assets/` or asset scripts, commit the regenerated outputs (CI `assets` job fails on drift). All CI jobs except the `assets` drift job sparse-checkout the repo without `Raw Assets/` (the 700 MB raw sources are only needed to regenerate committed outputs). Unit tests that assert against raw sources skip when that directory is absent; run them locally with a full checkout.

CI's `desktop_renderer` path filter covers Electron integration plus app boot, routing, shell/store orchestration, phase screens, Vite configuration, and renderer asset preparation. Matching changes rebuild the desktop-mode renderer and run the Electron smoke suite; installer packaging remains under the narrower `desktop` filter.

`predev:desktop` is an alias of `predev` (same stop-server + asset prep).

`npm run clean` never stops the main Vite dev server (`5173` / `ALCHEMY_DEV_PORT`). Use `npm run clean -- --processes --include-dev-port` for that, or rely on `predev` which already calls `scripts/stop-dev-server.mjs`. Playwright keeps only failed-run output under `test-results/` (`preserveOutput: "failures-only"`). Shared `~/Library/Caches/ms-playwright` may be used by other projects — do not prune it from Alchemy alone.

This section is the documented catalog. [README.md](../README.md) is a short onboarding subset. `package.json` is exhaustive.

## Failure-first triage

Verification and audit commands keep full artifacts on disk but print a bounded digest. Start with the digest and open the referenced artifact only when it names the next useful seam.

- Unit failures: rerun the exact path from the report, then inspect the first assertion and its nearest fixture. `reports/vitest-timings.json` is timing data, not default context.
- Playwright failures: read the compact failure summary and `test-results/failures/<name>.md` first. Open a trace ZIP only when the DOM/console artifact cannot explain the failure; use `npx playwright show-trace` for that one test.
- E2E audit: `npm run test:e2e:audit` writes `reports/e2e-audit-report.md` and keeps the full JSON report. Use `--verbose` only when the child runner's complete stream is needed.
- Measurable audits: `npm run audit:all` reports one line per passing probe and a bounded failure tail. Full step output is under `reports/audit-all/` after a failure; pass `--verbose` to stream it deliberately.
- Balance: read `reports/balance-findings.html` or its JSON summary first. The full matrix under `reports/balance-full/` is drill-down evidence only.
- Report pointer: report-producing summaries overwrite `reports/current-run.md` and `reports/current-run.json`; start there instead of recursively listing `reports/`.
- Do not paste complete logs, traces, snapshots, generated bundles, or report directories into agent context when the digest identifies a narrower file or test.
- Local transient artifacts are pruned automatically at common dev/build/test/performance boundaries after a one-day grace period. Copy a failure artifact elsewhere only when an investigation genuinely needs to outlive that grace period; use `npm run prune:transient -- --dry-run` to inspect candidates.
- CI retains failure-only diagnostic artifacts for seven days and retains no successful-run report history.

### Context-efficiency measurements

Use `npm run measure:agent-context -- --path <changed-path>` for a stable preread proxy. It reports always-loaded instruction bytes, exact route-selected owner sections, changed-file bytes, verification/test-path counts, and explicitly named artifact/output bytes as separate values. `selectedBytes` is only instructions plus owner docs; it is not a tokenizer count or the agent's complete context.

Use `--all-routes` to compare one canonical fixture per route. Add `--doc`, `--artifact`, or `--output-file` only for an intentional walkthrough. Missing mapped documents/headings fail visibly; unknown paths select no generic owner document.

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

Windows PowerShell:

```powershell
$env:ALCHEMY_BALANCE_ITERATIONS="500"; npm run balance:sim
$env:ALCHEMY_BALANCE_POLICY="greedy-effective-damage"; npm run balance:sim
```

Scenarios run at three talent-progression tiers. Talent presets use **combat-eligible** talents in tree/pool order (shop and post-combat economy talents are excluded). Gold is seeded per tier so in-combat gold scaling can fire.

| Tier      | Act | Combat talents                         | Gold | Loadout (`typical`)                                                                                                   |
| --------- | --- | -------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| **Early** | 1   | None                                   | 0    | Base 30 HP; companion bonds only                                                                                      |
| **Mid**   | 2   | 5 per affinity keyword + 2 per other   | 40   | +1 HP per affinity talent (≈15); Vitality +8; 1★ homestead; seeded affinity gear (weapon + body); Grove's Favor       |
| **Late**  | 3   | Up to 7 per affinity keyword + 5 other | 80   | +1 HP per affinity talent (≈21); Vitality +18; 2★ homestead; seeded affinity full set; Grove's Favor / Tattered Pages |

Max HP in the sim is `30 + affinity combat-talent points + Vitality (typical only) + homestead Chicken Coop + gear maxHealth affixes`. Talent-point HP counts **affinity** unlocks only (Wildcard uses a 3-keyword equivalent), not the off-tree combat grants the sim also unlocks. `ALCHEMY_BALANCE_LOADOUT=bare` keeps tier gold, combat talents, and talent-point HP, but omits Vitality, homestead, gear, and core trinkets. Gear rolls from a salted RNG stream derived from the fight seed so paired isolation sweeps stay matched.

After the run, the opener launches **`reports/balance-findings.html`** (JSON: `reports/balance-findings.json`). That is the default agent/human surface. The full matrix is written under **`reports/balance-full/`** (drill-down only; do not read it unless a finding needs extra context).

The summary groups by issue type (timeouts, 0/100, type win-rate, length, equity, paired deltas, anomalies). Class matchups collapse to the **worst class per enemy / tier / metric**, then the cap round-robins those buckets so one boss-WR cluster cannot fill all 25 slots.

Target bands (source: `src/lib/balance/findings-bands.ts`): never 0% or 100% win/lose; Mid/Late type win rates Normal ~90–99%, Elite ~80–95%, Boss ≥70% and &lt;100%; fight length Normal 5–10 / Elite 10–15 / Boss 15–30 turns; ≥2% timeout rate is a stall; within-pool equity ~15pp from median; anomaly spikes Early 100 / Mid 200 / Late 300. Paired deltas with \|delta\| &lt; 2 SE are skipped. Do not apply tunings from findings until they are reviewed.

Console prints the findings list. Isolation sweeps do not use the typical core trinket pair. All simulations use deterministic seeding.

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
- **Battle RNG** — live combat draws the persisted `world` run stream (`withDraftWorldBattleRng` inside a command). Pure engine code uses `state.rng` / `getBattleRng(state)`, never `Math.random()`. Tests and the balance simulator use `createRunStreamRng` (same mixer as `nextRunRngValue`). `createBattleState` may pass explicit RNG in unit tests.
- **Enemy status** — stack changes go through `addEnemyStatus()` / `setEnemyStatus()` in `src/lib/battle/types.ts`; `braced` enemy trait halves incoming stun.
- **Static enemy actions** — `enemyAttackEffects` resolve sequentially every turn; no randomized intents.
- **Run materials** — player loot via `awardMaterialsDuringRun()` only; not progress `addMaterials()` from run-loop code ([WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run)).

---

## Domain Glossary

Definitions of common terms used in the Alchemy codebase.

| Term                       | Definition                                                                                                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Block**                  | Damage absorption on player/enemy; halves at the start of the owner's next turn after one opposing attack window.                                                                                                                                                                                              |
| **Burn**                   | DoT status; deals its stack as damage, then normally decays by half.                                                                                                                                                                                                                                           |
| **Death's Door**           | Prevents fatal damage once per battle, leaving the player at 1 HP with 2 grace turns (extendable). Healing does not end the window. While active, lethal hits floor at 1 HP (multi-hit and DoT ticks included). The enemy phase that spends the last grace still floors; damage becomes lethal on a later hit. |
| **Fight pacing**           | Hidden combat scaler (not a player-facing rule). Live default on; `ALCHEMY_BALANCE_PACING=off` measures raw kit.                                                                                                                                                                                               |
| **Homestead**              | Between-run hub; spend **Materials** on permanent upgrades.                                                                                                                                                                                                                                                    |
| **Mana**                   | Resource to play cards; resets to `maxMana` each turn (unspent lost unless Wellspring).                                                                                                                                                                                                                        |
| **Materials**              | Meta currency for homestead upgrades; in-run earnings via `awardMaterialsDuringRun()`.                                                                                                                                                                                                                         |
| **Screen**                 | Route union (`menu`, `battle`, `rewards`, …) on `navigation.screen` — not a map node.                                                                                                                                                                                                                          |
| **Combat Text**            | Floating numbers merged per `(target, kind, stat)`.                                                                                                                                                                                                                                                            |
| **Companion Bond**         | Per-companion talent level; boosts companion damage each turn.                                                                                                                                                                                                                                                 |
| **Content System**         | `campaign`, `labyrinth`, or `wildwood` — map generation and encounter rules.                                                                                                                                                                                                                                   |
| **Corruption**             | Altar event that mutates a card with a random harmful effect/tag. Leave without corrupting returns to the same Choose Destination picker and does not consume the destination.                                                                                                                                 |
| **Damage type**            | `physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature` — enemies may resist or be vulnerable per type.                                                                                                                                                                                      |
| **Potion**                 | Consumable with temporary effect from the Alchemist shop.                                                                                                                                                                                                                                                      |
| **Regen / Regeneration**   | Enemy trait: heal each turn at end of enemy phase.                                                                                                                                                                                                                                                             |
| **Reward route**           | Internal post-rewards destination (`REWARD_ROUTES`), not a `Screen` — see **Screen** above. Combat rewards: normal → card, elite → trinket, boss → gear; Wildwood rolls 1/3 card/trinket/gear.                                                                                                                 |
| **Run materials earned**   | `activeRun.runMaterialsEarned` — materials collected during the current run (combat, mysteries); persisted in `ActiveRunData`; cleared after run end. Shown on game-over / run-victory via `session.runEndMaterials` (includes homestead `endRun*PerRoom` bonuses).                                            |
| **FadeSlot / screen fade** | Sequential opacity enter/exit (`src/features/alchemy/shared/ui/fade-slot.tsx`); route wrapper `page-enter` / `page-exit`. See [WORKFLOWS § Screen fade](./WORKFLOWS.md#screen-fade-motion).                                                                                                                    |
| **Status**                 | Temporary player/enemy effect with tick/expiry (Burn, Freeze, Poison, Stun, …).                                                                                                                                                                                                                                |
| **TiltSurface**            | Card/tile wrapper with tilt-on-hover, optional shimmer, and button/div modes (`src/features/alchemy/shared/ui/tilt-surface.tsx`).                                                                                                                                                                              |
| **Summon**                 | Brings a companion into battle.                                                                                                                                                                                                                                                                                |
| **Talent Effect Manifest** | Active talent bonuses on `BattleState.talentEffects`.                                                                                                                                                                                                                                                          |
| **Trinket Manifest**       | Run-scoped Trinket bonuses on `BattleState.trinketEffects`.                                                                                                                                                                                                                                                    |
| **Gear**                   | Permanent unique items stored in the Armory and equipped per character. Gear effects are snapshotted when battle begins.                                                                                                                                                                                       |
| **Wish**                   | Card choices from full library; `wishQueue`.                                                                                                                                                                                                                                                                   |

---

## Navigation Hints

Lookup for modules not covered in [ARCHITECTURE.md](./ARCHITECTURE.md). Paths are on-disk unless noted.

| Need                                   | Look in                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| App boot / screen registry             | `src/app/screen-routes/`                                                                                                                             |
| Audio (cache / music / SFX / volume)   | `src/lib/audio-*.ts`, `src/lib/audio.ts`                                                                                                             |
| Cold-start loading gate                | [ARCHITECTURE.md § Boot](./ARCHITECTURE.md#boot-and-loading)                                                                                         |
| Balance simulation                     | `src/lib/balance/`                                                                                                                                   |
| Card corruption                        | `src/lib/corruption/`                                                                                                                                |
| Card library barrel                    | `src/lib/game-data/cards.ts` → `cards/library/{core-cards,specialty-cards,advanced-cards}.ts`                                                        |
| Content systems (labyrinth / wildwood) | `src/lib/content-systems/`                                                                                                                           |
| Effect handler registry doc            | `src/lib/game-data/effects/BATTLE_HANDLERS.md`                                                                                                       |
| Feature config barrel                  | `src/features/alchemy/shared/config/`                                                                                                                |
| Game-data types                        | `src/lib/game-data/types.ts`                                                                                                                         |
| Homestead data                         | `src/lib/homestead/` — **Detect Magic** (`detect-magic` research) shifts gear reward/shop Basic↔Astral rolls (+3% / +6% / +10% Astral at tiers 1–3). |
| In-run material grants                 | [WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run)                                                                           |
| Motion UI (`FadeSlot`, `TiltSurface`)  | [WORKFLOWS § Screen fade](./WORKFLOWS.md#screen-fade-motion); files in `src/features/alchemy/shared/ui/`                                             |
| Image preload helper                   | `src/lib/image-preload.ts`                                                                                                                           |
| Potion mixing                          | `src/lib/alchemist/potion-mixer.ts`                                                                                                                  |
| Platform / Steam                       | `src/lib/platform.ts`, `src/lib/platform-save-backend.ts`, `desktop/`                                                                                |
| Reward card sampling                   | `run-loop/navigation/reward-flow.ts`                                                                                                                 |
| Run lifecycle / capability ports       | [ARCHITECTURE.md](./ARCHITECTURE.md)                                                                                                                 |
| Run screen taxonomy                    | `src/lib/routing/run-screen-router.ts`                                                                                                               |
| Save migrations doc                    | `shared/storage/MIGRATIONS.md`                                                                                                                       |
| Sound ↔ card registry                  | `src/lib/sound-registry.ts`                                                                                                                          |
| Startup validation                     | `src/lib/validate-startup.ts`                                                                                                                        |
| Talent XP math vs talent data          | `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/`                                                                           |
| Tuning                                 | Topical files under `src/lib/game-constants/`, exported through `src/lib/game-constants.ts`                                                          |
