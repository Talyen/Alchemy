import { useState } from "react";
import { characters, starterDeck, type BattleCard, type CharacterId } from "@/lib/game-data";
import { maxPlayerHealth } from "@/lib/battle/types";
import type { Destination } from "./types";

export function useRunState(initialActiveRun: { characterId: CharacterId } | null) {
  const [runDeck, setRunDeck] = useState<BattleCard[]>(() => initialActiveRun ? [...characters[initialActiveRun.characterId].startingDeck] : [...starterDeck]);
  const [runGold, setRunGold] = useState(0);
  const [runPlayerHealth, setRunPlayerHealth] = useState(maxPlayerHealth);
  const [runMaxHealth, setRunMaxHealth] = useState(maxPlayerHealth);
  const [roomsEncountered, setRoomsEncountered] = useState(0);
  const [currentAct, setCurrentAct] = useState(1);
  const [destinationIndexInAct, setDestinationIndexInAct] = useState(0);
  const [completedDestinations, setCompletedDestinations] = useState<Destination[]>([]);
  const [characterId, setCharacterId] = useState<CharacterId>(() => initialActiveRun?.characterId ?? "knight");
  const [runTrinkets, setRunTrinkets] = useState<string[]>([]);

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
