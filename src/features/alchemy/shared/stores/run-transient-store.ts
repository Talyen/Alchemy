import { createInitialSessionFields, type RunSessionFields } from "./run-domain-types";
import type { SessionActions } from "./slices/session-slice";
import { createSliceStore } from "./slice-store-adapter";
import type { GameplayState } from "./gameplay-state-store";

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

const sessionActionKeys = new Set<string>([
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
]);

function pickRunTransientStore(state: GameplayState): RunTransientStore {
  return { ...state.session, ...state.sessionActions };
}

function writeRunTransientKey(state: GameplayState, key: keyof RunTransientStore, value: unknown): void {
  if (sessionActionKeys.has(String(key))) {
    (state.sessionActions as unknown as Record<string, unknown>)[String(key)] = value;
    return;
  }
  (state.session as unknown as Record<string, unknown>)[String(key)] = value;
}

export const useRunTransientStore = createSliceStore<RunTransientStore>(
  pickRunTransientStore,
  SESSION_KEYS,
  {},
  writeRunTransientKey,
);

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
