// Screen route registry — maps Screen values to screen components.
import type { ReactNode } from "react";
import { optionsScreenRoutes } from "./options-route";
import { metaScreenRoutes } from "./meta-routes";
import { runSetupScreenRoutes } from "./run-setup-routes";
import { runLoopScreenRoutes } from "./run-loop-routes";
import { runEndScreenRoutes } from "./run-end-routes";
import { withScreenBoundary } from "./with-screen-boundary";
import type { ScreenRouteContext } from "./types";

export type { ScreenRouteContext } from "./types";
export type ScreenRoute = (ctx: ScreenRouteContext) => ReactNode;

/**
 * Compose phase-scoped route tables. Each input covers a disjoint subset of
 * `Screen`; the union must equal `Screen` for `SCREEN_ROUTES` to type as
 * `Record<Screen, ScreenRoute>`. A missing or duplicate key becomes a
 * compile error on `_exhaustive` below.
 */
/* eslint-disable @typescript-eslint/no-duplicate-type-constituents --
   composed from overlapping phase route tables; _exhaustive check below
   guarantees no duplicates */
type PhaseKeys =
  | keyof typeof metaScreenRoutes
  | keyof typeof runSetupScreenRoutes
  | keyof typeof runLoopScreenRoutes
  | keyof typeof runEndScreenRoutes
  | "options";
/* eslint-enable @typescript-eslint/no-duplicate-type-constituents */

type _Exhaustive = [PhaseKeys] extends [import("@/lib/routing").Screen]
  ? [import("@/lib/routing").Screen] extends [PhaseKeys]
    ? true
    : false
  : false;
const _exhaustive: _Exhaustive = true;
void _exhaustive;

const SCREEN_ROUTES = {
  ...metaScreenRoutes,
  ...runSetupScreenRoutes,
  ...runLoopScreenRoutes,
  ...runEndScreenRoutes,
  ...optionsScreenRoutes,
};

export function renderAlchemyScreenRoute(ctx: ScreenRouteContext): ReactNode {
  const render = SCREEN_ROUTES[ctx.screen]!;
  return withScreenBoundary(ctx.screen, render(ctx));
}
