// Narrow run/talent ports for run-flow handlers — avoid threading full controller bags.
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "../../shared/types";

/** Active-run fields and setters that run-flow handlers touch via deps.run. */
export interface RunFlowRunPort {
  contentSystemType: ContentSystemId;
  currentAct: number;
  selectedDifficulty: DifficultyId | null;
  characterId: CharacterId;
  runMaxHealth: number;
  setCurrentAct: (value: number | ((prev: number) => number)) => void;
  setDestinationIndexInAct: (value: number | ((prev: number) => number)) => void;
  setCompletedDestinations: (value: Destination[] | ((prev: Destination[]) => Destination[])) => void;
  setRoomsEncountered: (value: number | ((prev: number) => number)) => void;
  setRunDeck: (value: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])) => void;
  setRunTrinkets: (value: string[] | ((prev: string[]) => string[])) => void;
  setRunPlayerHealth: (value: number | ((prev: number) => number)) => void;
}

/** Talent fields run-flow handlers use (campfire heal only). */
export interface RunFlowTalentPort {
  talentEffects: {
    campfireHealBonus: number;
  };
}
