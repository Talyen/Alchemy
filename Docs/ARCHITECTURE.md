# Alchemy architecture

Canonical map of repository ownership, feature layout, and application composition. Coding rules: [AGENTS.md](../AGENTS.md). Gameplay / battle rules: [GAME_RULES.md § Battle](./GAME_RULES.md#battle-implementation-rules). How-to: [WORKFLOWS.md](./WORKFLOWS.md). Hooks and tests: [CONTRIBUTING.md](../CONTRIBUTING.md). Audits: [Audits/README.md](./Audits/README.md).

`src/lib/` stays React-free. Feature UI lives under `src/features/alchemy/`.

## Guide index

- [Steam demo edition](./STEAM_DEMO.md): build identity, command/resume restrictions and automatic progress transfer.

- [Run state and persistence](./RUN_STATE.md): aggregate regions, command atomicity, RNG, save codecs, and capability ports.
- [Battle controllers](./BATTLE_CONTROLLERS.md): command props, committed playback, and navigation timing.
- Below: feature layout, run setup, shops, meta progression, import boundaries, and boot.

## Repository ownership

Start here to locate a subsystem, then follow its contract or workflow. Command
selection belongs to [Commands](./COMMANDS.md), execution policy to
[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change), and tooling internals
to the [scripts map](../scripts/README.md). [Agent discovery](./AGENT_DISCOVERY.md)
provides optional lookup over these owners.

| Responsibility                                      | Implementation home                                                                                 | Contract or workflow                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Application boot and route composition              | `src/app/`, `src/features/alchemy/shell/`                                                           | [Boot](#boot-and-loading), [screen workflows](./WORKFLOWS.md)                                 |
| Game session, transactions, reads and initial state | `src/features/alchemy/shared/stores/session/`                                                       | [Run state](./RUN_STATE.md)                                                                   |
| Gameplay commands, lifecycle and draft writes       | `src/features/alchemy/shared/stores/commands/`                                                      | [Run workflows](./RUN_WORKFLOWS.md)                                                           |
| Session save codecs                                 | `src/features/alchemy/shared/stores/persistence/`                                                   | [Persistence API](./RUN_STATE.md#persistence-api)                                             |
| React state adapters and presentation stores        | `src/features/alchemy/shared/stores/react/`                                                         | [Capability ports](./RUN_STATE.md#session-capability-ports)                                   |
| Save transport and durable writes                   | `src/features/alchemy/shared/storage/`, `src/lib/platform-save-backend.ts`                          | [Save compatibility](../src/features/alchemy/shared/storage/MIGRATIONS.md)                    |
| Saved-data schemas, parsing and recovery            | `src/lib/validation/`                                                                               | [Persistence ownership](#persistence-ownership)                                               |
| Run activity contracts and pure visit conversion    | `src/lib/active-run-session/`                                                                       | [Activity and rewards](./RUN_STATE.md#activity-and-rewards)                                   |
| Battle rules and effects                            | `src/lib/battle/`                                                                                   | [Game rules](./GAME_RULES.md#battle-implementation-rules)                                     |
| Cards, characters, enemies and authored catalogs    | `src/lib/game-data/`                                                                                | [Content authoring](./CONTENT_AUTHORING.md)                                                   |
| Authored-content correctness                        | `src/lib/content-validation/`                                                                       | [Content authoring](./CONTENT_AUTHORING.md)                                                   |
| Campaign alternatives and map generation            | `src/lib/content-systems/`                                                                          | [Content-system workflow](./WORKFLOWS.md#content-system-behavior)                             |
| Gear, loot, Homestead, corruption and brewing rules | `src/lib/gear/`, `src/lib/loot/`, `src/lib/homestead/`, `src/lib/corruption/`, `src/lib/alchemist/` | [Armory](./ARMORY.md), [unique items](./UNIQUE_ITEMS.md), [game rules](./GAME_RULES.md)       |
| Destination and screen policies                     | `src/lib/routing/`, `src/features/alchemy/run-loop/navigation/`                                     | [Run loop](#run-loop-overview)                                                                |
| Shared tuning                                       | `src/lib/game-constants/`                                                                           | [Tuning conventions](./CONTENT_AUTHORING.md#shared-tuning)                                    |
| Reusable UI, dialogs and inspection                 | `src/components/`, `src/features/alchemy/shared/ui/`                                                | [UI](./UI.md)                                                                                 |
| Audio and image loading                             | `src/lib/audio/`, `src/lib/preload/`                                                                | [Audio](./AUDIO.md), [boot](#boot-and-loading)                                                |
| Localization                                        | `src/lib/localization/`, `scripts/localization/`                                                    | [Localization](./LOCALIZATION.md)                                                             |
| Headless careers and battle simulation              | `src/app/playthrough/`, `src/lib/balance/`, `scripts/lib/playthrough/`                              | [Simulation](./SIMULATION.md)                                                                 |
| Performance scenarios and runner                    | `performance/`, `scripts/lib/performance/`                                                          | [Performance](./PERFORMANCE.md)                                                               |
| Desktop bridge, packaging and Steam                 | `desktop/`, `src/lib/desktop-api.ts`, `src/lib/platform.ts`, `steam/`, `scripts/lib/release/`       | [Release](./RELEASE.md), [Steam demo](./STEAM_DEMO.md)                                        |
| Verification and import rules                       | `tests/`, `scripts/lib/verification/`, `lint/`                                                      | [Contributing](../CONTRIBUTING.md), [verification implementation](../scripts/VERIFICATION.md) |
| Asset masters, prepared art and public media        | `assets/sources/`, `src/assets/`, `public/`, `scripts/assets/`                                      | [Assets](./WORKFLOWS-ASSETS.md)                                                               |

Tests mirror their source owners under `tests/`. Cross-subsystem interaction,
architecture, browser, Electron and playthrough suites retain their distinct
homes because they validate contracts spanning multiple owners.

## Persistence ownership

Follow the save path by responsibility rather than treating every save-related
module as storage:

- **Schemas and repair:** `lib/validation/` validates saved input and recovers
  damaged data. `lib/active-run-session/` owns domain activity shapes and pure
  visit conversions shared by live commands and save recovery; it must not
  depend on validation or transport.
- **Codecs:** `shared/stores/persistence/` selects and detaches session fields,
  applies defaults, and hydrates through the owning transaction. Gear, profile,
  settings, permanent progress and run-resume codecs live here. Session reads
  and mutations remain with their session or command owners.
- **Storage:** `shared/storage/` owns backend access, save queues, recovery
  candidates, snapshots and completion tracking. `persistence.ts` composes
  codecs into the versioned envelope and performs bootstrap hydration; it does
  not own gameplay rules. Platform backends live at the I/O seam.

[Persistence API](./RUN_STATE.md#persistence-api) owns session snapshots and codecs;
[save compatibility](../src/features/alchemy/shared/storage/MIGRATIONS.md#public-save-contract)
owns storage behavior. [Change persisted data](./RUN_WORKFLOWS.md#change-persisted-save-data)
owns the editing sequence. These directory roles do not change the saved format.

## Directory layout (`src/features/alchemy/`)

- **`shared/`** — `stores/` (`session/`, `commands/`, `persistence/`, `react/`), `storage/`, `ui/`, `config/`, `context/`, `utils/`, `run-flow/`, `types.ts`
- **`meta/`** — Menu, collection, homestead, talents, armory screens
- **`run-setup/`** — Character, difficulty, draft screens
- **`run-loop/`** — Battle glue, navigation, shop, in-run screens
- **`shell/`** — Screen routing + run/battle controller composition (see navigation vocabulary below)

`shared/ui/tooltips/` owns tooltip placement, panels, and item popups; `shared/ui/inspection/` owns card and enemy inspection overlays and their grid/sorting helpers. `shared/ui/cards/` owns card rendering and selection used across screens. `shared/ui/dialogs/` owns modal shells, focus ownership/navigation, portal roots, and dialog dismissal; hooks without a cohesive subsystem stay directly in `shared/ui/`; battle-only panels and playback visuals live under `run-loop/battle/presentation/` (`ui/` for panels and effects). Unit tests mirror these owners. Collection-only presentation lives in `meta/screens/collection/`; shop purchase and service widgets live in `run-loop/shop/ui/`. Mystery outcome badges live beside their screens in `run-loop/screens/mystery/`; Options panels, controls, and the error-log viewer live in `meta/screens/options/`. Display scaling belongs to `shared/ui/use-virtual-resolution.ts`; the general latest-value ref hook belongs to `shared/ui/use-latest-ref.ts`. Import shared UI directly from its owning module rather than a catch-all barrel.

Import lib catalogs through their Oxlint-enforced barrels (`@/lib/game-data`,
`@/lib/battle`, `@/lib/validation`, `@/lib/content-validation`). Feature stores and
screens use on-disk paths. Feature UI reads static catalogs through
[`game-data-catalog.ts`](../src/features/alchemy/shared/config/game-data-catalog.ts),
kept off the token `config/` barrel so layout imports stay catalog-free.
`content-validation/card-parity` is the sanctioned source deep-import exception;
tests sit outside boundary lint and may import leaves.

Battle state contracts are type-only and cannot import or re-export executable
rules. Internal mechanics use their owning leaves; the battle barrel exposes the
public gameplay surface. [Game rules](./GAME_RULES.md#direct-player-hit-resolution)
and [effect handlers](../src/lib/game-data/effects/BATTLE_HANDLERS.md) locate those
rules. `content-validation` checks authored content; `validation` parses and
repairs saves; `content-systems` owns mode generation and encounter selection.

`shared/run-flow/` is the neutral seam for destination sampling and starter drafts,
keeping `run-setup` and `run-loop` independent under Oxlint.

## Run phase

`getRunPhase(screen, hasActiveBattle)` in `@/lib/routing` → `meta` | `runLoop` | `battle` | `runEnd`.

## Run setup ownership

| Responsibility                                   | Owner under `src/features/alchemy/`                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| Mode, hero and difficulty routing                | `run-setup/run/content-system-navigation.ts`                               |
| Current-run resume                               | `run-setup/run/run-resume-navigation.ts`                                   |
| New-run initialization and Campaign launch       | `run-setup/run/new-run-initialization.ts`                                  |
| Run-start snapshots                              | `shared/stores/commands/run-start-command.ts`                              |
| Wildcard starter draft                           | `shared/run-flow/starter-draft.ts`                                         |
| Wildwood post-entry progression                  | `run-loop/run/wildwood-gauntlet-flow.ts`                                   |
| Pure destination eligibility and weighted offers | `shared/run-flow/resolve-available-destinations.ts`, `destination-flow.ts` |
| Transaction-owned offer generation               | `shared/stores/commands/destination-offer-command.ts`                      |

Starter offer generation lives in `src/lib/starter-draft.ts`, shared by new drafts
and save repair. The feature entry point re-exports that recipe and owns resume targeting.

Initialization commits deck, discovery, offers, activity and opening combat together;
failure rolls all of them back. Schedule Battle before opening feedback so an
immediate Companion outcome can supersede it. Novice Campaign starts with Skeleton;
difficulty selection uses the normal encounter pool.

New-run initialization clears pending character setup and commits a complete start
before presentation. A requested mode cannot replace an unfinished run. Finishing
that run's starter draft is the only supported re-application of its start snapshot.

Commands derive destination eligibility from the open transaction; shells supply
no reader or partial overrides. Victory calculation uses settled Health/Gold and
the upcoming loot depth. Offer history and RNG commit with the offer.
[Activity ownership](./RUN_STATE.md#activity-and-rewards),
[mode behavior](./GAME_RULES.md#saved-runs-and-shared-progression), and
[content-system changes](./WORKFLOWS.md#content-system-behavior) own the remaining rules.

## Battle path

```text
BattleScreen action → routeCommands.battle → store command → lib/battle
                    → committed snapshot + detached feedback → playback
```

Store commands in `shared/stores/commands/battle-commands.ts` own Card, Wish and
End Turn admission, progression and publication. Standalone starts use
`battle-start-commands.ts`; room entry composes its initialization operation.
The engine's `resolveBattleAction` and `resolveBattleStart` serve live commands
and simulation with an explicit `BattleResolutionContext`.

[Game rules](./GAME_RULES.md#direct-player-hit-resolution) own hit recipes,
cutoffs, RNG order and source-specific reactions.
[Run state](./RUN_STATE.md#committed-battle-playback) owns snapshot publication;
[Battle controllers](./BATTLE_CONTROLLERS.md#battle-path) owns controller props,
input-snapshot identity and playback lifetime. Use
[the playback workflow](./WORKFLOWS.md#change-battle-playback) to change that wiring.

## Controller entry points

The [session capability reference](./RUN_STATE.md#session-capability-ports) lists controller, route, and domain entry points together. Use the [battle path](#battle-path), [shop commands](#shop-commands), and [run setup ownership](#run-setup-ownership) sections for their distinct execution contracts.

Campaign and Labyrinth enter rooms through `run-loop/run/room-entry-commands.ts`.
`labyrinth-controller.ts` delegates selected-node entry; `shell/labyrinth-node-routing.ts`
and Campaign flow receive detached results. [Activity ownership](./RUN_STATE.md#activity-and-rewards)
defines atomic entry and opening-outcome ordering.

### Run loop overview

| Layer                                            | Owner under `src/features/alchemy/`                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Pure outcome and reward calculation              | `run-loop/navigation/` (`reward-flow`, `reward-offers`, `victory-flow`, `mystery-flow`, `reward-math`) |
| Atomic progression and grants                    | Domain `*-commands.ts` modules beside those flows                                                      |
| Navigation and feedback                          | `run-loop/run/run-flow.ts` and outcome handlers                                                        |
| Factory composition                              | `shell/run-flow-engine.ts`                                                                             |
| Battle presentation lifetime and draw sequencing | `run-loop/battle/playback-lifetime.ts`, `draw-sequence.ts`, `battle-transfers.ts`                      |
| Resolved action feedback                         | `run-loop/battle/controller-utils.ts` (`presentCombatTexts`)                                           |

For a flow change, start at `run-flow.ts`, follow its command, then its pure
calculation. `reward-math.ts` settles victory Gold through `victory-flow.ts`;
`reward-flow.ts` assembles the reward state from that settled amount.
`reward-offers.ts` owns eligibility and seeded sampling, without run settlement.

`progression-commands.ts` owns non-combat exits: expected-activity validation,
room completion, history, RNG and the next activity commit together. Untouched
Corruption remains available; used Corruption completes the room. Act advancement
belongs to reward claiming. Renderer and headless callers bind exits to the activity
that offered them. See [run workflows](./RUN_WORKFLOWS.md) for editing steps and
[Battle controllers](./BATTLE_CONTROLLERS.md) for presentation cancellation.

## Shop commands

| Responsibility                                         | Owner in `run-loop/shop/` |
| ------------------------------------------------------ | ------------------------- |
| Session-bound route capabilities                       | `create-shop-actions.ts`  |
| Shop-specific player actions                           | `*-shop-commands.ts`      |
| Purchase validation, shared pricing and refresh recipe | `shop-commands-core.ts`   |
| Current progression effects and quotes                 | `shop-pricing.ts`         |
| Pure shelf sampling                                    | `shop-state-init.ts`      |
| Shared shelf props and tile selection                  | `shop-shelf.tsx`          |

`run-loop/run/room-visit-initialization.ts` initializes shops and other visits only
through `room-entry-commands.ts`, enforced by import boundaries. Room entry commits
a complete visit before navigation; rendering and retained route capabilities cannot
initialize or reroll it. Resume restores the active activity independently of the
presentation screen.

[Shop rules](./GAME_RULES.md#shops) own transaction inputs, pricing, refresh
eligibility and offer sampling. [Change a shop](./WORKFLOWS.md#change-a-shop)
gives the editing sequence.

## Settings and meta profile

[Localization](./LOCALIZATION.md) owns bundled message catalogs, presentation-only text resolution, language selection and the device-local language preference. It adds no gameplay provider or run state.

- `settings-store` owns synchronized display, audio, and gameplay preferences. It does not contain gameplay progression.
- `device-display-store` owns Game Size and Tooltip Size. Its storage seam writes a versioned device-local record, outside the settings save codec and Steam Cloud. Defaults load synchronously before layout; unavailable storage falls back to in-memory preferences. Options receives values and actions through its route props.
- `lib/settings-values.ts` owns the shared value sets and numeric bounds consumed by save validation, Options, audio,
  and the desktop bridge. `lib/validation/save-schemas/settings.ts` owns synchronized
  preference fields, their saved defaults, and load repair; the settings codec
  derives fresh defaults and field types from it and owns encoding and hydration.
  Options receives these values and named actions directly through route props.

Gameplay progression remains in the [aggregate regions](./RUN_STATE.md#run-state); persistence follows the [codec contract](./RUN_STATE.md#persistence-api). Run reward finalization uses the write module and `run-lifecycle.ts` (`finalizeRunXP`, `awardMaterialsDuringRun` — see [grant materials](./RUN_WORKFLOWS.md#grant-materials-during-a-run)), never the discovery-only profile region. `error-log-store.ts` is a standalone local-only error buffer (own storage key, debounced persist); `shared/stores/commands/reset.ts` owns the Options wipe (distinct from the audio test reset in `src/lib/audio/reset.ts`). Both sit outside the gameplay aggregate and its save codecs.

## Permanent Gear (`gear-store`)

Pure rules live in `src/lib/gear/`; session reads in `shared/stores/session/gear-store.ts`;
intent commands in `shared/stores/commands/gear-commands.ts`; save conversion in
`shared/stores/persistence/gear-codec.ts`. [Armory](./ARMORY.md) owns acquisition,
combat reservations, Health rebinding and persistence. Use
[Add permanent Gear](./WORKFLOWS.md#add-permanent-gear) for authoring.

## Types

`GameplayState` defines the [aggregate regions](./RUN_STATE.md#run-state).
The [capability reference](./RUN_STATE.md#session-capability-ports) locates reads,
commands and route surfaces; the [transaction contract](./RUN_STATE.md#command-atomicity)
owns input/result detachment. Run-progress contracts live independently of validation
in `lib/active-run-session/run-progress.ts`; validation checks those contracts and
owns recovery defaults. Fresh constructors remain in `run-state-init.ts` and
`shared/run-flow/run-start.ts`.

[Content authoring](./CONTENT_AUTHORING.md#add-a-new-talent) owns manifest derivation,
ordered catalogs and special defaults. Keep signatures derived from their composition
owner instead of maintaining parallel method or field inventories.

Talent, Homestead and Trinket neutral manifests are frozen shared templates,
including their nested default collections. Manifest factories return independent
mutable values. Gear effect-key lists are frozen because factory initialization
and save normalization both depend on them. Companion Bond tier costs and their
tier records are frozen; purchase quotes copy costs before exposing editable data.

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

`app/alchemy-bootstrap.ts` owns one bootstrap operation per GameSession, including
platform configuration, the development wipe, load/recovery selection, and restore.
React adapters subscribe to its result; Strict Mode replay and shell remounts share
pending work and retain completed readiness without restoring over newer progress.
Closing the session revokes continuations before another persistence operation or
restore can start. Independent sessions bootstrap independently.
Cold startup restores saved progress but opens the main menu, including when a
battle was interrupted. Continue opens the saved activity without restarting it.
The menu is selected in the restore publication, before observers can run battle
presentation; an already initialized session keeps its current screen.

Image preload pipelines borrow deduplicated fetch/decode work from `lib/preload/image.ts`.
Each pipeline owns cancellation across its batches, frame yields, and progress
callbacks. Unmount cancels both essential and deferred art work. Cache reset revokes
all existing pipelines before releasing their images, so suspended producers cannot
refill the cache afterward. Cancelling one borrower preserves another borrower's
fetch; the last departure aborts readiness and releases the source immediately.
Completed entries retain the bounded cache policy.

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
wordmark, styles and reduced-motion behavior. It shows the Alchemy name without
English phrases at first paint. `src/app/startup-splash.ts` starts one localized
phrase timer after catalogs and the selected language are ready. React renders no second
loader: `App` calls `syncStartupSplash` to publish smoothed progress to the
splash's `progressbar` ARIA value and dismiss it once bootstrap and initial
loading are ready. The fill animation matches `INITIAL_LOAD_MIN_DURATION_MS`;
the architecture smoke check guards that shared timing. `startup-load-state.ts`
owns the reveal decision; `use-initial-load-ready.ts` supplies image, font,
bootstrap, timer and frame events. Reveal waits for settled work, the minimum
duration and the eased progress reaching 100%. Essential art failures are logged
and treated as settled. Deferred Gear art begins as soon as essential art settles,
overlapping the minimum loading window and continuing after reveal if needed.

**Do not add:** `React.lazy()` on route screens, lazy game art, or per-screen spinners for assets in `allGameArt`. Gear URLs register eagerly in `game-data/catalog-art.ts`; prepared filenames own Gear identity. General art keeps its generated named exports. Card and enemy builders derive conventional art from content IDs, with explicit overrides for shared or differently named art.

**E2E bypass:** `localStorage["alchemy-skip-loading-screen"]` — startup gate only (`shouldSkipStartupLoadingGate()`).

Path-specific test commands: [CONTRIBUTING.md § What to run](../CONTRIBUTING.md#what-to-run-when-you-change).

Run termination and outgoing display retention follow
[run teardown](./RUN_WORKFLOWS.md#run-teardown) and
[committed playback](./RUN_STATE.md#committed-battle-playback).

## Headless playthrough tooling

`src/app/playthrough/` is loaded only by Node tooling. It binds production commands,
reads and autosave to an explicit independent game session; it owns policy and
evidence, never game rules or direct aggregate writes. Renderer and headless shells
share `createRunOutcomes().connect(actions)` with their own presentation capabilities.
[Headless careers](./SIMULATION.md#headless-careers) owns runtime injection, replay,
choice identity, implementation owners and evidence limits.
