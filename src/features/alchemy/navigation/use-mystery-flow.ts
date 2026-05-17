// Mystery event state and handlers for run navigation.
// Uses useScreenStore for state, keeps logic in the hook.
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";

import { mysteryPool, type MysteryChoice } from "../mystery-events";
import { addCardToRun, applyMysteryEffect } from "./mystery-flow";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { KeywordId } from "@/lib/game-data";
import { useScreenStore } from "../stores/screen-store";

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
  onAwardGold: (amount: number) => void;
};

export function useMysteryFlow(context: MysteryFlowContext) {
  const mysteryEvent = useScreenStore((s) => s.mysteryEvent);
  const mysteryCardChoices = useScreenStore((s) => s.mysteryCardChoices);

  function getStore() {
    return useScreenStore.getState();
  }

  function beginMysteryEvent(navigateToMystery: () => void) {
    getStore().setMysteryEvent(pickRandom(mysteryPool) ?? mysteryPool[0]);
    getStore().setMysteryCardChoices(null);
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
        setMysteryCardChoices: getStore().setMysteryCardChoices,
        awardMysteryXP: context.awardMysteryXP,
        onAddMaterials: context.onAddMaterials,
        onAwardGold: context.onAwardGold,
      });
      if (result.followUp) return;
    }
  }

  function handleMysteryChooseCard(cardId: string) {
    const card = cardLibrary.find((c) => c.id === cardId);
    if (card) {
      addCardToRun(card, { setRunDeck: context.setRunDeck, setDiscoveredCardIds: context.setDiscoveredCardIds });
    }
    getStore().setMysteryCardChoices(null);
  }

  function handleMysteryRemoveCard(index: number) {
    context.setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function handleMysteryContinue() {
    context.advanceToNextDestination();
  }

  function clearCardChoices() {
    getStore().setMysteryCardChoices(null);
  }

  function reset() {
    getStore().setMysteryEvent(null);
    getStore().setMysteryCardChoices(null);
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
