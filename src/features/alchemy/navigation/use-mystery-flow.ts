// Mystery event state and handlers for run navigation.
// Depends on the effect dispatcher (mystery-flow.ts), game data, audio, and run state setters.
// Consumed by useRunNavigation to keep mystery UI state co-located with the mutation callbacks.
import { useState } from "react";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";

import { mysteryPool, type MysteryChoice, type MysteryEvent } from "../mystery-events";
import { addCardToRun, applyMysteryEffect } from "./mystery-flow";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { KeywordId } from "@/lib/game-data";

export type MysteryFlowContext = {
  runMaxHealth: number;
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setRunGold: Dispatch<SetStateAction<number>>;
  setRunPlayerHealth: Dispatch<SetStateAction<number>>;
  setRunTrinkets: Dispatch<SetStateAction<string[]>>;
  setDiscoveredCardIds: Dispatch<SetStateAction<string[]>>;
  setDiscoveredTrinketIds: Dispatch<SetStateAction<string[]>>;
  awardMysteryXP: (keyword: KeywordId, amount: number) => void;
  onAddMaterials: (materials: MaterialInventory) => void;
  advanceToNextDestination: () => void;
};

export function useMysteryFlow(context: MysteryFlowContext) {
  const [mysteryEvent, setMysteryEvent] = useState<MysteryEvent | null>(null);
  const [mysteryCardChoices, setMysteryCardChoices] = useState<BattleCard[] | null>(null);

  function beginMysteryEvent(navigateToMystery: () => void) {
    setMysteryEvent(pickRandom(mysteryPool) ?? mysteryPool[0]);
    setMysteryCardChoices(null);
    navigateToMystery();
  }

  function handleMysteryChoice(choice: MysteryChoice) {
    for (const effect of choice.effects) {
      const result = applyMysteryEffect(effect, {
        runMaxHealth: context.runMaxHealth,
        setRunDeck: context.setRunDeck,
        setRunGold: context.setRunGold,
        setRunPlayerHealth: context.setRunPlayerHealth,
        setRunTrinkets: context.setRunTrinkets,
        setDiscoveredCardIds: context.setDiscoveredCardIds,
        setDiscoveredTrinketIds: context.setDiscoveredTrinketIds,
        setMysteryCardChoices,
        awardMysteryXP: context.awardMysteryXP,
        onAddMaterials: context.onAddMaterials,
      });
      if (result.followUp) return;
    }
  }

  function handleMysteryChooseCard(cardId: string) {
    const card = cardLibrary.find((c) => c.id === cardId);
    if (card) {
      addCardToRun(card, { setRunDeck: context.setRunDeck, setDiscoveredCardIds: context.setDiscoveredCardIds });
    }
    setMysteryCardChoices(null);
  }

  function handleMysteryRemoveCard(index: number) {
    context.setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function handleMysteryContinue() {
    context.advanceToNextDestination();
  }

  function clearCardChoices() {
    setMysteryCardChoices(null);
  }

  function reset() {
    setMysteryEvent(null);
    setMysteryCardChoices(null);
  }

  return {
    mysteryEvent,
    mysteryCardChoices,
    beginMysteryEvent,
    handleMysteryChoice,
    handleMysteryChooseCard,
    handleMysteryRemoveCard,
    handleMysteryContinue,
    clearCardChoices,
    reset,
  };
}
