// Props for the screen route renderer (shared by render-alchemy-screen and screen-routes).
import type { Screen } from "@/features/alchemy/shared/types";
import type { ControllerActions } from "@/app/build-controller-actions";
import type { BattleControllerBindings } from "@/features/alchemy/shell/battle-bindings";

export type RenderAlchemyScreenProps = {
  screen: Screen;
  actions: ControllerActions;
  battleBindings: BattleControllerBindings;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
};
