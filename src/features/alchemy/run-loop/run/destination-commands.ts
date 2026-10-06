import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  addGold,
  createDraftRunRandomSource,
  setAlchemyVisit,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getCampfireHealFraction, getCampfireRestHealth } from "@/lib/campfire-heal";
import { activeLabyrinthBenefits, labyrinthCampfireHealing } from "@/lib/content-systems/labyrinth/room-rules";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";
import { computeTalentEffects } from "@/lib/game-data";
import { applyAlchemistPotion } from "./reward-commands";

export function restAtCampfire(gameSession: GameSession = defaultGameSession) {
  return dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind !== "campfire" || draft.session.activity.data.completed)
        return rejectCommand("Destination action is unavailable", false);
      const talentEffects = computeTalentEffects(snapshotTransactionValue(draft.runProfile.unlockedTalents));
      const modifiers = activeLabyrinthBenefits(
        draft.run.activeRun.contentSystemType,
        draft.session.activeLabyrinthRewardModifiers,
      );
      const healFraction = labyrinthCampfireHealing(
        getCampfireHealFraction(talentEffects.campfireHealBonus),
        modifiers,
      );
      if (modifiers.includes("hidden-purse")) addGold(draft, LABYRINTH_MODIFIER_CONFIG.hiddenPurseGold);
      if (modifiers.includes("herbal-hearth"))
        applyAlchemistPotion({ draft, rng: createDraftRunRandomSource(draft, "rewards") });
      setRunPlayerHealth(draft, (prev) =>
        getCampfireRestHealth(
          prev,
          draft.run.activeRun.runMaxHealth,
          healFraction,
          draft.runProfile.effects.homesteadHealing,
        ),
      );
      setAlchemyVisit(draft, "campfire", { ...draft.session.activity.data, completed: true });
      return acceptCommand(true);
    },
    undefined,
    gameSession,
  );
}
