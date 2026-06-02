// Battle screen actions for card play, turn flow, and dev shortcuts.
import type { BattleCard } from "@/lib/game-data";

export type BattleActions = {
  handleCardClick: (card: BattleCard, index: number, event: React.MouseEvent<HTMLButtonElement>) => void;
  handleWishChoice: (card: BattleCard | null) => void;
  handleEndTurn: () => void;
  handleEndRun: () => void;
  skipCombatDevMode: () => void;
  removeCardGhost: (id: string) => void;
  returnToBattle: () => void;
};
