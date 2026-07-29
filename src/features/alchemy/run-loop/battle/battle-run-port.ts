// Narrow run/talent ports for battle glue — avoid threading the full RunStateController bag.
import type { BattleCard, CharacterId, DifficultyId, TalentEffectManifest } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";

/** Active-run fields and setters that battle init / play actually touch. */
export interface BattleRunPort {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  runMaxHealth: number;
  runTrinkets: string[];
  roomsEncountered: number;
  setRoomsEncountered: (value: number | ((prev: number) => number)) => void;
  contentSystemType: ContentSystemId;
  encounteredRunEnemyIds: string[];
  setEncounteredRunEnemyIds: (value: string[] | ((prev: string[]) => string[])) => void;
  runDeck: BattleCard[];
  runGold: number;
}

/** Talent fields battle uses for effect merge and XP awards. */
export interface BattleTalentPort {
  talentEffects: TalentEffectManifest;
  awardCardXP: (card: BattleCard) => void;
}
