import { useState } from "react";
import { characters, starterDeck, type BattleCard, type CharacterGender, type CharacterId } from "@/lib/game-data";
import { maxPlayerHealth } from "@/lib/battle/types";

export function useRunState(initialActiveRun: { characterId: CharacterId; characterGender: CharacterGender } | null) {
  const [runDeck, setRunDeck] = useState<BattleCard[]>(() => initialActiveRun ? [...characters[initialActiveRun.characterId].startingDeck] : [...starterDeck]);
  const [runGold, setRunGold] = useState(0);
  const [runPlayerHealth, setRunPlayerHealth] = useState(maxPlayerHealth);
  const [roomsEncountered, setRoomsEncountered] = useState(0);
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const [characterGender, setCharacterGender] = useState<CharacterGender>("female");

  function setCharacter(selectedId: CharacterId, gender: CharacterGender) {
    setCharacterId(selectedId);
    setCharacterGender(gender);
  }

  function reset() {
    setRunDeck([...starterDeck]);
    setRunGold(0);
    setRoomsEncountered(0);
    setRunPlayerHealth(maxPlayerHealth);
  }

  return {
    runDeck, setRunDeck, runGold, setRunGold, runPlayerHealth, setRunPlayerHealth,
    roomsEncountered, setRoomsEncountered, characterId, characterGender, setCharacter, reset,
  };
}
