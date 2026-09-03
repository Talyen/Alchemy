# Asset Barrels Are Outputs

Status: active
Confidence: high

## Observation

Edits directly to `src/lib/game-data/assets.generated.ts`, `src/lib/game-data/gear-art.ts`, `src/assets/optimized/**`, or `public/sounds/**` built outputs get clobbered on next `prepare-assets`. Conversely, missing a `sync:gear-art` step after adding `Raw Assets/Gear/` leaves mappings stale.

## Why it matters

`Raw Assets/` is source of truth. Generated barrels are deterministic outputs; CI `assets:check` fails if preparation would change outputs (idempotency gate). Asset barrel value-imports break Playwright's esbuild collection entirely.

## Evidence

- `docs/WORKFLOWS-ASSETS.md` — authored asset workflow, manifest/regeneration pipeline.
- `docs/ARCHITECTURE.md#boot-and-loading` — `allGameArt` eagerly decoded, no lazy art.
- `scripts/prepare-assets.mjs`, `sync-generated.mjs`, `optimize-assets.mjs` — generation pipeline.
- `eslint.config.js` — `ASSET_BARREL_NO_VALUE_IMPORT_REASONS` bans value imports of `@/lib/game-data` / `@/lib/gear` in Playwright-collected files.
- `scripts/lib/change-routes.mjs` — `assets` route → `assets-check` command.
- `package.json` scripts — `predev`/`prebuild` run `prepare-assets`; `assets:check` enforces idempotency.

## Resolution

The asset workflow is canonical. `assets:check`, generated-output checks, ESLint,
and dependency boundaries enforce the recurring failure class; consult this
pattern only to understand why direct output edits are discarded.
