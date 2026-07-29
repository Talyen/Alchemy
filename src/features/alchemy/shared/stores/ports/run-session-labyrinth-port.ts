// Labyrinth session write port — transient run-session fields only.
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import { getRunTransientStore } from "../run-transient-store";

export function setActiveLabyrinthModifiers(modifiers: EncounterCombatTraitId[]) {
  getRunTransientStore().setActiveLabyrinthModifiers(modifiers);
}

export function setActiveLabyrinthRewardModifiers(modifiers: EncounterRewardTraitId[]) {
  getRunTransientStore().setActiveLabyrinthRewardModifiers(modifiers);
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  getRunTransientStore().setActiveLabyrinthPendingNode(node);
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  getRunTransientStore().setLabyrinthMap(map);
}
