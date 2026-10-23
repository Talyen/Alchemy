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

Item model, generation, Uniques, and write paths: [ARMORY.md](./ARMORY.md) (data model, write paths, battle integration, persistence).

1. Add base item metadata in `src/lib/gear/base-items.ts` (slots, two-hand rule, affinity keywords, available rarities, thematic homestead `salvageByRarity`). Salvage consumes `salvageValue` on the generated definition.
2. Register Gear art via the [asset workflow § Add or replace Gear art](./WORKFLOWS-ASSETS.md#add-or-replace-gear-art) (naming/slot violations throw during sync). A base without art still builds its definitions with fallback art so loot and saves keep working, but the gap fails `content:audit` and the gear validation tests — never ship an ordinary definition without generated barrel art (Uniques reuse their base item's Astral art).
3. Register the base item's Unique in `src/lib/gear/unique-catalog.ts`, with one exclusive fixed signature and three fixed standard supporting affixes. Every base item needs one Unique; ordinary variant generation does not create it. Follow [Unique affix and combat contracts](./UNIQUE_ITEMS.md) for signature implementation and interaction documentation.
4. For new affixes, append definitions in `src/lib/gear/affix-rows.ts` with stable IDs, `keywordId`, effect keys, value ranges, and eligible slots. Keep `keywordId` aligned with affinity weighting; effect keys and numeric manifest defaults derive from the catalog. Independent-roll chance effects are recognized by the `Chances` suffix in their effect key (derived in `gear-effect-manifest.ts`); every other effect sums numerically. Display/roll helpers live in `affixes.ts`, pool filtering in `affix-pool.ts`, and description formatting in `formatAffixDescription` (`affix-catalog.ts`), shared by tooltips and the unique catalog. Percent-based bonuses use `ROLL_PERCENT`, never the resist-only `ROLL_RESIST`.
5. Update Gear save schemas/defaults and migration fixtures when instance or loadout shapes change. Unique instances store no affix rolls — only identity — with reads resolving `getUniqueAffixes()`.
6. Run `npm run content:audit` (enforces the affix-catalog, pool, and Unique invariants in `validators-gear.ts`) and `npm run balance:loot` when loot weights or depth curves change. New affixes must also satisfy the `uniqueOnly` fixed-roll rule and the description typography rule.
7. Check affected Gear behavior, including existing Unique catalog coverage and save compatibility for instance or loadout shape changes. HP-sync write paths: [ARMORY.md § Write paths](./ARMORY.md#write-paths). Rewards store the exact `GearInstance` and never re-roll on acceptance; never put definition objects or art URLs into saves.

---

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
  `npm run test:unit -- <test-paths>` or select affected unit suites with
  `npm run check -- <task-owned paths>` under the [verification policy](../CONTRIBUTING.md#what-to-run-when-you-change).

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

1. Add the screen to `ROUTE_SCREENS` in `src/lib/routing/screens.ts`; `Screen` and the runtime value list derive from it.
2. Classify it in `src/lib/routing/run-screen-router.ts` (`SCREEN_PHASE`) and add every legal interactive edge in `src/lib/routing/screen-transition-policy.ts`. Run-loop lists derive from `SCREEN_PHASE`; `use-screen-transitions.ts` owns delay/immediate/commit timing, not taxonomy.
   Ordinary edges cover new-run setup and player actions. Returning to an existing run uses `resumeRun` and its validated saved screen through `resumeTo`; do not add every resumable screen as an ordinary edge from menus or meta screens.
3. Create the component under `run-loop/screens/`, `run-setup/screens/`, or `meta/screens/`, and export it from that directory's `index.ts`.
4. Use `TitledScreenShell` from `shared/ui/layout-components.tsx`; `ScreenShell` is transparent and layout-only. `TitledScreenShell` owns the full-stage overflow wrapper so plasma shows through, and the app stage owns the background. Reserve `alchemy-shell` for contained panels. Main Menu and Battle are exceptions; choosers use widths from `shared/config/layout.ts`. The global menu button lives in `App.tsx`, so screens wire no menu props.
5. Wire the route in the matching phase table under `src/app/screen-routes/` (`meta-routes`, `run-setup-routes`, `run-loop-routes`, or `run-end-routes`). Register a statically imported component; `SCREEN_ROUTES` checks completeness and mounts it through React.
6. For activity-backed run screens, add the exact display selector in `shared/stores/session/run-screen-data.ts` and its capability hook in `use-run-screen-data.ts`. Those hooks retain outgoing data during fades; Battle keeps its dedicated [route display hook](./BATTLE_CONTROLLERS.md#battle-path). When the visit also clears its payload within the screen, use `useHeldWhile` and a shell fallback, following `app/screen-routes/mystery-screen-route.tsx`.
7. Add required actions through the existing controller composition. `shell/route-commands.ts` derives its command types from those factories and limits the battle surface exposed to routes; do not add a second handwritten method inventory. Route display stays separate from commands. If route context props must change, update their owner in `src/app/screen-routes/route-ctx.ts` and its callers; `index.tsx` re-exports that contract.
8. For a new gameplay activity, update `lib/active-run-session/run-activity.ts` and its initialization, then encode/decode resumable data through the [resume workflow](./RUN_WORKFLOWS.md#change-mid-run-resume-activerundata). A route alone does not establish an activity or saved location.
9. Wire the navigation trigger at the caller of `goToScreen("<name>")`. For run activities, also update the production-flow adapter and legal choices in `src/app/playthrough/` so headless careers can proceed. Review affected route mocks, save fixtures, and browser helpers against the new contracts; verify initialization and current-format resume with focused unit tests.
10. Classify the route in `SCREEN_FAMILIES` in `tests/interaction/screen-coverage.ts` and update the [interaction screen map](../tests/interaction/README.md#screen-and-boundary-map) with its lifecycle family and retained protection. This exhaustive registration does not by itself prove action coverage; choose tests under the shared [test value policy](../CONTRIBUTING.md#test-value-and-coverage-strategy).

Restore/hydration bypasses the interactive transition table. Cold startup opens the main menu while preserving the validated saved activity; Continue resumes that activity through the resume policy. Screen components subscribing to Zustand stores should select narrow slices or use `useShallow` to prevent render churn during high-frequency combat ticks.

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
