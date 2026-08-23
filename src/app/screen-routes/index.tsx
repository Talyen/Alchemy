// Screen route registry — maps Screen values to screen components.
import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { optionsScreenRoutes } from "./options-screen-route";
import { metaScreenRoutes } from "./meta-routes";
import { runSetupScreenRoutes } from "./run-setup-routes";
import { runLoopScreenRoutes } from "./run-loop-routes";
import { runEndScreenRoutes } from "./run-end-routes";
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

/** Keys shared between the head table and any later table. */
type SharedWithLater<Head, Rest extends readonly unknown[]> = Rest extends readonly [infer Next, ...infer Tail]
  ? (keyof Head & keyof Next) | SharedWithLater<Head, Tail>
  : never;
/** Keys shared by at least two tables in the tuple. */
type PairwiseSharedKeys<Tables extends readonly unknown[]> = Tables extends readonly [infer Head, ...infer Rest]
  ? Rest extends readonly unknown[]
    ? SharedWithLater<Head, Rest> | PairwiseSharedKeys<Rest>
    : never
  : never;

type PhaseRouteTableTuple = [
  typeof metaScreenRoutes,
  typeof runSetupScreenRoutes,
  typeof runLoopScreenRoutes,
  typeof runEndScreenRoutes,
  typeof optionsScreenRoutes,
];

type _Exhaustive = [PhaseKeys] extends [Screen] ? ([Screen] extends [PhaseKeys] ? true : false) : false;
const _exhaustive: _Exhaustive = true;
void _exhaustive;
type _Disjoint = [PairwiseSharedKeys<PhaseRouteTableTuple>] extends [never] ? true : false;
const _disjoint: _Disjoint = true;
void _disjoint;

const SCREEN_ROUTES = {
  ...metaScreenRoutes,
  ...runSetupScreenRoutes,
  ...runLoopScreenRoutes,
  ...runEndScreenRoutes,
  ...optionsScreenRoutes,
} satisfies Record<Screen, ScreenRoute>;

import { type RenderAlchemyScreenProps } from "./route-ctx";
export type { RenderAlchemyScreenProps };

export function renderAlchemyScreenRoute(ctx: RenderAlchemyScreenProps): ReactNode {
  const render = SCREEN_ROUTES[ctx.screen];
  if (!render) {
    throw new Error(`Missing screen route for ${ctx.screen}`);
  }
  return <ErrorBoundary label={ctx.screen}>{render(ctx)}</ErrorBoundary>;
}
