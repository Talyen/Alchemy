---
status: complete
updated: 2026-09-07
---

# Consistent saved-card restoration

## Objective and approval status

Approved by the user; implemented and verified. Ensure restored cards describe the actions they actually perform, while preserving complete saved modifications. Scope is card validation, restoration, focused regression coverage, and the canonical save documentation.

The checkout was clean at investigation start. A Node.js draw using `Math.floor(Math.random() * sections.length)` selected index 1, `card`, from `[battle, card, ui, tooltip, gear, rewards, shop, save, run-state, assets, browser, tooling]`. Exploration stopped after identifying the restoration inconsistency below.

## Evidence before the change

1. [Card validation](../../../src/lib/validation/save-schemas/battle-card-schemas.ts) drops individual invalid effects but retains saved description lines. It does not retain whether an effect was discarded. The resulting card therefore looks like a complete, valid card to later stages.
2. [Card restoration](../../../src/lib/game-data/cards/hydrate-card.ts) chooses descriptions and effects independently. An effect-count difference selects library text, while any nonempty saved effect list still wins. Missing descriptions similarly select library text without replacing modified saved effects.
3. Comparing effect counts cannot establish whether saved content is damaged. A valid card with an additional effect also loses its matching saved prose. Historical commits `327cdc5e` and `062a165d` show the fallback was intended to prevent stale descriptions and highlights, but only the description half of the recovery was implemented.
4. The existing [storage round-trip suite](../../../tests/features/alchemy/shared/storage/storage-roundtrip.test.ts) locally parses a save and hydrates only its run deck. It does not exercise the production restoration of card choices, shop stock, corruption results, or active battle piles. There is no dedicated hydration test file among the discovered tests.

A read-only Node reproduction transpiled the actual hydration source with TypeScript and supplied a small synthetic library card. It demonstrated all three cases below; this was a focused function reproduction, not a full production-load test.

| Input                                                                                 | Result before the change                                    |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Library card grants 3 Block and deals 4 Burn damage; saved effects contain only Block | Text advertises both actions; only Block remains executable |
| Saved card grants 9 Block; saved description is missing                               | Text advertises 3 Block; the effect still grants 9          |
| Valid saved card includes an extra heal and matching text                             | Heal remains executable; its description disappears         |

## Approved recovery behavior

Preserve complete, validated saved effects and their saved descriptions together, including valid Corruption modifications and valid effect lists that differ from the current catalog.

When validation has discarded an effect, or either the effect list or description is unusable, restore both effects and descriptions from the current library as one recovery operation. Clear Corruption highlights and modification markers that no longer describe the recovered content. Preserve valid saved identity and cost, and the existing explicit Consume override; continue taking catalog-owned presentation fields from the library.

**Player impact:** recovery can remove saved card modifications or restore an action that was missing from damaged data. The user explicitly approved this recovery policy. It affects damaged or incomplete cards; it is not a balance change to healthy cards. Valid older cards should retain their complete saved behavior even when the library's effect count has changed. Retired-card filtering remains governed by the existing save contract.

## Implementation plan

- [x] Add failing regressions for the three demonstrated mismatches, plus a save containing one valid and one invalid effect. Assert executable effects and displayed descriptions together.
- [x] Preserve the minimum validation information needed to distinguish a complete saved effect list from one repaired by dropping entries. Use the existing empty effect list as the explicit recovery signal in the validation/restoration pipeline; do not add serialized fields, a second effect schema, or a general repair framework. Apply the architect skill before changing this cross-boundary contract, and trace normalizing/serializing consumers so repair information cannot disappear before restoration or leak into saved JSON.
- [x] Replace independent text/effect fallback decisions with a single content-selection decision. Remove effect-count comparison as a damage detector. Keep catalog metadata refresh and existing cost behavior separate from that content decision. Replace the generic optional-field cast helper with direct typed optional-field checks where appropriate.
- [x] Preserve current effect cloning behavior and avoid expanding into unrelated cloning or card-builder refactors. Test that nested recursive effects are preserved and that restoration does not mutate its input or library data.
- [x] Add focused integration coverage through the production load/restore owners. Cover the run deck, active battle card piles, and representative choice/shop/corruption-result locations. Extend existing suites and fixtures rather than creating another hand-written save parser or launching browser journeys for pure data cases. Include restoring twice and JSON round-tripping to catch loss of transient validation information or repeated recovery.
- [x] Update the card-restoration policy in [MIGRATIONS](../../../src/features/alchemy/shared/storage/MIGRATIONS.md). Record the demonstrated split fallback in the friction log with the canonical prevention. Review schema-version requirements against that owner; the intended implementation changes recovery behavior without introducing a persisted shape change.
- [x] Run path-scoped verification and the complete save/persistence unit escalation selected by the verifier. Finish with `npm run check -- <all changed paths>`, inspect the final diff, and report recovery behavior and compatibility evidence. Complete and archive this execution plan after implementation.

## Acceptance criteria

- A partially invalid effect list cannot produce library prose paired with surviving saved effects.
- Missing text cannot leave modified effects paired with unmodified library values.
- Complete valid cards retain their saved effects and matching prose even when their effect count differs from the library.
- Healthy Corruption values and highlights survive restoration; recovered content has no stale modification markers.
- Cost, Consume overrides, card identity, catalog art/title refresh, and retired-card handling retain their established behavior.
- Production restoration tests cover more than the run deck, and no new validation metadata appears in saved JSON.

## Implementation decisions

Validation invalidates the whole saved effect list when any entry fails, using the existing empty-list signal. This needs no new type, serialized field, or schema version. Saved battle piles and pending result states now use the same card schema. The storage round-trip suite uses the production save-candidate loader instead of a local run-deck-only hydrator. Focused card, parse, storage, and battle-restore tests pass. Wish queue validation preserves valid entries when adjacent entries are malformed; the existing normalization test now asserts IDs independently of newly populated card defaults.

`npm run check -- --diff` passed in run `check-20260907t014120z-28412-1c01f3`: documentation, related unit tests, the complete save/persistence unit suite, changed tests, CI static checks, production web build, and preview smoke. No new save fields or version bump were needed.

## Limits

This change does not attempt to prove arbitrary saved prose semantically matches every possible effect. It fixes mismatches introduced by the game's own validation and restoration decisions. No balance, RNG, reward-pool, tech-stack, or general description-generation changes are proposed. The planning reproduction was function-level; implementation regression tests additionally exercise production validation, save loading, and battle restoration.
