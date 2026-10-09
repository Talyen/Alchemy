import type { ProgressSaveState } from "@/features/alchemy/shared/storage";
import type { BrewOperation } from "@/lib/alchemist/brewing";
import type { BattleRefs } from "../shared/types";
import type {
  MerchantShopCommands,
  AlchemistShopCommands,
  TrinketShopCommands,
  EquipmentShopCommands,
} from "../run-loop/shop/shop-action-types";
import type { Screen, Destination } from "@/lib/routing";
import type { KeywordId, CharacterId, DifficultyId, BattleCard } from "@/lib/game-data";
import type { MysteryChoice } from "@/lib/mystery";
import type { MouseEvent } from "react";
import type { AutoplayCardHandler, AutoplayWishHandler, BattlePlaybackBind } from "../run-loop/battle/battle-context";

import type { BattlePresentationStore } from "../run-loop/battle/battle-presentation-store";

export interface AlchemyRouteCommands {
  progress: {
    isPending: () => boolean;
    afterSaved: (feedback: () => void) => void;
  };
  meta: {
    resumeRun: () => void;
    goToScreen: (nextScreen: Screen) => void;
    beginCampaign: () => void;
    beginLabyrinth: () => void;
    beginWildwood: () => void;
    unlockTalent: (keywordId: KeywordId, talentId: string) => void;
    resetUnlockedTalents: () => void;
  };
  runSetup: {
    goToScreen: (nextScreen: Screen) => void;
    handleCharacterSelect: (selectedId: CharacterId) => void;
    handleStandardDraftComplete: () => void;
    handleWildwoodDraftComplete: () => void;
    handleWildwoodDraftPick: (cardId: string) => void;
    handleStarterDraftPick: (cardId: string) => void;
    handleDifficultySelect: (difficultyId: DifficultyId) => void;
    handleBackFromDifficultySelect: () => void;
  };
  runLoop: {
    labyrinth: {
      handleNodeSelect: (nodeId: string) => void;
      handleNodeDeselect: () => void;
      handleNodeEnter: () => boolean;
      descend: () => void;
    };
    rewards: {
      skip: () => void;
      claimChoice: (id: string) => void;
    };
    destinations: {
      prepare: () => void;
      choose: (destination: Destination) => void;
      continueCampfire: () => void;
      rest: () => boolean;
      brew: (operation: BrewOperation) => BattleCard | null;
    };
    wildwood: {
      removeCard: (index: number) => void;
      skipRemoval: () => void;
    };
    shop: {
      merchant: Omit<MerchantShopCommands, "initialize">;
      alchemist: Omit<AlchemistShopCommands, "initialize">;
      trinket: Omit<TrinketShopCommands, "initialize">;
      equipment: Omit<EquipmentShopCommands, "initialize">;
      continue: () => void;
    };
    mystery: {
      handleChoice: (choice: MysteryChoice) => void;
      handleChooseCard: (cardId: string) => boolean;
      handleContinue: () => void;
    };
    transmutation: { exchange: (sourceIndex: number, offerIndex: number) => BattleCard | null; continue: () => void };
    corruption: {
      handleCorruptCard: (cardIndex: number) => void;
      handleExit: () => void;
    };
  };
  battle: {
    presentation: BattlePresentationStore;
    handleCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
    handleWishChoice: (card: BattleCard) => void;
    handleEndTurn: () => void;
    handleAutoplayCard: AutoplayCardHandler;
    handleAutoplayWish: AutoplayWishHandler;
    skipCombatDevMode: () => void;
    refs: BattleRefs;
    bindPlayback: (bind: BattlePlaybackBind | null) => void;
    isCardPlayInProgress: () => boolean;
    isProgressSavePending: () => boolean;
    subscribeProgressSave: (listener: () => void) => () => void;
    screen: Screen;
    isAutoplayEnabled: boolean;
    setAutoplayEnabled: (enabled: boolean) => void;
    toggleAutoplayEnabled: () => void;
    boonInspectOpen: boolean;
    toggleBoonInspect: () => void;
    closeBoonInspect: () => void;
  };
  runEnd: {
    continueFromRunEnd: () => void;
  };
}

export interface AlchemyRunCommands {
  screen: Screen;
  navigationPending: boolean;
  progressSave: ProgressSaveState;
  retryProgressSave: () => void;
  routeCommands: AlchemyRouteCommands;
  unlockAllTalents: () => void;
  returnToBattle: () => void;
  goToScreen: (nextScreen: Screen) => void;
  handleEndRun: () => void;
  resetRunState: () => void;
}
