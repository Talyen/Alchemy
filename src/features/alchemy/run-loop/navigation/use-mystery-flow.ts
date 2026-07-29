// Manages React state integration and event handlers for the run's mystery events flow.
// Depends on: cardLibrary, run session store, mysteryPool, and mystery-flow helpers.
// Depended on by: useRunNavigation for managing the React state of mystery events during a run.
import { cardLibrary } from "@/lib/game-data";
import { pickMysteryEvent, type MysteryChoice } from "@/lib/mystery";
import { appendCardToRunWithDiscovery } from "../run/deck-mutations";
import { applyMysteryEffect } from "./mystery-flow";
import { setMysteryCardChoices, setMysteryEvent } from "../../shared/stores/run-session-facade";
import { readActiveRunStore, awardMaterialsDuringRun } from "../../shared/stores/run-session-facade";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";

export function useMysteryFlow(rng: () => number) {
  function beginMysteryEvent(navigateToMystery: () => void) {
    setMysteryEvent(pickMysteryEvent(rng));
    setMysteryCardChoices(null);
    navigateToMystery();
  }

  function handleMysteryChoice(choice: MysteryChoice) {
    const runStore = readActiveRunStore();

    for (const effect of choice.effects) {
      const result = applyMysteryEffect(effect, {
        runDeck: runStore.runDeck,
        runMaxHealth: runStore.runMaxHealth,
        rng,
        setRunDeck: runStore.setRunDeck,
        setRunGold: runStore.setRunGold,
        setRunPlayerHealth: runStore.setRunPlayerHealth,
        setRunTrinkets: runStore.setRunTrinkets,
        setMysteryCardChoices,
        awardMysteryXP: runStore.awardMysteryXP,
        onAddMaterials: (materials) => awardMaterialsDuringRun(applyMaterialFindBonus(materials, runStore.effects)),
        onAwardGold: runStore.addRunGold,
      });
      if (result.followUp) return;
    }
  }

  function handleMysteryChooseCard(cardId: string) {
    const card = cardLibrary.find((c) => c.id === cardId);
    if (card) {
      appendCardToRunWithDiscovery(card, readActiveRunStore().setRunDeck);
    }
    setMysteryCardChoices(null);
  }

  function handleMysteryRemoveCard(index: number) {
    readActiveRunStore().setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function clearCardChoices() {
    setMysteryCardChoices(null);
  }

  return {
    beginMysteryEvent,
    handleMysteryChoice,
    handleMysteryChooseCard,
    handleMysteryRemoveCard,
    clearCardChoices,
  };
}
