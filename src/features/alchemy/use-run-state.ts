// Type-only file — the hook implementation moved to stores/run-store.ts.
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import type { RunStartSnapshot } from "./run/run-start";
import type { Destination } from "./types";
import type { ContentSystemId } from "@/lib/content-systems/types";

type RunState = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
};

type RunFieldSetter<T> = (action: T | ((prev: T) => T)) => void;

export type RunStateController = RunState & {
  setRunDeck: RunFieldSetter<BattleCard[]>;
  setRunGold: RunFieldSetter<number>;
  setRunPlayerHealth: RunFieldSetter<number>;
  setRunMaxHealth: RunFieldSetter<number>;
  setRoomsEncountered: RunFieldSetter<number>;
  setCurrentAct: RunFieldSetter<number>;
  setDestinationIndexInAct: RunFieldSetter<number>;
  setCompletedDestinations: RunFieldSetter<Destination[]>;
  setRunTrinkets: RunFieldSetter<string[]>;
  setEncounteredRunEnemyIds: RunFieldSetter<string[]>;
  setSelectedDifficulty: RunFieldSetter<DifficultyId | null>;
  setContentSystemType: RunFieldSetter<ContentSystemId>;
  setCharacter: (selectedId: CharacterId) => void;
  reset: () => void;
  addRunGold: (amount: number) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
};
