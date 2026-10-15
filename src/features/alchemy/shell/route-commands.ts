import type { useBattleController } from "./use-battle-controller";
import type { ComposedRunCommands } from "./use-alchemy-run-controller";

// The shell composition owns the capability surface. Routes select their phase
// from this type instead of maintaining a second list of methods and signatures.
type BattleRouteCommands = Omit<
  ReturnType<typeof useBattleController>,
  "hasActiveBattle" | "presentBattleStart" | "startBattle" | "startBossBattle" | "startBossById" | "cancelBattle"
>;
export type AlchemyRouteCommands = Omit<ComposedRunCommands["routeCommands"], "battle"> & {
  battle: BattleRouteCommands;
};
export type AlchemyRunCommands = Omit<ComposedRunCommands, "routeCommands"> & { routeCommands: AlchemyRouteCommands };

export type ArmoryRouteCommands = AlchemyRouteCommands["meta"]["armory"];
