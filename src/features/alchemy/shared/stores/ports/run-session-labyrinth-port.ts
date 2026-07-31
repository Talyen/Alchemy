// Labyrinth session write port — transient run-session fields only.
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import { getRunTransientStore } from "../run-transient-store";
import { dispatchRunSessionCommand } from "../run-session-command";

export function setActiveLabyrinthModifiers(modifiers: EncounterCombatTraitId[]) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setActiveLabyrinthModifiers(modifiers));
}

export function setActiveLabyrinthRewardModifiers(modifiers: EncounterRewardTraitId[]) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setActiveLabyrinthRewardModifiers(modifiers));
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setActiveLabyrinthPendingNode(node));
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setLabyrinthMap(map));
}
