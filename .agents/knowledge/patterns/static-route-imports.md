# Static Route Imports

Status: active
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

## Preferred pattern

- Add screen: extend `Screen` union + `ROUTE_SCREENS`, classify via `SCREEN_PHASE`, add edges to `ALLOWED_SCREEN_TRANSITIONS`, create component in `run-loop/screens/` etc., wrap in `TitledScreenShell`, wire in `screen-routes` phase table.
- Keep `src/app/screen-routes/**/*` free of `React.lazy` / `React.lazy`.
- Keep `allGameArt` eager; no lazy art or per-screen spinners for those assets.
- E2E bypass only via `alchemy-skip-loading-screen` in `localStorage` for startup gate.

## Exceptions

- `localStorage["alchemy-skip-loading-screen"]` intentionally skips gate for E2E (`shouldSkipStartupLoadingGate`).
- Boot `restoreRun` hydration bypasses `ALLOWED_SCREEN_TRANSITIONS` intentionally after save validation.

## Enforcement opportunity

Strongest: ESLint `no-restricted-imports` + `no-restricted-properties` bans on `React.lazy` in screen routes + architecture smoke (`lint:architecture-smoke`). Keep as lint; no further prose needed.
