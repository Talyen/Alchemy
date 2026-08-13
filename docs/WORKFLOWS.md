# Alchemy — Implementation Workflows

Step-by-step checklists for adding or changing game content and wiring.

For refactors and simplification passes on attached paths, use [docs/Audits](./Audits/README.md) when the user cites an audit.

**Docs:** [AGENTS.md](../AGENTS.md) (rules) · [ARCHITECTURE.md](./ARCHITECTURE.md) (run state) · [REFERENCE.md](./REFERENCE.md) (commands, glossary, battle) · [CONTRIBUTING.md](../CONTRIBUTING.md) (hooks & tests) · [Audits](./Audits/README.md) (code-quality audits)

**Import paths:** only `@/*` → `src/*` in `tsconfig.json`. Use **on-disk** capability paths under `src/features/alchemy/` (for example `@/features/alchemy/shared/stores/run-session-read-port`) — not legacy alias paths that skip `shared/`.

## Task index

| Task                                          | Section                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Raw asset / art                               | [Assets](#assets)                                                                                                                                                  |
| Save schema / migration                       | [Persisted save data](#change-persisted-save-data)                                                                                                                 |
| Mid-run resume                                | [Active run data](#change-mid-run-resume-activerundata)                                                                                                            |
| Post-victory routing                          | [REWARD_ROUTES](#add-or-change-post-victory-routing-reward_routes)                                                                                                 |
| Run teardown / clear save                     | [Run teardown](#run-teardown)                                                                                                                                      |
| Status effect                                 | [New status](#add-a-new-status-effect)                                                                                                                             |
| Card / card effect kind                       | [New card](#add-a-new-card) · [New effect kind](#add-a-new-card-effect-kind)                                                                                       |
| Character, enemy, trinket, companion, keyword | [Character](#add-a-new-character) · [Enemy](#add-a-new-enemy) · [Trinket](#add-a-new-trinket) · [Companion](#add-a-new-companion) · [Keyword](#add-a-new-keyword)  |
| Talent / homestead upgrade                    | [Talent](#add-a-new-talent) · [Homestead upgrade](#add-a-homestead-upgrade)                                                                                        |
| Permanent gear                                | [Gear](#add-permanent-gear)                                                                                                                                        |
| Screen, destination, mystery                  | [New screen](#adding-a-new-screen) · [Destination](#adding-a-new-destination-map-node) · [Mystery effect](#adding-a-new-mystery-effect-kind)                       |
| In-run materials, screen fade                 | [Grant materials during a run](#grant-materials-during-a-run) · [Screen fade motion](#screen-fade-motion) · [Interactive buttons](#interactive-button-conventions) |
| Tooltips                                      | [Hover tooltips](#hover-tooltips)                                                                                                                                  |
| Gameplay session mutation                     | [Gameplay command boundary](#gameplay-command-boundary)                                                                                                            |

---

## Assets

**Add a new raw asset:** register it in `scripts/assets/` (core/content/card manifests) → `npm run assets:optimize` (or `node scripts/prepare-assets.mjs`) → import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`. `sync:assets` regenerates `assets.generated.ts` from the art manifest targets.

**Gear art:** place files in `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg` → `npm run assets:optimize` → `npm run sync:gear-art` (regenerates `src/lib/game-data/gear-art.ts`). `predev` / `prebuild` run the full pipeline via `scripts/prepare-assets.mjs`: the art, sound, and music optimizers run concurrently (disjoint output dirs), then `sync:assets` + `sync:gear-art` regenerate the barrels from the art manifest. Set `ALCHEMY_SKIP_ASSETS=1` to skip that prep (CI/Vercel/release use this; commit regenerated outputs when you change sources).

---

## Change persisted save data

Policy (when to bump, stamp-only floor, migrate steps, public save contract): [`MIGRATIONS.md`](../src/features/alchemy/shared/storage/MIGRATIONS.md).

1. Decide bump vs safe additive default using that contract — do not add a `migrateVNToVNPlus1` step for stamp-only or defaulted additive fields.
2. Follow the Required pattern in `MIGRATIONS.md` (version stamp, transform step only when needed, Zod/defaults/fixtures, CI guards).
3. Verify with the save-migration tests named there (`npm run check:ship` covers the production parse path).

---

## Change mid-run resume (`ActiveRunData`)

1. Extend `ActiveRunData` in `src/lib/active-run-session/types.ts` and Zod schema in `src/lib/validation/save-schemas/active-run.ts` (optional fields with defaults in `normalize-active-run-data.ts` often avoid a schema bump). Mid-combat wire shape goes through `PersistedBattleStateSchema` in `save-schemas/persisted-battle-state.ts`.
2. Add the field to `ActiveRunProgressFields` / hydration in `src/features/alchemy/shared/stores/run-state-init.ts` (mirror `runTalentXP` / `runMaterialsEarned` pattern) when it is active-run progression. Transient resume fields belong in the codec projection instead of the run-domain types. The flat `RunStateFields` patch type is test-only now — if a test needs it, add the key to `tests/helpers/run-domain-store-test.ts`.
3. Update `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()` in `src/features/alchemy/shared/stores/run-resume-codec.ts` — the codec is the sole `RunSession` → `ActiveRunData` translator. Progress fields spread from the aggregate via `pickActiveRunFields`; do not re-list them. `normalize-active-run-data.ts` keeps the decode-time content-system guards in sync.
4. Keep `snapshotRun()` and `restoreRun()` as thin lifecycle wrappers around `encodeRunResumeSnapshot()` / `decodeRunResumeSnapshot()`. `restore-active-run-session.ts` should only apply the decoded session fields. Default trinket-manifest repair for mid-combat resume runs in `restoreRun` via `repairPersistedBattleTrinketManifest` (not Zod). Keep the operation inside `dispatchRunSessionCommand()` so boot/resume is published as one aggregate commit; defer navigation, audio, and presentation work with `afterCommit` or after the command returns.
5. Run `tests/features/alchemy/shared/storage/active-run.test.ts`, `tests/features/alchemy/shared/stores/run-domain.test.ts` (snapshot parity), the codec / pending-reward tests, plus storage/migration tests.

**Active-run helpers (do not confuse):**

| Function                 | Module                                                                       | When                                                         |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `normalizeActiveRunData` | `@/lib/validation`                                                           | Zod transform: health clamp + content-system field isolation |
| `parseActiveRun`         | `@/lib/active-run-session` or `@/features/alchemy/shared/storage/active-run` | Runtime validation before hydration                          |
| `toActiveRunData`        | `@/lib/active-run-session` (`parse.ts`)                                      | Card hydrate after Zod parse (also used by save IO)          |

---

## Grant materials during a run

Player-earned materials must flow through `awardMaterialsDuringRun()` (`run-session-write-port.ts`) so homestead inventory and `activeRun.runMaterialsEarned` stay aligned for the run-end summary.

| Step                                                       | File(s)                                                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Call `awardMaterialsDuringRun(materials)`               | Mystery handlers: `run-loop/navigation/use-mystery-flow.ts`; combat: `run-loop/run/run-flow-handlers.ts` (`finishRewards`, `commitVictoryRewards` via `addHomesteadMaterials` callback)             |
| 2. Apply homestead find bonus when appropriate             | `applyMaterialFindBonus()` from `@/lib/homestead/loot` before awarding (mystery/combat already do this)                                                                                             |
| 3. Run-end display (no change needed if step 1 is correct) | `run-flow-handlers.awardRunEndMaterials` in `run-loop/run/run-flow-handlers.ts` merges `runMaterialsEarned` + `applyEndOfRunHomesteadBonuses` into the aggregate session region's `runEndMaterials` |
| 4. Tests                                                   | `tests/features/alchemy/run-loop/run/run-victory-handlers.test.ts`; mystery/reward-flow tests if adding a new source                                                                                |

**Do not** call `addMaterials()` on the run profile store directly from run-loop or mystery code for player loot.

---

## Screen fade motion

| Step                  | Guidance                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Route change       | `useRenderedScreenTransition` fades the page wrapper out, swaps the screen at opacity 0, then fades in. Opacity only — no translate. Tokens: `--motion-fade-duration` / `MOTION_FADE_MS` / `PAGE_EXIT_MS`.                                                                                                                                                                                                             |
| 2. In-screen identity | `<FadeSlot swapKey={...}>` for any in-screen identity swap (tabs, shop modes, offerings, keyword trees). First mount is idle so it does not stack on the route fade.                                                                                                                                                                                                                                                   |
| 3. Overlays           | Dialogs, wish, and game menu use `useFadePresence` so they fade out before unmount.                                                                                                                                                                                                                                                                                                                                    |
| 4. Copy               | `ScreenDescription` is static. Word-by-word `TextAnimate` is mystery narrative only.                                                                                                                                                                                                                                                                                                                                   |
| 5. Anti-flash         | Swap layout only while opacity is 0. `FadeSlot` holds wrapper `className` until then. Identity swaps that change subtree shape (tabs, shop modes, mystery phases, talent keywords) use `FadeSlot` plus reserved min-height. Collection uses inner `grid-rows-2` + aspect fillers + slot `min-h`. Routes must not `return null` for a missing payload — hold the last view or keep screen chrome. Do not stagger items. |

Motion tokens live in `src/styles/theme.css` and `src/styles/components.css`. Hover/tap rules: [Interactive button conventions](#interactive-button-conventions).

---

## Interactive button conventions

Tokens live in `src/features/alchemy/shared/config/button-tokens.ts`. Use shared components before hand-rolling styles.

| Concern         | Standard                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Shape           | `rounded-xl` rectangles (`BUTTON_SHAPE`)                                                                            |
| Primary CTA     | `Button variant="primary"` (gold fill) — Play, Continue, Confirm                                                    |
| Secondary CTA   | `Button variant="outline"` — Back, Cancel, Skip, alternate menu nav                                                 |
| Neutral surface | `bg-background` + `border-border/80` — outline, `ChoiceButton`, `TabBar`, talent filters (`BUTTON_SURFACE_NEUTRAL`) |
| Accent CTA      | `ShineAccentButton` — corruption forward actions with shine border                                                  |
| Paired footers  | `ActionButtonRow` — secondary left, primary right                                                                   |
| Equal choices   | `ChoiceButton` — destinations, neutral surface + accent text                                                        |
| Tabs            | `TabBar` — `h-11`, `rounded-xl`                                                                                     |
| Hover           | Sound + CSS brightness/background lift (no scale); see `src/lib/ui/button-hover.ts`                                 |
| Press           | CSS `active:brightness-95`                                                                                          |
| Width tiers     | `menu` → `w-56`, `dialog` → `w-40`, `action` → `min-w-40`, `full` → `w-full`                                        |

| Step               | Guidance                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| 1. Menu stack      | One `primary` at top (Play); all other items `outline` + `BUTTON_WIDTH_MENU` |
| 2. Back + Continue | `ActionButtonRow` with `width="dialog"`                                      |
| 3. Skip + confirm  | `ActionButtonRow` with `width="action"`; skip secondary, confirm primary     |
| 4. Destinations    | `ChoiceButton` via `DestinationChoices`; accent text only on neutral surface |
| 5. Shine           | Only on accent-intent forward actions — never Back/Cancel/Skip               |

---

## Hover tooltips

Every hover tooltip renders in the root-space `#tooltip-root` overlay (registered
in `App.tsx`) at constant CSS-pixel scale, so it never shrinks with the vr-stage
transform and cannot be clipped by `overflow-hidden` ancestors. Clip/placement
bounds are `[data-testid="vr-stage"]` (fallback: `documentElement`), not the raw
browser window. Prefer above; flip below when the tooltip would clip the stage top;
place beside the trigger when neither vertical gutter fits (prefer the roomier
side, then flip/clamp). Explicit `side-start` / `side-end` still anchor beside
the trigger (locked menu items).

Build tooltips with `PortaledTooltip` (`src/features/alchemy/shared/ui/portaled-tooltip.tsx`):

| Need                         | Prop / helper                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Basic hover tooltip          | `triggerRef` + `visible`; drive hover with `useHoverVisible()` (`use-hover-visible.ts`) |
| Placement beside the trigger | `placement="side-start"` / `"side-end"` (flips to the other side when clipped)          |
| Small-window guard           | `maxWidthFraction` — cap against a fraction of the vr-stage width                       |

Panels are `pointer-events-none`; visibility follows the trigger only. Nested
keyword tooltips inside a panel are not supported. State-driven triggers (mount
on hover) render `PortaledTooltip` only while hovered; CSS-hover converts use
`useHoverVisible()` and always mount, letting `PortaledTooltip` keep the panel
mounted through a short fade-out.

`EnemyTooltip`, `GearTooltipPortal`, `DetailPopup`, and `GearDetailPopup` wrap
`PortaledTooltip` with their own content. Placement helpers live in
`src/features/alchemy/shared/ui/portaled-tooltip-placement.ts`; content slots
(`TooltipHeader` / `TooltipBody` / `TooltipSection`) live in `tooltip-panel.tsx`.

---

## Add or change post-victory routing (`REWARD_ROUTES`)

| Step                           | File(s)                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add route constant          | `src/features/alchemy/shared/types.ts` → `REWARD_ROUTES`, exported via `CONSTANTS`                                                                       |
| 2. Compute route after rewards | `src/features/alchemy/run-loop/navigation/reward-flow.ts` (`finalizeRewardState` / related; import `@/features/alchemy/run-loop/navigation/reward-flow`) |
| 3. Handle transition           | `reward-flow.ts` (`executeRewardRouteTransition`) and/or `shell/use-run-flow-engine.ts`                                                                  |
| 4. Tests                       | `tests/features/alchemy/run-loop/navigation/reward-flow.test.ts`; victory-flow tests if end-of-run                                                       |

---

## Run teardown

`src/features/alchemy/shared/stores/reset.ts` (import `@/features/alchemy/shared/stores/reset`):

- `teardownRun()` / `flushSaveAfterRunEnd()` in [`run-transitions.ts`](../src/features/alchemy/shared/stores/run-transitions.ts) — run teardown and immediate save flushes (navigation calls these on run end).
- `clearAllPersistentGameData()` — clears app options, permanent run/talent data, and homestead (Options “clear save”).

## Gameplay command boundary

Gameplay code mutates run state through `dispatchRunSessionCommand()` from `run-session-command.ts`. Ownership and anti-patterns: [ARCHITECTURE.md](./ARCHITECTURE.md).

1. Keep the command synchronous; do not cross an `await` while mutating run state.
2. Put audio, navigation, timers, and presentation cleanup in `afterCommit` so failed commands cannot leak non-rollbackable effects.
3. Pass the draft to every gameplay mutator. Use the object form when a result is needed by the post-commit effect:

   ```ts
   dispatchRunSessionCommand({
     execute: (draft) => {
       setRunGold(draft, (gold) => gold + price);
       return price;
     },
     afterCommit: (paid) => playPurchaseSound(paid),
   });
   ```

4. If an async battle flow persists an intermediate state, commit `activeCombat.pendingBattleTransition` with it and add a boot resume path. Presentation timers alone are not a gameplay continuation.

---

## Add a new status effect

1. Define the status type in `src/lib/game-data/types.ts` — extend `PlayerStatusId` or `EnemyStatusId` string unions (discriminated union pattern).
2. Add tick logic in `src/lib/battle/status-ticks.ts`
3. Add player-side application logic in `src/lib/battle/status-player.ts`; add damage-type status riders in `src/lib/battle/damage-status-riders.ts`
4. Add CC threshold logic in `src/lib/battle/status-cc.ts`
5. Add matching keyword in `src/lib/game-data/keywords.ts`
6. Cover through `tests/lib/battle/status-*.test.ts` tests

---

## Add a new card

| Step                                                                      | File(s)                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Define card in the appropriate library array                           | `src/lib/game-data/cards/library/{core-cards,specialty-cards,advanced-cards}.ts` |
| 2. Add effects (discriminated union on `kind`)                            | same card entry, `effects: [...]`                                                |
| 3. Add art reference                                                      | `src/lib/game-data/assets.ts` (or `placeholderCard` while WIP)                   |
| 4. (Optional) Register card sound                                         | `src/lib/sound-registry.ts` (`cardSounds` record)                                |
| 5. Update `descriptionLines` to match effects                             | same card entry                                                                  |
| 6. Cover through `tests/lib/game-data/descriptions-match-effects.test.ts` |                                                                                  |

Cards in `cardLibrary` are automatically included in merchant shop, combat rewards, mysteries, wish, and draft via `getOfferableCardPool()` — no separate pool registration. Exclude a card with `excludeFromOfferPool: true` (`mixed-potion` is the current example).

---

## Add a new card effect `kind`

| Step                                                                         | File(s)                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Add to `BattleCardEffect` union                                           | `src/lib/game-data/types.ts`                                                              |
| 2. Add an `EffectKindDefinition` to the matching grouped `*-schemas.ts` file | `src/lib/game-data/effects/`                                                              |
| 3. Register non-recursive kinds in `TEMPLATE_EFFECT_DEFINITIONS`             | `src/lib/game-data/effects/template-definitions.ts`                                       |
| 4. Add `kind` to `BATTLE_CARD_EFFECT_KINDS`                                  | `src/lib/game-data/effects/kinds.ts`                                                      |
| 5. Register the runtime handler in `EFFECT_APPLY_BY_KIND`                    | `src/lib/battle/effect-handlers/` — see `src/lib/game-data/effects/BATTLE_HANDLERS.md`    |
| 6. Update effect metadata used for descriptions/keywords                     | `src/lib/game-data/effect-metadata.ts`                                                    |
| 7. Tests                                                                     | `tests/lib/battle/apply-effects*.test.ts`, `tests/lib/game-data/effects-registry.test.ts` |

`chance` and `repeat-over-turns` are the recursive exceptions: their schema factories live in `recursive-definition.ts` and dispatch handles them before the non-recursive registry.

---

## Add a new character

| Step                                                            | File(s)                           |
| --------------------------------------------------------------- | --------------------------------- |
| 1. Add character ID to `CharacterId` union                      | `src/lib/game-data/types.ts`      |
| 2. Define character in `characters` record                      | `src/lib/game-data/characters.ts` |
| 3. List card IDs in `startingDeck` (resolved via `resolveDeck`) | same file                         |

---

## Add a new enemy

| Step                                                  | File(s)                                           |
| ----------------------------------------------------- | ------------------------------------------------- |
| 1. Add enemy ID to `EnemyId` union                    | `src/lib/game-data/types.ts`                      |
| 2. Define entry in `enemyBestiary` array              | `src/lib/game-data/compendium/enemies.ts`         |
| 3. Set `enemyType` (`normal`/`elite`/`boss`)          | same file                                         |
| 4. Add traits as `{ id, title, description }` objects | same file (logic lives in battle system)          |
| 5. (Optional) Register attack sound                   | `src/lib/sound-registry.ts` (`enemyAttackSounds`) |

---

## Add a new trinket

| Step                                      | File(s)                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| 1. Define entry in `trinketLibrary` array | `src/lib/game-data/compendium/trinkets.ts`                                |
| 2. Implement effect logic                 | `src/lib/trinkets.ts` — extend `TrinketManifest` and apply in battle init |
| 3. Add art reference                      | `src/lib/game-data/assets.ts`                                             |

## Add permanent Gear

1. Add base item metadata in `src/lib/gear/base-items.ts` (slots, two-hand rule, affinity keywords, available rarities, salvage).
2. Register raw art as `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg`; run `npm run assets:optimize` then `npm run sync:gear-art` to emit `gear-{slug}-{rarity}.webp` mappings in `src/lib/game-data/gear-art.ts`.
3. Variant definitions are built automatically in `src/lib/gear/definitions.ts` as `{baseItemId}-{rarity}`.
4. Add new affix definitions in `src/lib/gear/affix-catalog.ts` with a stable ID, `keywordId`, effect key, value range, and eligible slots. Display/roll helpers live in `affixes.ts`.
5. Reward generation rolls instances in `src/lib/gear/generation.ts`; rewards screen stores the exact `GearInstance` (never re-roll on accept). Mid-reward campaign/labyrinth progress is persisted in `activeRun.interruptedFlow` (`primary-reward` / `companion-reward` arms; gear stores full instances; cards/trinkets store choice ids).
6. Keep owned items as unique `GearInstance` records with `affixes: GearAffixRoll[]`; never put definition objects or art URLs into save data.
7. Battle applies aggregated `gearEffects` from `computeGearManifest()` during battle creation.
8. Keep each affix's `keywordId` aligned with affinity weighting and its `effectKey` aligned with `GEAR_EFFECT_KEYS`; architecture tests enforce registry coverage.
9. Update Gear save schemas/defaults and migration fixtures when instance or loadout shapes change.
10. Cover pure operations, generation, persistence, reward selection, Armory interaction, and battle snapshot behavior.

---

## Add a new companion

| Step                                                                                           | File(s)                                                                                                   |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1. Add companion ID to `CompanionId` union                                                     | `src/lib/game-data/types.ts`                                                                              |
| 2. Add optimized art and barrel export                                                         | `src/lib/game-data/assets.ts`                                                                             |
| 3. Define companion in `companionLibrary` record                                               | `src/lib/game-data/companions.ts`                                                                         |
| 4. Add summon card via `summonCompanionCard()` in `cardLibrary` (`src/lib/game-data/cards.ts`) | `src/lib/game-data/cards/card-builders.ts` — companion must have **exactly one** `turnStartEffects` entry |
| 5. Add summon card ID to `CardId` union                                                        | `src/lib/game-data/types.ts`                                                                              |
| 6. (Optional) Register card sound                                                              | `src/lib/sound-registry.ts`                                                                               |
| 7. Add bond level to talent defaults (`companionBondLevels`)                                   | `src/lib/game-data/talents/manifest-defaults.ts`                                                          |
| 8. Add bond level to homestead defaults                                                        | `src/lib/homestead/defaults.ts`                                                                           |
| 9. Update description lines + tests                                                            | `tests/lib/game-data/companions.test.ts` + `tests/lib/game-data/descriptions-match-effects.test.ts`       |

---

## Add a new talent

| Step                                                                 | File(s)                                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Add effect field if the talent needs a new battle bonus           | `src/lib/game-data/talent-effect-manifest.ts` + default in `talents/manifest-defaults.ts`      |
| 2. Define the talent (`id`, `keywordId`, name, description, effects) | matching `src/lib/game-data/talents/pool/{keyword}.ts` — already spread into `talentPool`      |
| 3. XP is keyword-based                                               | `src/lib/game-data/talents/progression.ts` — no per-talent XP hook unless the keyword is new   |
| 4. Tests                                                             | `tests/lib/game-data/talent-pool.test.ts`, `tests/lib/game-data/talents-match-effects.test.ts` |

New keywords still follow [Add a new keyword](#add-a-new-keyword) first.

## Add a homestead upgrade

| Step                                                                       | File(s)                                                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Add `BuildingId` / `FarmId` / `ResearchId`                              | `src/lib/homestead/types.ts`                                                                   |
| 2. Define the item with `defineBuilding` / `defineFarm` / `defineResearch` | `src/lib/homestead/data.ts` (costs via `data-builders.ts` / `costs.ts`)                        |
| 3. New battle or meta effect keys                                          | `HomesteadEffectManifest` + `HOMESTEAD_BATTLE_*_KEYS` in `types.ts`; defaults in `defaults.ts` |
| 4. Tests                                                                   | `tests/lib/homestead.test.ts`, `tests/lib/homestead/tiers.test.ts`                             |

## Add a new keyword

| Step                                                  | File(s)                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Define keyword config (label, description, colors) | `src/lib/game-data/keywords.ts`                                     |
| 2. Add display config if needed                       | `src/features/alchemy/shared/config/keywords.ts`                    |
| 3. Add talent XP trigger                              | `src/lib/game-data/talents/progression.ts` (keyword-based XP logic) |

---

## Adding a new screen

| Step                                                                                                                      | File(s)                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add string to `Screen` union and `ROUTE_SCREENS`                                                                       | `src/lib/routing/screens.ts`                                                                                                                                                                                                                                                                                                                         |
| 2. Classify the screen and add every legal interactive edge                                                               | `run-screen-router.ts`, `screen-transition-policy.ts`                                                                                                                                                                                                                                                                                                |
| 3. Create component in `run-loop/screens/`, `run-setup/screens/`, or `meta/screens/` + barrel export                      | `index.ts` (local screen index under that subdirectory)                                                                                                                                                                                                                                                                                              |
| 4. Wrap in `TitledScreenShell` (`PageLayout` + `ScreenShell` + header-row hamburger) and pass `onOpenMenu` from the route | `layout-components.tsx`; exceptions: Main Menu (unshelled) and Battle (existing combat shell). Art-heavy 3-up landscape chooser rows pass `chooserRowShellWidthClass` / `chooserArtWidthClass` from `layout.ts`; 4-up portrait choosers pass `chooserHeroRowShellWidthClass` / `chooserHeroArtWidthClass` so the shell ceiling fits intrinsic tiles. |
| 5. Wire route handler in the matching phase table (`meta-routes`, `run-setup-routes`, `run-loop-routes`, …)               | `src/app/screen-routes/`                                                                                                                                                                                                                                                                                                                             |
| 6. Extend phase route ctx / `RenderAlchemyScreenProps` if new props are needed                                            | `src/app/screen-routes/route-ctx.ts`, `src/app/screen-routes/index.tsx`                                                                                                                                                                                                                                                                              |
| 7. Wire navigation trigger                                                                                                | caller of `goToScreen("<name>")`                                                                                                                                                                                                                                                                                                                     |
| 8. Cover taxonomy, allowed/rejected transitions, and route rendering                                                      | `tests/lib/routing/`, `tests/features/alchemy/shell/`, route component tests                                                                                                                                                                                                                                                                         |

Boot restore/hydration sets a validated saved screen directly and intentionally bypasses the interactive transition table.

---

## Adding a new destination (map node)

| Step                                      | File(s)                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add to `DESTINATIONS` const            | `src/lib/routing/destinations.ts`                                                                                                  |
| 2. Add to destination pool / availability | `src/lib/routing/destination-availability.ts`                                                                                      |
| 3. Offer construction (pure)              | `shared/run-flow/destination-flow.ts` — campaign start and run-loop progression pass offer history, boss ID, and command-bound RNG |

---

## Adding a new mystery effect kind

| Step                                              | File(s)                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1. Add `kind` string to `MysteryEffect` union     | `src/lib/mystery/types.ts`                                                                                                |
| 2. Add `case` in `applyMysteryEffect()` switch    | `src/features/alchemy/run-loop/navigation/mystery-flow.ts` (import `@/features/alchemy/run-loop/navigation/mystery-flow`) |
| 3. Add fields to `MysteryEffectContext` if needed | `mystery-flow.ts`                                                                                                         |
| 4. Wire React hook if needed                      | `run-loop/navigation/use-mystery-flow.ts`                                                                                 |
| 5. Wire follow-up UI in mystery screen            | `run-loop/screens/mystery/mystery-screen.tsx` (exported via screens barrel)                                               |
