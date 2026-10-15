# Alchemy architecture

Canonical reference for run state, store layout, and boot policy. Coding rules: [AGENTS.md](../AGENTS.md). Gameplay / battle rules: [GAME_RULES.md § Battle](./GAME_RULES.md#battle-implementation-rules). How-to: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

`src/lib/` stays React-free. Feature UI lives under `src/features/alchemy/`.

## Guide index

- [Steam demo edition](./STEAM_DEMO.md): build identity, command/resume restrictions and automatic progress transfer.

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

Import lib catalogs through their Oxlint-enforced barrels (`@/lib/game-data`, `@/lib/battle`, `@/lib/validation`, `@/lib/content-validation`). Feature stores and screens use on-disk paths (for example `@/features/alchemy/shared/stores/run-reads`). Feature UI reads static catalogs through [`shared/config/game-data-catalog.ts`](../src/features/alchemy/shared/config/game-data-catalog.ts). Content parity helpers live under `@/lib/content-validation/card-parity` (the only sanctioned deep path: relative imports inside the package plus test deep imports, which sit outside boundary lint; every other `src/` import goes through the barrel). Naming rule for the three similarly-named lib areas: authored-content correctness (card text matches effects, catalogs are consistent) belongs in `content-validation`; persisted save shapes, normalization, and migrations belong in `validation`; mode logic (labyrinth/wildwood map generation, encounter-trait picking) belongs in `content-systems`. Tests sit outside boundary lint and may deep-import battle leaves (for example `@/lib/battle/encounter-trait-events`); `src/` must use the `@/lib/battle` barrel. Battle state contracts (`battle/types.ts` and `battle/types/state-types.ts`) are type-only; they cannot import or re-export executable rules. Internal callers import mechanics from their owners: `health-state.ts` for Health, healing and death prevention; `status-state.ts` for status writes; `enemy-mitigation-state.ts` for enemy defenses; `encounter-trait-state.ts` for immutable trait lookups; `resource-state.ts` for Mana and Gold; and `damage-modifiers.ts` for damage scaling. Snapshot serialization and crowd-control eligibility live in `battle-snapshot.ts` and `crowd-control-policy.ts`. This keeps low-level state contracts independent of gameplay and makes rule dependencies explicit. The battle barrel exports the gameplay surface only — hit-pipeline staging helpers (`remapDrawnCardBenefits`, `playerStatusDelta`, `mitigatePlayerCombatDamage`, `scaleReceivedPlayerDamage`) and single-use tooling (`regrowEnemyThorns`) stay importable by relative path inside `src/lib/battle/` but are not barrel exports.

> Token-barrel exception: keep `game-data-catalog.ts` off the token `config/` barrel so layout/token imports stay catalog-free.

`shared/run-flow/` is the neutral seam for destination sampling and starter-draft helpers so `run-setup` and `run-loop` do not import each other (Oxlint-enforced).

## Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

## Run setup ownership

`run-setup/run/content-system-navigation.ts` owns content-system selection,
character/difficulty routing. `run-resume-navigation.ts` owns current-run resume;
`new-run-initialization.ts` prepares new runs and drafts in commands before navigation. Run-start snapshots belong to
`run-start-command.ts`; Wildcard starter-draft sampling belongs to
`shared/run-flow/starter-draft.ts`.
`new-run-initialization.ts` owns Campaign launch: run setup, discovery, destination offers, pending-character cleanup, and opening combat
commit in one command. Initialization failure rolls all of them back. After
commit, it schedules Battle before presenting opening feedback, so an immediate
Companion outcome supersedes that request. Presentation failure retains a
complete resumable battle. Novice starts explicitly choose Skeleton; difficulty
selection uses the normal encounter pool.
Wildwood post-entry progression belongs to
`run-loop/run/wildwood-gauntlet-flow.ts`. The persisted draft/resume differences
between Campaign, Labyrinth, and Wildwood are covered by the [content-system
workflow](./WORKFLOWS.md#content-system-behavior).

The main menu offers Continue when a run is unfinished, otherwise Play. Continue delegates to `content-system-navigation.resumeRun` through route props. A requested mode cannot replace an active run. End Run in the existing red menu action cancels pending battle/navigation work, finalizes earned progression once, clears the current run, and always shows Journey’s End without confirmation; continuation follows the [run recap UI](./UI_BROWSING.md#run-journey-recap), including earned hero unlocks. Ordinary defeat and victory retain their outcome screens. Drafting belongs to the active run; finishing its starter draft is the only supported re-application of a start snapshot. Domain commands own the activity's resume location; display navigation, including Menu/meta visits, never replaces it. Run-start and progression commands establish their next activity before presentation begins. There are no parked slots or recency fields.

Destination eligibility is pure in `shared/run-flow/resolve-available-destinations.ts`;
weighted offer construction lives in `shared/run-flow/destination-flow.ts`.
`shared/stores/destination-offer-command.ts` derives act, room history, Health,
Gold, and collection eligibility from the open transaction. Run start, resume
repair, and progression use that owner; victory supplies its plain eligibility
context to reward calculation, which uses settled Health and Gold. Domain
commands never call a shell reader or accept partial overrides for eligibility.
Offer history, reward state, and command-bound RNG counters commit together;
destination generation is not exposed through navigation capabilities.

## Battle path

Gameplay resolves before presentation; playback uses committed results.

`lib/battle/battle-start.ts` owns opening Companion actions (including Eager Pack)
and the subsequent hand draw. `resolveBattleStart` returns data-only state and
Companion feedback; live start commands own progression, opening Gold settlement,
and presentation notices. `resolveTurnSequence` internally owns progression through forced
player skips and runs the next Companion only when player input returns. The
balance simulator uses both operations; its policy selects cards and Wishes but
never assembles turn stages. A simulator round budget limits resolved turn
frames, including forced skips; live commands omit that limit.

`battle/player-rewards.ts` owns the coupled player reward reactions (Health,
Mana, Gold, Block, Armor, cleanse, and defeat payouts), including the base
Health update and its combat-text feedback; defeat healing uses
that base update without restarting the full healing reaction chain. Import
`battle/combat-text-events.ts` for text aggregation and `battle/enemy-healing.ts`
for enemy healing. Combat text is feedback, not a gameplay rule owner.

- **Card play:** UI → `useBattleController`'s `handleCardClick` → bound `battle.playCard` capability → `commitCardPlay` → committed snapshot and combat feedback.
- **Wish choice:** UI → `handleWishChoice` → bound `battle.chooseWish` capability → `commitBattleWish` → committed chosen card and remaining Wish queue.
- **End Turn:** UI → `handleEndTurn` → bound `battle.endTurn` capability → `commitEndTurn` → committed result and XP → `playTurnFrames` for presentation only.

Those store commands call `resolveBattleAction(snapshot, action, context)` with
the typed `BattleAction` request from `battle/battle-actions.ts`: `card` carries
`cardId`, `index`, and optional play options; `wish` carries `cardId`; `end-turn`
may carry a simulation turn budget. The context supplies command-bound world RNG.

`resolveBattleAction` in `battle/battle-actions.ts` owns acceptance and resolution
for Card, Wish, and end-turn requests in both live commands and simulation. Its
discriminated result separates rejection from accepted gameplay; rejected actions
retain snapshot identity and consume no RNG. Phase, defeat, pending Wish, offered
choice, card payment, and turn-budget validation happen before execution. Card
previews reuse the same card validation. Pending Wishes may settle after enemy
defeat or while controlled; explicit Card options preserve victory-grace plays,
but neither permits a new enemy turn. Live commands award XP, discover cards,
and settle resources only after acceptance. The convenience Card, Wish, and turn
resolvers delegate to that boundary and keep their data-only return shapes.
Hosts supply an explicit `BattleResolutionContext`; only snapshot data and combat
feedback return. Low-level Card, Wish, and turn mechanics remain internal to the
engine rather than barrel exports.

`battle/card-play.ts` owns hand validation, payment, and the ordinary play sequence.
`battle/card-play-effects.ts` resolves effects, repeats, and subsequent Talent
and trinket rewards for ordinary and Dodge-triggered plays. `battle/card-consume.ts` owns discard/exhaust routing and Consume rewards.
Callers keep effect resolution, encounter reactions, and Consume routing in
explicit order. Automatic play bypasses ordinary payment.

`battle/enemy-damage-mitigation.ts` owns enemy damage preparation and the player's
Block, Armor, and damage reductions. `battle/enemy-attack-damage.ts` applies the
result to Health and resolves defensive rewards, Leech, retaliation, and pending
reactions. Its existing damage entry points remain the caller-facing surface.

Direct player hits use source-specific recipes in `lib/battle/hit-resolution.ts`
and its lower `follow-up-hit-resolution.ts` tier. `player-hit-core.ts` carries source
intent (`HitRequest`) and captures eligibility and Health results (`HitFacts`) before
nested reactions. Card play binds an execution-only empty-draw callback so low-level
Stun and Bleed draw rewards can request Emergency Wish without importing its
orchestrator; snapshots strip that callback along with RNG and action context.
Attack orchestration keeps Dodge, reserved bonuses, numeric preparation,
whole-packet follow-ups, and retaliation. Card reaction stages cannot call back into
attack orchestration. The [hit-source matrix](./GAME_RULES.md#direct-player-hit-resolution)
describes the current ordering and scaling differences. Retirement of legacy
recipes follows the [save baseline](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

Controller construction, route props, and playback: [Battle controllers](./BATTLE_CONTROLLERS.md#battle-path).

## Controller entry points

The [session capability reference](./RUN_STATE.md#session-capability-ports) lists controller, route, and domain entry points together. Use the [battle path](#battle-path), [shop commands](#shop-commands), and [run setup ownership](#run-setup-ownership) sections for their distinct execution contracts.

Campaign and Labyrinth room entry share `run-loop/run/room-entry-commands.ts`.
`enterRunRoom` validates the offered destination or selected reachable node, then
commits its activity, encounter traits, seeded initialization, room history, and
progress in one transaction. Campaign keeps its destination claim inside that
transaction so loot depth includes the entering room. Labyrinth records its node
before resolving opening combat. Failed initialization publishes nothing.
`labyrinth-controller.ts` delegates selected-node entry to that command;
`shell/labyrinth-node-routing.ts` and the Campaign flow receive detached results.
`run-destination-handlers.ts` schedules the display before presenting opening
battle feedback, allowing an immediate Companion outcome to supersede Battle.
Presentation failure or cancellation leaves complete, resumable gameplay.

### Run loop overview

`run-loop/` splits each outcome into three layers: pure computation in
`navigation/` (`reward-flow`, `reward-offers`, `victory-flow`, `mystery-flow`, `reward-math`),
store commits in domain command modules (`reward-commands`, `victory-commands`, `destination-commands`, `progression-commands`, `wildwood-commands`, and `run-end-commands`), and
navigation plus sound in `run/run-flow.ts`, with separate victory/defeat handlers needed before battle construction.
`shell/run-flow-engine.ts` wires the factories to route actions. Reading order
for a change: `run-flow.ts` → its
`*-commands` → the `navigation/` pure function. Victory Gold is settled once in
`reward-math.ts` through `victory-flow.ts`; the saved purse and every reward
screen derive from that same settlement. `reward-flow.ts` receives the settled
Gold payout and only assembles reward states.
`progression-commands.ts` owns non-combat visit exits. Callers supply the
expected activity; the command rejects mismatched activities and unfinished
Mystery choices. Automatic Campfire rest, room completion, next destination
sampling, history, RNG, and the durable next activity commit together. Untouched
Corruption restores the Campaign picker or leaves the Labyrinth node unconsumed;
used Corruption completes the room. Presentation only navigates to the returned
committed screen. Act advancement remains inside reward claiming rather than a
separate shell action. The renderer and headless playthrough bind exits to the
activity that offered the action.

`reward-offers.ts` owns category eligibility, hoard guarantees, and seeded
choice sampling. It returns a typed offer without run settlement fields;
`reward-flow.ts` adds the reward state defaults, settled Gold, Materials, destinations,
and post-claim routing.

Single owners to know: `shared/stores/run-materials.ts` owns the run-earned Material grant
site inventory and end-of-run Material totals across all three modes;
`battle/playback-gate.ts` owns the shared Card, Wish, and auto-end-turn gate
(`isBattlePlaybackBlocked`, `usePlaybackBlocked`). `use-battle-autoplay.ts` selects
a ready action with its live commit guard; the React-free `autoplay-driver.ts`
owns retries, pacing, and cancellation through one action loop. `battle/playback-lifetime.ts`
owns explicit playback phases, binding readiness, cancellation, timers, transfers, and draw counts.
`battle/draw-sequence.ts` sequences hand reveals against that lifetime; draw ownership
is shared even when callers copy dependencies to strengthen a screen guard.
`battle/battle-transfers.ts` supplies DOM measurements, sound, and timed transfer wiring.
`battle/battle-session.ts` adapts that lifetime to presentation and delegates turn
commit to `shared/stores/battle-commands.ts`; restore hydrates committed snapshots; legacy activity conversion stays in the save migration. Battle start
uses `shared/stores/battle-start-commands.ts` and then arms presentation. Fight feedback (floating numbers + shake + sound) is
unified in `presentCombatTexts` in `battle/controller-utils.ts`; card overlay
layers live beside their leaves (`card-ghost-overlay.tsx`,
`card-transfer-overlay.tsx`).

## Shop commands

`shop-shelf.tsx` owns the shared shelf props, item identity, and Card, Gear, and Trinket tile selection. Shop screens add their own services; routes use the same `items`, `getPrice`, and `onBuy` props for every shelf.

`create-shop-actions.ts` composes the matching `*-shop-commands.ts` modules and
binds them once to a `GameSession`. Callers supply no Talent or Homestead
manifests. `shop-pricing-context.ts` derives effects from current session
progression for quotes and from the open transaction for mutations. Purchases,
services, refresh chances, and Gear sampling therefore use the
same progression as payment and visit state, including after upgrades, resets,
or save restoration. Refresh quotes read the live visit; callers supply no cached
refresh allowance or progression overrides. Retained capabilities do not need to be recreated.
`shop-commands-core.ts` owns shared purchase actions and live price helpers.
Each shop supplies typed shelf selection, item identity, pricing, and acquisition
rules; the shared purchase owner uses that pricing rule for both displayed quotes
and commits, validating and acquiring the live shelf item inside the transaction.
Pure shelf samplers live in `shop-state-init.ts`. `run-loop/run/room-visit-initialization.ts`
owns transaction-only initialization for shops, Campfire, Transmutation, and Mystery.
Only `room-entry-commands.ts` may import that owner (Oxlint and import-boundary gates enforce this).
Room entry commits complete visits before navigation. Screen mount effects and retained
shop/route capabilities cannot initialize or replace visits, reset purchases or refresh
allowances, or reroll saved offers. Resume hydrates existing visit data; damaged
Transmutation choices use the screen's existing unavailable-visit exit. `shop-commands-core.ts` owns
purchase validation and the complete refresh recipe; the activity
selects pricing and the typed `setRunActivityData` write target. Callers supply
shop-specific sampling and acquisition rules without wiring separate state writers.
`runShopTransaction` owns guarded dispatch and success feedback:
payment, benefits, and visit changes commit together, and stale commands for
another shop are rejected. Gear writes inside that transaction follow
[Armory write paths](./ARMORY.md#write-paths).

Only the active visit is encoded by `encodeRunResumeSnapshot`; presentation
navigation does not select the shelf to save. Kind `"merchant"` is the
player-facing **Card Shop**. For the editing sequence, refresh behavior, typed
shelf assignment, and modifier ordering, follow
[Change a shop](./WORKFLOWS.md#change-a-shop).

## Settings and meta profile

- `settings-store` owns synchronized display, audio, and gameplay preferences. It does not contain gameplay progression.
- `device-display-store` owns Game Size and Tooltip Size. Its storage seam writes a versioned device-local record, outside the settings save codec and Steam Cloud. Defaults load synchronously before layout; unavailable storage falls back to in-memory preferences. Options receives values and actions through its route props.
- `lib/settings-values.ts` owns the shared value sets and numeric bounds consumed by save validation, Options, audio,
  and the desktop bridge. `lib/validation/save-schemas/settings.ts` owns synchronized
  preference fields, their saved defaults, and load repair; the settings codec
  derives fresh defaults and field types from it and owns encoding and hydration.
  Options receives these values and named actions directly through route props.

Gameplay progression remains in the [aggregate regions](./RUN_STATE.md#run-state); persistence follows the [codec contract](./RUN_STATE.md#persistence-api). Run reward finalization uses the write module and `run-lifecycle.ts` (`finalizeRunXP`, `awardMaterialsDuringRun` — see [grant materials](./RUN_WORKFLOWS.md#grant-materials-during-a-run)), never the discovery-only profile region. `error-log-store.ts` is a standalone local-only error buffer (own storage key, debounced persist); `shared/stores/reset.ts` owns the Options wipe (distinct from the audio test reset in `src/lib/audio/reset.ts`). Both sit outside the gameplay aggregate and its save codecs.

## Permanent Gear (`gear-store`)

Owned Gear and per-character loadouts live in `shared/stores/gear-store.ts`. Pure rules live under `src/lib/gear/`; per-command draft views and health-sync wrappers live in `gear-session-command.ts` (`GearDraftView` with deeply readonly collection views and guarded mutation methods, explicit write tracking — no snapshot comparison). `gear-state-defaults.ts` owns `createInitialGearState` and save-field defaults independently of live mutation code; `gear-actions.ts` owns draft mutators. Player actions live in `gear-commands.ts`; routes and headless playthroughs cannot supply draft callbacks or save-flush adapters. Salvage owns removal and all payouts in `salvageGearInTransaction`, outside the generic draft view. Import boundaries keep Gear mutation internals store-owned. Gear is meta progression, not copied into active-run data; battle snapshots `BattleState.gearEffects` and live meta mutations rebind via `rebindLiveRunMeta`. Feature code reads through `gear-store.ts`. Screen, mutations, and HP-sync: [ARMORY.md](./ARMORY.md). Authoring new items: [WORKFLOWS § Add permanent Gear](./WORKFLOWS.md#add-permanent-gear).

## Types

Gameplay write operations own incoming data at the transaction boundary. Direct
values and functional updater results are copied before domain mutators can
retain them, so later caller edits cannot change the draft or committed state,
and committing cannot freeze caller-owned objects. Existing readonly transaction
views resolve to their owned snapshots, preserving unchanged updater identity.
The same boundary copier handles incoming values and detached command results;
Gear inventory insertion and initialization use it as well. Functions remain
explicit capabilities (for example command-bound RNG), rather than data to copy.

`GameplayState` in `gameplay-state.ts` defines the [aggregate regions](./RUN_STATE.md#run-state). Read, write, command, and screen contracts are listed in the [capability reference](./RUN_STATE.md#session-capability-ports); persistence types are in the [codec contract](./RUN_STATE.md#persistence-api).

Run-progress contracts and the exhaustive `ACTIVE_RUN_PROGRESS_KEYS` projection live in `lib/active-run-session/run-progress.ts`, independently of save validation. `lib/validation` owns saved-run parsing and recovery; its schemas check the domain contracts. Initial progress and permanent fields, `generateRunSeed`, and `pickActiveRunView` live in `run-state-init.ts`; `run-domain-types.ts` defines session, battle, and run-data fields. `profile-store-types.ts` owns its domain (completion buckets derived from the character registry); `gear-state-defaults.ts` owns the initial gear state. Fresh-run snapshots live in `shared/run-flow/run-start.ts`. Shared numeric manifest defaults use `createNumericManifest` / `mergeNumericManifests` from `manifest-utils.ts`.

## Import boundaries

Enforced in `oxlint.config.ts` (composition in `lint/fragments.js` + `lint/boundaries.js`) and double-checked by `npm run lint:boundaries` (dependency-cruiser, except barrel deep-import bans which are Oxlint-only). Phase bans and path override order live in those files; focused Oxlint fixtures exercise accepted and rejected code through the real configuration. `npm run lint:architecture-smoke` checks shared presentation constants and cross-language contracts. Summary:

- `src/lib/**` must not import `@/features/**`
- Source modules must remain acyclic; reusable battle rules and reactions live below turn/card orchestrators
- The application singleton is created in `app/application-session.ts`; reusable commands and headless careers require explicit sessions or bound capabilities (see [Session ownership](./RUN_STATE.md#session-ownership)).
- Session reads, commands, and save codecs stay independent of React and application initialization. `gameplay-state-reads.ts` owns explicit-session aggregate reads and subscriptions; `gameplay-state-store.ts` owns the shipping presentation hook. React consumers use `use-run-reads.ts`, `use-gear-store.ts`, and `use-profile-store.ts`; their corresponding domain modules never re-export hooks. Shared selectors remain in the domain modules so committed and presentation reads use the same rules. The headless session regression exercises production run start, combat, and save/resume while rejecting React and application-session imports.
- `gameplay-state.ts`, `gameplay-state-reads.ts`, `gameplay-state-store.ts`, and `session-runtime.ts` are internal to `shared/stores/`; other layers use capability hooks, reads, writes, commands, and `run-lifecycle`
- Raw dispatch and transaction draft lookup stay inside `shared/stores/`, with `shared/storage/persistence.ts` allowed to dispatch bootstrap hydration. Feature command callbacks receive deeply readonly transaction reads and write through the existing domain operations.
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

`index.html` owns the single startup splash, including its artwork, filling
wordmark, styles and reduced-motion behavior. `public/startup-words.js` rotates
phrases on one timer from first paint until dismissal. React renders no second
loader: `App` calls `syncStartupSplash` to publish smoothed progress to the
splash's `progressbar` ARIA value and dismiss it once bootstrap and initial
loading are ready. The fill animation matches `INITIAL_LOAD_MIN_DURATION_MS`;
the architecture smoke check guards that shared timing. `startup-load-state.ts`
owns the reveal decision; `use-initial-load-ready.ts` supplies image, font,
bootstrap, timer and frame events. Reveal waits for settled work, the minimum
duration and the eased progress reaching 100%. Essential art failures are logged
and treated as settled. Deferred Gear art begins as soon as essential art settles,
overlapping the minimum loading window and continuing after reveal if needed.

**Do not add:** `React.lazy()` on route screens, lazy game art outside the board decode exception, or per-screen spinners for assets in `allGameArt`. Board and Gear URLs register eagerly in `game-data/catalog-art.ts`; the board catalog owns board identity and prepared filenames own Gear identity. General art keeps its generated named exports. Card and enemy builders derive conventional art from content IDs, with explicit overrides for shared or differently named art. Board art is excluded from both startup decode sets through `onDemandBoardArt` and decoded on demand. Follow the [board asset workflow](./WORKFLOWS-ASSETS.md#game-board-artwork) when changing that explicit exception.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only (`shouldSkipStartupLoadingGate()`).

Path-specific test commands: [CONTRIBUTING.md § What to run](../CONTRIBUTING.md#what-to-run-when-you-change).

Manual End Run clears resumable activity and pending work immediately. The battle
route retains its outgoing display snapshot until the fade completes, while
active combat is removed from gameplay. Commands cannot resolve that retained
frame, and saves cannot include it. Outcome playback hands its final frame to
presentation before victory or defeat settlement. The next battle initializes
fresh state.

## Headless playthrough tooling

The [playthrough runner](./PLAYTHROUGH_SIMULATION.md) lives in `src/app/playthrough/` and is loaded only by Node tooling. It composes feature read ports and production action flows against an explicit independent game session. Child processes provide fresh-process replay and an external watchdog; session isolation also works within one process. Production battle start/card/Wish and autosave operations are shared with the UI; the harness owns policy, evidence, and assertions. It must not implement game rules or mutate the gameplay aggregate directly.

`career-runtime.ts` owns each career’s deterministic seed, ID counter, and clock.
Recorded replay inputs never replace process-wide `Date.now` or `crypto`. The
application keeps one default session; independent consumers use
[`createGameSession`](./RUN_STATE.md#session-ownership) and pass its handle through
controller factories, reads, commands, and persistence.

`actor.ts` routes each observation to `meta-offers.ts` or `run-offers.ts` after constructing the production controller. `choice-catalog.ts` owns recorded choice identities and their executable commands for the current observation; duplicate identities fail instead of replacing a command. Offer builders score and register legal choices but do not commit gameplay until the selected choice executes.

Run outcomes and navigation share one construction owner: `createRunOutcomes`
exposes `connect(actions)`. Both UI and headless shells supply presentation
capabilities; domain commands own destination eligibility and sampling.
Hover-clearing navigation is wrapped once in the shell.

Route and shop command types derive from their composition factories. The route
surface excludes battle initialization and cancellation; screens borrow only their
phase's commands. Changes to command signatures update consumers without a second
handwritten capability inventory.
