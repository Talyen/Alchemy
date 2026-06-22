import type { ReactNode } from "react";
import { OptionsScreenRoute } from "./options-screen-route";
import type { ScreenRouteContext } from "./types";

export const optionsScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
  options: (ctx) => <OptionsScreenRoute {...ctx} />,
};
