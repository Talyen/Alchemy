// Applies a validated active-run snapshot to runtime stores on bootstrap/resume.
import type { BattleState } from "@/lib/battle";
import type { LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { UnlockedTalents, TalentXP } from "@/lib/game-data";

import type { ActiveRunData, LabyrinthNodePosition } from "./types";

export type ActiveRunHydrationTargets = {
  runStore: {
    initialize: (activeRun: ActiveRunData | null, talentXP: TalentXP, unlockedTalents: UnlockedTalents) => void;
  };
  battleStore: {
    initializeActiveBattle: (battleState: BattleState | null) => void;
  };
  screenStore: {
    setHasActiveRun: (hasActiveRun: boolean) => void;
    setLabyrinthMap: (map: LabyrinthMap) => void;
    setActiveLabyrinthModifiers: (modifiers: LabyrinthModifierKind[]) => void;
    setActiveLabyrinthRewardModifiers: (modifiers: LabyrinthModifierKind[]) => void;
    setActiveLabyrinthPendingNode: (node: LabyrinthNodePosition) => void;
    applyDestinationChoices: (choices: string[]) => void;
  };
};

export function hydrateActiveRunSession(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  targets: ActiveRunHydrationTargets,
): void {
  targets.runStore.initialize(activeRun, talentXP, unlockedTalents);
  targets.battleStore.initializeActiveBattle(activeRun?.activeCombat?.battleState ?? null);

  if (!activeRun) {
    return;
  }

  targets.screenStore.setHasActiveRun(true);

  if (activeRun.labyrinthMap) {
    targets.screenStore.setLabyrinthMap(activeRun.labyrinthMap);
  }

  if (activeRun.activeCombat) {
    targets.screenStore.setActiveLabyrinthModifiers(activeRun.activeCombat.activeLabyrinthModifiers);
    targets.screenStore.setActiveLabyrinthRewardModifiers(activeRun.activeCombat.activeLabyrinthRewardModifiers);
  }

  if (activeRun.labyrinthPendingNode) {
    targets.screenStore.setActiveLabyrinthPendingNode(activeRun.labyrinthPendingNode);
  }

  if (activeRun.currentScreen === "destination" && activeRun.destinationChoices.length > 0) {
    targets.screenStore.applyDestinationChoices(activeRun.destinationChoices);
  }
}
