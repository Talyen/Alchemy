import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { optionsScreenRoutes } from "./options-screen-route";
import { metaScreenRoutes } from "./meta-routes";
import { runSetupScreenRoutes } from "./run-setup-routes";
import { runLoopScreenRoutes } from "./run-loop-routes";
import { runEndScreenRoutes } from "./run-end-routes";
import type { Screen } from "@/lib/routing";

export type ScreenRoute = (ctx: RenderAlchemyScreenProps) => ReactNode;

import { type RenderAlchemyScreenProps } from "./route-ctx";
export type { RenderAlchemyScreenProps };

export const SCREEN_ROUTES = {
  ...metaScreenRoutes,
  ...runSetupScreenRoutes,
  ...runLoopScreenRoutes,
  ...runEndScreenRoutes,
  ...optionsScreenRoutes,
} satisfies Record<Screen, ScreenRoute>;

export function renderAlchemyScreenRoute(ctx: RenderAlchemyScreenProps): ReactNode {
  const render = SCREEN_ROUTES[ctx.screen];
  if (!render) {
    throw new Error(`Missing screen route for ${ctx.screen}`);
  }
  return <ErrorBoundary label={ctx.screen}>{render(ctx)}</ErrorBoundary>;
}
