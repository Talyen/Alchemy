// Manages React state integration and event handlers for the run's mystery events flow.
// Depends on: cardLibrary, useScreenStore, mysteryPool, and mystery-flow helpers.
// Depended on by: useRunNavigation for managing the React state of mystery events during a run.
import { cardLibrary } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";

import { mysteryPool, type MysteryChoice } from "../mystery-events";
import { addCardToRun, applyMysteryEffect } from "./mystery-flow";
import { useScreenStore } from "../stores/screen-store";
import { useRunStore } from "../stores/run-store";
import { useAppStore } from "../stores/app-store";
import { useHomesteadStore } from "../stores/homestead-store";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";

export function useMysteryFlow({ advanceToNextDestination }: { advanceToNextDestination: () => void }) {
  const mysteryEvent = useScreenStore((s) => s.mysteryEvent);
  const mysteryCardChoices = useScreenStore((s) => s.mysteryCardChoices);

  function getStore() {
    return useScreenStore.getState();
  }

  // Prepares the mystery destination state by sampling a random event and navigating to the screen.
  function beginMysteryEvent(navigateToMystery: () => void) {
    getStore().setMysteryEvent(pickRandom(mysteryPool) ?? mysteryPool[0]);
    getStore().setMysteryCardChoices(null);
    navigateToMystery();
  }

  // Processes each consequence effect linked to the player's choice sequentially.
  // If an effect requires follow-up UI interaction (like choosing a card), execution halts.
  function handleMysteryChoice(choice: MysteryChoice) {
    const runStore = useRunStore.getState();
    const appStore = useAppStore.getState();
    const homesteadStore = useHomesteadStore.getState();

    for (const effect of choice.effects) {
      const result = applyMysteryEffect(effect, {
        runMaxHealth: runStore.runMaxHealth,
        setRunDeck: runStore.setRunDeck,
        setRunGold: runStore.setRunGold,
        setRunPlayerHealth: runStore.setRunPlayerHealth,
        setRunTrinkets: runStore.setRunTrinkets,
        setDiscoveredCardIds: appStore.setDiscoveredCardIds,
        setDiscoveredTrinketIds: appStore.setDiscoveredTrinketIds,
        setMysteryCardChoices: getStore().setMysteryCardChoices,
        awardMysteryXP: runStore.awardMysteryXP,
        onAddMaterials: (materials) =>
          homesteadStore.addMaterials(applyMaterialFindBonus(materials, homesteadStore.effects)),
        onAwardGold: runStore.addRunGold,
      });
      if (result.followUp) return;
    }
  }

  // Adds the selected card from the choice picker to the run's deck and closes the picker.
  function handleMysteryChooseCard(cardId: string) {
    const card = cardLibrary.find((c) => c.id === cardId);
    if (card) {
      const runStore = useRunStore.getState();
      const appStore = useAppStore.getState();
      addCardToRun(card, {
        setRunDeck: runStore.setRunDeck,
        setDiscoveredCardIds: appStore.setDiscoveredCardIds,
      });
    }
    getStore().setMysteryCardChoices(null);
  }

  // Removes a card at the given deck index as part of a choose-removal consequence.
  function handleMysteryRemoveCard(index: number) {
    useRunStore.getState().setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  // Completes the event flow and advances the run map to the next set of destinations.
  function handleMysteryContinue() {
    advanceToNextDestination();
  }

  // Clears the buffered card selection options.
  function clearCardChoices() {
    getStore().setMysteryCardChoices(null);
  }

  // Resets the screen store's mystery-related states back to clean defaults.
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
