# Alchemy architecture

Canonical reference for run state, store layout, and boot policy. Coding rules: [AGENTS.md](../AGENTS.md). Gameplay / battle rules: [GAME_RULES.md § Battle](./GAME_RULES.md#battle-implementation-rules). How-to: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

`src/lib/` stays React-free. Feature UI lives under `src/features/alchemy/`.

## Guide index

- [Run state and persistence](./RUN_STATE.md): aggregate regions, command atomicity, RNG, save codecs, and capability ports.
- [Battle controllers](./BATTLE_CONTROLLERS.md): command props, committed playback, and navigation timing.
- Below: feature layout, run setup, shops, meta progression, import boundaries, and boot.

## Directory layout (`src/features/alchemy/`)

- **`shared/`** — `stores/`, `storage/`, `ui/`, `config/`, `context/`, `utils/`, `run-flow/`, `types.ts`
- **`meta/`** — Menu, collection, homestead, talents, armory screens
- **`run-setup/`** — Character, difficulty, draft screens
- **`run-loop/`** — Battle glue, navigation, shop, in-run screens
- **`shell/`** — Screen routing + run/battle controller composition (see navigation vocabulary below)

`shared/ui/tooltips/` owns tooltip placement, panels, and item popups; `shared/ui/inspection/` owns card and enemy inspection overlays and their grid/sorting helpers. `shared/ui/cards/` owns card rendering and selection used across screens. General shared hooks stay directly in `shared/ui/`; battle-only panels and playback visuals live under `run-loop/battle/presentation/` (`ui/` for panels and effects). Unit tests mirror these owners. Collection-only presentation lives in `meta/screens/collection/`; shop purchase and service widgets live in `run-loop/shop/ui/`. Mystery outcome badges live beside their screens in `run-loop/screens/mystery/`; Options panels, controls, and the error-log viewer live in `meta/screens/options/`. Display scaling belongs to `shared/ui/use-virtual-resolution.ts`; the general latest-value ref hook belongs to `shared/ui/use-latest-ref.ts`. Import shared UI directly from its owning module rather than a catch-all barrel.

Import lib catalogs through their eslint-enforced barrels (`@/lib/game-data`, `@/lib/battle`, `@/lib/validation`, `@/lib/content-validation`). Feature stores and screens use on-disk paths (for example `@/features/alchemy/shared/stores/run-reads`). Feature UI reads static catalogs through [`shared/config/game-data-catalog.ts`](../src/features/alchemy/shared/config/game-data-catalog.ts). Content parity helpers live under `@/lib/content-validation/card-parity` (the only sanctioned deep path: relative imports inside the package plus test deep imports, which sit outside boundary lint; every other `src/` import goes through the barrel). Naming rule for the three similarly-named lib areas: authored-content correctness (card text matches effects, catalogs are consistent) belongs in `content-validation`; persisted save shapes, normalization, and migrations belong in `validation`; mode logic (labyrinth/wildwood map generation, encounter-trait picking) belongs in `content-systems`. Tests sit outside boundary lint and may deep-import battle leaves (for example `@/lib/battle/encounter-trait-events`); `src/` must use the `@/lib/battle` barrel. The battle barrel exports the gameplay surface only — hit-pipeline staging helpers (`remapDrawnCardBenefits`, `playerStatusDelta`, `mitigatePlayerCombatDamage`, `scaleReceivedPlayerDamage`) and single-use tooling (`regrowEnemyThorns`) stay importable by relative path inside `src/lib/battle/` but are not barrel exports.

> Token-barrel exception: keep `game-data-catalog.ts` off the token `config/` barrel so layout/token imports stay catalog-free.

`shared/run-flow/` is the neutral seam for destination sampling and campaign-start helpers so `run-setup` and `run-loop` do not import each other (ESLint-enforced).

## Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

## Run setup ownership

`run-setup/run/content-system-navigation.ts` owns content-system selection,
character/difficulty routing. `run-resume-navigation.ts` owns current-run resume;
`new-run-initialization.ts` prepares new runs and drafts in commands before navigation. Run-start snapshots belong to
`run-start-command.ts`; wildcard starter-draft and novice Campaign helpers belong
to `shared/run-flow/starter-draft.ts` and `shared/run-flow/campaign-start.ts`.
Wildwood post-entry progression belongs to
`run-loop/run/wildwood-gauntlet-flow.ts`. The persisted draft/resume differences
between Campaign, Labyrinth, and Wildwood are covered by the [content-system
workflow](./WORKFLOWS.md#content-system-behavior).

The main menu offers Continue when a run is unfinished, otherwise Play. Continue delegates to `content-system-navigation.resumeRun` through route props. A requested mode cannot replace an active run. End Run in the existing red menu action cancels pending battle/navigation work, finalizes earned progression once, clears the current run, and always shows the End Run screen without confirmation; Main Menu on that recap returns to the menu. Ordinary defeat and victory retain their outcome screens. Drafting belongs to the active run; finishing its starter draft is the only supported re-application of a start snapshot. Menu/meta visits do not replace the activity's resume location. There are no parked slots or recency fields.

Destination offer construction is pure in `shared/run-flow/destination-flow.ts`.
Callers supply offer history, boss ID, and command-bound RNG; destination
generation is not exposed through the content-system navigation API.

## Battle path

The engine resolves gameplay before presentation; playback consumes committed results.

`battle/player-rewards.ts` owns the coupled player reward reactions (Health,
Mana, Gold, Block, Armor, cleanse, and defeat payouts). The base Health update
and its feedback live in `battle/player-reward-feedback.ts`; defeat healing uses
that base update without restarting the full healing reaction chain. Import
`battle/combat-text-events.ts` for text aggregation and `battle/enemy-healing.ts`
for enemy healing. Combat text is feedback, not a gameplay rule owner.

- **Card play:** UI → `useBattleController.playCard()` → `playBattleCardResolved()` → `applyCardEffects()` → new `BattleState` → store.
- **Enemy turn:** `commitEndTurn()` → `resolveBattleTurn(snapshot, context)` → committed result and XP → `playTurnFrames()` for presentation only.

`battle/card-play.ts` owns hand validation, payment, and the ordinary play sequence.
`battle/card-play-effects.ts` owns effect execution, repeated effects, and
post-effect talent and trinket rewards; both ordinary play and Dodge-triggered
automatic play use it. `battle/card-consume.ts` owns the final discard or
exhaust routing and Consume rewards. Keep the order of effect resolution,
encounter reactions, and Consume routing explicit at each caller; automatic
play does not use the ordinary payment entry point.

Direct player hits use source-specific recipes in `lib/battle/hit-resolution.ts`
and its lower `follow-up-hit-resolution.ts` tier. `hit-request.ts` carries source
intent; `hit-facts.ts` captures eligibility and Health results before nested
reactions. Attack orchestration keeps Dodge, reserved bonuses, numeric preparation,
whole-packet follow-ups, and retaliation. Card reaction stages cannot call back into
attack orchestration. The [hit-source matrix](./GAME_RULES.md#direct-player-hit-resolution)
describes the current ordering and scaling differences. Retirement of legacy
recipes follows the [save baseline](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

Controller construction, route props, and playback bindings: [Battle controllers](./BATTLE_CONTROLLERS.md#battle-path).

## Controller entry points

The [session capability reference](./RUN_STATE.md#session-capability-ports) lists controller, route, and domain entry points together. Use the [battle path](#battle-path), [shop commands](#shop-commands), and [run setup ownership](#run-setup-ownership) sections for their distinct execution contracts.

### Run loop overview

`run-loop/` splits each outcome into three layers: pure computation in
`navigation/` (`reward-flow`, `reward-offers`, `victory-flow`, `mystery-flow`, `reward-math`),
store commits in domain command modules (`reward-commands`, `victory-commands`, `destination-commands`, `progression-commands`, `wildwood-commands`, and `run-end-commands`), and
navigation plus sound in `run-flow-*.ts` shells composed by `run/run-flow.ts`.
`shell/run-flow-engine.ts` wires the factories to route actions. Reading order
for a change: `run-flow.ts` → the `run-flow-*` file for the outcome → its
`*-commands` → the `navigation/` pure function. Victory Gold is settled once in
`reward-math.ts` through `victory-flow.ts`; the saved purse and every reward
screen derive from that same settlement. `reward-flow.ts` receives the settled
Gold payout and only assembles reward states.
`reward-offers.ts` owns category eligibility, hoard guarantees, and seeded
choice sampling. It returns a typed offer without run settlement fields;
`reward-flow.ts` adds the reward state defaults, settled Gold, Materials, destinations,
and post-claim routing.

Single owners to know: `run/run-materials.ts` owns the run-earned Material grant
site inventory and end-of-run Material totals across all three modes;
`battle/autoplay-driver.ts` owns the shared autoplay / auto-end-turn gate
(`isBattlePlaybackBlocked`, `usePlaybackBlocked`); `battle/playback-lifetime.ts`
owns explicit playback phases, binding readiness, cancellation, timers, transfers, and draw counts.
`battle/draw-sequence.ts` keeps only per-deps animated-draw counts for transfer UI.
`battle/battle-session.ts` adapts that lifetime to presentation and delegates turn
commit to `shared/stores/battle-commands.ts`; legacy recovery stays inside `shared/stores/battle-restore.ts`. Battle start
uses `shared/stores/battle-start-commands.ts` and then arms presentation. Fight feedback (floating numbers + shake + sound) is
unified in `presentCombatTexts` in `battle/controller-utils.ts`; card overlay
layers live beside their leaves (`card-ghost-overlay.tsx`,
`card-transfer-overlay.tsx`).

## Shop commands

`create-shop-actions.ts` composes the matching `*-shop-commands.ts` modules;
`shop-commands-core.ts` owns shared purchase and live refresh-price helpers.
Pure shelf samplers live in `shop-state-init.ts`, and draft recipes in
`shop-transactions.ts`. `runShopTransaction` / `commitShopInitialize` own dispatch:
payment, benefits, and visit changes commit together, and stale commands for
another shop are rejected. Gear writes inside that transaction follow
[Armory write paths](./ARMORY.md#write-paths).

Only the active visit is encoded by `encodePersistedShops`; presentation
navigation does not select the shelf to save. Kind `"merchant"` is the
player-facing **Card Shop**. For the editing sequence, refresh behavior, typed
shelf assignment, and modifier ordering, follow
[Change a shop](./WORKFLOWS.md#change-a-shop).

## Settings and meta profile

- `settings-store` owns synchronized display, audio, and gameplay preferences. It does not contain gameplay progression.
- `device-display-store` owns Game Size and Tooltip Size. Its storage seam writes a versioned device-local record, outside the settings save codec and Steam Cloud. Defaults load synchronously before layout; unavailable storage falls back to in-memory preferences. Options receives values and actions through its route props.
- `lib/settings-values.ts` owns the shared value sets and numeric bounds consumed by save validation, Options, audio,
  and the desktop bridge; the settings codec still owns defaults, encoding, and hydration.

Gameplay progression remains in the [aggregate regions](./RUN_STATE.md#run-state); persistence follows the [codec contract](./RUN_STATE.md#persistence-api). Run reward finalization uses the write module and `run-lifecycle.ts` (`finalizeRunXP`, `awardMaterialsDuringRun` — see [grant materials](./RUN_WORKFLOWS.md#grant-materials-during-a-run)), never the discovery-only profile region. `error-log-store.ts` is a standalone local-only error buffer (own storage key, debounced persist); `shared/stores/reset.ts` owns the Options wipe (distinct from the audio test reset in `src/lib/audio/reset.ts`). Both sit outside the gameplay aggregate and its save codecs.

## Permanent Gear (`gear-store`)

Owned Gear and per-character loadouts live in `shared/stores/gear-store.ts`. Pure rules live under `src/lib/gear/`; per-command draft views and health-sync wrappers live in `gear-session-command.ts` (`GearDraftView`, explicit write tracking — no snapshot comparison). `createInitialGearState` lives in `gear-actions.ts` beside the other pure draft mutators. Gear is meta progression, not copied into active-run data; battle snapshots `BattleState.gearEffects` and live meta mutations rebind via `rebindLiveRunMeta`. Feature code reads through `gear-store.ts`. Screen, mutations, and HP-sync: [ARMORY.md](./ARMORY.md). Authoring new items: [WORKFLOWS § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Types

`GameplayState` in `gameplay-state-store.ts` defines the [aggregate regions](./RUN_STATE.md#run-state). Read, write, command, and screen contracts are listed in the [capability reference](./RUN_STATE.md#session-capability-ports); persistence types are in the [codec contract](./RUN_STATE.md#persistence-api).

Initial progress and permanent fields, `ACTIVE_RUN_PROGRESS_KEYS`, `generateRunSeed`, and `pickActiveRunView` live in `run-state-init.ts`; `run-domain-types.ts` defines session, battle, and run-data fields. `profile-store-types.ts` owns its domain (completion buckets derived from the character registry); `gear-actions.ts` owns the initial gear state. Fresh-run snapshots live in `shared/run-flow/run-start.ts`. Shared numeric manifest defaults use `createNumericManifest` / `mergeNumericManifests` from `manifest-utils.ts`.

## Import boundaries

Enforced in `eslint.config.js` (composition in `eslint/fragments.js` + `eslint/boundaries.js`) and double-checked by `npm run lint:boundaries` (dependency-cruiser, except barrel deep-import bans which are eslint-only). Phase bans and flat-config stacking order live in those files; `npm run lint:architecture-smoke` (`scripts/lint-architecture-smoke.mjs`) asserts effective `no-restricted-imports` policies on representative files. Summary:

- `src/lib/**` must not import `@/features/**`
- Source modules must remain acyclic; reusable battle rules and reactions live below turn/card orchestrators
- `gameplay-state-store.ts` is internal to `shared/stores/`; other layers use capability hooks, reads, writes, commands, and `run-lifecycle`
- Feature adapters import reads, lifecycle operations, and intent-level commands. Draft dispatch and `run-session-write-port` belong to command owners, not shell or playback wiring.
- Screens must not import `run-loop/battle` or `run-loop/navigation` orchestration (screens may import `run-loop/battle/presentation/` leaves)
- `run-setup` ↛ `run-loop` and `run-loop` ↛ `run-setup` (shared helpers in `shared/run-flow/`)
- `meta` ↛ `run-loop` / `run-setup`

## Boot and loading

- **Shell preload / autosave:** App warms `essentialGameArt` before reveal and starts the remaining per-item Gear art as soon as that essential preload settles; autosave and chrome read needed fields through capability modules. Sound warming follows the [audio runtime contract](./AUDIO.md#runtime-contract); it does not gate startup on successful playback or decoding.

One loading experience at cold start, then navigation through the shared fade — no per-route "Loading …" fallbacks. Route and in-screen reveals hold the fade until mounted artwork has decoded; see [UI](./UI_MOTION.md#screen-fade-motion).

| Layer     | Where                                                                          | Policy                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Images    | `essentialGameArt` in `assets.ts` (subset of the static `allGameArt` manifest) | Decoded in bounded batches (`IMAGE_PRELOAD_BATCH_SIZE`, `preloadImagesInBatches`) before reveal; per-image counts drive the startup bar |
| Fonts     | `use-initial-load-ready.ts`                                                    | Ready with images before reveal                                                                                                         |
| Save      | `use-alchemy-bootstrap.ts`                                                     | Hydrated before reveal; included in startup bar target                                                                                  |
| Screen JS | `src/app/screen-routes/`                                                       | Static imports — **no** `React.lazy()`                                                                                                  |
| SFX       | `use-app-effects.ts`                                                           | Critical sounds eager; rest on idle                                                                                                     |

`StartupLoadingScreen` shows the wordmark filling left to right with the CTA gold (`text-primary`) over the 3s minimum display, rotating loading phrases below (`startup-loading-screen.tsx`) — no progress bar. The determinate readout lives on as the screen's `progressbar` ARIA value, still a smoothed meter of art decode, fonts, and save bootstrap (`startup-bar-progress.ts`) — not a timed CSS fill. `startup-load-state.ts` owns the reveal decision; `use-initial-load-ready.ts` supplies browser preload, font, timer, and animation-frame events. Reveal waits until that work has settled, the 3s minimum display has elapsed, **and** the eased display has caught 100%. A rejected essential art preload is logged and treated as settled so startup can continue. Deferred per-item gear art starts decoding as soon as essential art settles so it overlaps the minimum window, continuing in the background after reveal if unfinished. The pre-React `index.html` track uses an indeterminate gold comet (no progress, no header) until React mounts.

**Do not add:** `React.lazy()` on route screens; lazy game art; per-screen spinners for assets in `allGameArt`.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only (`shouldSkipStartupLoadingGate()`).

Path-specific test commands: [CONTRIBUTING.md § What to run](../CONTRIBUTING.md#what-to-run-when-you-change).

Manual End Run clears resumable activity and pending work immediately, but keeps
the final battle snapshot available to the outgoing screen until the route
transition completes. Clearing it to default enemy/card data early can render
invalid artwork during the exit frame. The inactive activity excludes the
snapshot from saves, and the next run/battle initializes fresh state.

## Headless playthrough tooling

The [playthrough runner](./PLAYTHROUGH_SIMULATION.md) lives in `src/app/playthrough/` and is loaded only by Node tooling. It composes feature read ports and production action flows, with isolated processes per career. Production battle start/card/Wish and autosave operations are shared with the UI; the harness owns policy, evidence, and assertions. It must not implement game rules or mutate the gameplay aggregate directly.

`actor.ts` routes each observation to `meta-offers.ts` or `run-offers.ts` after constructing the production controller. `choice-catalog.ts` owns recorded choice identities and their executable commands for the current observation; duplicate identities fail instead of replacing a command. Offer builders score and register legal choices but do not commit gameplay until the selected choice executes.

Run outcomes and navigation share one construction owner: `createRunOutcomes`
captures the destination sampler and exposes `connect(actions)`. Both UI and
headless shells connect navigation to that owner; neither can supply a second
sampler for progression. Hover-clearing navigation is wrapped once in the shell.
