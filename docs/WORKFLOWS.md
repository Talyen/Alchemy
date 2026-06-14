# Alchemy — Implementation Workflows

Step-by-step checklists for adding or changing game content and wiring.

**Docs:** [AGENTS.md](../AGENTS.md) (rules) · [ARCHITECTURE.md](./ARCHITECTURE.md) (run state) · [REFERENCE.md](./REFERENCE.md) (commands, glossary, battle) · [CONTRIBUTING.md](../CONTRIBUTING.md) (hooks & tests) · [PROMPTS.md](../PROMPTS.md) (audits)

**Import paths:** only `@/*` → `src/*` in `tsconfig.json`. Use **on-disk** paths under `src/features/alchemy/` (e.g. `@/features/alchemy/shared/stores/run-session-facade`) — not legacy alias paths that skip `shared/`.

## Task index

| Task | Section |
|------|---------|
| Raw asset / art | [Assets](#assets) |
| Save schema / migration | [Persisted save data](#change-persisted-save-data) |
| Mid-run resume | [Active run data](#change-mid-run-resume-activerundata) |
| Post-victory routing | [REWARD_ROUTES](#add-or-change-post-victory-routing-reward_routes) |
| Run teardown / clear save | [Run teardown](#run-teardown) |
| Status effect | [New status](#add-a-new-status-effect) |
| Card / card effect kind | [New card](#add-a-new-card) · [New effect kind](#add-a-new-card-effect-kind) |
| Character, enemy, boon, companion, keyword | [Character](#add-a-new-character) · [Enemy](#add-a-new-enemy) · [Boon](#add-a-new-boon) · [Companion](#add-a-new-companion) · [Keyword](#add-a-new-keyword) |
| Permanent gear | [Gear](#add-permanent-gear) |
| Screen, destination, mystery | [New screen](#adding-a-new-screen) · [Destination](#adding-a-new-destination-map-node) · [Mystery effect](#adding-a-new-mystery-effect-kind) |
| In-run materials, staggered enter | [Grant materials during a run](#grant-materials-during-a-run) · [Staggered screen enter](#staggered-screen-enter-motion) |

---

## Assets

**Add a new raw asset:** edit `scripts/optimize-assets.mjs` → `npm run assets:optimize` → import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`.

**Add new art:** place in `public/assets/card-art/` or `public/assets/templates/frames/` → add entry in `scripts/optimize-art.mjs` → `node scripts/optimize-art.mjs`.

---

## Change persisted save data

See also [`src/features/alchemy/shared/storage/MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md).

1. Decide if a schema bump is needed (transform required vs safe additive default).
2. Increment `CURRENT_SAVE_SCHEMA_VERSION` in `src/lib/validation/metadata.ts`.
3. Add `migrateVNToVNPlus1` in `src/lib/validation/migration/steps.ts` (use nested helpers under `src/lib/validation/migration/` for `activeRun` / battle / wildwood renames).
4. Update Zod schemas in `src/lib/validation/save-schemas/`, storage defaults, and fixtures in `tests/fixtures/legacy-saves.ts`.
5. CI enforces via `tests/architecture/save-migration-guard.test.ts`, `tests/architecture/save-migration-contract.test.ts`, and `npm run check:ship` — no manual release checklist.

---

## Change mid-run resume (`ActiveRunData`)

1. Extend `ActiveRunData` in `src/lib/active-run-session/types.ts` and Zod schema in `src/lib/validation/save-schemas/active-run.ts` (optional fields with defaults in `normalize-active-run-data.ts` often avoid a schema bump).
2. Add the field to `RunStateFields` / hydration in `src/features/alchemy/run-setup/run/run-state-init.ts` (mirror `runTalentXP` / `runMaterialsEarned` pattern).
3. Update `createActiveRunSnapshot()` in `src/lib/active-run-session/snapshot.ts` and `snapshotRun()` in `src/features/alchemy/shared/stores/run-transitions.ts`.
4. Update hydration in `shell/use-alchemy-run-controller.ts` via `restoreRun` (restore `screen`, `destinationChoices`, combat, etc.).
5. Run `tests/features/storage/active-run.test.ts`, `tests/features/stores/run-domain.test.ts` (snapshot parity), plus storage/migration tests.

**Active-run helpers (do not confuse):**

| Function | Module | When |
|----------|--------|------|
| `normalizeActiveRunData` | `@/lib/validation` | Zod transform while loading save files (legacy deck / content-system fixes) |
| `parseActiveRun` | `@/lib/active-run-session` or `@/features/alchemy/shared/storage/active-run` | Runtime validation before hydration |

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-facade.ts`) so homestead inventory and `progress.runMaterialsEarned` stay aligned for the run-end summary.

| Step | File(s) |
|------|---------|
| 1. Call `awardMaterialsDuringRun(materials)` | Mystery handlers: `run-loop/navigation/use-mystery-flow.ts`; combat: `run-flow-handlers.ts` (`finishRewards`, `commitVictoryRewards` via `addHomesteadMaterials` callback) |
| 2. Apply homestead find bonus when appropriate | `applyMaterialFindBonus()` from `@/lib/homestead/loot` before awarding (mystery/combat already do this) |
| 3. Run-end display (no change needed if step 1 is correct) | `run-flow-handlers.awardRunEndMaterials` merges `runMaterialsEarned` + `applyEndOfRunHomesteadBonuses` into `session.runEndMaterials` |
| 4. Tests | `tests/features/run/run-victory-handlers.test.ts`; mystery/reward-flow tests if adding a new source |

**Do not** call `useHomesteadStore.addMaterials()` directly from run-loop or mystery code for player loot.

---

## Staggered screen enter (motion)

| Step | Guidance |
|------|----------|
| 1. Panel wrapper | `<StaggerGroup>` on the main content container; optional `swapKey` when content identity changes and enter should replay |
| 2. Child items | `<StaggerItem index={n}>` wrapping each row/card — not on `Button` / `PressableMotion` directly |
| 3. Nested grid | Inner `<StaggerGroup animate={false}>` to avoid double panel enter (shops, pickers inside an already-entering panel) |
| 4. Tab switch fade only | `state-fade` class instead of `state-swap` when restagger on tab change is undesirable (options tabs) |
| 5. Absolute / map nodes | Skip `StaggerItem` when the node uses `-translate-x/y` for centering; use panel-level enter only |

Motion tokens and keyframes live in `src/index.css`. Hover/tap hard rules: [AGENTS.md § UI hard rules](../AGENTS.md#ui-hard-rules). Failure modes: [AGENTS.md § Common mistakes](../AGENTS.md#common-mistakes).

---

## Add or change post-victory routing (`REWARD_ROUTES`)

| Step | File(s) |
|---|---|
| 1. Add route constant | `src/features/alchemy/shared/types.ts` → `REWARD_ROUTES`, exported via `CONSTANTS` |
| 2. Compute route after rewards | `src/features/alchemy/run-loop/navigation/reward-flow.ts` (`finalizeRewardState` / related; import `@/features/alchemy/run-loop/navigation/reward-flow`) |
| 3. Handle transition | `reward-flow.ts` (`executeRewardRouteTransition`) and/or `shell/use-run-navigation.ts` (`routeAfterReward`) |
| 4. Tests | `tests/features/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run |

---

## Run teardown

`src/features/alchemy/shared/stores/reset.ts` (import `@/features/alchemy/shared/stores/reset`):

- `teardownRun()` / `flushSaveAfterRunEnd()` in [`run-transitions.ts`](../src/features/alchemy/shared/stores/run-transitions.ts) — run teardown and immediate save flushes (navigation calls these on run end).
- `clearAllPersistentGameData()` — clears app options, permanent run/talent data, and homestead (Options “clear save”).

---

## Add a new status effect

1. Define the status type in `src/lib/game-data/types.ts` — extend `PlayerStatusId` or `EnemyStatusId` string unions (discriminated union pattern).
2. Add tick logic in `src/lib/battle/status-ticks.ts`
3. Add application logic in `src/lib/battle/status-application.ts`
4. Add CC threshold logic in `src/lib/battle/status-cc.ts`
5. Register in `src/lib/battle/status-effects.ts`
6. Add matching keyword in `src/lib/game-data/keywords.ts`
7. Cover through `tests/lib/battle/status-*.test.ts` tests

---

## Add a new card

| Step | File(s) |
|---|---|
| 1. Define card in `combatCards.ts` or `supportCards.ts` (merged into `cardLibrary`) | `src/lib/game-data/cards/` |
| 2. Add effects (discriminated union on `kind`) | same entry, `effects: [...]` |
| 3. Add art reference | `src/lib/game-data/assets.ts` (or `placeholderCard` while WIP) |
| 4. (Optional) Register card sound | `src/lib/sound-registry.ts` (`cardSounds` record) |
| 5. Update `descriptionLines` to match effects | same card entry |
| 6. Cover through `tests/lib/game-data/descriptions-match-effects.test.ts` | |

Cards in `cardLibrary` are automatically included in merchant shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration (only `mixed-potion` is excluded).

---

## Add a new card effect `kind`

| Step | File(s) |
|---|---|
| 1. Add to `BattleCardEffect` union | `src/lib/game-data/types.ts` |
| 2. Create `effects/<kind>/definition.ts` (schema + `dispatchRoute`) | `src/lib/game-data/effects/` |
| 3. Register in `TEMPLATE_EFFECT_DEFINITIONS` (+ `ALL_EFFECT_REGISTRY_ENTRIES` if needed) | `src/lib/game-data/effects/template-definitions.ts` |
| 4. Add `kind` to `BATTLE_CARD_EFFECT_KINDS` | `src/lib/game-data/effects/kinds.ts` |
| 5. Implement handler (existing route module or new) | `src/lib/battle/effect-handlers/` — see `src/lib/game-data/effects/BATTLE_HANDLERS.md` |
| 6. Update `effect-metadata.ts` keywords | `src/lib/game-data/effect-metadata.ts` |
| 7. Tests | `tests/lib/battle/apply-effects*.test.ts`, `tests/lib/game-data/effects-registry.test.ts` |

---

## Add a new character

| Step | File(s) |
|---|---|
| 1. Add character ID to `CharacterId` union | `src/lib/game-data/types.ts` |
| 2. Define character in `characters` record | `src/lib/game-data/characters.ts` |
| 3. List card IDs in `startingDeck` (resolved via `resolveDeck`) | same file |

---

## Add a new enemy

| Step | File(s) |
|---|---|
| 1. Add enemy ID to `EnemyId` union | `src/lib/game-data/types.ts` |
| 2. Define entry in `enemyBestiary` array | `src/lib/game-data/compendium.ts` |
| 3. Set `enemyType` (`normal`/`elite`/`boss`) | same file |
| 4. Add traits as `{ id, title, description }` objects | same file (logic lives in battle system) |
| 5. (Optional) Register attack sound | `src/lib/sound-registry.ts` (`enemyAttackSounds`) |

---

## Add a new boon

| Step | File(s) |
|---|---|
| 1. Define entry in `boonLibrary` array | `src/lib/game-data/compendium.ts` |
| 2. Implement effect logic | `src/lib/boons.ts` — extend `BoonEffectManifest` and apply in battle init |
| 3. Add art reference | `src/lib/game-data/assets.ts` |

## Add permanent Gear

1. Add the definition ID and definition in `src/lib/gear/`, including compatible slots, effects, art, and salvage value.
2. Keep owned items as unique `GearInstance` records; never put definition objects or art URLs into save data.
3. Add effect aggregation through `getEquippedGearEffects()` and merge battle-facing bonuses during battle creation.
4. Update Gear save schemas/defaults and migration fixtures when instance or loadout shapes change.
5. Cover pure operations, persistence, reward selection, Armory interaction, and battle snapshot behavior.

---

## Add a new companion

| Step | File(s) |
|---|---|
| 1. Add companion ID to `CompanionId` union | `src/lib/game-data/types.ts` |
| 2. Add optimized art and barrel export | `src/lib/game-data/assets.ts` |
| 3. Define companion in `companionLibrary` record | `src/lib/game-data/companions.ts` |
| 4. Add summon card via `summonCompanionCard()` in `combatCards.ts` / `supportCards.ts` | `src/lib/game-data/cards/card-builders.ts` — companion must have **exactly one** `turnStartEffects` entry |
| 5. Add summon card ID to `CardId` union | `src/lib/game-data/types.ts` |
| 6. (Optional) Register card sound | `src/lib/sound-registry.ts` |
| 7. Add bond level to talent defaults (`companionBondLevels`) | `src/lib/game-data/talents/manifest-defaults.ts` |
| 8. Add bond level to homestead defaults | `src/lib/homestead/defaults.ts` |
| 9. Update description lines + tests | `tests/lib/game-data/companions.test.ts` + `tests/lib/game-data/descriptions-match-effects.test.ts` |

---

## Add a new keyword

| Step | File(s) |
|---|---|
| 1. Define keyword config (label, description, colors) | `src/lib/game-data/keywords.ts` |
| 2. Add display config if needed | `src/features/alchemy/shared/config/keywords.ts` |
| 3. Add talent XP trigger | `src/lib/game-data/talents/progression.ts` (keyword-based XP logic) |

---

## Adding a new screen

| Step | File(s) |
|---|---|
| 1. Add string to `Screen` union and `ROUTE_SCREENS` | `src/lib/routing/screens.ts` |
| 2. Create component in `run-loop/screens/` or `meta/screens/` + barrel export | `index.ts` (local screen index under that subdirectory) |
| 3. Export from screens barrel | `src/features/alchemy/shared/screens/index.ts` |
| 4. Add route handler in `meta-routes`, `run-setup-routes`, or `run-loop-routes` (wrapped in `ErrorBoundary` via registry) | `src/app/screen-routes/` |
| 5. Extend `RenderAlchemyScreenProps` / route context if new props needed | `src/app/render-screen-props.ts`, `src/app/render-alchemy-screen.tsx` |
| 6. Add callbacks to `ControllerActions` if new handlers needed | `src/app/controller-actions.ts` |
| 7. Wire navigation trigger | caller of `goToScreen("<name>")` |

---

## Adding a new destination (map node)

| Step | File(s) |
|---|---|
| 1. Add to `DESTINATIONS` const | `src/lib/routing/destinations.ts` |
| 2. Add to destination pool / availability | `src/lib/routing/destination-availability.ts` (re-exported from `features/alchemy/config/routes.ts`) |

---

## Adding a new mystery effect kind

| Step | File(s) |
|---|---|
| 1. Add `kind` string to `MysteryEffect` union | `src/lib/mystery/types.ts` |
| 2. Add `case` in `applyMysteryEffect()` switch | `src/features/alchemy/run-loop/navigation/mystery-flow.ts` (import `@/features/alchemy/run-loop/navigation/mystery-flow`) |
| 3. Add fields to `MysteryEffectContext` if needed | `mystery-flow.ts` |
| 4. Wire React hook if needed | `run-loop/navigation/use-mystery-flow.ts` |
| 5. Wire follow-up UI in mystery screen | `run-loop/screens/mystery/mystery-screen.tsx` (exported via screens barrel) |
