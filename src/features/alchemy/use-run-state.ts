// Transient per-run React state restored from active save data or initialized from defaults.
// Depends on character game data, battle health defaults, and destination/run type shapes.
// Used by controllers; battle, shop, and navigation rules intentionally live elsewhere.
import { useState } from "react";
import { getStartingDeck, type BattleCard, type CharacterId } from "@/lib/game-data";
import { maxPlayerHealth } from "@/lib/battle";
import type { Destination } from "./types";
import type { ActiveRunData } from "./run/types";

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
};

function createInitialRunState(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): RunState {
  // Hydration copies mutable arrays so the active run store is independent of save data.
  const characterId = initialActiveRun?.characterId ?? fallbackCharacterId;
  return {
    characterId,
    runDeck: initialActiveRun ? [...initialActiveRun.runDeck] : getStartingDeck(characterId),
    runGold: initialActiveRun?.runGold ?? 0,
    runPlayerHealth: initialActiveRun?.runPlayerHealth ?? maxPlayerHealth,
    runMaxHealth: initialActiveRun?.runMaxHealth ?? maxPlayerHealth,
    roomsEncountered: initialActiveRun?.roomsEncountered ?? 0,
    currentAct: initialActiveRun?.currentAct ?? 1,
    destinationIndexInAct: initialActiveRun?.destinationIndexInAct ?? 0,
    completedDestinations: initialActiveRun?.completedDestinations?.length
      ? (initialActiveRun.completedDestinations as Destination[])
      : [],
    runTrinkets: initialActiveRun?.runTrinkets ? [...initialActiveRun.runTrinkets] : [],
  };
}

export function useRunState(initialActiveRun: ActiveRunData | null) {
  // Run data is stored as one object so multi-field transitions describe one coherent run.
  const [state, setState] = useState<RunState>(() => createInitialRunState(initialActiveRun));

  function fieldSetter<K extends keyof RunState>(key: K) {
    return (action: RunState[K] | ((prev: RunState[K]) => RunState[K])) => {
      setState((prev) => ({ ...prev, [key]: typeof action === "function" ? action(prev[key]) : action }));
    };
  }

  const setRunDeck = fieldSetter("runDeck");
  const setRunGold = fieldSetter("runGold");
  const setRunPlayerHealth = fieldSetter("runPlayerHealth");
  const setRunMaxHealth = fieldSetter("runMaxHealth");
  const setRoomsEncountered = fieldSetter("roomsEncountered");
  const setCurrentAct = fieldSetter("currentAct");
  const setDestinationIndexInAct = fieldSetter("destinationIndexInAct");
  const setCompletedDestinations = fieldSetter("completedDestinations");
  const setRunTrinkets = fieldSetter("runTrinkets");

  function setCharacter(selectedId: CharacterId) {
    setState((prev) => ({ ...prev, characterId: selectedId }));
  }

  function reset() {
    setState((prev) => createInitialRunState(null, prev.characterId));
  }

  return {
    ...state,
    setRunDeck,
    setRunGold,
    setRunPlayerHealth,
    setRunMaxHealth,
    setRoomsEncountered,
    setCurrentAct,
    setDestinationIndexInAct,
    setCompletedDestinations,
    setCharacter,
    reset,
    setRunTrinkets,
  };
}
