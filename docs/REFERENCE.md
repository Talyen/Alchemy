# Alchemy — Developer Reference

Reference for commands, glossary, battle rules, and file lookup. Strict coding rules: **[AGENTS.md](../AGENTS.md)**. Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

## Environment & Commands

- **Node.js `^20.19.0 || >=22.12.0`** — authoritative in `package.json` `engines` (`.node-version` pins 24 for local dev).
- **npm `>=11`** — authoritative in `package.json` `engines` (Node 24 bundles npm 11).
- **Playwright:** `npx playwright install chromium` once before first `npm run test:e2e`.
- **GitHub CLI (`gh`):** optional; PR/CI only when the user asks — do not run `gh auth login`.
- **Git hooks / local gates:** [CONTRIBUTING.md](../CONTRIBUTING.md). Changelog updates happen at release only ([RELEASE.md](./RELEASE.md)).
- **Steam / ship gates:** [RELEASE.md](./RELEASE.md).

### Script Command Reference

```sh
npm run dev                 # Vite dev server
npm run build               # vite build (typecheck is a separate gate; Vercel runs vercel.json buildCommand)
npm run assets:check        # Prepare assets and fail unless the operation is idempotent
npm test                    # Vitest; `npm test -- <path>` for a single file
npm run verify:changed -- --diff  # Changed-path verification route (--plan previews; --e2e <route> escalates)
npm run runs:show -- --last 10    # Recent run IDs, outcomes, counts, and evidence availability
npm run context:hotspots          # Ranked route context and recent command-output exposure
npm run typecheck           # tsc --noEmit (fast; also in lint:ci / check:push)
npm run lint:ci             # Full static gate
npm run check:push          # Local pre-push gate
npm run check:ship          # Ship gate before tagging/desktop packaging
npm run docs:check          # Validate documentation contracts and plan metadata
npm run plans:check         # Validate active plan metadata only
npm run new:plan -- <Name>  # Scaffold an execution plan under docs/Plans/
npm run balance:sim         # Headless balance findings (opens reports/balance-findings.html)
npm run perf                # FPS / hitch profiling ([PERFORMANCE.md](./PERFORMANCE.md))
npm run clean               # Remove local diagnostics/artifacts
npm run release             # Full release: gates, commit/tag, push, CI watch ([RELEASE.md](./RELEASE.md))
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

**Skip flags:**

- `ALCHEMY_SKIP_ASSETS=1` — skip asset optimization/barrel regeneration; semantics owned by [`WORKFLOWS-ASSETS.md`](./WORKFLOWS-ASSETS.md).
- `ALCHEMY_ENABLE_CHECKER=1` — opt-in to the in-Vite `vite-plugin-checker` typecheck (off by default so `npm run dev` stays snappy; use `npm run typecheck:watch`, `npm run dev:checked`, or this flag when you need live type errors). `ALCHEMY_SKIP_CHECKER=1` is a hard off used by the Playwright preview server.
- `ALCHEMY_SKIP_SOURCEMAP=1` — opt-out of hidden sourcemaps for `mode=desktop` builds when fast local iterate is preferred; `npm run clean` removes existing maps.

`npm run clean` removes local diagnostics and build artifacts. Its exact
options are owned by `scripts/clean-dev-artifacts.mjs`; do not use it to prune
shared Playwright caches.

## Failure-first triage

Verification and audit commands keep full artifacts on disk but print a bounded digest. Start with the digest and open the referenced artifact only when it names the next useful seam. Battle warnings use the `[Enemy Turn]` prefix.

Outer test runners set `ALCHEMY_RUN_ID` once and pass it to child commands; CI derives the same identity from its run, attempt, job, and optional matrix variant. Do not change it within one invocation.

- Unit failures: rerun the exact path from the report, then inspect the first assertion and its nearest fixture. `reports/vitest-timings.json` is timing data, not default context.
- Playwright failures: read the compact failure summary and `test-results/failures/<run-id>/<name>.md` first. Its bounded accessibility snapshot shows the roles, names, and hierarchy present at failure; open a trace ZIP only when that and the console evidence cannot explain the failure. CI summaries add the changed-path route and any path-filtered focused E2E gate for the failing file.
- Changed-path failures: open the run-specific Markdown digest named by `reports/current-run.md`; the sibling `.log` is secondary evidence when its bounded failure tail is insufficient.
- E2E audit: `npm run test:e2e:audit` writes `reports/e2e-audit-report.md` and keeps the full JSON report. Use `--verbose` only when the child runner's complete stream is needed.
- Measurable audits: `npm run audit:all` reports one line per passing probe and a bounded failure tail. Full step output is under `reports/audit-all/` after a failure; pass `--verbose` to stream it deliberately.
- Balance: read `reports/balance-findings.html` or its JSON summary first. The full matrix under `reports/balance-full/` is drill-down evidence only.
- Report pointer: `reports/current-run.md` and `.json` point to the latest run-specific record under `reports/runs/<run-id>/`. Start there, or use `npm run runs:show -- --last 10`, instead of recursively listing `reports/`.
- Do not paste complete logs, traces, snapshots, generated bundles, or report directories into agent context when the digest identifies a narrower file or test.
- Local transient artifacts are pruned automatically before dev/build preparation and remain available for test/performance investigation until explicitly pruned. Copy a failure artifact elsewhere only when an investigation genuinely needs to outlive the grace period; use `npm run prune:transient -- --dry-run` to inspect candidates.
- CI retains failure-only diagnostic artifacts for seven days and retains no successful-run report history.

### Context-efficiency measurements

`npm run measure:agent-context -- --path <changed-path>` reports a stable preread byte proxy: always-loaded instructions, route-selected owner sections, changed-file bytes, verification/test-path counts, and explicitly named artifact bytes. `--all-routes` compares one canonical fixture per route.

`npm run context:hotspots -- --last 20` ranks every canonical route by preread plus fixture bytes, then aggregates raw versus agent-exposed output for commands captured in recent report-producing runs. The default hides command groups below 4,000 raw bytes; use `--min-bytes 0` for the complete inventory, `--json` for machine-readable output, or `--check` to fail when a recorded command exceeded the 4 KiB routine-exposure budget. Route budgets are ratcheted in the repository-tooling tests. `verify:changed`, `audit:all`, and `test:e2e:audit` enforce the exposure budget on their own current run, while the verifier handoff rechecks the latest record. `--verbose` remains an explicit opt-in that records full exposure without enforcing the routine budget.

## Balance simulation

Headless battle simulator for overpowered or underpowered cards, classes, enemies, talents, companions, and trinkets. It runs isolated fights through the real battle engine (no browser, no React) using simple play policies. It is a **skill-floor** tool (dump-hand, random wishes, no holds), not a full run/map/shop simulator. Skipped during normal `npm test` runs.

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

# Run the low-iteration, side-effect-free integration check
npm run test:balance
```

The simulator covers deterministic early/mid/late progression scenarios using
combat-eligible talents and seeded loadouts. Exact presets, finding bands, and
report grouping are owned by `src/lib/balance/` and the generated report; use
findings as review input rather than applying tunings automatically. The
summary opens `reports/balance-findings.html` and writes a JSON companion.
Numeric environment values must be positive integers. Policy and loadout values
must exactly match the choices above; pacing accepts `on`/`1`/`true` or
`off`/`0`/`false` (empty or any other value now fails fast — previously empty string silently defaulted to `on`). Invalid configuration fails before report files are written.
Sweep seeds are deterministic per report tier and were re-keyed during the report extraction (`report-catalog`/`report-sweeps`): compare reports only from the same extractor revision.
`balance:sim` generates reports; `test:balance` only verifies deterministic,
finite report construction and does not touch `reports/`.

---

## Battle Implementation Rules

Operational rules for `src/lib/battle/` that deviate from typical CCG assumptions. Term definitions: [Domain Glossary](#domain-glossary). Tests: `tests/lib/battle/`.

- **1-on-1 targeting** — one enemy per battle; attacks/debuffs go to the enemy, blocks/heals/buffs to player/companions; no target selectors.
- **Turn order** — Player (companion attacks → play cards) → Enemy (enemy DoTs → attack → player DoTs → regen) → reset (draw 4, restore mana, halve player block). Enemy block halves when the next enemy phase begins.
- **Mana** — resets to `maxMana` each turn; unspent mana is lost (Wellspring talent excepted).
- **Companions** — invulnerable; act at player turn start; persist indefinitely.
- **Draw / deck** — battles commit with an empty hand, then deal the opening 4 plus battle-start bonus draws; later turns draw 4. Max hand 7 (overflow skipped); hand clears before turn draws; discard reshuffles when the draw pile empties; only `consume` cards leave permanently.
- **Block** — absorbs incoming damage first; halved (not cleared) at the start of the owner's next turn, after the opposing side had a chance to attack into it.
- **Dodge** — both sides have a 5% chance to Dodge each opposing attack **damage packet** before Block and Armor. A dodge deals 0, spends no Block/Armor, skips that packet's status riders and lifesteal, and shows Dodge combat text instead of damage. Status-only attacks, DoT ticks, and encounter/proc pulses cannot be dodged. Each damage packet rolls independently. Player Dodge can be increased by gear and by Last Gasp while below half Health. On-Dodge gear, on-Dodge talents, and Dance of Blades fire only when the hero Dodges. Torpor and Icebound can prevent enemy Dodge.
- **Haste** — extra turns skip the enemy phase; both blocks hold until a real attack window resolves, then halve once each.
- **Death's Door** — [Domain Glossary](#domain-glossary).
- **Fight pacing** — hidden combat scaler, not a player-facing status. Paces damage, block, forge, mana, and healing magnitudes; armor and gold grants bypass it at every site (pinned by `tests/lib/battle/fight-pacing.test.ts`). [Domain Glossary](#domain-glossary). Balance simulator: `ALCHEMY_BALANCE_PACING=off` measures raw kit.
- **Lethality payouts** — a kill via any damage source (main hits, follow-up typed hits, stun/freeze procs, wish triggers, DoT ticks, bleed/poison detonation, mana-crystal burn) pays the same rewards exactly once per health transition: Bone Charm heal + gear kill rewards via `payKillPayouts` (`src/lib/battle/kill-payouts.ts`). Enemy DoT ticks and detonates share `applyEnemyDotDamage` in `src/lib/battle/dot-resolve.ts` so Divine Aegis and armor decay cannot skip a source. Documented exceptions stay source-specific (e.g. Lucky Clover gold is off freeze-proc kills).
- **State and arithmetic** — treat `BattleState` as immutable. Combat magnitudes use nearest-integer `Math.round()`, never `Math.floor()`; the battle-engine lint boundary enforces this convention.
- **Battle RNG** — live combat draws the persisted `world` run stream (`withDraftWorldBattleRng` inside a command). Pure engine code uses `state.rng` / `getBattleRng(state)`, never `Math.random()`. Tests and the balance simulator use `createRunStreamRng` (same mixer as `nextRunRngValue`). `createBattleState` may pass explicit RNG in unit tests.
- **Enemy status** — stack changes go through `addEnemyStatus()` / `setEnemyStatus()` in `src/lib/battle/types/state-helpers.ts` (re-exported from `src/lib/battle/types.ts`); `braced` enemy trait halves incoming stun.
- **Static enemy actions** — `enemyAttackEffects` resolve sequentially every turn; no randomized intents.

---

## Domain Glossary

Definitions of common terms used in the Alchemy codebase.

### Content systems

- **Content System** — `campaign`, `labyrinth`, or `wildwood`; owns map generation and encounter rules. Implementations live under `src/lib/content-systems/`.
  - **Labyrinth** — infinite hex floors during a run. Each floor is a small hex map (one floor on screen). Reachable rooms are hex-adjacent to a cleared room, or the next floor entry after that floor's boss. Hover a hex for its name and type; click any chamber to pin a floating card, then confirm Enter when that room is reachable. HP carries between rooms. Dying ends the run (game over with XP/items); the next Labyrinth start generates a fresh map. There is no single Labyrinth victory screen.

### Shared battle and progression terms

| Term                     | Definition                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Block**                | Damage absorption on player/enemy; halves at the start of the owner's next turn after one opposing attack window.                                                                                                                                                                                                                                                                                                 |
| **Burn**                 | DoT status; deals its stack as damage, then normally decays by half.                                                                                                                                                                                                                                                                                                                                              |
| **Dodge**                | 5% chance for either side to avoid an opposing attack damage packet before Block and Armor. See [Battle Implementation Rules](#battle-implementation-rules).                                                                                                                                                                                                                                                      |
| **Death's Door**         | Prevents fatal damage once per battle, leaving the player at 1 HP with 2 grace turns (extendable). Healing does not end the window. While active, lethal hits floor at 1 HP (multi-hit and DoT ticks included). The enemy phase that spends the last grace still floors; damage becomes lethal on a later hit.                                                                                                    |
| **Fight pacing**         | Hidden combat scaler (not a player-facing rule). Live default on; `ALCHEMY_BALANCE_PACING=off` measures raw kit.                                                                                                                                                                                                                                                                                                  |
| **Homestead**            | Between-run hub; spend **Materials** on permanent upgrades.                                                                                                                                                                                                                                                                                                                                                       |
| **Mana**                 | Resource to play cards; resets to `maxMana` each turn (unspent lost unless Wellspring).                                                                                                                                                                                                                                                                                                                           |
| **Materials**            | Meta currency for homestead upgrades.                                                                                                                                                                                                                                                                                                                                                                             |
| **Screen**               | Route union (`menu`, `battle`, `rewards`, …) on `navigation.screen` — not a map node.                                                                                                                                                                                                                                                                                                                             |
| **Companion Bond**       | Per-companion talent level; boosts companion damage each turn.                                                                                                                                                                                                                                                                                                                                                    |
| **Corruption**           | Altar event that mutates a card's numeric values (+1 buff 80% of the time, -1 nerf 20% of the time, or transforms into another mutable card). Leave without corrupting returns to the same Choose Destination picker and does not consume the destination.                                                                                                                                                        |
| **Damage type**          | `physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature` — enemies may resist or be vulnerable per type.                                                                                                                                                                                                                                                                                         |
| **Potion**               | Consumable with temporary effect from the Alchemist shop.                                                                                                                                                                                                                                                                                                                                                         |
| **Regen / Regeneration** | Enemy trait: heal each turn at end of enemy phase.                                                                                                                                                                                                                                                                                                                                                                |
| **Reward route**         | Internal post-rewards destination (`REWARD_ROUTES`), not a `Screen` — see **Screen** above. Combat rewards: normal → card, elite → Boon, boss → Gear reward. Gear reward surfaces first roll an unowned permanent Trinket replacement (`GEAR_REWARD_PERMANENT_TRINKET_CHANCE`: boss 30%, Wildwood/non-boss 1/3), falling back to Gear when exhausted. Wildwood rolls card/Boon/Gear before that replacement roll. |
| **Run materials earned** | Materials collected during the current run and included in the run-end summary. See [WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run).                                                                                                                                                                                                                                                   |
| **Status**               | Temporary player/enemy effect with tick/expiry (Burn, Freeze, Poison, Stun, …).                                                                                                                                                                                                                                                                                                                                   |
| **Summon**               | Brings a companion into battle.                                                                                                                                                                                                                                                                                                                                                                                   |
| **Gear**                 | Permanent generated items stored in the Armory and equipped per character. Rarity is basic, astral, or unique. Unique items are named, fixed-affix definitions; uniqueness is inventory-scoped (salvage returns them to the drop pool). Collection discovery of a unique survives salvage. Gear effects are snapshotted when battle begins. See [ARMORY](./ARMORY.md).                                            |
| **Trinket**              | Permanent unique Armory collectible stored by definition ID and equipped in the dedicated Trinket slot. It has no rarity, affixes, duplicates, crafting, or salvage.                                                                                                                                                                                                                                              |
| **Boon**                 | Run-scoped form of a Trinket definition. It shares the name, art, effect, and Collection discovery, but does not enter the Armory or occupy a slot. A matching equipped Trinket and Boon apply once.                                                                                                                                                                                                              |
| **Wish**                 | Card choices from full library; `wishQueue`.                                                                                                                                                                                                                                                                                                                                                                      |

---

## Navigation Hints

Lookup for modules not covered in [ARCHITECTURE.md](./ARCHITECTURE.md). Paths are on-disk unless noted.

| Need                                   | Look in                                                                                                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App boot / screen registry             | `src/app/screen-routes/`                                                                                                                                                                                                                     |
| Audio (cache / music / SFX / volume)   | `src/lib/audio-*.ts`, `src/lib/audio.ts`; setting values and bounds live in `src/lib/settings-values.ts`. Non-player hosts (foreign Electron, undisplayed windows) never emit audible output.                                                |
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
| Motion UI (`FadeSlot`, `Surface`)      | [WORKFLOWS § Screen fade](./WORKFLOWS.md#screen-fade-motion); files in `src/features/alchemy/shared/ui/`                                                                                                                                     |
| Image preload helper                   | `src/lib/image-preload.ts`                                                                                                                                                                                                                   |
| Potion mixing                          | `src/lib/alchemist/potion-mixer.ts`                                                                                                                                                                                                          |
| Platform / Steam                       | `src/lib/platform.ts`, `src/lib/desktop-api.ts`, `src/lib/platform-save-backend.ts`, `desktop/`                                                                                                                                              |
| Reward card sampling                   | `src/features/alchemy/run-loop/navigation/reward-flow.ts`                                                                                                                                                                                    |
| Run lifecycle / capability ports       | [ARCHITECTURE.md](./ARCHITECTURE.md)                                                                                                                                                                                                         |
| Run screen taxonomy                    | `src/lib/routing/run-screen-router.ts`                                                                                                                                                                                                       |
| Save migrations doc                    | `src/features/alchemy/shared/storage/MIGRATIONS.md`                                                                                                                                                                                          |
| Sound ↔ card registry                  | `src/lib/sound-registry.ts`                                                                                                                                                                                                                  |
| Startup validation                     | `src/lib/validate-startup.ts`                                                                                                                                                                                                                |
| Talent XP math vs talent data          | `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/`                                                                                                                                                                   |
| Tuning                                 | Topical files under `src/lib/game-constants/` (`combat-rules`, `battle-timing`, `progression`, `run-rewards`, `audio`, `ui-motion`, `enemy-traits`, `homestead-loot`, `storage`, `gear`), exported through `src/lib/game-constants/index.ts` |
