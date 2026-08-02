// Labyrinth session write port — transient run-session fields only.
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import { dispatchRunSessionCommand } from "../run-session-command";
import { readGameplayState } from "../gameplay-state-store";

export function setActiveLabyrinthModifiers(modifiers: EncounterCombatTraitId[]) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setActiveLabyrinthModifiers(modifiers));
}

export function setActiveLabyrinthRewardModifiers(modifiers: EncounterRewardTraitId[]) {
  return dispatchRunSessionCommand(() =>
    readGameplayState().sessionActions.setActiveLabyrinthRewardModifiers(modifiers),
  );
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setActiveLabyrinthPendingNode(node));
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setLabyrinthMap(map));
}
