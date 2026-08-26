import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { cardById, trinketLibrary, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { filterValidDestinations, type Destination } from "@/lib/routing";
import type { PersistedPendingReward } from "./types";
import {
  createEmptyRewardState,
  type BoonRewardState,
  type CardRewardState,
  type GearRewardState,
  type RewardState,
  type TrinketRewardState,
} from "./reward-types";

export function lookupTrinketEntries(ids: string[]): TrinketEntry[] {
  return ids.flatMap((id) => {
    const trinket = trinketLibrary.find((entry) => entry.id === id);
    return trinket ? [trinket] : [];
  });
}

export function resolveGearChoices(gearChoices: GearInstance[]): GearInstance[] | null {
  return gearChoices.length === 0 ? null : gearChoices;
}

export function resolveCardChoices(choiceIds: string[]): BattleCard[] | null {
  const choices = choiceIds
    .map((id) => getOfferableCardPool().find((entry) => entry.id === id))
    .filter((entry): entry is BattleCard => Boolean(entry));
  return choices.length === 0 ? null : choices;
}

function resolveCompanionChoices(choiceIds: string[]): BattleCard[] | null {
  const choices = choiceIds
    .map((id) => cardById[id])
    .filter((entry): entry is BattleCard =>
      Boolean(entry && entry.effects.some((effect) => effect.kind === "summon-companion")),
    );
  return choices.length === 0 ? null : choices;
}

export function resolveTrinketChoices(choiceIds: string[]): TrinketEntry[] | null {
  const choices = lookupTrinketEntries(choiceIds);
  return choices.length === 0 ? null : choices;
}

interface PersistedRewardSharedFields {
  companionChoiceIds: string[];
  selectedId: string | null;
  gold: number;
  materials: RewardState["materials"];
  destinations: Destination[];
  selectedBossId: string | null;
  lastVictoryEnemyType: RewardState["lastVictoryEnemyType"];
  lastVictoryContentSystem: RewardState["lastVictoryContentSystem"];
}

function sharedRewardFields(
  rewardState: RewardState,
  companionRewardCards: BattleCard[] | null = null,
): PersistedRewardSharedFields {
  return {
    companionChoiceIds: companionRewardCards?.map((choice) => choice.id) ?? [],
    selectedId: rewardState.selectedId,
    gold: rewardState.gold,
    materials: rewardState.materials,
    destinations: [...rewardState.destinations],
    selectedBossId: rewardState.selectedBossId,
    lastVictoryEnemyType: rewardState.lastVictoryEnemyType,
    lastVictoryContentSystem: rewardState.lastVictoryContentSystem,
  };
}

export function serializePendingReward(
  rewardState: RewardState,
  companionRewardCards: BattleCard[] | null = null,
): PersistedPendingReward | null {
  if (rewardState.choices.length === 0 && !companionRewardCards?.length) return null;

  const shared = sharedRewardFields(rewardState, companionRewardCards);
  if (rewardState.rewardType === "gear") {
    return { ...shared, rewardType: "gear", gearChoices: rewardState.choices };
  }
  if (rewardState.rewardType === "trinket") {
    return { ...shared, rewardType: "trinket", choiceIds: rewardState.choices.map((choice) => choice.id) };
  }
  if (rewardState.rewardType === "boon") {
    return { ...shared, rewardType: "boon", choiceIds: rewardState.choices.map((choice) => choice.id) };
  }
  return { ...shared, rewardType: "card", choiceIds: rewardState.choices.map((choice) => choice.id) };
}

/** Empty reward state carrying the persisted shared fields (selection, gold, materials, victory context). */
function restoreSharedRewardFields(persisted: PersistedPendingReward): RewardState {
  return {
    ...createEmptyRewardState(filterValidDestinations(persisted.destinations)),
    selectedId: persisted.selectedId,
    gold: persisted.gold,
    materials: persisted.materials,
    selectedBossId: persisted.selectedBossId,
    lastVictoryEnemyType: persisted.lastVictoryEnemyType,
    lastVictoryContentSystem: persisted.lastVictoryContentSystem,
  };
}

export function restorePendingReward(persisted: PersistedPendingReward): RewardState | null {
  const shared = restoreSharedRewardFields(persisted);

  if (persisted.rewardType === "gear") {
    const choices = resolveGearChoices(persisted.gearChoices);
    if (!choices) return null;
    return { ...shared, rewardType: "gear", choices } satisfies GearRewardState;
  }

  if (persisted.rewardType === "card") {
    const choices = resolveCardChoices(persisted.choiceIds);
    if (!choices) return null;
    return { ...shared, rewardType: "card", choices } satisfies CardRewardState;
  }

  const choices = resolveTrinketChoices(persisted.choiceIds);
  if (!choices) return null;
  return persisted.rewardType === "boon"
    ? ({ ...shared, rewardType: "boon", choices } satisfies BoonRewardState)
    : ({ ...shared, rewardType: "trinket", choices } satisfies TrinketRewardState);
}

export interface RestoredPendingReward {
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
}

/** Restore both sides of the victory reward handoff as one persistence unit. */
export function restorePendingRewardBundle(persisted: PersistedPendingReward): RestoredPendingReward {
  const companionRewardCards = resolveCompanionChoices(persisted.companionChoiceIds);
  const rewardState = restorePendingReward(persisted);

  if (rewardState || !companionRewardCards) {
    return { rewardState, companionRewardCards };
  }

  // A save can be taken after the normal reward is claimed but before the
  // companion choices are promoted to rewardState. Preserve the shared reward
  // metadata so the companion claim remains valid after resume.
  return {
    rewardState: restoreSharedRewardFields(persisted),
    companionRewardCards,
  };
}
