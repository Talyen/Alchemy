import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  addGold,
  createDraftRunRandomSource,
  setAlchemyVisit,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getCampfireRestHealth } from "@/lib/campfire-heal";
import { activeLabyrinthBenefits, labyrinthCampfireHealing } from "@/lib/content-systems/labyrinth/room-rules";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";
import { applyAlchemistPotion } from "./alchemist-reward";

export function restAtCampfire(gameSession: GameSession) {
  return dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind !== "campfire" || draft.session.activity.data.completed)
        return rejectCommand("Destination action is unavailable", false);
      restAtCampfireInDraft(draft);
      return acceptCommand(true);
    },
    undefined,
    gameSession,
  );
}

/** Rest and automatic Continue share the same transaction-level recipe. */
export function restAtCampfireInDraft(draft: RunTransaction): void {
  if (draft.session.activity.kind !== "campfire" || draft.session.activity.data.completed) return;
  const modifiers = activeLabyrinthBenefits(
    draft.run.activeRun.contentSystemType,
    draft.session.activeLabyrinthRewardModifiers,
  );
  const healFraction = labyrinthCampfireHealing(CAMPFIRE_HEAL_FRACTION, modifiers);
  if (modifiers.includes("hidden-purse")) addGold(draft, LABYRINTH_MODIFIER_CONFIG.hiddenPurseGold);
  // Campfire visits draw from the events stream like campfire offers and
  // mystery setup; the rewards stream owns victory and reward choices, so
  // resting must not perturb it.
  if (modifiers.includes("herbal-hearth"))
    applyAlchemistPotion({ draft, rng: createDraftRunRandomSource(draft, "events") });
  setRunPlayerHealth(draft, (prev) =>
    getCampfireRestHealth(
      prev,
      draft.run.activeRun.runMaxHealth,
      healFraction,
      draft.runProfile.effects.homesteadHealing,
    ),
  );
  setAlchemyVisit(draft, "campfire", { ...draft.session.activity.data, completed: true });
}
