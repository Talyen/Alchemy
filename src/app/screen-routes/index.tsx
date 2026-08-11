// Screen route registry — maps Screen values to screen components.
import type { ReactNode } from "react";
import { optionsScreenRoutes } from "./options-screen-route";
import { metaScreenRoutes } from "./meta-routes";
import { runSetupScreenRoutes } from "./run-setup-routes";
import { runLoopScreenRoutes } from "./run-loop-routes";
import { runEndScreenRoutes } from "./run-end-routes";
import { withScreenBoundary } from "./with-screen-boundary";
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { Screen } from "@/lib/routing";

export type ScreenRoute = (ctx: RenderAlchemyScreenProps) => ReactNode;

/**
 * Compose phase-scoped route tables. Each input covers a disjoint subset of
 * `Screen`; their union must equal `Screen` and their keys must be pairwise
 * disjoint. Missing, extra, and duplicate registrations fail compilation.
 */
type PhaseRouteTables = typeof metaScreenRoutes &
  typeof runSetupScreenRoutes &
  typeof runLoopScreenRoutes &
  typeof runEndScreenRoutes &
  typeof optionsScreenRoutes;
type PhaseKeys = keyof PhaseRouteTables;
type SharedPhaseKeys =
  | (keyof typeof metaScreenRoutes & keyof typeof runSetupScreenRoutes)
  | (keyof typeof metaScreenRoutes & keyof typeof runLoopScreenRoutes)
  | (keyof typeof metaScreenRoutes & keyof typeof runEndScreenRoutes)
  | (keyof typeof metaScreenRoutes & keyof typeof optionsScreenRoutes)
  | (keyof typeof runSetupScreenRoutes & keyof typeof runLoopScreenRoutes)
  | (keyof typeof runSetupScreenRoutes & keyof typeof runEndScreenRoutes)
  | (keyof typeof runSetupScreenRoutes & keyof typeof optionsScreenRoutes)
  | (keyof typeof runLoopScreenRoutes & keyof typeof runEndScreenRoutes)
  | (keyof typeof runLoopScreenRoutes & keyof typeof optionsScreenRoutes)
  | (keyof typeof runEndScreenRoutes & keyof typeof optionsScreenRoutes);

type _Exhaustive = [PhaseKeys] extends [Screen] ? ([Screen] extends [PhaseKeys] ? true : false) : false;
const _exhaustive: _Exhaustive = true;
void _exhaustive;
type _Disjoint = [SharedPhaseKeys] extends [never] ? true : false;
const _disjoint: _Disjoint = true;
void _disjoint;

const SCREEN_ROUTES = {
  ...metaScreenRoutes,
  ...runSetupScreenRoutes,
  ...runLoopScreenRoutes,
  ...runEndScreenRoutes,
  ...optionsScreenRoutes,
} satisfies Record<Screen, ScreenRoute>;

export interface RenderAlchemyScreenProps {
  screen: Screen;
  routeCommands: AlchemyRouteCommands;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
  onBackFromOptions: () => void;
}

export function renderAlchemyScreenRoute(ctx: RenderAlchemyScreenProps): ReactNode {
  const render = SCREEN_ROUTES[ctx.screen];
  if (!render) {
    throw new Error(`Missing screen route for ${ctx.screen}`);
  }
  return withScreenBoundary(ctx.screen, render(ctx));
}
