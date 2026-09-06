# Task: Battle — missing-health Block effect

Use the pinned base and comparison procedure in [the evaluation guide](../../README.md). Do this only in the evaluation checkout.

## Exact request

Add a card effect kind named `gainMissingHealthBlock` with a nonnegative numeric `value` multiplier. It grants the acting hero `Math.round(max(0, maxHealth - health) * value)` Block through the existing Block gain path. Use current health at effect execution. Define a test-only card using the effect; do not add collectible content, artwork, balance changes, or migrations.

Wire the effect through its type, schema, registry, runtime handler and description owners. The description must communicate Block gained per missing Health. Preserve existing Block modifiers and seeded behavior.

## Acceptance

- At 20 maximum Health and 15 current Health, multiplier 0.5 gives a base gain of 3 Block before existing Block modifiers.
- Full Health and zero multiplier produce no gain; consecutive effects use the then-current health.
- Schema rejects negative multipliers. Registry coverage and descriptions recognize the new kind.
- Existing battle behavior passes its relevant tests; the full task-owned changed-path check passes.

Verify the complete set of edited and added files, including the regression tests; do not substitute example paths for the actual change.
