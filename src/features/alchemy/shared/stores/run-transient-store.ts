import { createInitialSessionFields, type RunSessionFields } from "./run-domain-types";
import type { SessionActions } from "./slices/session-slice";
import { createSliceStore } from "./slice-store-adapter";

export type RunTransientStore = RunSessionFields & SessionActions;

const SESSION_KEYS = [
  "hasActiveRun",
  "rewardClaimInFlight",
  "pendingDestinationClaim",
  "activeLabyrinthModifiers",
  "activeLabyrinthRewardModifiers",
  "activeLabyrinthPendingNode",
  "rewardState",
  "companionRewardCards",
  "runEndMaterials",
  "runEndTalentXP",
  "corruptionResult",
  "pendingCharacterId",
  "pendingContentSystemType",
  "labyrinthMap",
  "wildwoodDraft",
  "shopState",
  "alchemistState",
  "trinketShopState",
  "equipmentShopState",
  "mysteryEvent",
  "mysteryCardChoices",
  "setHasActiveRun",
  "beginRewardClaim",
  "releaseRewardClaim",
  "beginDestinationClaim",
  "cancelDestinationClaim",
  "setActiveLabyrinthModifiers",
  "setActiveLabyrinthRewardModifiers",
  "setActiveLabyrinthPendingNode",
  "setRewardState",
  "setCompanionRewardCards",
  "setRunEndMaterials",
  "setRunEndTalentXP",
  "setCorruptionResult",
  "setPendingCharacterId",
  "setPendingContentSystemType",
  "setLabyrinthMap",
  "setWildwoodDraft",
  "setShopState",
  "setAlchemistState",
  "setTrinketShopState",
  "setEquipmentShopState",
  "setMysteryEvent",
  "setMysteryCardChoices",
  "clearTransientSession",
  "applyDestinationChoices",
] as const satisfies ReadonlyArray<keyof RunTransientStore>;

export const useRunTransientStore = createSliceStore<RunTransientStore>((state) => state, SESSION_KEYS);

export function getRunTransientStore(): RunTransientStore {
  return useRunTransientStore.getState();
}

export function resetRunTransientStore(): void {
  useRunTransientStore.setState(createInitialSessionFields(), false);
}

export function readRunSessionFields(session: RunSessionFields): RunSessionFields {
  return {
    hasActiveRun: session.hasActiveRun,
    rewardClaimInFlight: session.rewardClaimInFlight,
    pendingDestinationClaim: session.pendingDestinationClaim,
    activeLabyrinthModifiers: session.activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers: session.activeLabyrinthRewardModifiers,
    activeLabyrinthPendingNode: session.activeLabyrinthPendingNode,
    rewardState: session.rewardState,
    companionRewardCards: session.companionRewardCards,
    runEndMaterials: session.runEndMaterials,
    runEndTalentXP: session.runEndTalentXP,
    corruptionResult: session.corruptionResult,
    pendingCharacterId: session.pendingCharacterId,
    pendingContentSystemType: session.pendingContentSystemType,
    labyrinthMap: session.labyrinthMap,
    wildwoodDraft: session.wildwoodDraft,
    shopState: session.shopState,
    alchemistState: session.alchemistState,
    trinketShopState: session.trinketShopState,
    equipmentShopState: session.equipmentShopState,
    mysteryEvent: session.mysteryEvent,
    mysteryCardChoices: session.mysteryCardChoices,
  };
}
