// Phase-scoped route contexts — keep the composer bag at App, narrow tables by phase.
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { Screen } from "@/lib/routing";

export interface RenderAlchemyScreenProps {
  screen: Screen;
  routeCommands: AlchemyRouteCommands;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
  onBackFromOptions: () => void;
  gameMenuOpen: boolean;
}

export type MetaCommands = AlchemyRouteCommands["meta"];
export type RunSetupCommands = AlchemyRouteCommands["runSetup"];
export type RunLoopCommands = AlchemyRouteCommands["runLoop"];
export type BattleCommands = AlchemyRouteCommands["battle"];
export type RunEndCommands = AlchemyRouteCommands["runEnd"];

export interface MetaRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "meta">;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface RunSetupRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "runSetup">;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface RunLoopRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "runLoop">;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface BattleRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "battle">;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
  gameMenuOpen: RenderAlchemyScreenProps["gameMenuOpen"];
}

export interface RunEndRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "runEnd">;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export type OptionsRouteCtx = Pick<
  RenderAlchemyScreenProps,
  "onOpenBattleMenu" | "onClearSaveData" | "onUnlockAllDevMode" | "onBackFromOptions"
>;
