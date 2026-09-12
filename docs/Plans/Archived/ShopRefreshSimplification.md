---
status: complete
updated: 2026-09-11
implementation: 26c1185c
---

# Shop refresh transactions

## Decision and rationale

Implemented in `26c1185c`. All four shops share one atomic refresh recipe, with
pure shelf samplers and explicitly typed shelf assignments. Offering modifiers
run before storage so the returned items describe the committed shelf.

Previously, forwarding wrappers and an independently typed shelf key/value pair
obscured ownership. Strong Spirits transformed only the stored shelf while the
transaction returned original Potions. Existing public callers used only the
commit flag, so this was an internal consistency problem, not a demonstrated
player-facing potency bug.

Scalar pricing calls replaced singleton array wrappers. Test-only refresh-price
exports and redundant mapping tests were retired; canonical pricing and pure
sampling tests retained the meaningful rules. Current owners are documented in
[shop commands](../../ARCHITECTURE.md#shop-commands) and
[the shop workflow](../../WORKFLOWS.md#change-a-shop).

## Compatibility

Prices, discounts, offering counts, novelty/fallback behavior, room themes,
rarities, sound timing, and save shapes were preserved. Rejected refreshes neither
sample nor change Gold, refresh counts, or state revision. Successful refreshes
charge once and return the final modified items. No dependency or public API
change was required, and no runtime speedup was claimed.

## Verification recorded at implementation

A deterministic before/after probe with LCG seed 73 preserved shelves and RNG
consumption: current shelves `[a]`, `[a,b,c]`, and `[a,b,c,d]` produced
`[d,b,c]` / 10 draws, `[d,a,c]` / 12 draws, and `[a,d,b]` / 15 draws. The temporary
probe was removed after comparison.

Task-scoped handoff `check-20260910t164301z-24514-6dc648` passed related and changed
tests, documentation, CI static checks, the web build, and preview smoke. A mistaken
reference-identity assertion and an export left unused by consolidation were
corrected before the passing run. Command, modifier, acquisition, and persistence
coverage remained in place.
