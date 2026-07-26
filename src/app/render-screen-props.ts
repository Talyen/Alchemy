// Props for the screen route renderer (shared by render-alchemy-screen and screen-routes).
import type { Screen } from "@/lib/routing";
import type { BattleControllerBindings } from "@/features/alchemy/shell/battle-bindings";
import type { AlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";

export interface RenderAlchemyScreenProps {
  screen: Screen;
  run: AlchemyRunController;
  battleBindings: BattleControllerBindings;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
  onBackFromOptions: () => void;
}
