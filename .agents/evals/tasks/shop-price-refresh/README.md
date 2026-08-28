# Task: Shop — price refresh

Setup: Branch from `main`, adjust shop pricing/refresh logic via `shop-transactions.ts` draft recipe.
Goal: Gold guard reads `draft`, SFX in `afterCommit`, no nested `dispatchRunSessionCommand`, refresh keeps novel offerings; gear HP-sync uses draft variant if needed.
Pass when:

- `unit-shop` green
- `lint:boundaries` green
- `alchemy/no-run-earned-add-materials` not regressed
  Run: `npm run verify:changed -- src/features/alchemy/run-loop/shop/trinket-shop-commands.ts` (or `src/features/alchemy/run-loop/shop/**` — bare dir without `/**` does not route)
