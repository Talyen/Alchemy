import { isRecord, migrateParkedRuns } from "./types";
import type { RawSaveData } from "./types";
import { emptyInventory } from "@/lib/homestead/inventory";

const EMPTY_MATERIALS = emptyInventory();

function isNoneInterruptedFlow(value: unknown): boolean {
  return !isRecord(value) || value.kind === "none" || value.kind == null;
}

function isWildwoodRewardPhase(phase: unknown): boolean {
  return phase === "reward" || phase === "recovery";
}

function hasLiveNestedWildwoodReward(draft: Record<string, unknown>): boolean {
  if (!isWildwoodRewardPhase(draft.phase)) return false;
  const rewardType = draft.rewardType;
  if (rewardType === "gear") {
    return Array.isArray(draft.rewardGearChoices) && draft.rewardGearChoices.length > 0;
  }
  if (rewardType === "card" || rewardType === "boon" || rewardType === "trinket") {
    return Array.isArray(draft.rewardChoiceIds) && draft.rewardChoiceIds.length > 0;
  }
  return false;
}

function liftNestedWildwoodReward(draft: Record<string, unknown>): Record<string, unknown> {
  const selectedId = typeof draft.selectedRewardId === "string" ? draft.selectedRewardId : null;
  const shared = {
    companionChoiceIds: [],
    selectedId,
    gold: 0,
    materials: EMPTY_MATERIALS,
    destinations: [],
    selectedBossId: null,
    lastVictoryEnemyType: null,
    lastVictoryContentSystem: "wildwood",
  };
  if (draft.rewardType === "gear") {
    return {
      kind: "primary-reward",
      pending: { ...shared, rewardType: "gear", gearChoices: draft.rewardGearChoices },
    };
  }
  return {
    kind: "primary-reward",
    pending: { ...shared, rewardType: draft.rewardType, choiceIds: draft.rewardChoiceIds },
  };
}

function stripNestedWildwoodRewardFields(draft: unknown): unknown {
  if (!isRecord(draft)) return draft;
  const {
    version: _version,
    rewardType: _rewardType,
    rewardChoiceIds: _rewardChoiceIds,
    rewardGearChoices: _rewardGearChoices,
    selectedRewardId: _selectedRewardId,
    ...rest
  } = draft;
  void _version;
  void _rewardType;
  void _rewardChoiceIds;
  void _rewardGearChoices;
  void _selectedRewardId;
  return rest;
}

function migrateRun(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.wildwoodDraft)) {
    return value;
  }
  const nested = value.wildwoodDraft;
  const interruptedFlow =
    isNoneInterruptedFlow(value.interruptedFlow) && hasLiveNestedWildwoodReward(nested)
      ? liftNestedWildwoodReward(nested)
      : value.interruptedFlow;
  return {
    ...value,
    ...(Object.hasOwn(value, "interruptedFlow") || interruptedFlow !== value.interruptedFlow
      ? { interruptedFlow }
      : {}),
    wildwoodDraft: stripNestedWildwoodRewardFields(nested),
  };
}

export function migrateV12ToV13(save: RawSaveData): RawSaveData {
  const nextParkedRuns = migrateParkedRuns(save.parkedRuns, migrateRun);
  return {
    ...save,
    activeRun: migrateRun(save.activeRun),
    parkedRuns: nextParkedRuns,
  };
}
