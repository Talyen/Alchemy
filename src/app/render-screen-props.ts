// Props for the screen route renderer (shared by render-alchemy-screen and screen-routes).
import type { Screen } from "@/features/alchemy/types";
import type { ControllerActions } from "@/app/controller-actions";

export type RenderAlchemyScreenProps = {
  screen: Screen;
  actions: ControllerActions;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
};
