// Manages React state integration and event handlers for the run's mystery events flow.
// Depends on: cardLibrary, run session store, mysteryPool, and mystery-flow helpers.
// Depended on by: useRunFlowEngine for managing the React state of mystery events during a run.
import { cardLibrary } from "@/lib/game-data";
import { pickMysteryEvent, type MysteryChoice } from "@/lib/mystery";
import { appendCardToRunWithDiscovery } from "../run/deck-mutations";
import { applyMysteryEffect } from "./mystery-flow";
import {
  addRunGold,
  awardMaterialsDuringRun,
  awardMysteryXP,
  bindRunRandomSource,
  setMysteryCardChoices,
  setMysteryEvent,
  setRunDeck,
  setRunGold,
  setRunPlayerHealth,
  setRunTrinkets,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";
import type { MaterialInventory } from "@/lib/homestead/types";

export function useMysteryFlow(rng: () => number) {
  function beginMysteryEvent(navigateToMystery: () => void) {
    dispatchRunSessionCommand(
      (draft) => {
        setMysteryEvent(draft, pickMysteryEvent(bindRunRandomSource(rng, draft)));
        setMysteryCardChoices(draft, null);
      },
      { afterCommit: navigateToMystery },
    );
  }

  function handleMysteryChoice(choice: MysteryChoice) {
    dispatchRunSessionCommand((draft) => {
      const runStore = draft.run.activeRun;

      for (const effect of choice.effects) {
        const result = applyMysteryEffect(effect, {
          runDeck: runStore.runDeck,
          runMaxHealth: runStore.runMaxHealth,
          rng: bindRunRandomSource(rng, draft),
          setRunDeck,
          setRunGold,
          setRunPlayerHealth,
          setRunTrinkets,
          setMysteryCardChoices,
          awardMysteryXP,
          onAddMaterials: ((nextDraft: GameplayDraft, materials: MaterialInventory) =>
            awardMaterialsDuringRun(
              nextDraft,
              applyMaterialFindBonus(materials, draft.runProfile.effects),
            )) as unknown as (
            draftOrMaterials: GameplayDraft | MaterialInventory,
            materials?: MaterialInventory,
          ) => void,
          onAwardGold: addRunGold as unknown as (draftOrAmount: GameplayDraft | number, amount?: number) => void,
          draft,
        });
        if (result.followUp) return;
      }
    });
  }

  function handleMysteryChooseCard(cardId: string) {
    dispatchRunSessionCommand((draft) => {
      const card = cardLibrary.find((c) => c.id === cardId);
      if (card) {
        appendCardToRunWithDiscovery(card, setRunDeck, draft);
      }
      setMysteryCardChoices(draft, null);
    });
  }

  function handleMysteryRemoveCard(index: number) {
    dispatchRunSessionCommand((draft) => {
      setRunDeck(draft, (p) => p.filter((_, i) => i !== index));
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
