import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  clearMysteryVisitState,
  createDraftRunRandomSource,
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryEvent,
  setMysteryPendingRemoval,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { playGoldGain, playGoldSpend, playUISound } from "@/lib/audio";
import {
  activeLabyrinthBenefits,
  applyLabyrinthMysteryModifiers,
  isLabyrinthMysteryEligible,
} from "@/lib/content-systems/labyrinth/room-rules";
import { cardById } from "@/lib/game-data";
import { isMysteryLootEligible, pickResolvedMysteryEvent, type MysteryChoice } from "@/lib/mystery";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { isValidDeckIndex } from "@/lib/utils";
export function createMysteryEventNavigation({
  navigateTo,
}: {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
}) {
  const beginMysteryEvent = (prepareNavigation?: () => void) => {
    dispatchRunSessionCommand(
      (draft) => {
        clearMysteryVisitState(draft);
        const rng = createDraftRunRandomSource(draft, "events");
        const modifiers = activeLabyrinthBenefits(
          draft.run.activeRun.contentSystemType,
          draft.session.activeLabyrinthRewardModifiers,
        );
        const ownedBoons = combineTrinketEffectIds(
          draft.run.activeRun.runBoons,
          draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
        );
        const lootProgress = resolveDraftLootProgress(draft);
        setMysteryEvent(
          draft,
          applyLabyrinthMysteryModifiers(
            pickResolvedMysteryEvent(
              rng,
              ownedBoons,
              (event) =>
                isLabyrinthMysteryEligible(event, modifiers) && isMysteryLootEligible(event, lootProgress, ownedBoons),
            ),
            modifiers,
            draft.run.activeRun.runMaxHealth,
          ),
        );
      },
      {
        afterCommit: () => {
          navigateTo(ROUTE_SCREENS.MYSTERY, prepareNavigation);
          playUISound("musicBoxMystery");
        },
      },
    );
  };
  const handleMysteryChoice = (choice: MysteryChoice) => {
    dispatchRunSessionCommand(
      (draft) => {
        if (
          draft.session.activity.kind !== "mystery" ||
          readActivityData(draft.session.activity, "mystery").mysteryChosenChoice !== null
        )
          return [];
        setMysteryChosenChoice(draft, choice);
        const goldSounds: Array<"gain" | "spend"> = [];
        const rng = createDraftRunRandomSource(draft, "events");
        for (const effect of choice.effects) {
          const result = applyMysteryEffect(effect, { draft, rng });
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
  };
  const handleMysteryChooseCard = (cardId: string): boolean => {
    return dispatchRunSessionCommand((draft) => {
      if (readActivityData(draft.session.activity, "mystery").mysteryChosenCardId !== null) return false;
      const choices = readActivityData(draft.session.activity, "mystery").mysteryCardChoices;
      if (!choices || !choices.some((card) => card.id === cardId)) return false;
      const card = cardById[cardId];
      if (!card) return false;
      appendCardToRunWithDiscovery(draft, card);
      setMysteryChosenCardId(draft, cardId);
      setMysteryCardChoices(draft, null);
      return true;
    });
  };
  const handleMysteryRemoveCard = (index: number): boolean => {
    return dispatchRunSessionCommand((draft) => {
      if (!readActivityData(draft.session.activity, "mystery").mysteryPendingRemoval) return false;
      if (!isValidDeckIndex(index, draft.run.activeRun.runDeck.length)) return false;
      setRunDeck(draft, (deck) => deck.filter((_, cardIndex) => cardIndex !== index));
      setMysteryPendingRemoval(draft, false);
      return true;
    });
  };
  return {
    beginMysteryEvent,
    handleMysteryChoice,
    handleMysteryChooseCard,
    handleMysteryRemoveCard,
  };
}
