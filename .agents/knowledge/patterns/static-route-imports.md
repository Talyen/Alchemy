# Static Route Imports

Status: enforced-rationale
Confidence: high

## Observation

Attempts to `React.lazy()` route screens or add per-route `"Loading …"` fallbacks conflict with the single cold-start loading gate (`StartupLoadingScreen` smoothed bar over art/fonts/save bootstrap). Lazy screens break E2E boot smoke and hide real startup cost.

## Why it matters

One loading experience at cold start, then instant navigation. Screen JS in `src/app/screen-routes/` is statically imported so code-splitting does not introduce waterfall spinners. Art decode, font readiness, and save hydrate are metered before reveal; `pre-React` comet fills until React mounts.

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
