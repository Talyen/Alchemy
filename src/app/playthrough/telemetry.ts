import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import type { BattleSnapshot } from "@/lib/battle";
import type { PlaythroughBattleSnapshot, PlaythroughDeckProfile, PlaythroughRunSnapshot } from "./types";

function summarizeDeck(deck: readonly BattleCard[]): PlaythroughDeckProfile {
  const keywordCounts: PlaythroughDeckProfile["keywordCounts"] = {};
  for (const card of deck) {
    for (const keyword of getCardKeywords(card)) keywordCounts[keyword] = (keywordCounts[keyword] ?? 0) + 1;
  }
  return { deckSize: deck.length, keywordCounts };
}

export function snapshotRunProgress(
  step: number,
  run: number,
  state: {
    currentAct: number;
    roomsEncountered: number;
    runPlayerHealth: number;
    runMaxHealth: number;
    runDeck: BattleCard[];
  },
  gold: number,
  materials: number,
  unlockedTalentCount: number,
): PlaythroughRunSnapshot {
  return {
    step,
    run,
    act: state.currentAct,
    rooms: state.roomsEncountered,
    gold,
    health: state.runPlayerHealth,
    maxHealth: state.runMaxHealth,
    materials,
    unlockedTalentCount,
    ...summarizeDeck(state.runDeck),
  };
}

export function snapshotBattle(
  step: number,
  run: number,
  room: number,
  stage: PlaythroughBattleSnapshot["stage"],
  state: BattleSnapshot,
): PlaythroughBattleSnapshot {
  return {
    step,
    run,
    room,
    enemy: state.currentEnemy.id,
    boss: state.currentEnemy.enemyType === "boss",
    stage,
    turn: state.turn,
    playerHealth: state.playerHealth,
    playerMaxHealth: state.playerMaxHealth,
    enemyHealth: state.enemyHealth,
    enemyMaxHealth: state.enemyMaxHealth,
    mana: state.mana,
    maxMana: state.maxMana,
    handSize: state.hand.length,
    discardSize: state.discard.length,
    exhaustedSize: state.exhausted.length,
    playerStatuses: { ...state.playerStatuses },
    enemyStatuses: { ...state.enemyStatuses },
    enemyMitigation: { ...state.enemyMitigation },
    ...summarizeDeck(state.deck),
  };
}
