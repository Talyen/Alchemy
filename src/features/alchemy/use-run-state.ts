import { useState } from "react";
import { starterDeck, type BattleCard, type CharacterId } from "@/lib/game-data";
import { maxPlayerHealth } from "@/lib/battle/types";
import type { Destination } from "./types";

type ActiveRunData = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: string[];
  runTrinkets: string[];
};

export function useRunState(initialActiveRun: ActiveRunData | null) {
  const [runDeck, setRunDeck] = useState<BattleCard[]>(() => initialActiveRun ? [...initialActiveRun.runDeck] : [...starterDeck]);
  const [runGold, setRunGold] = useState(initialActiveRun?.runGold ?? 0);
  const [runPlayerHealth, setRunPlayerHealth] = useState(initialActiveRun?.runPlayerHealth ?? maxPlayerHealth);
  const [runMaxHealth, setRunMaxHealth] = useState(initialActiveRun?.runMaxHealth ?? maxPlayerHealth);
  const [roomsEncountered, setRoomsEncountered] = useState(initialActiveRun?.roomsEncountered ?? 0);
  const [currentAct, setCurrentAct] = useState(initialActiveRun?.currentAct ?? 1);
  const [destinationIndexInAct, setDestinationIndexInAct] = useState(initialActiveRun?.destinationIndexInAct ?? 0);
  const [completedDestinations, setCompletedDestinations] = useState<Destination[]>(() => initialActiveRun?.completedDestinations?.length ? initialActiveRun.completedDestinations as Destination[] : []);
  const [characterId, setCharacterId] = useState<CharacterId>(() => initialActiveRun?.characterId ?? "knight");
  const [runTrinkets, setRunTrinkets] = useState<string[]>(() => initialActiveRun?.runTrinkets ?? []);

  function setCharacter(selectedId: CharacterId) {
    setCharacterId(selectedId);
  }

  function reset() {
    setRunDeck([...starterDeck]);
    setRunGold(0);
    setRunPlayerHealth(maxPlayerHealth);
    setRunMaxHealth(maxPlayerHealth);
    setRoomsEncountered(0);
    setCurrentAct(1);
    setDestinationIndexInAct(0);
    setCompletedDestinations([]);
    setRunTrinkets([]);
  }

  return {
    runDeck, setRunDeck, runGold, setRunGold, runPlayerHealth, setRunPlayerHealth,
    runMaxHealth, setRunMaxHealth,
    roomsEncountered, setRoomsEncountered,
    currentAct, setCurrentAct, destinationIndexInAct, setDestinationIndexInAct,
    completedDestinations, setCompletedDestinations,
    characterId, setCharacter, reset,
    runTrinkets, setRunTrinkets,
  };
}
