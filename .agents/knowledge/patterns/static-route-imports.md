# Static Route Imports

Status: enforced-rationale
Confidence: high

## Observation

Attempts to `React.lazy()` route screens or add per-route `"Loading …"` fallbacks conflict with the single cold-start loading experience. Lazy screens introduce a second readiness boundary and can hide real startup cost.

## Why it matters

Static screen imports avoid navigation waterfalls. Startup readiness and mounted-artwork readiness have different lifetimes: a completed preload does not prove that a later image is ready to paint. [Boot and loading](../../../docs/ARCHITECTURE.md#boot-and-loading) owns the startup-critical art subset; [screen fades](../../../docs/UI.md#screen-fade-motion) own later reveals.

## Evidence

- `docs/ARCHITECTURE.md#boot-and-loading` — image/font/save/screen JS policy, anti-patterns (`Do not add: React.lazy()`).
- `eslint/boundaries.js` — bans `React.lazy` / `lazy` import in `src/app/screen-routes/**/*`.
- `src/app/use-alchemy-bootstrap.ts` — `restoreRun` before readiness, `readRunInitialized` guard prevents `AppInner` rendering unhydrated.
- `src/app/screen-routes/` — static imports, `RenderAlchemyScreen`, `ALLOWED_SCREEN_TRANSITIONS` (`src/lib/routing/screen-transition-policy.ts`).
- `docs/WORKFLOWS.md#adding-a-new-screen` — checklist adds to `Screen` union + `ROUTE_SCREENS` + transition policy, wraps in `TitledScreenShell`.

## Resolution

[ARCHITECTURE.md](../../../docs/ARCHITECTURE.md#boot-and-loading) owns loading
policy and [WORKFLOWS.md](../../../docs/WORKFLOWS.md#adding-a-new-screen) owns
screen wiring. ESLint and the architecture smoke gate enforce static route
imports; retain this pattern only as historical rationale.
