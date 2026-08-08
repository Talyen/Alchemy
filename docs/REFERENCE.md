# Alchemy — Developer Reference

Static reference for commands, glossary, battle rules, and file lookup. Strict coding rules: **[AGENTS.md](../AGENTS.md)**. Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

## Quick Reference

- [Environment & Commands](#environment--commands)
- [Battle Implementation Rules](#battle-implementation-rules)
- [Domain Glossary](#domain-glossary)
- [Navigation Hints](#navigation-hints)

---

## Environment & Commands

- **Node.js `>=24`** — authoritative in `package.json` `engines`.
- **npm `>=11`** — authoritative in `package.json` `engines` (Node 24 bundles npm 11).
- **Playwright:** `npx playwright install chromium` once before first `npm run test:e2e`.
- **GitHub CLI (`gh`):** optional; PR/CI only when the user asks — do not run `gh auth login`. CI failures are easiest to read from check annotations and the job Step Summary (not the raw Vitest pass list).
- **Git hooks:** lefthook `pre-commit` / `commit-msg` / fast `pre-push` — see [CONTRIBUTING.md](../CONTRIBUTING.md). Changelog updates happen at release only ([RELEASE.md](./RELEASE.md)). Fuller local static+unit is `npm run check:push:full` (still `@prepush` E2E); CI owns critical E2E (`test:e2e:prepush:full`).
- **Steam / ship gates:** [RELEASE.md](./RELEASE.md) — `check:ship`, `check:ship:full`, tag-triggered `release.yml`.
- **Balance sim env vars:** `ALCHEMY_BALANCE_ITERATIONS`, `ALCHEMY_BALANCE_POLICY` (`random-playable`, `greedy-damage`, `defensive-random`).

### Script Command Reference

```sh
npm run dev                 # Vite dev server
npm run build               # vite build (typecheck is a separate gate; Vercel runs vercel.json buildCommand)
npm run build:desktop       # vite desktop build (runs prebuild:desktop sync)
npm run package:win         # unpacked Windows app via dist-desktop.mjs (ALCHEMY_PACKAGE_DIR=1)
npm run dist:desktop        # installers via dist-desktop.mjs (steam/platforms.json targets)
npm run smoke:preview       # start vite preview and assert HTTP 200 (CI/release)
npm run typecheck           # tsc --noEmit (fast; also in lint:ci and pre-commit)
npm test                    # Vitest
npm test -- <path>          # Single test file
npm run lint:ci             # format:check + typecheck:all + lint + boundaries + deadcode (full local/CI static gate)
npm run lint:boundaries     # dependency-cruiser phase / lib edges
npm run lint:architecture-smoke  # optional debugging smoke over representative screens (subsumed by npm run lint; not in lint:ci)
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
npm run balance:sim         # Balance simulator report (opens via scripts/open-report.mjs)
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

`predev:desktop` is an alias of `predev` (same stop-server + asset prep).

`npm run clean` never stops the main Vite dev server (`5173` / `ALCHEMY_DEV_PORT`). Use `npm run clean -- --processes --include-dev-port` for that, or rely on `predev` which already calls `scripts/stop-dev-server.mjs`. Playwright keeps only failed-run output under `test-results/` (`preserveOutput: "failures-only"`). Shared `~/Library/Caches/ms-playwright` may be used by other projects — do not prune it from Alchemy alone.

Full script list: `package.json` / [README.md](../README.md).

---

## Battle Implementation Rules

Operational rules for `src/lib/battle/` that deviate from typical CCG assumptions. Term definitions: [Domain Glossary](#domain-glossary). Tests: `tests/lib/battle/`.

- **1-on-1 targeting** — one enemy per battle; attacks/debuffs go to the enemy, blocks/heals/buffs to player/companions; no target selectors.
- **Turn order** — Player (companion attacks → play cards) → Enemy (enemy DoTs → attack → player DoTs → regen) → reset (draw 4, restore mana, halve player block). Enemy block halves when the next enemy phase begins.
- **Mana** — resets to `maxMana` each turn; unspent mana is lost (Wellspring talent excepted).
- **Companions** — invulnerable; act at player turn start; persist indefinitely.
- **Draw / deck** — draw 4 per turn, max hand 7 (overflow skipped); hand cleared before draw; discard reshuffles when draw pile empties; only `consume` cards leave permanently.
- **Block** — absorbs incoming damage first; halved (not cleared) at the start of the owner's next turn, after the opposing side had a chance to attack into it.
- **Death's Door** — prevents fatal damage once per battle, leaving player at 1 HP with grace turn(s); during grace, lethal damage floors the player at 1 HP until they heal or grace expires; CC skip suppressed during grace.
- **Battle RNG** — use `state.rng`, not `Math.random()` (`createBattleState` may pass explicit RNG in tests).
- **Enemy status** — stack changes go through `addEnemyStatus()` / `setEnemyStatus()` in `src/lib/battle/types.ts`; `braced` enemy trait halves incoming stun.
- **Static enemy actions** — `enemyAttackEffects` resolve sequentially every turn; no randomized intents.
- **Run materials** — player loot via `awardMaterialsDuringRun()` only; not progress `addMaterials()` from run-loop code ([WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run)).

---

## Domain Glossary

Definitions of common terms used in the Alchemy codebase.

| Term                           | Definition                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Block**                      | Damage absorption on player/enemy; halves at the start of the owner's next turn after one opposing attack window.                                                                                                                                                   |
| **Burn**                       | DoT status; deals its stack as damage, then normally decays by half.                                                                                                                                                                                                |
| **Death's Door**               | Prevents fatal damage once per battle, leaving player at 1 HP with grace turn(s); while grace is active lethal hits floor the player at 1 HP (multi-hit and DoT ticks included), and damage becomes lethal once grace expires.                                      |
| **Homestead**                  | Between-run hub; spend **Materials** on permanent upgrades.                                                                                                                                                                                                         |
| **Mana**                       | Resource to play cards; resets to `maxMana` each turn (unspent lost unless Wellspring).                                                                                                                                                                             |
| **Materials**                  | Meta currency for homestead upgrades; in-run earnings via `awardMaterialsDuringRun()`.                                                                                                                                                                              |
| **Screen**                     | Route union (`menu`, `battle`, `rewards`, …) on `navigation.screen` — not a map node.                                                                                                                                                                               |
| **Combat Text**                | Floating numbers merged per `(target, kind, stat)`.                                                                                                                                                                                                                 |
| **Companion Bond**             | Per-companion talent level; boosts companion damage each turn.                                                                                                                                                                                                      |
| **Content System**             | `campaign`, `labyrinth`, or `wildwood` — map generation and encounter rules.                                                                                                                                                                                        |
| **Corruption**                 | Altar event that mutates a card with a random harmful effect/tag.                                                                                                                                                                                                   |
| **Damage type**                | `physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature` — enemies may resist or be vulnerable per type.                                                                                                                                           |
| **Potion**                     | Consumable with temporary effect from the Alchemist shop.                                                                                                                                                                                                           |
| **Regen / Regeneration**       | Enemy trait: heal each turn at end of enemy phase.                                                                                                                                                                                                                  |
| **Reward route**               | Internal post-rewards destination (`REWARD_ROUTES`), not a `Screen` — see **Screen** above. Combat rewards: normal → card, elite → trinket, boss → gear; Wildwood rolls 1/3 card/trinket/gear.                                                                      |
| **Run materials earned**       | `activeRun.runMaterialsEarned` — materials collected during the current run (combat, mysteries); persisted in `ActiveRunData`; cleared after run end. Shown on game-over / run-victory via `session.runEndMaterials` (includes homestead `endRun*PerRoom` bonuses). |
| **StaggerGroup / StaggerItem** | Shared enter-animation wrappers (`shared-ui`); panel `state-swap` + per-child `.stagger-item` stagger. See [WORKFLOWS § Staggered screen enter](./WORKFLOWS.md#staggered-screen-enter-motion).                                                                      |
| **Status**                     | Temporary player/enemy effect with tick/expiry (Burn, Freeze, Poison, Stun, …).                                                                                                                                                                                     |
| **TiltSurface**                | Card/tile wrapper with tilt-on-hover, optional shimmer, and button/div modes (`shared/ui/tilt-surface.tsx`).                                                                                                                                                        |
| **Summon**                     | Brings a companion into battle.                                                                                                                                                                                                                                     |
| **Talent Effect Manifest**     | Active talent bonuses on `BattleState.talentEffects`.                                                                                                                                                                                                               |
| **Trinket Manifest**           | Run-scoped Trinket bonuses on `BattleState.trinketEffects`.                                                                                                                                                                                                         |
| **Gear**                       | Permanent unique items stored in the Armory and equipped per character. Gear effects are snapshotted when battle begins.                                                                                                                                            |
| **Wish**                       | Card choices from full library; `wishQueue`.                                                                                                                                                                                                                        |

---

## Navigation Hints

Lookup for modules not covered in [ARCHITECTURE.md](./ARCHITECTURE.md). Paths are on-disk unless noted.

| Need                                                                       | Look in                                                                                                                                         |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| App boot / screen registry                                                 | `src/app/screen-routes/`                                                                                                                        |
| Audio (cache / music / SFX / volume)                                       | `src/lib/audio-*.ts`, `src/lib/audio.ts`                                                                                                        |
| Cold-start loading gate                                                    | `use-app-effects.ts`, `allGameArt` in `assets.ts` — see [ARCHITECTURE § Boot](./ARCHITECTURE.md#boot-and-loading)                               |
| Balance simulation                                                         | `src/lib/balance/`                                                                                                                              |
| Card corruption                                                            | `src/features/alchemy/run-loop/corruption.ts`                                                                                                   |
| Card library barrel                                                        | `src/lib/game-data/cards.ts` → `cards/library/{core-cards,specialty-cards,advanced-cards}.ts`                                                   |
| Content systems (labyrinth / wildwood)                                     | `src/lib/content-systems/`                                                                                                                      |
| Effect handler registry doc                                                | `src/lib/game-data/effects/BATTLE_HANDLERS.md`                                                                                                  |
| Feature config barrel                                                      | `src/features/alchemy/shared/config/`                                                                                                           |
| Game-data types                                                            | `src/lib/game-data/types.ts`                                                                                                                    |
| Homestead data                                                             | `src/lib/homestead/` — **Detect Magic** (`masonry` research) shifts gear reward/shop Basic↔Astral rolls (+3% / +6% / +10% Astral at tiers 1–3). |
| In-run material grants                                                     | `awardMaterialsDuringRun()` in `shared/stores/run-session-write-port.ts`                                                                        |
| Motion UI (`StaggerGroup`, `StaggerItem`, `TiltSurface`, `PressableSound`) | `src/features/alchemy/shared/ui/` — enter tokens in `src/index.css`                                                                             |
| Image preload helper                                                       | `src/lib/image-preload.ts`                                                                                                                      |
| Potion mixing                                                              | `src/lib/alchemist/potion-mixer.ts`                                                                                                             |
| Platform / Steam                                                           | `src/lib/platform.ts`, `desktop/`                                                                                                               |
| Reward card sampling                                                       | `run-loop/navigation/reward-flow.ts`                                                                                                            |
| Run lifecycle / capability ports                                           | `shared/stores/run-session-lifecycle-port.ts`, `run-session-read-port.ts`, `run-session-write-port.ts`                                          |
| Run screen taxonomy                                                        | `src/lib/routing/run-screen-router.ts`                                                                                                          |
| Save migrations doc                                                        | `shared/storage/MIGRATIONS.md`                                                                                                                  |
| Sound ↔ card registry                                                      | `src/lib/sound-registry.ts`                                                                                                                     |
| Startup validation                                                         | `src/lib/validate-startup.ts`                                                                                                                   |
| Talent XP math vs talent data                                              | `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/`                                                                      |
| Tuning                                                                     | `src/lib/game-constants.ts`                                                                                                                     |
