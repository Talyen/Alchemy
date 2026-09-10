---
status: complete
updated: 2026-09-10
---

# Simplify shop refreshes and pricing helpers

## Approval and objective

Approved and completed on 2026-09-10. Simplify the shared shop refresh path, restore its internal result consistency, and remove redundant pricing APIs and low-value test indirection. Preserve all current player-facing shop behavior. The implementation is complete and remains uncommitted.

The expected benefit is a shorter, type-checked path from each shop command to one atomic refresh transaction. No new dependency, framework, persistence format, or cross-feature contract is needed. This is a maintenance improvement; no measurable runtime speedup is claimed.

## Random selection and investigation boundary

The checkout was clean. Selection used JavaScript `Math.random()` over these ordered repository context categories: battle, card, ui, audio, tooltip, gear, rewards, shop, save, run-state, assets, tooling. The draw was `0.6408061663427757`; `Math.floor(draw * 12)` produced index 7, selecting shops.

Read the shop documentation owners, the four shop command modules, shared transactions, pricing, shelf generation, nearby screens, and relevant tests. Followed equipment generation and reward selection only to understand dependencies. The history of commit `8a6bc0e3` confirms that the shared command layer originated as consolidation; preserve shared transaction ownership while removing configuration forwarding that no longer pays for itself. Exploration stopped at the findings below.

## Findings and evidence

### 1. Refresh orchestration has too many layers and weak field typing

[Shop command helpers](../../../src/features/alchemy/run-loop/shop/shop-commands-core.ts) route card refreshes through `refreshCardOfferings`, then `refreshCardShopOfferings`, then `refreshShopOfferings`, with `mapRefreshedShopOfferings` responsible for the state replacement. Catalog refreshes have a parallel forwarding wrapper with the same price and modifier resolution.

The map helper accepts `itemsKey: keyof TState` and an independently typed `TState[keyof TState]` value. It does not enforce that a shelf key corresponds to the supplied item array. A caller can select another state field; the command wrappers additionally force item arrays through `as never` and a broad indexed-access cast. Current callers use the correct fields, so this is an evidenced type-safety hole and maintenance burden, not a demonstrated corrupt shop state.

### 2. The refresh result can disagree with the committed shelf

In `refreshCardOfferings`, `postSample` runs only inside `mapState`. [The transaction](../../../src/features/alchemy/run-loop/shop/shop-transactions.ts) returns its original `newItems`. [The Alchemist command](../../../src/features/alchemy/run-loop/shop/alchemist-shop-commands.ts) uses `postSample` for Strong Spirits: the committed shelf contains doubled potions, but the returned value contains the original potions.

All four current public refresh commands read only `.committed`, and existing Strong Spirits coverage checks the actual shelf, purchase, hydration, and mixing. There is no demonstrated player-facing potency bug here. The internal result should still describe what was committed, so future consumers cannot accidentally use the wrong potency.

### 3. Pricing APIs retain unnecessary wrappers and test indirection

[Shop pricing](../../../src/features/alchemy/run-loop/shop/shop-pricing.ts) exports four `compute*RefreshPrice` wrappers with no production consumers; only [pricing tests](../../../tests/features/alchemy/run-loop/shop/shop-pricing.test.ts) call them. Production already uses `getShopRefreshPrice`.

The only production callers of `readBuyPrices` are Card Shop and Alchemist single-item reads. Each wraps one item in an array, calls `getShopBuyPrices`, reads index zero, and falls back to zero. A scalar call can express the operation directly. The batch helper's test compares it against the same function it maps, adding little protection.

One pricing test is also named as though Bargain Bin halves the price after discounts; both its assertion and the implementation halve the base price before subtracting discounts. Correct the test name without changing the price formula.

## Proposed implementation

### A. Separate shelf selection from the paid transaction

- [x] Extract the existing card refresh selection into a pure shop-local sampler alongside the existing shelf samplers in [shop-state-init.ts](../../../src/features/alchemy/run-loop/shop/shop-state-init.ts). Take the deck, pool, current shelf, count, and supplied RNG explicitly. Preserve the exact novel-first selection and fallback calls.
- [x] Keep `refreshShopOfferings` as the single draft recipe that checks gold and remaining refreshes, samples, charges, updates state, and reports the result. Keep `runShopTransaction` as the dispatch and post-commit sound boundary.
- [x] Replace dynamic field names with a typed callback returning the concrete updated shop state, for example a Card Shop update that explicitly assigns `cards: items`. The shared recipe owns the common decrement and purchased-slot reset, applied after the callback; each command owns only its concrete shelf assignment. This removes the indexed-field mapper without inventing a generic shop registry or changing the stored state shapes.
- [x] Have each shop command provide its existing price, sampler, writer, and typed shelf update to that recipe. Remove `refreshCardOfferings`, `refreshCatalogOfferings`, `refreshCardShopOfferings`, and `mapRefreshedShopOfferings` once all consumers move. Small explicit price expressions at four call sites are preferable to separate wrappers forwarding nearly the same configuration.
- [x] Apply Strong Spirits within the Alchemist sampler before handing the items to the transaction. Return and store the same final item values. Preserve the existing `ShopTransactionResult` shape and public boolean refresh APIs.

### B. Simplify pricing at actual call sites

- [x] Replace the two singleton batch-price reads with direct `getShopBuyPrice` calls using the existing live pricing-context resolver.
- [x] Reconfirm repository consumers, then remove `readBuyPrices`, `getShopBuyPrices`, and the four test-only refresh-price wrappers. Preserve the canonical scalar pricing functions, discount ordering, rounding, and shop-specific traits.
- [x] Update the existing pricing suite to exercise `getShopRefreshPrice` directly with a compact table of shop kinds, talent behavior, exhausted refreshes, and matching/nonmatching room traits. Remove only the batch forwarding test and overlapping wrapper assertions; preserve all distinct pricing rules.
- [x] Rename the misleading Bargain Bin test to match the asserted ordering.

### C. Preserve meaningful protection with focused tests

- [x] Retain the existing atomic-refresh test and rejection cases. Extend the rejection cases with a sampler spy to establish that failed refreshes do not sample or advance shop RNG; continue asserting no gold change and no published revision.
- [x] Move the card sampling assertion from its store-backed wrapper test into the sampler suite. Use a small deterministic pool to cover enough alternatives, partial novelty with fallback, and no novel alternatives without constructing a gameplay store for selection-only checks.
- [x] Extend the existing transaction success case with transformed items and assert that returned items equal the committed shelf. Reuse the existing Strong Spirits command test for the real modifier; do not add a separate browser journey for this internal change.
- [x] Retain command-level coverage for all four shops, room themes, acquired items, first-purchase discounts, refresh limits, and purchase sound behavior. Preserve existing save/hydration checks.
- [x] Before restructuring, capture a small deterministic baseline of card refresh outputs and RNG call counts for the selection cases above. Compare after the change. These are compatibility checks for the refactor, not a large permanent snapshot suite.

### D. Documentation and handoff

- [x] Update [Shop commands](../../ARCHITECTURE.md#shop-commands) and [Change a shop](../../WORKFLOWS.md#change-a-shop) with the final ownership: pure shelf samplers, typed shop-specific assignments, and one atomic refresh recipe. Document that a successful refresh returns the final offered items.
- [x] Resolve the matching friction entry when the result mismatch is fixed, following the log's existing history convention.
- [x] Review the complete diff and all four refresh call sites for integration. Run the verifier skill's path-scoped handoff gate over every changed source, test, and documentation path. It selects dependency-related unit tests and applicable static/build/smoke checks. Explicitly include surviving sampling and pricing suites when retiring their previous wrappers' tests.
- [x] After approved implementation passes, complete and archive this plan through the [plan lifecycle](../README.md#task-handoff). Do not close or archive it at the proposal stage.

## Acceptance criteria and player-visible decisions

1. All four shops refresh through one transaction recipe, without dynamic shelf-key casts or duplicate card/catalog orchestration wrappers.
2. A successful refresh returns the same item values stored on the shelf, including Strong Spirits potency.
3. Failed refreshes leave gold, shelf, flags, revision, and RNG unchanged. Successful refreshes charge once, consume one refresh, clear purchased slots, and preserve per-visit service/first-purchase flags.
4. Existing offering counts, novelty/fallback behavior, rarity rules, room themes, owned-item exclusions, discounts, and sound timing remain unchanged. Preserve seeded card choices and RNG consumption for the same inputs; equipment generation remains with its existing owner.
5. Saved data and screen/controller contracts stay compatible. No changes to shop balance, eligibility, empty-shelf policy, or player interactions are included.
6. Tests protect these behaviors through the functions used in production; obsolete wrapper-only tests and exports are removed.

No significant player-visible or game-design changes are proposed. If implementation evidence requires one, stop that portion and present the exact decision for explicit approval before proceeding.

## Verification record

The full `npm run check -- --diff` gate passed in run `check-20260910t164301z-24514-6dc648`: related unit tests, changed unit tests, documentation contracts, CI static checks, web build, and preview smoke. Initial verification identified a mistaken reference-identity assertion in the new rejection test and an export made unused by test consolidation; both were corrected before the passing run. No player-facing rule or saved-data format changed.

Obsolete refresh/batch wrapper coverage was consolidated into the canonical pricing table and pure sampling cases. Existing shop command, modifier, acquisition, and persistence protection remains in place. The friction entry was resolved into September history. Archive metadata and relative links receive a final documentation-only check.

Deterministic before/after probe passed: current shelves `[a]`, `[a,b,c]`, and `[a,b,c,d]` produced `[d,b,c]` / 10 RNG draws, `[d,a,c]` / 12 draws, and `[a,d,b]` / 15 draws respectively (LCG seed 73). The temporary probe was removed after comparison.
