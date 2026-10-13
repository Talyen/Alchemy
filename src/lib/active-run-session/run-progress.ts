import type { ContentSystemId } from "@/lib/content-systems/types";
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRngState } from "@/lib/rng";
import type { Destination } from "@/lib/routing";
export type RunObtainedItem = { kind: "gear"; instance: GearInstance } | { kind: "trinket"; trinketId: string };

/** Progress shared by live runs and their save representation. Recovery defaults belong to validation. */
export interface PersistedRunProgress {
  runHistory: Array<{ id: string; destination: Destination; act: number; floor: number | null; completed: boolean }>;
  runHistoryPartial: boolean;
  runGoldEarned: number | null;
  characterId: CharacterId;
  runDeck: BattleCard[];
  runPlayerHealth: number;
  runMaxHealth: number;
  runMetaMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  // Wire callers may carry old destination names until normalization; live state narrows them.
  completedDestinations: string[];
  lastOfferedDestinations: string[];
  destinationRoundsSinceOffered: Record<string, number>;
  runBoons: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  rng: RunRngState;
  runTalentXP: Record<string, number>;
  runMaterialsEarned: MaterialInventory;
  runCurrenciesEarned: Record<CraftingCurrencyId, number>;
  runObtainedItems: RunObtainedItem[];
}

// Exhaustive domain projection used by save encoding and restoration, without loading save schemas.
const progressFields = {
  runHistory: true,
  runHistoryPartial: true,
  runGoldEarned: true,
  characterId: true,
  runDeck: true,
  runPlayerHealth: true,
  runMaxHealth: true,
  runMetaMaxHealth: true,
  roomsEncountered: true,
  currentAct: true,
  destinationIndexInAct: true,
  completedDestinations: true,
  lastOfferedDestinations: true,
  destinationRoundsSinceOffered: true,
  runBoons: true,
  encounteredRunEnemyIds: true,
  selectedDifficulty: true,
  contentSystemType: true,
  rng: true,
  runTalentXP: true,
  runMaterialsEarned: true,
  runCurrenciesEarned: true,
  runObtainedItems: true,
} satisfies Record<keyof PersistedRunProgress, true>;

export const ACTIVE_RUN_PROGRESS_KEYS = Object.freeze(Object.keys(progressFields)) as ReadonlyArray<
  keyof PersistedRunProgress
>;
