import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { Destination } from "@/features/alchemy/shared/types";
import type { DestinationOfferState } from "./destination-flow";
import type { RewardState } from "./reward-flow";

export interface VictoryRewardsInput {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runDeck: BattleCard[];
  runTrinkets: string[];
  contentSystemType: ContentSystemId;
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  battleState: BattleState;
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  homesteadEffects: HomesteadEffectManifest;
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
  bossEnemyId?: string | null | undefined;
  destinationOfferState: DestinationOfferState;
}

export interface VictoryRewardsResult {
  newGold: number;
  rewardState: RewardState;
  labyrinthRewardModifiers: EncounterRewardTraitId[];
  destinations: Destination[];
  materials: MaterialInventory;
  goldEarned: number;
  playerHealth: number;
  maxHealthDelta: number;
  baseGold: number;
  eliteBonus: number;
  bossBonus: number;
  generousBonus: number;
  destinationOfferState: DestinationOfferState;
}

export interface CommitVictoryRewardsDeps {
  battleState: BattleState;
  contentSystemType: ContentSystemId;
  addHomesteadMaterials: (materials: MaterialInventory) => void;
  addRunGold: (amount: number) => void;
  setRunMaxHealth: (fn: (prev: number) => number) => void;
  setRewardState: (state: RewardState) => void;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setDestinationOfferState: (state: DestinationOfferState) => void;
  setHasActiveBattle: (active: boolean) => void;
}
