// Mystery event navigation: begin + choice handlers with screen transition + sound.
import { useCallback, useMemo } from "react";
import { cardLibrary } from "@/lib/game-data";
import { pickMysteryEvent, resolveMysteryEventTrinkets, type MysteryChoice } from "@/lib/mystery";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import {
  addRunGold,
  awardMaterialsDuringRun,
  awardMysteryXP,
  createDraftRunRandomSource,
  setMysteryCardChoices,
  setMysteryEvent,
  setMysteryGrantedTrinketIds,
  setMysteryGrantedGearInstances,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryPendingRemoval,
  clearMysteryVisitState,
  setRunDeck,
  setRunGold,
  setRunPlayerHealth,
  setRunTrinkets,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import { applyMaterialFindBonus } from "@/lib/homestead/loot";
import type { MaterialInventory } from "@/lib/homestead/types";
import { playGoldGain, playGoldSpend, playUISound } from "@/lib/audio";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";

export function useMysteryEventNavigation({
  navigateTo,
}: {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
}) {
  const beginMysteryEvent = useCallback(
    (onRenderedScreenCommit?: () => void) => {
      dispatchRunSessionCommand(
        (draft) => {
          clearMysteryVisitState(draft);
          const rng = createDraftRunRandomSource(draft, "events");
          setMysteryEvent(
            draft,
            resolveMysteryEventTrinkets(pickMysteryEvent(rng), draft.run.activeRun.runTrinkets, rng),
          );
        },
        {
          afterCommit: () => {
            navigateTo(CONSTANTS.SCREENS.MYSTERY, onRenderedScreenCommit);
            playUISound("musicBoxMystery");
          },
        },
      );
    },
    [navigateTo],
  );

  const handleMysteryChoice = useCallback((choice: MysteryChoice) => {
    dispatchRunSessionCommand(
      (draft) => {
        if (draft.session.mysteryChosenChoice !== null) return [];
        setMysteryChosenChoice(draft, choice);
        const runStore = draft.run.activeRun;
        const goldSounds: Array<"gain" | "spend"> = [];

        for (const effect of choice.effects) {
          const result = applyMysteryEffect(effect, {
            runDeck: runStore.runDeck,
            runMaxHealth: runStore.runMaxHealth,
            rng: createDraftRunRandomSource(draft, "events"),
            ownedTrinketIds: runStore.runTrinkets,
            setRunDeck,
            setRunGold,
            setRunPlayerHealth,
            setRunTrinkets,
            setMysteryCardChoices,
            setMysteryGrantedTrinketIds,
            setMysteryGrantedGearInstances,
            awardMysteryXP,
            onAddMaterials: (materials: MaterialInventory) =>
              awardMaterialsDuringRun(draft, applyMaterialFindBonus(materials, draft.runProfile.effects)),
            onAwardGold: (amount) => addRunGold(draft, amount),
            onAddGear: (instance) => {
              const characterId = draft.run.activeRun.characterId;
              mutateGearWithRunHealthSync(draft, {
                characterId,
                mutate: (gear: GearStore) => gear.addInstance(instance, characterId),
              });
            },
            gearAstralChanceBonus: draft.runProfile.effects.gearAstralChanceBonus,
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
  }, []);

  const handleMysteryChooseCard = useCallback((cardId: string) => {
    dispatchRunSessionCommand((draft) => {
      if (draft.session.mysteryChosenCardId !== null) return;
      const card = cardLibrary.find((c) => c.id === cardId);
      if (card) {
        appendCardToRunWithDiscovery(draft, card);
        setMysteryChosenCardId(draft, cardId);
      }
      setMysteryCardChoices(draft, null);
    });
  }, []);

  const handleMysteryRemoveCard = useCallback((index: number) => {
    dispatchRunSessionCommand((draft) => {
      if (!draft.session.mysteryPendingRemoval) return;
      setRunDeck(draft, (deck) => deck.filter((_, cardIndex) => cardIndex !== index));
      setMysteryPendingRemoval(draft, false);
    });
  }, []);

  return useMemo(
    () => ({
      beginMysteryEvent,
      handleMysteryChoice,
      handleMysteryChooseCard,
      handleMysteryRemoveCard,
    }),
    [beginMysteryEvent, handleMysteryChoice, handleMysteryChooseCard, handleMysteryRemoveCard],
  );
}
