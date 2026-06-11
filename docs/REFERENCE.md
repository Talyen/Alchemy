# Alchemy — Developer Reference

Static reference for commands, glossary, battle rules, and file lookup. Strict coding rules: **[AGENTS.md](../AGENTS.md)**. Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [PROMPTS.md](../PROMPTS.md).

## Quick Reference
- [Environment & Commands](#environment--commands)
- [Battle Implementation Rules](#battle-implementation-rules)
- [Domain Glossary](#domain-glossary)
- [Navigation Hints](#navigation-hints)

---

## Environment & Commands

- **Node.js `>=24`** — authoritative in `package.json` `engines`.
- **npm 10+**
- **Playwright:** `npx playwright install chromium` once before first `npm run test:e2e`.
- **GitHub CLI (`gh`):** optional; PR/CI only when the user asks — do not run `gh auth login`.
- **Git hooks:** lefthook `pre-push` — see [CONTRIBUTING.md](../CONTRIBUTING.md) (`lint:ci`, `test`, `build:ship`, `@prepush` e2e).
- **Steam / ship gates:** [RELEASE.md](./RELEASE.md) — `check:ship`, `check:ship:full`, tag-triggered `release.yml`.
- **Balance sim env vars:** `ALCHEMY_BALANCE_ITERATIONS`, `ALCHEMY_BALANCE_POLICY` (`random-playable`, `greedy-damage`, `defensive-random`).

### Script Command Reference

```sh
npm run dev                 # Vite dev server
npm run build               # tsc + vite build
npm test                    # Vitest
npm test -- <path>          # Single test file
npm run lint:ci             # format:check + lint + deadcode (CI / pre-push)
npm run check               # npm ci --dry-run + lint:ci + test + build
npm run check:push          # check + test:e2e:prepush
npm run check:ship          # lint:ci + ship unit tests + desktop compile
npm run check:ship:full     # check:ship + save E2E + Electron E2E
npm run sync:version        # package.json → metadata.generated.ts
npm run generate:patch-notes
npm run dist:desktop        # electron-builder per steam/platforms.json
npm run test:e2e:prepush    # Fast @prepush subset (pre-push hook)
npm run test:e2e:prepush:full  # @critical on preview (CI e2e job)
npm run test:e2e:main-gate  # Full suite on preview (push to main)
npm run balance:sim         # Balance simulator report
```

Full script list: `package.json` / [README.md](../README.md).

---

## Battle Implementation Rules

Operational rules for `src/lib/battle/` that deviate from typical CCG assumptions. Term definitions: [Domain Glossary](#domain-glossary). Tests: `tests/lib/battle/`.

- **1-on-1 targeting** — one enemy per battle; attacks/debuffs go to the enemy, blocks/heals/buffs to player/companions; no target selectors.
- **Turn order** — Player (companion attacks → play cards) → Enemy (enemy DoTs → attack → player DoTs → regen) → reset (draw 4, restore mana, halve block).
- **Mana** — resets to `maxMana` each turn; unspent mana is lost (Wellspring talent excepted).
- **Companions** — invulnerable; act at player turn start; persist indefinitely.
- **Draw / deck** — draw 4 per turn, max hand 7 (overflow skipped); hand cleared before draw; discard reshuffles when draw pile empties; only `consume` cards leave permanently.
- **Block** — absorbs enemy damage first; halved (not cleared) at end of enemy turn.
- **Death's Door** — at 0 HP, grace turn(s) before run ends; CC skip suppressed during grace.
- **Battle RNG** — use `state.rng`, not `Math.random()` (`createBattleState` may pass explicit RNG in tests).
- **Enemy status** — stack changes via `adjustEnemyStatusDelta()` so labyrinth/difficulty modifiers apply.
- **Static enemy actions** — `enemyAttackEffects` resolve sequentially every turn; no randomized intents.
- **Run materials** — player loot via `awardMaterialsDuringRun()` only; not `useHomesteadStore.addMaterials()` from run-loop code ([WORKFLOWS § Grant materials](./WORKFLOWS.md#grant-materials-during-a-run)).

---

## Domain Glossary

Definitions of common terms used in the Alchemy codebase.

| Term | Definition |
|---|---|
| **Block** | Damage absorption on player/enemy; player block halves (not clears) at end of enemy turn. |
| **Burn** | DoT status; ticks at start of enemy turn, stack −1 after tick. |
| **Death's Door** | At 0 HP, grace turn(s) before run ends; must heal above 0 before grace expires. |
| **Homestead** | Between-run hub; spend **Materials** on permanent upgrades. |
| **Mana** | Resource to play cards; resets to `maxMana` each turn (unspent lost unless Wellspring). |
| **Materials** | Meta currency for homestead upgrades; in-run earnings via `awardMaterialsDuringRun()`. |
| **Screen** | Route union (`menu`, `battle`, `rewards`, …) on `navigation.screen` — not a map node. |
| **Combat Text** | Floating numbers merged per `(target, kind, stat)`. |
| **Companion Bond** | Per-companion talent level; boosts companion damage each turn. |
| **Content System** | `campaign`, `labyrinth`, or `wildwood` — map generation and encounter rules. |
| **Corruption** | Altar event that mutates a card with a random harmful effect/tag. |
| **Damage type** | `physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature` — enemies may resist or be vulnerable per type. |
| **Potion** | Consumable with temporary effect from the Alchemist shop. |
| **Regen / Regeneration** | Enemy trait: heal each turn at end of enemy phase. |
| **Reward route** | Internal post-rewards destination (`REWARD_ROUTES`), not a `Screen` — see **Screen** above. |
| **Run materials earned** | `progress.runMaterialsEarned` — materials collected during the current run (combat, mysteries); persisted in `ActiveRunData`; cleared after run end. Shown on game-over / run-victory via `session.runEndMaterials` (includes homestead `endRun*PerRoom` bonuses). |
| **StaggerGroup / StaggerItem** | Shared enter-animation wrappers (`shared-ui`); panel `state-swap` + per-child `.stagger-item` stagger. See [WORKFLOWS § Staggered screen enter](./WORKFLOWS.md#staggered-screen-enter-motion). |
| **Status** | Temporary player/enemy effect with tick/expiry (Burn, Freeze, Poison, Stun, …). |
| **TiltSurface** | Card/tile wrapper with tilt-on-hover, optional shimmer, and button/div modes (`shared/ui/tilt-surface.tsx`). |
| **Summon** | Brings a companion into battle. |
| **Talent Effect Manifest** | Active talent bonuses on `BattleState.talentEffects`. |
| **Trinket Manifest** | Equipped trinket bonuses on `BattleState.trinketEffects`. |
| **Wish** | Card choices from full library; `wishQueue`. |

---

## Navigation Hints

Lookup for modules not covered in [ARCHITECTURE.md](./ARCHITECTURE.md). Paths are on-disk unless noted.

| Need | Look in |
|---|---|
| App boot / screen registry | `src/app/screen-routes/`, `render-alchemy-screen.tsx` |
| Audio (cache / music / SFX / volume) | `src/lib/audio-*.ts`, `src/lib/audio.ts` |
| Cold-start loading gate | `use-initial-load-ready.ts`, `allGameArt` in `assets.ts` — see [ARCHITECTURE § Boot](./ARCHITECTURE.md#boot-and-loading) |
| Balance simulation | `src/lib/balance/` |
| Card corruption | `src/features/alchemy/run-loop/corruption.ts` |
| Card library barrel | `src/lib/game-data/cards.ts` → `cards/combatCards.ts`, `supportCards.ts` |
| Content systems (labyrinth / wildwood) | `src/lib/content-systems/` |
| Effect handler registry doc | `src/lib/game-data/effects/BATTLE_HANDLERS.md` |
| Feature config barrel | `src/features/alchemy/shared/config/` |
| Game-data types | `src/lib/game-data/types.ts` |
| Homestead data | `src/lib/homestead/` |
| In-run material grants | `awardMaterialsDuringRun()` in `shared/stores/run-session-facade.ts` |
| Motion UI (`StaggerGroup`, `StaggerItem`, `TiltSurface`, `PressableMotion`) | `src/features/alchemy/shared/ui/` — enter tokens in `src/index.css` |
| Image preload helper | `src/lib/image-preload.ts` |
| Potion mixing | `src/features/alchemy/potion-mixer.ts` |
| Platform / Steam | `src/lib/platform.ts`, `desktop/` |
| Reward card sampling | `run-loop/reward-utils.ts` |
| Run lifecycle / facade | `shared/stores/run-session-facade.ts`, `run-transitions.ts` |
| Run screen taxonomy | `src/lib/routing/run-screen-router.ts` |
| Save migrations doc | `shared/storage/MIGRATIONS.md` |
| Sound ↔ card registry | `src/lib/sound-registry.ts` |
| Startup validation | `src/lib/validate-startup.ts` |
| Talent XP math vs talent data | `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/` |
| Tuning | `src/lib/game-constants.ts` |
