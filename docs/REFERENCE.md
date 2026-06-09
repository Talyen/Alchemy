# Alchemy — Developer Reference

Static reference guides for command scripts, glossary terms, and file locations. Strict rules and coding conventions live in **[AGENTS.md](../AGENTS.md)**.

## Quick Reference
- [Environment & Commands](#environment--commands)
- [Domain Glossary](#domain-glossary)
- [Navigation Hints](#navigation-hints)

---

## Environment & Commands

- **Node.js `>=24`** — authoritative in `package.json` `engines`.
- **npm 10+**
- **Playwright:** `npx playwright install chromium` once before first `npm run test:e2e`.
- **GitHub CLI (`gh`):** optional; PR/CI only when the user asks — do not run `gh auth login`.
- **Git hooks:** lefthook `pre-push` — see [CONTRIBUTING.md](../CONTRIBUTING.md) (9 `@prepush` e2e tests after `lint:ci`, `test`, `build`).
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
npm run test:e2e:prepush    # Fast @prepush subset (pre-push hook)
npm run test:e2e:prepush:full  # @critical on preview (CI e2e job)
npm run test:e2e:main-gate  # Full suite on preview (push to main)
npm run balance:sim         # Balance simulator report
```

Full script list: `package.json` / [README.md](../README.md).

---

## Domain Glossary

Definitions of common terms used in the Alchemy codebase.

| Term | Definition |
|---|---|
| **Burn** | DoT status; ticks at start of enemy turn, stack −1 after tick. |
| **Combat Text** | Floating numbers merged per `(target, kind, stat)`. |
| **Companion Bond** | Per-companion talent level; boosts companion damage each turn. |
| **Content System** | `campaign`, `labyrinth`, or `wildwood` — map generation and encounter rules. |
| **Corruption** | Altar event that mutates a card with a random harmful effect/tag. |
| **Damage type** | `physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature` — enemies may resist or be vulnerable per type. |
| **Potion** | Consumable with temporary effect from the Alchemist shop. |
| **Regen / Regeneration** | Enemy trait: heal each turn at end of enemy phase. |
| **Reward route** | Internal post-rewards destination (`REWARD_ROUTES`), not a `Screen`. |
| **Status** | Temporary player/enemy effect with tick/expiry (Burn, Freeze, Poison, Stun, …). |
| **Summon** | Brings a companion into battle. |
| **Talent Effect Manifest** | Active talent bonuses on `BattleState.talentEffects`. |
| **Trinket Manifest** | Equipped trinket bonuses on `BattleState.trinketEffects`. |
| **Wish** | Card choices from full library; `wishQueue`. |

---

## Navigation Hints

Lookup for modules not covered in the [AGENTS.md Architecture Map](../AGENTS.md#runtime-map). Paths are on-disk unless noted.

| Need | Look in |
|---|---|
| Audio (cache / music / SFX / volume) | `src/lib/audio-*.ts`, `src/lib/audio.ts` |
| Balance simulation | `src/lib/balance/` |
| Card corruption | `src/features/alchemy/run-loop/corruption.ts` |
| Card library barrel | `src/lib/game-data/cards.ts` → `cards/combatCards.ts`, `supportCards.ts` |
| Content systems (labyrinth / wildwood) | `src/lib/content-systems/` |
| Effect handler registry doc | `src/lib/game-data/effects/BATTLE_HANDLERS.md` |
| Feature config barrel | `src/features/alchemy/shared/config/` |
| Game-data types | `src/lib/game-data/types.ts` |
| Homestead data | `src/lib/homestead/` |
| Image preload helper | `src/lib/image-preload.ts` |
| Potion mixing | `src/features/alchemy/potion-mixer.ts` |
| Platform / Steam | `src/lib/platform.ts`, `desktop/` |
| Reward card sampling | `run-loop/reward-utils.ts` |
| Run screen taxonomy | `src/lib/routing/run-screen-router.ts` |
| Save migrations doc | `shared/storage/MIGRATIONS.md` |
| Sound ↔ card registry | `src/lib/sound-registry.ts` |
| Startup validation | `src/lib/validate-startup.ts` |
| Talent XP math vs talent data | `src/lib/game-data/talents/progression.ts` vs `src/lib/game-data/talents/` |
| Tuning | `src/lib/game-constants.ts` |
