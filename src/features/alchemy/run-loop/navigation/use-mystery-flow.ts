// Manages React state integration and event handlers for the run's mystery events flow.
// Depends on: cardLibrary, run session store, mysteryPool, and mystery-flow helpers.
// Depended on by: useRunNavigation for managing the React state of mystery events during a run.
import { cardLibrary } from "@/lib/game-data";
import { pickMysteryEvent, type MysteryChoice } from "@/lib/mystery";
import { appendCardToRunWithDiscovery } from "../run/deck-mutations";
import { applyMysteryEffect } from "./mystery-flow";
import { useRunSessionMysterySlice } from "../../shared/stores/run-session-facade";
import { setMysteryCardChoices, setMysteryEvent } from "../../shared/stores/run-session-actions";
import { readActiveRunStore } from "../../shared/stores/run-session-read";
import { useAppStore } from "../../shared/stores/app-store";
import { useHomesteadStore } from "../../shared/stores/homestead-store";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";

export function useMysteryFlow({ advanceToNextDestination }: { advanceToNextDestination: () => void }) {
  const { mysteryEvent, mysteryCardChoices } = useRunSessionMysterySlice();

  function beginMysteryEvent(navigateToMystery: () => void) {
    setMysteryEvent(pickMysteryEvent());
    setMysteryCardChoices(null);
    navigateToMystery();
  }

  function handleMysteryChoice(choice: MysteryChoice) {
    const runStore = readActiveRunStore();
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
        setMysteryCardChoices,
        awardMysteryXP: runStore.awardMysteryXP,
        onAddMaterials: (materials) =>
          homesteadStore.addMaterials(applyMaterialFindBonus(materials, homesteadStore.effects)),
        onAwardGold: runStore.addRunGold,
      });
      if (result.followUp) return;
    }
  }

  function handleMysteryChooseCard(cardId: string) {
    const card = cardLibrary.find((c) => c.id === cardId);
    if (card) {
      const runStore = readActiveRunStore();
      const appStore = useAppStore.getState();
      appendCardToRunWithDiscovery(card, {
        setRunDeck: runStore.setRunDeck,
        setDiscoveredCardIds: appStore.setDiscoveredCardIds,
      });
    }
    setMysteryCardChoices(null);
  }

  function handleMysteryRemoveCard(index: number) {
    readActiveRunStore().setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function handleMysteryContinue() {
    advanceToNextDestination();
  }

  function clearCardChoices() {
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
  };
}
