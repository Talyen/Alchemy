import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
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
export function beginMysteryVisit(gameSession: GameSession): void {
  dispatchRunSessionCommand((draft) => acceptCommand(beginMysteryVisitInTransaction(draft)), undefined, gameSession);
}

export function beginMysteryVisitInTransaction(draft: RunTransaction): void {
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
}
export function chooseMysteryOption(choice: MysteryChoice, gameSession: GameSession) {
  const activity = readRunSession(gameSession).activity;
  // The choice object belongs to one resolved visit. A retained screen from an
  // earlier visit must not apply its effects to the current one.
  const choiceIndex = activity.kind === "mystery" ? (activity.data.mysteryEvent?.choices.indexOf(choice) ?? -1) : -1;
  if (choiceIndex < 0) return [];

  return dispatchRunSessionCommand(
    (draft) => {
      const visit = draft.session.activity;
      if (visit.kind !== "mystery" || visit.data.mysteryChosenChoice !== null)
        return rejectCommand("Mystery choice is unavailable", []);
      const offeredChoice = visit.data.mysteryEvent?.choices[choiceIndex];
      if (!offeredChoice) return rejectCommand("Mystery choice is unavailable", []);
      const resolvedEffects = [...offeredChoice.effects];
      const goldSounds: Array<"gain" | "spend"> = [];
      const rng = createDraftRunRandomSource(draft, "events");
      for (const [index, effect] of offeredChoice.effects.entries()) {
        const healthBefore = draft.run.activeRun.runPlayerHealth;
        const result = applyMysteryEffect(snapshotTransactionValue(effect), { draft, rng });
        if (effect.kind === "gainMaterial" && result.materialAward) {
          resolvedEffects[index] = {
            ...effect,
            amount: result.materialAward.amount,
          };
        } else if (effect.kind === "healHealth") {
          resolvedEffects[index] = {
            kind: "healHealth",
            amount: Math.max(0, draft.run.activeRun.runPlayerHealth - healthBefore),
          };
        }
        if (result.goldSound) goldSounds.push(result.goldSound);
      }
      setMysteryChosenChoice(draft, { ...offeredChoice, effects: resolvedEffects });
      return acceptCommand(goldSounds);
    },
    undefined,
    gameSession,
  );
}
export function chooseMysteryCard(cardId: string, gameSession: GameSession): boolean {
  return dispatchRunSessionCommand(
    (draft) => {
      if (readActivityData(snapshotTransactionValue(draft.session.activity), "mystery").mysteryChosenCardId !== null)
        return rejectCommand("Mystery choice is unavailable", false);
      const choices = readActivityData(snapshotTransactionValue(draft.session.activity), "mystery").mysteryCardChoices;
      if (!choices || !choices.some((card) => card.id === cardId))
        return rejectCommand("Mystery choice is unavailable", false);
      const card = cardById[cardId];
      if (!card) return rejectCommand("Mystery choice is unavailable", false);
      appendCardToRunWithDiscovery(draft, card);
      setMysteryChosenCardId(draft, cardId);
      setMysteryCardChoices(draft, null);
      return acceptCommand(true);
    },
    undefined,
    gameSession,
  );
}
