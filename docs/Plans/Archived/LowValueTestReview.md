---
status: complete
updated: 2026-09-12
---

# Low-Value Test Review

## Purpose

Review the unit, browser UI, and Electron test suites and identify only low-value tests for possible removal, consolidation, or movement to a cheaper layer. Medium- and high-value tests are intentionally omitted.

Low value means that a test:

- protects only cosmetic styling, exact CSS, or an implementation detail;
- duplicates stronger coverage at another layer;
- is a generic render or object-shape smoke test with no meaningful outcome; or
- has maintenance cost disproportionate to the behavior it protects.

Save compatibility, battle mechanics, progression, accessibility, persistence, security, architectural contracts, documented responsive behavior, anti-flash behavior, and meaningful real-timing behavior remain out of scope for retirement.

When a test mixes low-value assertions with a meaningful contract, retain the meaningful assertion and remove only the literal CSS, palette, or markup checks. Every consolidation must name the surviving test or move the assertion to the cheapest layer that can still detect the failure.

## Retain or consolidate, but do not retire

### App seams and shared helpers

- [`tests/app/startup-pref.test.ts`](../../../tests/app/startup-pref.test.ts): retain both the enabled and default branches. The global reduced-motion preference is an accessibility and startup contract, and there is no equivalent integration assertion.
- [`tests/app/particle-config.test.ts`](../../../tests/app/particle-config.test.ts): consolidate to a compact table-driven test covering boss versus normal battle intensity and the stale boss flag being ignored off the battle screen. Do not remove the off-battle guard.
- The former consolidation-only row helper test was removed after its cases moved into [`tests/lib/game-data/talent-pool.test.ts`](../../../tests/lib/game-data/talent-pool.test.ts), retaining both `chunkIntoRows` overloads.
- [`tests/features/alchemy/shared/ui/fade-presence.test.ts`](../../../tests/features/alchemy/shared/ui/fade-presence.test.ts): retain the direct `fadePhaseClass` mapping or fold it into `use-fade.test.tsx` with explicit CSS-class assertions. The existing hook tests assert phases, not the generated classes.
- [`tests/features/alchemy/shared/ui/unlock-text.test.tsx`](../../../tests/features/alchemy/shared/ui/unlock-text.test.tsx): consolidate to representative implicit-keyword coverage plus the explicit `**...**` markdown branch. Do not reduce all parser branches to one case.

### Item-shine and palette contracts

The item-shine rules in [`docs/UI.md`](../../UI.md#item-shine) are semantic presentation contracts. Retain representative coverage for keyword extraction, fallbacks, actual-affix versus base-affinity behavior, Unique/basic distinctions, legacy normalization, title keyword ordering/capping, and adapter wiring. Remove only redundant exact color/gradient literals.

- [`tests/features/alchemy/shared/config/boss-shine.test.ts`](../../../tests/features/alchemy/shared/config/boss-shine.test.ts): retain keyword aggregation, fallback colors, and repeated-stop removal; the exact gradient-string test may be retired.
- [`tests/features/alchemy/shared/config/plasma-palettes.test.ts`](../../../tests/features/alchemy/shared/config/plasma-palettes.test.ts): retain the one-keyword, multi-keyword, wildcard, enemy ability/trait aggregation, gear-affix filtering, Unique, Death’s Door, and hex interpolation behaviors. Consolidate repeated adapter cases rather than deleting the mapping contract.
- [`tests/features/alchemy/shared/config/shine-palettes.test.ts`](../../../tests/features/alchemy/shared/config/shine-palettes.test.ts): retain card/trinket/character fallbacks, described-keyword ordering, Wildcard behavior, and one representative gradient-builder case. Exact repeated gradient strings can be consolidated.
- [`tests/lib/gear/gear-shine.test.ts`](../../../tests/lib/gear/gear-shine.test.ts): retain actual-affix keyword extraction, affinity prioritization without adding absent keywords, Unique/basic behavior, legacy/content distinctions, and the three-keyword text cap/order. Consolidate repeated exact-color assertions.
- [`tests/features/alchemy/shared/ui/gear-affix-shine.test.tsx`](../../../tests/features/alchemy/shared/ui/gear-affix-shine.test.tsx): retain the rendered Dance-of-Blades separation and normalized-legacy-roll regression. If the 103-case catalog matrix is too costly, move it to a cheap data-invariant test that still verifies every description keyword has a corresponding shine stop; do not silently retire that invariant.
- [`tests/features/alchemy/shared/ui/shine-border.test.tsx`](../../../tests/features/alchemy/shared/ui/shine-border.test.tsx): retain the canonical ShineBorder suite covering external border-box placement, opaque paint, and persistent-versus-glow state. The duplicate component-level suite was removed.

### Interaction, accessibility, and battle presentation

- [`tests/features/alchemy/shared/ui/card-button.test.tsx`](../../../tests/features/alchemy/shared/ui/card-button.test.tsx): retain `scaleOnHover={false}` and the disabled/dragging/hover eligibility behavior. The simple default class assertion can be folded into one of those cases.
- [`tests/features/alchemy/shared/ui/battle/actor-panel-helpers.test.tsx`](../../../tests/features/alchemy/shared/ui/battle/actor-panel-helpers.test.tsx): retain active/inactive turn-border visibility and the border-box placement. Exact palette literals can be consolidated.
- [`tests/features/alchemy/shared/ui/battle/companion-panel.test.tsx`](../../../tests/features/alchemy/shared/ui/battle/companion-panel.test.tsx): retain active/inactive behavior, one companion palette representative, and the `turnShineColors` override. Remove only redundant per-companion color enumeration.
- [`tests/features/alchemy/shared/ui/battle/actor-panel.test.tsx`](../../../tests/features/alchemy/shared/ui/battle/actor-panel.test.tsx): retain the dead-enemy suppression or combine living/dead behavior into one test. The live enemy color literal may be retired if the shared mapping test remains.
- [`tests/features/alchemy/shared/ui/battle/combatant-status-effect-presentation.test.tsx`](../../../tests/features/alchemy/shared/ui/battle/combatant-status-effect-presentation.test.tsx): retain the active clipping/composition assertion; it protects battle feedback layering around the portrait canvas. The inactive case already remains.
- [`tests/features/alchemy/run-setup/screens/character-select-screen.test.tsx`](../../../tests/features/alchemy/run-setup/screens/character-select-screen.test.tsx): retain pointer and keyboard plasma-owner registration. This is screen-level focus/interaction wiring, not just a color choice.
- [`tests/features/alchemy/run-setup/screens/draft-deck-screen.test.tsx`](../../../tests/features/alchemy/run-setup/screens/draft-deck-screen.test.tsx): retain the duplicate-card hover identity test and one hover-to-plasma integration case. Duplicate cards must not share presentation state.
- [`tests/features/alchemy/meta/screens/collection/collection-tile.test.tsx`](../../../tests/features/alchemy/meta/screens/collection/collection-tile.test.tsx): retain a reduced discovered/undiscovered hover-and-focus representative. The E2E suite does not cover every Collection tile kind or the full locked-entry focus path.
- [`tests/features/alchemy/meta/screens/collection-screen.test.tsx`](../../../tests/features/alchemy/meta/screens/collection-screen.test.tsx): retain the undiscovered-art concealment assertion. Grayscale/opacity is the concealment behavior, not incidental styling.
- [`tests/features/alchemy/meta/screens/menu-screen.test.tsx`](../../../tests/features/alchemy/meta/screens/menu-screen.test.tsx): retain one locked-button or Play-focus plasma integration case; remove only the duplicate source case.
- [`tests/features/alchemy/run-loop/screens/rewards-screen.test.tsx`](../../../tests/features/alchemy/run-loop/screens/rewards-screen.test.tsx): retain one generic focus/hover reward case and the Unique rolled-keyword case. Those verify reward-surface wiring and item-shine semantics; remove duplicate per-item decoration checks.
- [`tests/features/alchemy/shared/ui/remove-card-grid-tooltip.test.tsx`](../../../tests/features/alchemy/shared/ui/remove-card-grid-tooltip.test.tsx): retain or move into a RemoveCardPanel/card-selection interaction test. It is the only top-row tooltip and pointer-events regression assertion.

### Responsive, timing, and anti-flash behavior

- [`tests/features/alchemy/run-loop/screens/run-end-screen.test.tsx`](../../../tests/features/alchemy/run-loop/screens/run-end-screen.test.tsx): retain row balancing and the ResizeObserver/Game Size recalculation test. These implement the documented fixed-width recap layout; fold redundant width/no-paging assertions into the surviving cases.
- [`tests/features/alchemy/meta/screens/homestead-screen.test.tsx`](../../../tests/features/alchemy/meta/screens/homestead-screen.test.tsx): retain the short-page filler-slot assertion and either retain or fold the centered-grid gap assertion into the homestead layout coverage. Both were added with the companion pagination/layout fix.
- [`tests/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout.test.ts`](../../../tests/features/alchemy/run-loop/screens/labyrinth/labyrinth-map-layout.test.ts): retain the pure layout algorithm test. It is cheaper and more diagnostic than the browser matrix, so the E2E test is not a reason to delete it.
- [`tests/e2e/specs/display-sizing.spec.ts`](../../../tests/e2e/specs/display-sizing.spec.ts): retain the independent Game Size/Tooltip Size and viewport-boundary contract. Screenshots and redundant raw CSS literals may be removed, but not the scale and readability behavior.
- [`tests/e2e/specs/aspect-ratio-layout.spec.ts`](../../../tests/e2e/specs/aspect-ratio-layout.spec.ts): retain the card-removal stability test because it directly covers the documented fixed-height card area and stationary header/actions across pages.
- [`tests/e2e/specs/talents-flow.spec.ts`](../../../tests/e2e/specs/talents-flow.spec.ts): retain one representative long-description viewport case rather than deleting the readability protection.
- [`tests/e2e/specs/labyrinth.spec.ts`](../../../tests/e2e/specs/labyrinth.spec.ts): retain the hover/focus/selection position test and the current/dim/boss state-precedence test. These directly cover the Labyrinth map contract, including reduced motion and persistent boss glow.
- [`tests/e2e/specs/overlay-transitions.spec.ts`](../../../tests/e2e/specs/overlay-transitions.spec.ts): retain the Armory outgoing-label test. It protects the documented identity boundary during an in-flight fade.
- [`tests/features/alchemy/run-loop/screens/mystery-event-intro.test.tsx`](../../../tests/features/alchemy/run-loop/screens/mystery-event-intro.test.tsx): retain the animated word-token test. `TextAnimate` is deliberately reserved for Mystery narrative and has no equivalent browser assertion.

For [`tests/e2e/specs/card-hover-layout.spec.ts`](../../../tests/e2e/specs/card-hover-layout.spec.ts), consolidate only genuinely repeated canaries. Keep distinct coverage for battle turn-border precedence, Labyrinth selection/boss state, equipped-art clipping, and one Collection plus one reward interaction. The Homestead affordability-preservation case may remain if no component replacement asserts that hover cannot alter action state. Wildcard color-specific checks and repeated Collection/Victory variants may be reduced.

## Low-Value Candidates

Parameterized tests are listed by declaration and include their generated cases.

### Unit and component tests

- Basic primitive, projection, action-shape, currency-render, and resource-row smoke files were removed; stronger wrapper, engine, and screen coverage remains as described above.
- [`tests/features/alchemy/shared/ui/layout-components.test.tsx`](../../../tests/features/alchemy/shared/ui/layout-components.test.tsx):11, 21 — consolidate to one representative header-composition test, retaining the back-button behavior.
- The static cycling-shine keyframe/CSS-variable suite was removed; shared ShineBorder and reduced-motion coverage remains for the cosmetic animation.
- [`tests/features/alchemy/shared/ui/battle/combatant-attack-lunge.test.tsx`](../../../tests/features/alchemy/shared/ui/battle/combatant-attack-lunge.test.tsx):62 — remove the generic `className` passthrough assertion; retain the stale-token, attack-token, and cast-token behavior tests.

### Screen-level presentation

- [`tests/features/alchemy/meta/screens/armory-screen.test.tsx`](../../../tests/features/alchemy/meta/screens/armory-screen.test.tsx):190, 229 — remove the duplicate astral/trinket Shine integration assertions after the shared item-shine and one reward/Armory representative survive.
- [`tests/features/alchemy/meta/screens/armory-screen-tooltips.test.tsx`](../../../tests/features/alchemy/meta/screens/armory-screen-tooltips.test.tsx):86, 102, 116 — consolidate the Armory-specific width/chip checks to one representative tooltip integration case.
- [`tests/features/alchemy/meta/screens/homestead/helpers.test.tsx`](../../../tests/features/alchemy/meta/screens/homestead/helpers.test.tsx):12, 34 — remove exact material-chip Tailwind class assertions; retain data mapping, known/fallback art, and pagination constants.
- [`tests/features/alchemy/meta/screens/homestead/companion-node.test.tsx`](../../../tests/features/alchemy/meta/screens/homestead/companion-node.test.tsx):72 — remove the duplicate locked-tile color/shine assertion; retain discovery, affordability, click suppression, and completion behavior.
- [`tests/features/alchemy/meta/screens/homestead/upgrade-node.test.tsx`](../../../tests/features/alchemy/meta/screens/homestead/upgrade-node.test.tsx):41, 96, 111 — remove exact hover-shine and tier-zero class assertions; retain affordable/unaffordable action behavior and max-tier rendering.
- [`tests/features/alchemy/run-setup/screens/difficulty-select-screen.test.tsx`](../../../tests/features/alchemy/run-setup/screens/difficulty-select-screen.test.tsx):128 — remove the isolated hover-store side-effect assertion; shared interactive-card coverage and selection tests remain.
- [`tests/features/alchemy/run-loop/screens/mystery-reward-summary.test.tsx`](../../../tests/features/alchemy/run-loop/screens/mystery-reward-summary.test.tsx):192 — remove the duplicate astral-gear hover decoration assertion; retain granted-item/fallback/tooltip behavior.
- [`tests/lib/mystery/mystery-events.test.ts`](../../../tests/lib/mystery/mystery-events.test.ts):34 — remove the catalog em-dash assertion because the content validator and repository lint enforce the same rule. Update the rationale to cite those actual consumers, not the ESLint rule unit test.

### E2E/UI tests

- [`tests/e2e/specs/collection.spec.ts`](../../../tests/e2e/specs/collection.spec.ts):101, 128, 140, 150 — retain heading stability plus one landscape and one portrait aspect-ratio/overflow representative; remove the duplicate unique-portrait variant.
- [`tests/e2e/specs/shop-layout.spec.ts`](../../../tests/e2e/specs/shop-layout.spec.ts):10, 43 — keep at most one post-purchase layout canary and one mixed-potion result-placement assertion if no cheaper component/screen test covers that result placement.
- [`tests/e2e/specs/run-setup.spec.ts`](../../../tests/e2e/specs/run-setup.spec.ts):21, 101 — remove the pure portrait-gap geometry test and the misleading Wizard test, which does not assert a Wizard-specific difference.
- [`tests/e2e/specs/homestead-flow.spec.ts`](../../../tests/e2e/specs/homestead-flow.spec.ts):36 — remove the visibility-only construction-button smoke test; retain the shell-height stability test because it protects tab-switch layout jumps.

## Validation Evidence

- Affected Vitest suites passed: 25 files, 193 tests.
- Changed browser specs collected 35 cases; all passed after the run-setup fixture was isolated with a valid save envelope.
- `npm run plans:check` passed before completion, and the final task-scoped `npm run check -- <paths>` passed static checks, build, bundle budget, and preview smoke.
- Implementation changed only the test files and plan paths named by this review; unrelated working-tree edits remain untouched.
