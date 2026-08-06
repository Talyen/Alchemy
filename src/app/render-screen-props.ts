// Props for the screen route renderer (shared by render-alchemy-screen and screen-routes).
import type { Screen } from "@/lib/routing";
import type { AlchemyRouteCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";

export interface RenderAlchemyScreenProps {
  screen: Screen;
  routeCommands: AlchemyRouteCommands;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
  onBackFromOptions: () => void;
}
