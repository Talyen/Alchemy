import type { ReactNode } from "react";
import { OptionsScreenRoute } from "./options-screen-route";
import type { OptionsRouteCtx } from "./route-ctx";

export const optionsScreenRoutes: {
  options: (ctx: OptionsRouteCtx) => ReactNode;
} = {
  options: (ctx) => <OptionsScreenRoute {...ctx} />,
};
