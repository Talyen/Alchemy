// Battle presentation bindings passed from the run controller to the battle screen route.
import type { MutableRefObject } from "react";
import type { CardTransfer } from "@/features/alchemy/shared/types";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";

export type BattleControllerBindings = {
  battleScreenData: BattleScreenData;
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: MutableRefObject<HTMLDivElement | null>;
  discardPileRef: MutableRefObject<HTMLDivElement | null>;
  battleSceneRef: MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: MutableRefObject<HTMLDivElement | null>;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
  playableHandCardKeys: Set<string>;
};
