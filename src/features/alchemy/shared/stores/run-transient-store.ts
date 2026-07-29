// Transient run-session store — shops, rewards, labyrinth, mystery, and pending selections.
// Lifetime: cleared on teardown; never persisted as permanent progression.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createInitialSessionFields, type RunSessionFields } from "./run-domain-types";
import { defineSessionActions, type SessionActions } from "./slices/session-slice";

export type RunTransientStore = RunSessionFields & SessionActions;

export const useRunTransientStore = create<RunTransientStore>()(
  immer((set) => ({
    ...createInitialSessionFields(),
    ...defineSessionActions(set),
  })),
);

/** Imperative access to the transient session store API. */
export function getRunTransientStore(): RunTransientStore {
  return useRunTransientStore.getState();
}

/** Reset every transient session field (teardown and tests). */
export function resetRunTransientStore(): void {
  useRunTransientStore.getState().clearTransientSession();
}

/** Field-only projection of the transient session (snapshots and read models). */
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
