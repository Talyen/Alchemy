import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
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
import { DESTINATIONS, type Destination } from "@/features/alchemy/shared/types";
import { createEmptyRewardState } from "@/lib/active-run-session/reward-types";
import { defineFieldSetter, type ImmerSet } from "./_field-setter";
import { createInitialSessionFields, type RunSessionFields, type RunDomainDataState } from "../run-domain-types";

export interface SessionActions {
  setHasActiveRun: (active: boolean) => void;
  setActiveLabyrinthModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthRewardModifiers: (modifiers: LabyrinthModifierKind[]) => void;
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
  setMysteryCardChoices: (
    choices:
      | RunSessionFields["mysteryCardChoices"]
      | ((prev: RunSessionFields["mysteryCardChoices"]) => RunSessionFields["mysteryCardChoices"]),
  ) => void;
  clearTransientSession: () => void;

  /**
   * Restore reward state with pre-sampled destinations on campaign resume.
   * Filters raw string choices to valid Destination values.
   */
  applyDestinationChoices: (choices: string[]) => void;
}

export function defineSessionActions(set: ImmerSet<RunDomainDataState>): SessionActions {
  const setField = defineFieldSetter<RunSessionFields, RunDomainDataState>(set, "session");

  return {
    setHasActiveRun: setField("hasActiveRun"),
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
    setMysteryCardChoices: (choices) =>
      set((state) => {
        state.session.mysteryCardChoices =
          typeof choices === "function" ? choices(state.session.mysteryCardChoices) : choices;
      }),

    clearTransientSession: () =>
      set((state) => {
        state.session = { ...createInitialSessionFields(), pendingContentSystemType: "campaign" };
      }),

    applyDestinationChoices: (choices) =>
      set((state) => {
        const validDestinations = new Set<string>(Object.values(DESTINATIONS));
        const filtered = choices.filter((c): c is Destination => validDestinations.has(c));
        state.session.rewardState = { ...createEmptyRewardState(), destinations: filtered };
      }),
  };
}
