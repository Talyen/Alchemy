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
  createDraftRunRandomSource,
  setMysteryCardChoices,
  setMysteryEvent,
  setRunDeck,
  setRunGold,
  setRunPlayerHealth,
  setRunTrinkets,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";
import type { MaterialInventory } from "@/lib/homestead/types";
import { playGoldGain, playGoldSpend } from "@/lib/audio";

export function useMysteryFlow() {
  function beginMysteryEvent(navigateToMystery: () => void) {
    dispatchRunSessionCommand(
      (draft) => {
        setMysteryEvent(draft, pickMysteryEvent(createDraftRunRandomSource(draft, "events")));
        setMysteryCardChoices(draft, null);
      },
      { afterCommit: navigateToMystery },
    );
  }

  function handleMysteryChoice(choice: MysteryChoice) {
    dispatchRunSessionCommand(
      (draft) => {
        const runStore = draft.run.activeRun;
        const goldSounds: Array<"gain" | "spend"> = [];

        for (const effect of choice.effects) {
          const result = applyMysteryEffect(effect, {
            runDeck: runStore.runDeck,
            runMaxHealth: runStore.runMaxHealth,
            rng: createDraftRunRandomSource(draft, "events"),
            setRunDeck,
            setRunGold,
            setRunPlayerHealth,
            setRunTrinkets,
            setMysteryCardChoices,
            awardMysteryXP,
            onAddMaterials: (materials: MaterialInventory) =>
              awardMaterialsDuringRun(draft, applyMaterialFindBonus(materials, draft.runProfile.effects)),
            onAwardGold: (amount) => addRunGold(draft, amount),
            draft,
          });
          if (result.goldSound) goldSounds.push(result.goldSound);
          if (result.followUp) return goldSounds;
        }
        return goldSounds;
      },
      {
        afterCommit: (goldSounds) => {
          for (const sound of goldSounds) {
            if (sound === "gain") playGoldGain();
            else playGoldSpend();
          }
        },
      },
    );
  }

  function handleMysteryChooseCard(cardId: string) {
    dispatchRunSessionCommand((draft) => {
      const card = cardLibrary.find((c) => c.id === cardId);
      if (card) {
        appendCardToRunWithDiscovery(draft, card);
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
    dispatchRunSessionCommand((draft) => setMysteryCardChoices(draft, null));
  }

  return {
    beginMysteryEvent,
    handleMysteryChoice,
    handleMysteryChooseCard,
    handleMysteryRemoveCard,
    clearCardChoices,
  };
}
