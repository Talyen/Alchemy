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

interface PhaseRouteCtx<K extends keyof AlchemyRouteCommands> {
  routeCommands: Pick<AlchemyRouteCommands, K>;
  onOpenBattleMenu: RenderAlchemyScreenProps["onOpenBattleMenu"];
}

export type MetaRouteCtx = PhaseRouteCtx<"meta">;
export type RunSetupRouteCtx = PhaseRouteCtx<"runSetup">;
export type RunLoopRouteCtx = PhaseRouteCtx<"runLoop">;
export type RunEndRouteCtx = PhaseRouteCtx<"runEnd">;

export interface BattleRouteCtx extends PhaseRouteCtx<"battle"> {
  gameMenuOpen: RenderAlchemyScreenProps["gameMenuOpen"];
}

export type OptionsRouteCtx = Pick<
  RenderAlchemyScreenProps,
  "onOpenBattleMenu" | "onClearSaveData" | "onUnlockAllDevMode" | "onBackFromOptions"
>;
