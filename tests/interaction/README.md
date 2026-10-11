# Connected interaction progress coverage

This suite connects commands, presentation, lifecycle hooks and input gates to
catch stalled actions and stale callbacks. It complements engine tests and the
headless playthrough runner, which intentionally skips presentation and makes
navigation immediate. Steam's Electron renderer is the acceptance target;
Chromium provides inexpensive renderer coverage. WebKit is not part of this gate.

## Run and replay

- `npm run test:interactions`: 16 fixed seeds per family, up to 40 actions each.
- `npm run test:interactions -- --tier nightly --day 2026-10-09`: 128 seeds per
  family, up to 120 actions each. The first 64 are fixed (17–80); the other 64
  derive from the supplied UTC date. Nightly does not duplicate push seeds 1–16.
- `npm run test:interactions -- --family battle --seed 12`: run one case.
- `npm run test:interactions -- --replay reports/runs/<run-id>/interaction/<family>-<seed>.json`:
  replay the recorded actions against the same seeded fixture.
- Add `--shrink` to replay or discovery to reduce a failure, with at most 64
  attempts and only while the same named invariant still fails.

Each family records generated and actually started seeds in its manifest under `reports/runs/<run-id>/interaction/`.
Nightly retains manifests even on success. Failures include the fixture, actions, completed observations, failing state and
named invariant. Reduced artifacts retain the original action history. Reports
are disposable verification output, not a second product state store.

Adapters retain real completion/cancellation logic. Only external seams are
controlled: storage I/O, clocks, frames, geometry, artwork loading and audio
output. Fake-clock advancement is bounded; normal UI animation completion is
delivered through the actual animation event handler. No lock reset, forced
click or page reload repairs a failing sequence. Fixture reset occurs only
between isolated cases. Progress is asserted after required work settles;
open menus, pending Wishes and failed saves awaiting recovery are legitimate
states. Font timeout is an existing startup recovery path.

## Screen and boundary map

Every route is assigned to a family below. Seeded adapters deliberately focus on
asynchronous ownership; retained focused suites protect transactions and
screen-specific behavior. A mapping is not a claim of exhaustive action coverage.

| Screens / boundary                                                            | Family               | Connected exploration and retained focused protection                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Battle                                                                        | battle               | Real controller, playback hooks, draw/transfer lifetime, inspection gate, autoplay and navigation interruption; `tests/features/alchemy/run-loop/battle/` covers enemy skips, companion ordering, Wish, terminal outcomes and cancellation. |
| Menu, game-mode-select, character-select, difficulty-select, draft-deck       | navigation           | Navigation/fade/tooltip ownership and real mode initialization/resume; `tests/features/alchemy/run-setup/run/content-system-navigation.test.ts` protects difficulty and draft commands.                                                     |
| Destination, labyrinth-map, rewards, wildwood-removal, game-over, run-victory | visits, navigation   | Reward claims across three modes, resume and repeated activation; `tests/features/alchemy/run-loop/run/run-reward-commit.test.ts`, room entry, destination flow and victory-handler suites protect progression and terminal settlement.     |
| Campfire, alchemist, transmutation                                            | visits               | Repeated service activation, invalid selections, payment, offer initialization and current-format resume; `alchemy-visits.test.ts` also covers Potion combinations, exhausted visits and room modifiers.                                    |
| Shop, trinket-shop, equipment-shop                                            | visits               | Retain `tests/features/alchemy/run-loop/shop/shop-transactions.test.ts`, `shop-actions.test.ts`, isolation and pricing suites for atomic purchase/refresh/rejection; screen feedback tests cover visible outcomes.                          |
| Mystery, corruption                                                           | visits, navigation   | Retain Mystery flow, corruption flow and route integration tests for deferred selection, continuation and resume.                                                                                                                           |
| Armory                                                                        | armory               | Real Gear mutation port, ordering and transfer hooks; resize/scroll interruption, filtering, missing geometry and rejection protection in the retained Armory suites.                                                                       |
| Talents, homestead                                                            | armory, navigation   | Permanent progression commands and screen tests retain purchase/eligibility coverage; meta navigation participates in seeded fade cancellation.                                                                                             |
| Collection, options                                                           | overlays, navigation | Shared modal/artwork/fade ownership and meta navigation; retained Collection, Options and keyboard browser journeys cover their specific controls.                                                                                          |
| Enemy/deck inspection, game menu, tooltips and keyboard focus                 | overlays, battle     | Real modal escape/backdrop/input shielding and battle inspection gate; retained modal, artwork, hand focus and inspection tests cover image replacement and disappearing selections.                                                        |
| All persisted screens                                                         | persistence          | Real autosave lifecycle, write queue and isolated backend under overlap, failure, exit and disposal; retained storage/bootstrap/teardown suites protect run replacement and clear epochs.                                                   |
| All initial renders and desktop windows                                       | startup              | Real startup readiness with delayed image/font/bootstrap ordering, frame delays and font timeout; Electron retains cold boot, display controls and save/relaunch coverage.                                                                  |

The map is checked against the route enum. New routes require an explicit family
and identified protection. Unit-only and full verification select this suite for
application, feature, animation, routing, artwork-loading and save-backend changes,
and avoid running it again through dependency-related selection in the same plan.
The default local smoke gate does not select it; see
[verification tiers](../../CONTRIBUTING.md#what-to-run-when-you-change).

## Renderer and desktop checks

`tests/electron/interaction-canaries.spec.ts` adds two push journeys: last-Mana
draw/inspection/End Turn, and repeated Campfire completion with keyboard
navigation. Five deeper journeys run nightly: reduced-motion draw/inspection, overlapping draws/autoplay,
Armory transfer interruption, native focus/fullscreen return, and save failure
recovery/relaunch. They use isolated profiles, actual player controls and normal
animations. The native focus case requires a visible CI virtual display (or an
explicitly requested local foreground run); a synthetic bridge event is not proof
of native focus behavior. Existing cold-start and packaged Windows startup
checks remain separate.

Electron failures use the existing bounded accessibility/HTML diagnostic owner.
Do not globally filter runtime errors. Injected storage failures must match the
specific expected errors before recovery; unexpected errors fail the journey.

Local unit discovery does not prove Electron acceptance, packaged Steam behavior,
native Windows focus or hosted CI. Browser/Electron execution, builds and full
static validation follow the explicit-execution policy in CONTRIBUTING. Test
collection proves selection only. Validate actual journeys in their configured
CI tier before treating a release as qualified.

## Combat outcome cohorts and suspension

Battle seeds rotate through eight named live-card cohorts: mitigated hits, Phoenix
Health costs, fatal retaliation, Poison overkill Leech, crowd-control immunity,
companions on skipped turns, Wish/draw takeover, and Consume at last Mana. Boundary
statuses are labeled as injected rather than earned career progression. Each case
starts with a fixed world-seed probe and an independent expected outcome before exploring
random player actions. Fixed world streams keep the probe expectation independent
of random Critical/Dodge outcomes; action seeds vary later RNG consumption through
interleavings. Legal owned Dagger/Bone Charm/Toxic Profit builds and resistance/detonation
variants participate in the same cohorts. Failures retain the cohort, initial checkpoint, expected/actual
outcomes, and the usual replay/shrink evidence. Resume compares state and world RNG;
pile checks detect duplicate card identities.

The frame seam can suspend delivery while timers continue, then resume actual
queued callbacks. This exercises delayed frames without claiming OS sleep evidence.
The isolated Electron crash suite separately terminates owned processes at IPC,
temporary-write, sync, backup-rotation, and replacement barriers. Test controls live
only in the test preload. Three push canaries cover completed purchases, reward
claims, and battle victory; deeper write-stage interruptions run nightly.
