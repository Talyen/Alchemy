# Alchemy — Implementation Workflows

Step-by-step checklists for adding or changing game content and wiring.

For refactors and simplification passes on attached paths, use [Docs/Audits](./Audits/README.md) when the user cites an audit.

**Import paths:** only `@/*` → `src/*` in `tsconfig.json`. Use **on-disk** capability paths under `src/features/alchemy/` (for example `@/features/alchemy/shared/stores/run-reads`) — not legacy alias paths that skip `shared/`.

**Read scope:** use the task index to locate missing context. Batch related
sections when useful and skip material already understood; follow dependencies
when they matter to the requested behavior. Generated asset barrels are
outputs; use the [asset workflow](./WORKFLOWS-ASSETS.md) for their sources and
regeneration. Each checklist's tests are selected by the changed-path route
([CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change)); only
catalog-external tests are named inline. Named suites are verification entry points. Apply the [test value policy](../CONTRIBUTING.md#test-value-and-coverage-strategy) throughout; section-specific save-compatibility and browser-timing requirements still apply.

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
2. Register Gear art via the [asset workflow § Add or replace Gear art](./WORKFLOWS-ASSETS.md#add-or-replace-gear-art) (naming/slot violations throw during sync). A base without art still builds its definitions with fallback art so loot and saves keep working, but the gap fails `content:audit` and the definitions tests — never ship with `missingGearArtDefinitionIds` non-empty.
3. Register the base item's Unique in `src/lib/gear/unique-catalog.ts`, with one exclusive fixed signature and three fixed standard supporting affixes. Every base item needs one Unique; ordinary variant generation does not create it. Follow [Unique affix and combat contracts](./UNIQUE_ITEMS.md) for signature implementation and interaction documentation.
4. For new affixes, add definitions in `src/lib/gear/ordinary-affixes.ts` or `src/lib/gear/unique-affixes.ts` with stable IDs, `keywordId`, effect keys, value ranges, and eligible slots. Keep `keywordId` aligned with affinity weighting and `effectKey` aligned with `GEAR_EFFECT_KEYS`; wire new effects into the manifest and their consumers. Display/roll helpers live in `affixes.ts`, pool filtering in `affix-pool.ts`, and description formatting in `formatAffixDescription` (`affix-catalog.ts`), shared by tooltips and the unique catalog. Percent-based bonuses use `ROLL_PERCENT`, never the resist-only `ROLL_RESIST`.
5. Update Gear save schemas/defaults and migration fixtures when instance or loadout shapes change. Unique instances store no affix rolls — only identity — with reads resolving `getUniqueAffixes()`.
6. Run `npm run content:audit` (enforces the affix-catalog, pool, and Unique invariants in `validators-gear.ts`) and `npm run balance:loot` when loot weights or depth curves change. New affixes must also satisfy the `uniqueOnly` fixed-roll rule and the description typography rule.
7. Check affected Gear behavior, including existing Unique catalog coverage and save compatibility for instance or loadout shape changes. HP-sync write paths: [ARMORY.md § Write paths](./ARMORY.md#write-paths). Rewards store the exact `GearInstance` and never re-roll on acceptance; never put definition objects or art URLs into saves.

---

## Change a shop

Ownership: [ARCHITECTURE.md § Shop commands](./ARCHITECTURE.md#shop-commands). Kind `"merchant"` is the player-facing Card Shop.

1. Locate the shop's command module, sampler, and draft recipe using the ownership map above; keep slot identity helpers separate from command/audio modules.
2. Dispatch purchases/refreshes through the existing shop transaction seam; play SFX only when its result confirms success. Equipment purchases resolve price and acquired contents from the live shelf item by instance ID.
3. Preserve the per-visit `firstPurchaseUsed` reset and use `mutateGearWithRunHealthSync` inside an open command draft; use the dispatching gear wrapper only at the outer boundary ([ARMORY.md § Write paths](./ARMORY.md#write-paths)).
4. Route every refresh through `refreshShopOfferings` with a sampler from `shop-state-init.ts` and an explicit typed shelf assignment. Apply potency or other offering modifiers inside the sampler so returned items match the committed shelf. The recipe clears purchased slots and consumes a refresh only on success; rejected refreshes never sample. Refreshes avoid the current offering set when enough eligible alternatives exist. Equipment refreshes compare base items across rarities and preserve room themes. When a pool is nearly exhausted, keep the shelf full while maximizing novel offerings.
5. Potion mixing scales amounts inside every chance branch while preserving probabilities; descriptions must reflect every alternative outcome. Same-ID ingredients combine through doubling only when their effects match; different-potency copies preserve both effect lists so ingredient order cannot create or destroy potency.

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
- Cover the changed setup/resume route with the dependency-related tests selected
  by `verify`.

## Change battle playback

Wiring: [ARCHITECTURE.md § Battle path](./ARCHITECTURE.md#battle-path) (ticks stay on the battle route; session autoplay preferences stay in the controller).
Visible behavior: [UI battle feedback](./UI_BATTLE.md#battle-feedback) and [battle motion](./UI_MOTION.md#battle-motion) (burst contract, death/survival behavior, attacker lunge and timing owners).

- Autoplay picks greedily: highest `getEffectiveDamageScore` wins (ties go left), restricted to defensive cards at half health or below, and Wish options resolve with the same score plus a hover preview. Picks live in `battle/playable-hand.ts` (`findBestPlayableHandCard`, `findBestWishChoice`) and the loop in `battle/autoplay-driver.ts` (`driveAutoplay`). Live scoring lives in `src/lib/battle/autoplay-policy.ts`; `src/lib/balance/play-policy.ts` re-exports it for reports. Retuning the live owner changes gameplay; independent simulation policies belong in the simulator.
- Presentation updates may wake autoplay readiness/retry waits, but cannot shorten the post-play pause. Measure that pause from the start of the successful play, counting transfer time toward it; longer transfers add no extra pause. Teardown cancels either wait, and autoplay rechecks current playback gates before the next play.
- Autoplay previews are uncommitted: the route forwards the driver’s abort signal and live playback eligibility check to the card handler. Disabling autoplay or unmounting cancels the preview; after its delay, recheck the session and all playback gates before committing. A cancelled preview must not clear a newer preview.
- Manual card plays commit immediately and remain available during other card draws and hand reflow; only the incoming hidden cards and actual turn transitions are unavailable. Resolve clicked cards by hand identity so reflow cannot invalidate their old slot. Autoplay, auto-end-turn, and End Turn share one gate (`isBattlePlaybackBlocked` in `battle/autoplay-driver.ts`). Send each resolved action through `presentCombatTexts` in `battle/controller-utils.ts` under the [battle feedback contract](./UI_BATTLE.md#battle-feedback). Concurrent draws preserve each other’s hidden cards and transfers; settlement checks the current battle state. Schedule auto-end explicitly after draws/resume; do not rely on React battle-state ticks. Opening the game menu cancels the auto-end countdown; closing it starts a fresh normal countdown only when eligible. Recheck the latest playback gates and hand playability when the countdown expires.
- Defer defeat teardown until the delayed screen transition commits; keep [battle timing](../src/lib/game-constants/battle-timing.ts) aligned with `combatant-attack-lunge` in [keyframes](../src/styles/keyframes.css) and the shake delay in [theme styles](../src/styles/theme.css). Death, survival, and lunge composition details live in [UI battle motion](./UI_MOTION.md#battle-motion).
- Wish choices open after active card transfers finish. Cards with both Draw and Wish show their draws first; queued Wishes also wait for the previous chosen card to reach the hand. Use the existing transfer-in-progress presentation signal without delaying gameplay commits.
- Preserve immutable hidden-hand keys, callback binding, post-death navigation timing, and the rule that mid-enemy-turn reload skips presentation replay.
- Run the focused battle playback tests and the selection from `verify`; use the shared browser fixture with real timing for animation coverage, following [the E2E guide](../tests/e2e/README.md#test-import). Do not request `fastBattle` or enable fast mode when timing is under test.

## Adding a new screen

1. Add the screen to `Screen` and `ROUTE_SCREENS` in `src/lib/routing/screens.ts`.
2. Classify it in `src/lib/routing/run-screen-router.ts` (`SCREEN_PHASE`) and add every legal interactive edge in `src/lib/routing/screen-transition-policy.ts`. Run-loop lists derive from `SCREEN_PHASE`; `use-screen-transitions.ts` owns delay/immediate/commit timing, not taxonomy.
3. Create the component under `run-loop/screens/`, `run-setup/screens/`, or `meta/screens/`, and export it from that directory's `index.ts`.
4. Use `TitledScreenShell` from `shared/ui/layout-components.tsx`; `ScreenShell` is transparent and layout-only. `TitledScreenShell` owns the full-stage overflow wrapper so plasma shows through, and the app stage owns the background. Reserve `alchemy-shell` for contained panels. Main Menu and Battle are exceptions; choosers use widths from `shared/config/layout.ts`. The global menu button lives in `App.tsx`, so screens wire no menu props.
5. Wire the route in the matching phase table under `src/app/screen-routes/` (`meta-routes`, `run-setup-routes`, or `run-loop-routes`).
6. For resumable screens that can lose visit data during a fade, use a thin route wrapper with `useHeldWhile` and a shell fallback, following `app/screen-routes/mystery-screen-route.tsx`.
7. If new props are needed, extend the phase route context and `RenderAlchemyScreenProps` in `src/app/screen-routes/route-ctx.ts` and `src/app/screen-routes/index.tsx`.
8. Wire the navigation trigger at the caller of `goToScreen("<name>")`.

Boot restore/hydration sets a validated saved screen directly and intentionally bypasses the interactive transition table. Screen components subscribing to Zustand stores should select narrow slices or use `useShallow` to prevent render churn during high-frequency combat ticks.

---

## Adding a new destination (map node)

- **1. Add to `DESTINATIONS` const** — `src/lib/routing/destinations.ts`
- **2. Add to destination pool / availability** — `src/lib/routing/destination-availability.ts`
- **3. Offer construction (pure)** — `shared/run-flow/destination-flow.ts` — campaign start and run-loop progression pass offer history, boss ID, and command-bound RNG

---

## Adding a new mystery effect kind

Mystery Boon choices prefer distinct unowned Boons across alternatives, but an unchosen alternative cannot exhaust the pool: reuse an available Boon across mutually exclusive choices before falling back to Astral Gear. Multiple grants within one choice remain distinct.

The committed `mysteryChosenChoice` records Material amounts actually awarded, including Homestead find bonuses, for the reward summary and save/resume. Keep the offered event's base amounts unchanged and apply bonuses only at the grant. `applyMysteryEffect` returns the actual Material award in `MysteryEffectResult`; navigation records that result without reconstructing it from inventory differences. In content systems that award no run materials (Wildwood), the grant reports a zero award so the recorded choice still matches.

`removeCard` removes a random deck card immediately with no picker. The old player-choice removal picker is retired: `handleMysteryRemoveCard` and the screen's remove phase are gone, and `mysteryPendingRemoval` persists only so old saves still parse.

Live pool events are authored in `src/lib/mystery/pool.ts`; other `MysteryEffect` kinds stay on the union and handlers for authoring even when no live event uses them.

- **1. Add `kind` string to `MysteryEffect` union** — `src/lib/mystery/types.ts`
- **2. Add a case to `applyMysteryEffect`** — `src/features/alchemy/run-loop/navigation/mystery-flow.ts`
- **3. Add fields to `MysteryEffectContext` if needed** — `mystery-flow.ts`
- **4. Wire event commands if needed** — `run-loop/navigation/mystery-event-navigation.ts`
- **5. Wire follow-up UI in mystery screen** — `run-loop/screens/mystery/mystery-screen.tsx` (exported via screens barrel)
- **6. Route-held fade / empty-visit continue** — `app/screen-routes/mystery-screen-route.tsx`
- **7. Persist new visit fields if the kind stores rolled results** — Mystery visit schema in `src/lib/validation/save-schemas/active-run.ts` + `src/lib/active-run-session/mystery-visit-persistence.ts`
- **8. Author choice `effects` in display order** — `src/lib/mystery/pool.ts`: XP → gold → materials → portrait reward per choice

---

## Adding / changing corruption flow

Numeric corruption also updates matching delayed repeats of the changed effect, so the later turn agrees with the card description. A shared damage number, such as Serrated Edge's Physical-or-Bleed amount, updates both alternatives without consuming the numeric target for a separately described effect. Wishing Well's visible Gold number maps to its Gold branch while its unnumbered Wish remains fixed; Powerful Wish uses the same numeric mapping. Unrelated repeated effects retain their values.

- **1. Card mutation rules** — `src/lib/corruption/`
- **2. Destination handlers (corrupt / exit / abandon)** — `run-loop/navigation/corruption-flow.ts`
- **2b. Shell wiring** — `createCorruptionFlowHandlers()` wired in `shell/run-flow-engine.ts` (receives advance/return callbacks plus labyrinth-map return)
- **3. Screen** — `run-loop/screens/corruption-screen.tsx`
- **4. Resume** — `session.corruptionResult` via `run-resume-codec.ts` (`encodeCorruptionResult`, screen-scoped)
- **5. Tests** — `tests/features/alchemy/run-loop/corruption.test.ts`, destination E2E Mystery/Corruption cases
