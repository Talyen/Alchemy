import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  clearMysteryVisitState,
  createDraftRunRandomSource,
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryEvent,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import {
  activeLabyrinthBenefits,
  applyLabyrinthMysteryModifiers,
  isLabyrinthMysteryEligible,
} from "@/lib/content-systems/labyrinth/room-rules";
import { cardById } from "@/lib/game-data";
import { isMysteryLootEligible, pickResolvedMysteryEvent, type MysteryChoice } from "@/lib/mystery";
import { combineTrinketEffectIds } from "@/lib/trinkets";
export function beginMysteryVisit(): void {
  dispatchRunSessionCommand((draft) => {
    clearMysteryVisitState(draft);
    // Shared "events" stream with corruption and run-restore mystery repair:
    // sequential draws stay deterministic for saves, so keep sharing rather
    // than splitting streams.
    const rng = createDraftRunRandomSource(draft, "events");
    const modifiers = activeLabyrinthBenefits(
      draft.run.activeRun.contentSystemType,
      draft.session.activeLabyrinthRewardModifiers,
    );
    const ownedTrinkets = combineTrinketEffectIds(
      draft.run.activeRun.runBoons,
      draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
    );
    const lootProgress = resolveDraftLootProgress(draft);
    setMysteryEvent(
      draft,
      applyLabyrinthMysteryModifiers(
        pickResolvedMysteryEvent(
          rng,
          ownedTrinkets,
          (event) =>
            isLabyrinthMysteryEligible(event, modifiers) && isMysteryLootEligible(event, lootProgress, ownedTrinkets),
        ),
        modifiers,
        draft.run.activeRun.runMaxHealth,
      ),
    );
  });
}
export function chooseMysteryOption(choice: MysteryChoice) {
  const activity = readRunSession().activity;
  // The choice object belongs to one resolved visit. A retained screen from an
  // earlier visit must not apply its effects to the current one.
  const choiceIndex = activity.kind === "mystery" ? (activity.data.mysteryEvent?.choices.indexOf(choice) ?? -1) : -1;
  if (choiceIndex < 0) return [];

  return dispatchRunSessionCommand((draft) => {
    const visit = draft.session.activity;
    if (visit.kind !== "mystery" || visit.data.mysteryChosenChoice !== null) return [];
    const offeredChoice = visit.data.mysteryEvent?.choices[choiceIndex];
    if (!offeredChoice) return [];
    const resolvedEffects = [...offeredChoice.effects];
    const goldSounds: Array<"gain" | "spend"> = [];
    const rng = createDraftRunRandomSource(draft, "events");
    for (const [index, effect] of offeredChoice.effects.entries()) {
      const result = applyMysteryEffect(effect, { draft, rng });
      if (effect.kind === "gainMaterial" && result.materialAward) {
        resolvedEffects[index] = {
          ...effect,
          amount: result.materialAward.amount,
        };
      }
      if (result.goldSound) goldSounds.push(result.goldSound);
      if (result.followUp) break;
    }
    setMysteryChosenChoice(draft, { ...offeredChoice, effects: resolvedEffects });
    return goldSounds;
  });
}
export function chooseMysteryCard(cardId: string): boolean {
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
}
