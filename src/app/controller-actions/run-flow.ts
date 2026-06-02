// Mid-run flow actions for rewards, destinations, shops, mysteries, and labyrinth map.
import type { BattleCard } from "@/lib/game-data";
import type { MysteryChoice } from "@/features/alchemy/mystery-events";
import type { Destination } from "@/lib/routing";

export type RunFlowActions = {
  finishRewards: () => void;
  selectRewardChoice: (id: string) => void;
  prepareDestinationScreen: () => void;
  handleDestinationChoice: (dest: Destination) => void;
  handleCampfireContinue: () => void;
  handleShopContinue: () => void;
  handleShopBuyCard: (card: BattleCard) => void | null;
  handleShopRemoveCard: (index: number) => void;
  handleShopRefresh: () => void;
  handleAlchemistBuyCard: (card: BattleCard) => void | null;
  handleAlchemistContinue: () => void;
  handleAlchemistRefresh: () => void;
  handleAlchemistMixPotions: (a: number, b: number) => BattleCard | null;
  handleMysteryChoice: (choice: MysteryChoice) => void;
  handleMysteryChooseCard: (cardId: string) => void;
  handleMysteryRemoveCard: (index: number) => void;
  handleMysteryContinue: () => void;
  handleCorruptCard: (index: number) => void;
  handleCorruptionExit: () => void;
  handleLabyrinthNodeEnter: (row: number, col: number) => void;
  handleLabyrinthEndRun: () => void;
  resetRunState: () => void;
};
