// Battle presentation bindings shared with the battle screen route via context.
import { createContext, useContext, type MutableRefObject, type ReactNode } from "react";
import type { CardTransfer } from "@/features/alchemy/types";
import type { BattleScreenData } from "@/features/alchemy/screens";

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

const BattleControllerContext = createContext<BattleControllerBindings | null>(null);

export function BattleControllerProvider({
  value,
  children,
}: {
  value: BattleControllerBindings;
  children: ReactNode;
}) {
  return <BattleControllerContext.Provider value={value}>{children}</BattleControllerContext.Provider>;
}

export function useBattleControllerBindings(): BattleControllerBindings {
  const value = useContext(BattleControllerContext);
  if (!value) {
    throw new Error("useBattleControllerBindings must be used within BattleControllerProvider");
  }
  return value;
}
