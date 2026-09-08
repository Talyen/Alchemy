import type { CardInspectionView } from "@/features/alchemy/shared/types";
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { Screen } from "@/lib/routing";

export interface RenderAlchemyScreenProps {
  cardInspection?: { canOpen: boolean; onOpen: (view: CardInspectionView) => void } | undefined;
  screen: Screen;
  routeCommands: AlchemyRouteCommands;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
  gameMenuOpen: boolean;
  onOpenGameMenu: (rect: DOMRect) => void;
  onBack?: (() => void) | undefined;
}

export type MetaCommands = AlchemyRouteCommands["meta"];
export type RunSetupCommands = AlchemyRouteCommands["runSetup"];
export type RunLoopCommands = AlchemyRouteCommands["runLoop"];
export type BattleCommands = AlchemyRouteCommands["battle"];
export type RunEndCommands = AlchemyRouteCommands["runEnd"];

interface PhaseRouteCtx<K extends keyof AlchemyRouteCommands> {
  routeCommands: Pick<AlchemyRouteCommands, K>;
  onOpenGameMenu: (rect: DOMRect) => void;
  onBack?: (() => void) | undefined;
}

export type MetaRouteCtx = PhaseRouteCtx<"meta">;
export type RunSetupRouteCtx = PhaseRouteCtx<"runSetup">;
export type RunLoopRouteCtx = PhaseRouteCtx<"runLoop">;
export type RunEndRouteCtx = PhaseRouteCtx<"runEnd">;

export interface BattleRouteCtx extends PhaseRouteCtx<"battle"> {
  cardInspection?: RenderAlchemyScreenProps["cardInspection"];
  gameMenuOpen: RenderAlchemyScreenProps["gameMenuOpen"];
}

export type OptionsRouteCtx = Pick<
  RenderAlchemyScreenProps,
  "onClearSaveData" | "onUnlockAllDevMode" | "onOpenGameMenu" | "onBack"
>;
