// Test helpers — build run/talent controller shapes from the live run store.
import { useRunStore } from "@/features/alchemy/stores/run-store";
import {
  selectRunController,
  selectTalentController,
  type TalentStateController,
} from "@/features/alchemy/stores/run-store-selectors";
import { computeTalentEffects } from "@/lib/game-data";

export function makeRunController() {
  return selectRunController(useRunStore.getState());
}

export function makeTalentController(): TalentStateController {
  const base = selectTalentController(useRunStore.getState());
  return { ...base, talentEffects: computeTalentEffects(base.unlockedTalents) };
}
