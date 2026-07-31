// Labyrinth session write port — transient run-session fields only.
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import { dispatchRunSessionCommand } from "../run-session-command";
import { createRunSessionStoreSnapshot } from "../run-session-queries";

export function setActiveLabyrinthModifiers(modifiers: EncounterCombatTraitId[]) {
  return dispatchRunSessionCommand(() =>
    createRunSessionStoreSnapshot().transient.setActiveLabyrinthModifiers(modifiers),
  );
}

export function setActiveLabyrinthRewardModifiers(modifiers: EncounterRewardTraitId[]) {
  return dispatchRunSessionCommand(() =>
    createRunSessionStoreSnapshot().transient.setActiveLabyrinthRewardModifiers(modifiers),
  );
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setActiveLabyrinthPendingNode(node));
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setLabyrinthMap(map));
}
