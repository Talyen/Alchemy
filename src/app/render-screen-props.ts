// Props for the screen route renderer (shared by render-alchemy-screen and screen-routes).
import type { CardTransfer, Screen } from "@/features/alchemy/types";
import type { ControllerActions } from "@/app/controller-actions";

export type RenderAlchemyScreenProps = {
  screen: Screen;
  actions: ControllerActions;
  handCardRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: React.MutableRefObject<HTMLDivElement | null>;
  discardPileRef: React.MutableRefObject<HTMLDivElement | null>;
  battleSceneRef: React.MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: React.MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: React.MutableRefObject<HTMLDivElement | null>;
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
  hasUnspentTalents: boolean;
  hasAffordableHomestead: boolean;
  pendingCharacterId: string | null;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
};
