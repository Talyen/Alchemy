import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type {
  AlchemistState,
  EquipmentShopState,
  RewardState,
  ShopState,
  TrinketShopState,
} from "@/lib/active-run-session";
import { filterValidDestinations, type Destination } from "@/lib/routing";
import { createEmptyRewardState } from "@/lib/active-run-session/reward-types";
import { defineFieldSetter, type ImmerSet } from "./_field-setter";
import { createInitialSessionFields, type RunSessionFields } from "../run-domain-types";

export interface SessionActions {
  setHasActiveRun: (active: boolean) => void;
  beginRewardClaim: () => boolean;
  releaseRewardClaim: () => void;
  beginDestinationClaim: (destination: Destination) => boolean;
  cancelDestinationClaim: () => void;
  setActiveLabyrinthModifiers: (modifiers: EncounterCombatTraitId[]) => void;
  setActiveLabyrinthRewardModifiers: (modifiers: EncounterRewardTraitId[]) => void;
  setActiveLabyrinthPendingNode: (node: LabyrinthNodePosition | null) => void;
  setRewardState: (action: RewardState | ((prev: RewardState) => RewardState)) => void;
  setCompanionRewardCards: (cards: RunSessionFields["companionRewardCards"]) => void;
  setRunEndMaterials: (materials: RunSessionFields["runEndMaterials"]) => void;
  setRunEndTalentXP: (xp: RunSessionFields["runEndTalentXP"]) => void;
  setCorruptionResult: (result: RunSessionFields["corruptionResult"]) => void;
  setPendingCharacterId: (id: RunSessionFields["pendingCharacterId"]) => void;
  setPendingContentSystemType: (type: RunSessionFields["pendingContentSystemType"]) => void;
  setLabyrinthMap: (action: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) => void;
  setWildwoodDraft: (
    action: WildwoodDraftState | null | ((prev: WildwoodDraftState | null) => WildwoodDraftState | null),
  ) => void;
  setShopState: (action: ShopState | ((prev: ShopState) => ShopState)) => void;
  setAlchemistState: (action: AlchemistState | ((prev: AlchemistState) => AlchemistState)) => void;
  setTrinketShopState: (action: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) => void;
  setEquipmentShopState: (action: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) => void;
  setMysteryEvent: (event: RunSessionFields["mysteryEvent"]) => void;
  setMysteryChosenChoice: (choice: RunSessionFields["mysteryChosenChoice"]) => void;
  setMysteryPendingRemoval: (pending: RunSessionFields["mysteryPendingRemoval"]) => void;
  setMysteryCardChoices: (
    choices:
      | RunSessionFields["mysteryCardChoices"]
      | ((prev: RunSessionFields["mysteryCardChoices"]) => RunSessionFields["mysteryCardChoices"]),
  ) => void;
  setMysteryGrantedTrinketIds: (
    ids:
      | RunSessionFields["mysteryGrantedTrinketIds"]
      | ((prev: RunSessionFields["mysteryGrantedTrinketIds"]) => RunSessionFields["mysteryGrantedTrinketIds"]),
  ) => void;
  setMysteryChosenCardId: (id: RunSessionFields["mysteryChosenCardId"]) => void;
  clearTransientSession: () => void;

  /**
   * Restore reward state with pre-sampled destinations on campaign resume.
   * Filters raw string choices to valid Destination values.
   */
  applyDestinationChoices: (choices: string[]) => void;
}

/** Transient run-session actions over root-level {@link RunSessionFields}. */
export function defineSessionActions(set: ImmerSet<RunSessionFields>): SessionActions {
  const setField = defineFieldSetter(set);

  return {
    setHasActiveRun: setField("hasActiveRun"),
    beginRewardClaim: () => {
      let claimed = false;
      set((state) => {
        if (state.rewardClaimInFlight) return;
        if (state.rewardState.choices.length === 0 && !state.companionRewardCards?.length) {
          return;
        }
        state.rewardClaimInFlight = true;
        claimed = true;
      });
      return claimed;
    },
    releaseRewardClaim: () =>
      set((state) => {
        state.rewardClaimInFlight = false;
      }),
    beginDestinationClaim: (destination) => {
      let claimed = false;
      set((state) => {
        if (state.pendingDestinationClaim !== null) return;
        if (!state.rewardState.destinations.includes(destination)) return;
        state.pendingDestinationClaim = destination;
        claimed = true;
      });
      return claimed;
    },
    cancelDestinationClaim: () =>
      set((state) => {
        state.pendingDestinationClaim = null;
      }),
    setActiveLabyrinthModifiers: setField("activeLabyrinthModifiers"),
    setActiveLabyrinthRewardModifiers: setField("activeLabyrinthRewardModifiers"),
    setActiveLabyrinthPendingNode: setField("activeLabyrinthPendingNode"),
    setRewardState: setField("rewardState"),
    setCompanionRewardCards: setField("companionRewardCards"),
    setRunEndMaterials: setField("runEndMaterials"),
    setRunEndTalentXP: setField("runEndTalentXP"),
    setCorruptionResult: setField("corruptionResult"),
    setPendingCharacterId: setField("pendingCharacterId"),
    setPendingContentSystemType: setField("pendingContentSystemType"),
    setLabyrinthMap: setField("labyrinthMap"),
    setWildwoodDraft: setField("wildwoodDraft"),
    setShopState: setField("shopState"),
    setAlchemistState: setField("alchemistState"),
    setTrinketShopState: setField("trinketShopState"),
    setEquipmentShopState: setField("equipmentShopState"),
    setMysteryEvent: setField("mysteryEvent"),
    setMysteryChosenChoice: setField("mysteryChosenChoice"),
    setMysteryPendingRemoval: setField("mysteryPendingRemoval"),
    setMysteryCardChoices: setField("mysteryCardChoices"),
    setMysteryGrantedTrinketIds: setField("mysteryGrantedTrinketIds"),
    setMysteryChosenCardId: setField("mysteryChosenCardId"),

    clearTransientSession: () =>
      set((state) => {
        Object.assign(state, createInitialSessionFields());
      }),

    applyDestinationChoices: (choices) =>
      set((state) => {
        state.rewardState = { ...createEmptyRewardState(), destinations: filterValidDestinations(choices) };
      }),
  };
}
