// Screen route registry — maps Screen values to screen components.
import type { ReactNode } from "react";
import type { Screen } from "@/lib/routing";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { buildOptionsScreen } from "./options-route";
import { metaScreenRoutes } from "./meta-routes";
import { runSetupScreenRoutes } from "./run-setup-routes";
import { runLoopScreenRoutes } from "./run-loop-routes";
import { withScreenBoundary } from "./with-screen-boundary";
import type { ScreenRouteContext } from "./types";

export type { ScreenRouteContext } from "./types";

const SCREEN_ROUTES: Record<Screen, (ctx: ScreenRouteContext) => ReactNode> = {
  ...metaScreenRoutes,
  ...runSetupScreenRoutes,
  ...runLoopScreenRoutes,
  options: buildOptionsScreen,
} as Record<Screen, (ctx: ScreenRouteContext) => ReactNode>;

for (const screen of ROUTE_SCREEN_VALUES) {
  if (!SCREEN_ROUTES[screen]) {
    throw new Error(`[screen-routes] Missing route handler for screen: ${screen}`);
  }
}

export function renderAlchemyScreenRoute(ctx: ScreenRouteContext): ReactNode {
  const render = SCREEN_ROUTES[ctx.screen];
  if (!render) {
    console.error(`[RenderAlchemyScreen] Unknown screen: "${ctx.screen}"`);
    return withScreenBoundary(
      "unknown-screen",
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unknown screen: {ctx.screen}</p>
      </div>,
    );
  }
  return withScreenBoundary(ctx.screen, render(ctx));
}
