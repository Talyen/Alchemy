import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import type { MysteryChoice } from "@/lib/mystery";
export function chooseMysteryOption(choice: MysteryChoice, gameSession: GameSession): Array<"gain"> | null {
  const activity = readRunSession(gameSession).activity;
  // The choice object belongs to one resolved visit. A retained screen from an
  // earlier visit must not apply its effects to the current one.
  const choiceIndex = activity.kind === "mystery" ? (activity.data.mysteryEvent?.choices.indexOf(choice) ?? -1) : -1;
  if (choiceIndex < 0) return null;

  return dispatchRunSessionCommand(
    (draft) => {
      const visit = draft.session.activity;
      if (visit.kind !== "mystery" || visit.data.mysteryChosenChoice !== null)
        return rejectCommand("Mystery choice is unavailable", null);
      const offeredChoice = visit.data.mysteryEvent?.choices[choiceIndex];
      if (!offeredChoice) return rejectCommand("Mystery choice is unavailable", null);
      const resolvedEffects = [...offeredChoice.effects];
      const goldSounds: Array<"gain"> = [];
      const rng = createDraftRunRandomSource(draft, "events");
      for (const [index, effect] of offeredChoice.effects.entries()) {
        const healthBefore = draft.run.activeRun.runPlayerHealth;
        const result = applyMysteryEffect(snapshotTransactionValue(effect), { draft, rng });
        if (effect.kind === "gainMaterial" && result.materialAward) {
          resolvedEffects[index] = {
            ...effect,
            amount: result.materialAward.amount,
          };
        } else if (effect.kind === "gainGold" && result.goldAward !== undefined) {
          resolvedEffects[index] = { ...effect, amount: result.goldAward };
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
      const card = choices?.find((offered) => offered.id === cardId);
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
