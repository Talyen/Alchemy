// Battle presentation bindings passed from the run controller to the battle screen route.
import type { RefObject } from "react";
import type { CardTransfer } from "@/features/alchemy/shared/types";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";

export type BattleControllerBindings = {
  battleScreenData: BattleScreenData;
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
  playableHandCardKeys: Set<string>;
};
