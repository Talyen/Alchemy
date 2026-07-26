// Restore wildwood reward choices from persisted ids (pure; used by run-transitions).
import type { GearInstance } from "@/lib/gear";
import { resolveCardChoices, resolveGearChoices, resolveTrinketChoices } from "./pending-reward-persistence";
import {
  createEmptyRewardState,
  type CardRewardState,
  type GearRewardState,
  type TrinketRewardState,
} from "./reward-types";

export function restoreWildwoodRewardState(
  rewardType: "card" | "trinket" | "gear",
  choiceIds: string[],
  selectedId: string | null,
  gearChoices: GearInstance[] = [],
): CardRewardState | TrinketRewardState | GearRewardState {
  if (rewardType === "gear") {
    const choices = resolveGearChoices(gearChoices) ?? [];
    return { ...createEmptyRewardState(), rewardType: "gear", choices, selectedId };
  }
  if (rewardType === "card") {
    const choices = resolveCardChoices(choiceIds) ?? [];
    return { ...createEmptyRewardState(), rewardType: "card", choices, selectedId };
  }
  const choices = resolveTrinketChoices(choiceIds) ?? [];
  return { ...createEmptyRewardState(), rewardType: "trinket", choices, selectedId };
}
