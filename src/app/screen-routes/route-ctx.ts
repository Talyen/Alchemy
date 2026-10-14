import type { CardInspectionView } from "@/features/alchemy/shared/types";
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/route-commands";
import type { Screen } from "@/lib/routing";

export interface RenderAlchemyScreenProps {
  cardInspection?: { canOpen: boolean; onOpen: (view: CardInspectionView) => void } | undefined;
  screen: Screen;
  routeCommands: AlchemyRouteCommands;
  onOpenBoards: () => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
  gameMenuOpen: boolean;
  onOpenGameMenu: (rect: DOMRect) => void;
  onBack?: (() => void) | undefined;
}

interface PhaseRouteCtx<K extends keyof AlchemyRouteCommands> {
  routeCommands: Pick<AlchemyRouteCommands, K>;
  onOpenGameMenu: (rect: DOMRect) => void;
  onBack?: (() => void) | undefined;
}

export type MetaRouteCtx = PhaseRouteCtx<"meta" | "progress" | "boards">;
export type RunSetupRouteCtx = PhaseRouteCtx<"runSetup">;
export type RunLoopRouteCtx = PhaseRouteCtx<"runLoop" | "progress">;
export type RunEndRouteCtx = PhaseRouteCtx<"runEnd" | "boards" | "progress"> & Pick<RenderAlchemyScreenProps, "screen">;

export interface BattleRouteCtx extends PhaseRouteCtx<"battle"> {
  cardInspection?: RenderAlchemyScreenProps["cardInspection"];
  gameMenuOpen: RenderAlchemyScreenProps["gameMenuOpen"];
}

export type OptionsRouteCtx = Pick<
  RenderAlchemyScreenProps,
  "onOpenBoards" | "onClearSaveData" | "onUnlockAllDevMode" | "onOpenGameMenu" | "onBack"
>;
