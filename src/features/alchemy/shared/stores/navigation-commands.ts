import { createRunSessionCommand, dispatchRunSessionCommand } from "./run-session-command";
import { prepareRunNavigation, setScreen } from "./write/run-navigation";
import {
  abandonLabyrinthCorruptionVisit,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
  setCorruptionResult,
} from "./write/run-session";
import { resetUnlockedTalents, unlockAllTalents, unlockTalent } from "./write/run-meta";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";

export const showRunScreen = createRunSessionCommand(setScreen);
export const prepareRunScreen = createRunSessionCommand(prepareRunNavigation);
export const purchaseTalent = createRunSessionCommand(unlockTalent);
export const resetTalentUnlocks = createRunSessionCommand(resetUnlockedTalents);
export const unlockTalentsForDevelopment = createRunSessionCommand(unlockAllTalents);
export const leaveLabyrinthCorruption = createRunSessionCommand(abandonLabyrinthCorruptionVisit);
export const resetCorruptionVisit = () => dispatchRunSessionCommand((draft) => setCorruptionResult(draft, null));

/** Both sets belong to one room; publish them together, including empty clears. */
export function prepareLabyrinthRoomTraits(combat: EncounterCombatTraitId[], rewards: EncounterRewardTraitId[]): void {
  dispatchRunSessionCommand((draft) => {
    if (combat.length || draft.session.activeLabyrinthModifiers.length) setActiveLabyrinthModifiers(draft, combat);
    if (rewards.length || draft.session.activeLabyrinthRewardModifiers.length)
      setActiveLabyrinthRewardModifiers(draft, rewards);
  });
}
