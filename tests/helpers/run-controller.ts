// Test helpers — build run/talent controller shapes from the live run store.
import {
  selectRunController,
  selectTalentController,
  type TalentStateController,
} from "@/features/alchemy/shared/stores/run-domain-store";
import { computeTalentEffects } from "@/lib/game-data";
import { getRunProgressStoreView } from "./run-domain-store-test";

export function makeRunController() {
  return selectRunController(getRunProgressStoreView());
}

export function makeTalentController(): TalentStateController {
  const base = selectTalentController(getRunProgressStoreView());
  return { ...base, talentEffects: computeTalentEffects(base.unlockedTalents) };
}
