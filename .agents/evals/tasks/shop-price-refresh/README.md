# Task: Shop — invalid refresh prices

Use the pinned base and comparison procedure in [the evaluation guide](../../README.md). Do this only in the evaluation checkout.

## Exact request

Harden the shared shop refresh transaction so a negative, NaN or infinite refresh price cannot change Gold, consume a refresh, resample offerings, or play spending feedback. Return the existing uncommitted transaction result. Zero remains a valid free refresh; valid positive prices retain their current behavior. Keep the Gold check against the transaction draft and preserve the existing owner for feedback.

## Acceptance

- Negative values, NaN and both infinities leave Gold, refresh count and offerings unchanged and never invoke the sampler or spend sound.
- A zero price commits when a refresh is available; an affordable positive price deducts exactly once.
- Insufficient Gold and no remaining refreshes remain no-ops.
- Focused shop-transaction regressions and the complete task-owned changed-path check pass.

The existing focused suite is [shop transactions](../../../../tests/features/alchemy/run-loop/shop/shop-transactions.test.ts).
