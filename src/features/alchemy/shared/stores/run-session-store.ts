// Zustand store for transient per-run session UI state.
import { create } from "zustand";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { SHOP_REFRESHES, ALCHEMIST_REFRESHES } from "@/lib/game-constants";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";
import type { RunSessionFields, RunSessionStore } from "./run-session-store-types";

export type { RunSessionFields, RunSessionStore } from "./run-session-store-types";

const emptyShop: ShopState = {
  cards: [],
  refreshesLeft: SHOP_REFRESHES,
  removeUsed: false,
  firstPurchaseUsed: false,
};
const emptyAlchemist: AlchemistState = {
  potions: [],
  refreshesLeft: ALCHEMIST_REFRESHES,
  mixUsed: false,
  firstPurchaseUsed: false,
};

function createInitialSessionState(): RunSessionFields {
  return {
    hasActiveRun: false,
    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    activeLabyrinthPendingNode: null,
    rewardState: createEmptyRewardState(),
    companionRewardCards: null,
    runEndMaterials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    runEndTalentXP: {},
    corruptionResult: null,
    pendingCharacterId: null,
    pendingContentSystemType: "campaign",
    labyrinthMap: generateLabyrinthMap(),
    shopState: emptyShop,
    alchemistState: emptyAlchemist,
    mysteryEvent: null,
    mysteryCardChoices: null,
  };
}

type RunSessionFieldKey = keyof RunSessionFields;

export const useRunSessionStore = create<RunSessionStore>()((set) => {
  const setField =
    <K extends RunSessionFieldKey>(key: K) =>
    (action: RunSessionStore[K] | ((prev: RunSessionStore[K]) => RunSessionStore[K])) =>
      set((s) => ({
        [key]:
          typeof action === "function" ? (action as (prev: RunSessionStore[K]) => RunSessionStore[K])(s[key]) : action,
      }));

  return {
    ...createInitialSessionState(),

    setHasActiveRun: (active) => set({ hasActiveRun: active }),
    setActiveLabyrinthModifiers: (modifiers) => set({ activeLabyrinthModifiers: modifiers }),
    setActiveLabyrinthRewardModifiers: (modifiers) => set({ activeLabyrinthRewardModifiers: modifiers }),
    setActiveLabyrinthPendingNode: (node) => set({ activeLabyrinthPendingNode: node }),
    setRewardState: setField("rewardState"),
    setCompanionRewardCards: (cards) => set({ companionRewardCards: cards }),
    setRunEndMaterials: (materials) => set({ runEndMaterials: materials }),
    setRunEndTalentXP: (xp) => set({ runEndTalentXP: xp }),
    setCorruptionResult: (result) => set({ corruptionResult: result }),
    setPendingCharacterId: (id) => set({ pendingCharacterId: id }),
    setPendingContentSystemType: (type) => set({ pendingContentSystemType: type }),
    setLabyrinthMap: setField("labyrinthMap"),
    setShopState: setField("shopState"),
    setAlchemistState: setField("alchemistState"),
    setMysteryEvent: (event) => set({ mysteryEvent: event }),
    setMysteryCardChoices: (choices) =>
      set((s) => ({
        mysteryCardChoices: typeof choices === "function" ? choices(s.mysteryCardChoices) : choices,
      })),

    clearTransientSession: () =>
      set({
        ...createInitialSessionState(),
        pendingContentSystemType: "campaign",
      }),
  };
});
