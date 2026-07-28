// Phase-scoped route contexts — keep the composer bag at App, narrow tables by phase.
import type { BattleControllerBindings } from "@/features/alchemy/shell/battle-bindings";
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { RenderAlchemyScreenProps } from "@/app/render-screen-props";

export interface MetaRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "meta">;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface RunSetupRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "runSetup">;
}

export interface RunLoopRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "runLoop">;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface BattleRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "battle">;
  battleBindings: BattleControllerBindings;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export interface RunEndRouteCtx {
  routeCommands: Pick<AlchemyRouteCommands, "runEnd">;
}

export type OptionsRouteCtx = Pick<
  RenderAlchemyScreenProps,
  "onOpenBattleMenu" | "onClearSaveData" | "onUnlockAllDevMode" | "onBackFromOptions"
>;
