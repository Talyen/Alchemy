import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type { RewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type {
  ShopState,
  AlchemistState,
  TrinketShopState,
  EquipmentShopState,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import { defineFieldSetter } from "./_field-setter";
import { createInitialSessionFields, type RunSessionFields } from "../run-domain-types";

type ImmerSet = (fn: (state: any) => void) => void;

export type SessionActions = {
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
};

export function defineSessionActions(set: ImmerSet): SessionActions {
  const setField = defineFieldSetter<RunSessionFields>(set, "session");

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
      set((state: any) => {
        state.session.mysteryCardChoices =
          typeof choices === "function" ? choices(state.session.mysteryCardChoices) : choices;
      }),

    clearTransientSession: () =>
      set((state: any) => {
        state.session = { ...createInitialSessionFields(), pendingContentSystemType: "campaign" };
      }),
  };
}
