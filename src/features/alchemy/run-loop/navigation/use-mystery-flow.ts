// Manages React state integration and event handlers for the run's mystery events flow.
// Depends on: cardLibrary, run session store, mysteryPool, and mystery-flow helpers.
// Depended on by: useRunNavigation for managing the React state of mystery events during a run.
import { cardLibrary } from "@/lib/game-data";
import { pickMysteryEvent, type MysteryChoice } from "@/lib/mystery";
import { appendCardToRunWithDiscovery } from "../run/deck-mutations";
import { applyMysteryEffect } from "./mystery-flow";
import { setMysteryCardChoices, setMysteryEvent } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";

export function useMysteryFlow(rng: () => number) {
  function beginMysteryEvent(navigateToMystery: () => void) {
    dispatchRunSessionCommand(
      () => {
        setMysteryEvent(pickMysteryEvent(rng));
        setMysteryCardChoices(null);
      },
      { afterCommit: navigateToMystery },
    );
  }

  function handleMysteryChoice(choice: MysteryChoice) {
    dispatchRunSessionCommand(() => {
      const runStore = readActiveRun();

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
          onAddMaterials: (materials) =>
            awardMaterialsDuringRun(applyMaterialFindBonus(materials, readRunProfile().effects)),
          onAwardGold: runStore.addRunGold,
        });
        if (result.followUp) return;
      }
    });
  }

  function handleMysteryChooseCard(cardId: string) {
    dispatchRunSessionCommand(() => {
      const card = cardLibrary.find((c) => c.id === cardId);
      if (card) {
        appendCardToRunWithDiscovery(card, readActiveRun().setRunDeck);
      }
      setMysteryCardChoices(null);
    });
  }

  function handleMysteryRemoveCard(index: number) {
    dispatchRunSessionCommand(() => {
      readActiveRun().setRunDeck((p) => p.filter((_, i) => i !== index));
    });
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
