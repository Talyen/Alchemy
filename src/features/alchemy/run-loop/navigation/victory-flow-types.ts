import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { RewardState } from "@/lib/active-run-session";
import type { Destination } from "@/lib/routing";
import type {
  DestinationOfferState,
  DestinationOptionsInput,
} from "@/features/alchemy/shared/run-flow/destination-flow";

export interface VictoryRewardsInput {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runDeck: BattleCard[];
  runBoons: string[];
  equippedTrinketId?: string | null;
  ownedTrinketIds?: string[];
  ownedUniqueIds?: ReadonlySet<string>;
  contentSystemType: ContentSystemId;
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  battleState: BattleState;
  purseGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  homesteadEffects: HomesteadEffectManifest;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
  bossEnemyId?: string | null | undefined;
  destinationOfferState: DestinationOfferState;
}

export interface VictoryRewardsResult {
  rewardState: RewardState;
  labyrinthRewardModifiers: EncounterRewardTraitId[];
  /** Presentation/SFX signal: unmultiplied gold gained this victory. */
  goldEarned: number;
  /** Purse total after this victory; commit writes this value, it does not re-add goldEarned. */
  persistedGold: number;
  playerHealth: number;
  maxHealthDelta: number;
  destinationOfferState: DestinationOfferState;
}

export interface CommitVictoryRewardsDeps {
  battleState: BattleState;
  contentSystemType: ContentSystemId;
}
