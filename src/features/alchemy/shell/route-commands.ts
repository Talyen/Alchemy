import type { TransmutationSelectionCommand } from "@/lib/active-run-session/alchemy-visits";
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
import type { BuildingId, FarmId, ResearchId } from "@/lib/homestead/types";
import type { CompanionId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance, GearSlot } from "@/lib/gear";
import type { CollectionTab } from "../shared/types";

export interface ArmoryRouteCommands {
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => boolean;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onEquipTrinket: (characterId: CharacterId, trinketId: string) => void;
  onUnequipTrinket: (characterId: CharacterId) => void;
  onSalvage: (instanceId: string) => boolean;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  onSpawnDevTrinket?: () => void;
}

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
    resetHomestead: () => boolean;
    constructBuilding: (id: BuildingId) => boolean;
    plantFarm: (id: FarmId) => boolean;
    completeResearch: (id: ResearchId) => boolean;
    bondCompanion: (id: CompanionId) => boolean;
    selectCollectionTab: (tab: CollectionTab) => void;
    setCollectionPage: (tab: CollectionTab, page: number) => void;
    armory: ArmoryRouteCommands;
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
      initializeCampfire: () => void;
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
      continue: (expectedActivity: "shop" | "alchemist" | "trinket-shop" | "equipment-shop") => void;
    };
    mystery: {
      handleChoice: (choice: MysteryChoice) => boolean;
      handleChooseCard: (cardId: string) => boolean;
      handleContinue: () => void;
    };
    transmutation: {
      select: (selection: TransmutationSelectionCommand) => boolean;
      exchange: (sourceIndex: number, offerIndex: number) => BattleCard | null;
      continue: () => void;
      initialize: () => void;
    };
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
