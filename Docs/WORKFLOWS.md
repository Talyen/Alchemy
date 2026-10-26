# Alchemy — Implementation Workflows

Step-by-step checklists for adding or changing game content and wiring.

For refactors and simplification passes on attached paths, use [Docs/Audits](./Audits/README.md) when the user cites an audit.

**Import paths:** only `@/*` → `src/*` in `tsconfig.json`. Use **on-disk** capability paths under `src/features/alchemy/` (for example `@/features/alchemy/shared/stores/session/run-reads`) — not legacy alias paths that skip `shared/`.

Use the index for missing context and read only relevant owners and dependencies.
[Contributing](../CONTRIBUTING.md#what-to-run-when-you-change)
owns gate selection; named suites below are useful verification entry points.

## Task index

- **Raw asset / art** — [Asset workflow](./WORKFLOWS-ASSETS.md)
- **Save schema / migration** — [Persisted save data](./RUN_WORKFLOWS.md#change-persisted-save-data)
- **Mid-run resume** — [Active run data](./RUN_WORKFLOWS.md#change-mid-run-resume-activerundata)
- **Post-victory routing** — [REWARD_ROUTES](./RUN_WORKFLOWS.md#add-or-change-post-victory-routing-reward_routes)
- **Run teardown / clear save** — [Run teardown](./RUN_WORKFLOWS.md#run-teardown)
- **Status effect** — [New status](./CONTENT_AUTHORING.md#add-a-new-status-effect)
- **Card / card effect kind** — [New card](./CONTENT_AUTHORING.md#add-a-new-card) · [New effect kind](./CONTENT_AUTHORING.md#add-a-new-card-effect-kind)
- **Character, enemy, trinket, companion, keyword** — [Character](./CONTENT_AUTHORING.md#add-a-new-character) · [Enemy](./CONTENT_AUTHORING.md#add-a-new-enemy) · [Trinket](./CONTENT_AUTHORING.md#add-a-new-trinket) · [Companion](./CONTENT_AUTHORING.md#add-a-new-companion) · [Keyword](./CONTENT_AUTHORING.md#add-a-new-keyword)
- **Talent / homestead upgrade** — [Talent](./CONTENT_AUTHORING.md#add-a-new-talent) · [Homestead upgrade](./CONTENT_AUTHORING.md#add-a-homestead-upgrade)
- **Permanent gear** — [Gear](#add-permanent-gear)
- **Shop** — [Change a shop](#change-a-shop)
- **Content system / starter draft** — [Content system behavior](#content-system-behavior)
- **Battle playback** — [Change battle playback](#change-battle-playback)
- **Screen, destination, mystery, corruption** — [New screen](#adding-a-new-screen) · [Destination](#adding-a-new-destination-map-node) · [Mystery effect](#adding-a-new-mystery-effect-kind) · [Corruption](#adding--changing-corruption-flow)
- **In-run materials** — [Grant materials during a run](./RUN_WORKFLOWS.md#grant-materials-during-a-run)
- **UI placement, motion, buttons, tooltips** — [UI system](./UI.md)
- **Gameplay session mutation** — [Gameplay command boundary](./RUN_WORKFLOWS.md#gameplay-command-boundary)

---

## Add permanent Gear

Follow [Armory](./ARMORY.md#data-model) for the data model and
[write paths](./ARMORY.md#write-paths) for acquisition and Health synchronization.

1. Define the base in `src/lib/gear/base-items.ts`: legal slots/hand preset,
   affinities, rarities and thematic `salvageByRarity`. Generated definitions own
   the final `salvageValue`.
2. Register [Gear art](./WORKFLOWS-ASSETS.md#add-or-replace-gear-art) and regenerate
   outputs. Missing ordinary art retains fallback definitions for saves/loot but
   fails validation; Uniques reuse their base's Astral art.
3. Add the base's Unique in `src/lib/gear/unique-catalog.ts` under the
   [fixed-affix contract](./UNIQUE_ITEMS.md#affix-contract).
4. Check affected generation/acquisition, then run `npm run content:audit` and the
   [task gate](../CONTRIBUTING.md#what-to-run-when-you-change). Loot-weight/depth
   changes also use `npm run balance:loot`.

**If adding an affix:** append its stable ID, keyword, effects, ranges and slots in
[affix rows](../src/lib/gear/affix-rows.ts). Follow [manifest/proc rules](./ARMORY.md#affix-rules),
`uniqueOnly` restrictions and typography. Pool helpers live in `affix-pool.ts`;
`formatAffixDescription` in `affix-catalog.ts` is shared by tooltips/Uniques.
Use `ROLL_PERCENT` for percentages; `ROLL_RESIST` is resistance-only.

**If changing instance/loadout shape:** update schema, defaults, codec and fixtures
under [save compatibility](../src/features/alchemy/shared/storage/MIGRATIONS.md).
Rewards retain the exact rolled instance; acceptance never rerolls it or saves
its definition/art URLs.

## Change a shop

Start with [shop ownership and transaction rules](./ARCHITECTURE.md#shop-commands).

1. Locate the shop's command module, pricing and shelf sampler in that map.
2. Change validation, payment and acquisition inside its existing
   `runShopTransaction`; compose Gear writes with the open transaction.
3. Change offers in the sampler and refresh behavior in `createShopRefreshAction`.
   Preserve visit limits, modifier ordering and saved shelf identity.
4. Check accepted, rejected, free and repeated actions, plus current-format resume
   when visit data changes. Use affected shop units and the
   [task gate](../CONTRIBUTING.md#what-to-run-when-you-change); visible changes
   also follow [visual review](./UI_VISUAL_REVIEW.md).

## Content system behavior

[Game rules](./GAME_RULES.md#content-systems) own mode resume, shared progression,
Labyrinth exploration, and room modifiers. Read
[run-setup ownership](./ARCHITECTURE.md#run-setup-ownership) before changing their
navigation. Keep persisted drafts and resume paths in their existing owners.

- Labyrinth maps persist on `activeRun.labyrinthMap` as Open Field `floors` and
  `nodes`. Generate floor 1 with seeded world RNG in the same command as the
  starting deck, including after a Wildcard starter draft. Core columns are 0–3;
  side rooms use columns -1 and 4. `currentNodeId` records the last completed room.
- Add modifiers in `content-systems/labyrinth/trait-catalog.ts`;
  `labyrinth/modifiers.ts` owns node eligibility, incompatible pairs, and exclusion
  of superseded modifiers from new rolls. Preserve existing saved IDs. Write
  descriptions of at most ten words, omit periods, use one theme, and never call
  a theme a “keyword” (enforced by `src/lib/content-validation/validators-typography.ts`; run `npm run content:audit`).
- Pass support-room modifiers through the existing active reward-modifier list
  before destination initialization. Apply offering modifiers before storing the
  shelf or event choices; see [shop changes](#change-a-shop),
  [Mystery effects](#adding-a-new-mystery-effect-kind), and
  [Corruption flow](#adding--changing-corruption-flow).
- Preserve supported saved geography and in-flight encounters. Below-baseline development maps are disposable under the [save baseline](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline); no historical grid/hex migration belongs in navigation.
- Cover the changed setup/resume route with focused unit tests using
  the affected setup and navigation suites. Select checks under the
  [verification policy](../CONTRIBUTING.md#what-to-run-when-you-change).

## Change battle playback

Start with [battle controllers](./BATTLE_CONTROLLERS.md#battle-path).

1. Change selection in `battle/playable-hand.ts` or the shared
   `src/lib/battle/autoplay-policy.ts`; change scheduling in
   `battle/autoplay-driver.ts`. Live scoring changes gameplay and simulation.
2. Keep gameplay commits in command owners and presentation work in the route's
   playback lifetime. Preserve [automation, draw and settlement rules](./BATTLE_CONTROLLERS.md#playback-and-automation-rules).
3. For visual changes, use [battle feedback](./UI_BATTLE.md#battle-feedback) and
   [battle motion](./UI_MOTION.md#battle-motion), including their timing owners.
4. Run affected playback units, then the [task gate](../CONTRIBUTING.md#what-to-run-when-you-change).
   Exercise changed interactions under [visual review](./UI_VISUAL_REVIEW.md).
   Timing checks use the shared [E2E fixture](../tests/e2e/README.md#test-import)
   with normal animations; never enable fast mode for a timing assertion.

## Adding a new screen

1. Add the route to `ROUTE_SCREENS` in `src/lib/routing/screens.ts`, classify it in
   `run-screen-router.ts` (`SCREEN_PHASE`), and add legal interactive edges in
   `screen-transition-policy.ts`. Derived unions/lists need no parallel registration.
2. Create/export the component in its `meta`, `run-setup` or `run-loop` screen
   directory. Use [shared page shells](./UI.md#placement-and-boundaries), choosers'
   `shared/config/layout.ts` widths and the app-owned menu. Main Menu/Battle retain
   their layout exceptions; `alchemy-shell` is for contained panels.
3. Register the statically imported component in the matching `src/app/screen-routes/`
   phase table. `SCREEN_ROUTES` checks completeness and React mounts the component.
4. Compose actions through existing controllers; `shell/route-commands.ts` derives
   their signatures. Keep display separate from commands. Context changes belong
   in `src/app/screen-routes/route-ctx.ts` and its consumers, not another method list.
5. Wire the caller's navigation trigger and classify the route in `SCREEN_FAMILIES`
   in `tests/interaction/screen-coverage.ts`; update the [screen map](../tests/interaction/README.md#screen-and-boundary-map).
   Check affected wiring and meaningful behavior under the shared test policy.

**For activity-backed screens:** add the exact selector in
`shared/stores/session/run-screen-data.ts` and its hook in `use-run-screen-data.ts`.
Those hooks retain outgoing data during fades; Battle uses its
[dedicated hook](./BATTLE_CONTROLLERS.md#battle-path). A visit clearing its own payload
also needs `useHeldWhile` and a shell fallback, as in
`app/screen-routes/mystery-screen-route.tsx`.

**For a new gameplay activity:** update `lib/active-run-session/run-activity.ts`,
initialization and the [resume codec](./RUN_WORKFLOWS.md#change-mid-run-resume-activerundata).
Update `src/app/playthrough/` adapters/legal choices and affected route mocks, save
fixtures and browser helpers. Verify initialization and current-format resume;
a route alone establishes no durable activity.

Use `resumeRun`/`resumeTo` for validated saved locations rather than adding menu
edges to every resumable screen. Restore bypasses interactive edges and cold boot
opens Menu; Continue opens saved activity. [Navigation timing](./BATTLE_CONTROLLERS.md#navigation-timing)
owns delay/commit behavior. Select narrow store slices (`useShallow` where needed)
to avoid combat-driven render churn. Family registration identifies protection,
not exhaustive action coverage.

---

## Adding a new destination (map node)

- **1. Add to `DESTINATIONS` const** — `src/lib/routing/destinations.ts`
- **2. Add to destination pool / availability** — `src/lib/routing/destination-availability.ts`
- **3. Offer construction (pure)** — `shared/run-flow/destination-flow.ts` — campaign start and run-loop progression pass offer history, boss ID, and command-bound RNG
- **4. Add display metadata** — `destinationMeta` in `src/features/alchemy/shared/config/metadata.ts` supplies the label, description, and artwork used by destination choices
- **5. Map room entry** — add the destination case in `src/features/alchemy/run-loop/run/room-entry-commands.ts` so entering the offered node opens an existing screen or activity
- **6. Add a screen and route when needed** — follow [Adding a new screen](#adding-a-new-screen); reuse an existing screen when the destination shares its interaction
- **7. Add localization and tests** — extract new labels, then cover offer rendering, availability, room entry, and current-format resume with focused tests

---

## Adding a new mystery effect kind

Start with [Mystery offer and resume rules](./GAME_RULES.md#mystery-visits).

- **1. Add `kind` string to `MysteryEffect` union** — `src/lib/mystery/types.ts`
- **2. Add a case to `applyMysteryEffect`** — `src/features/alchemy/run-loop/navigation/mystery-flow.ts`
- **3. Add fields to `MysteryEffectContext` if needed** — `mystery-flow.ts`
- **4. Wire event commands if needed** — `run-loop/navigation/mystery-event-navigation.ts`
- **5. Wire follow-up UI in mystery screen** — `run-loop/screens/mystery/mystery-screen.tsx` (exported via screens barrel)
- **6. Route-held fade / empty-visit continue** — `app/screen-routes/mystery-screen-route.tsx`
- **7. Persist new visit fields if the kind stores rolled results** — Mystery visit schema in `src/lib/validation/save-schemas/active-run.ts` + `src/lib/active-run-session/mystery-visit-persistence.ts`
- **8. Author choice `effects` in display order** — `src/lib/mystery/pool.ts`: XP → portrait reward → gold → materials per choice

---

## Adding / changing corruption flow

Preserve [Corruption outcomes and numeric bindings](./GAME_RULES.md#corruption-altars).

- **1. Card mutation rules** — `src/lib/corruption/`
- **2. Destination handlers (corrupt / exit / abandon)** — `run-loop/navigation/corruption-flow.ts`
- **2b. Shell wiring** — `createCorruptionFlowHandlers()` wired in `shell/run-flow-engine.ts` (receives advance/return callbacks plus labyrinth-map return)
- **3. Screen** — `run-loop/screens/corruption-screen.tsx`
- **4. Resume** — `session.activity` with kind `corruption` owns the result. `run-resume-codec.ts` persists it as `activeRun.activity` with kind `corruption` and the result in `data`; menu visits do not change the saved location.
- **5. Tests** — `tests/features/alchemy/run-loop/corruption.test.ts`, destination E2E Mystery/Corruption cases
