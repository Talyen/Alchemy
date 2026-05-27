import { create } from "zustand";
import { cardLibrary, getStandardPotionPool, type BattleCard } from "@/lib/game-data";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import {
  SHOP_CARDS_OFFERED,
  SHOP_REFRESHES,
  ALCHEMIST_POTIONS_OFFERED,
  ALCHEMIST_REFRESHES,
  SHIMMER_COOLDOWN_MS,
} from "@/lib/game-constants";
import { sampleItems } from "@/features/alchemy/utils";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import type { MysteryEvent } from "@/features/alchemy/mystery-events";
import type { CorruptionResult } from "@/features/alchemy/corruption";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CharacterId } from "@/lib/game-data";
import type { LabyrinthNodePosition } from "@/features/alchemy/run/types";
import type { Setter } from "@/lib/utils";

type ShopState = {
  cards: BattleCard[];
  refreshesLeft: number;
  removeUsed: boolean;
  firstPurchaseUsed: boolean;
};

type AlchemistState = {
  potions: BattleCard[];
  refreshesLeft: number;
  mixUsed: boolean;
  firstPurchaseUsed: boolean;
};

const emptyShop: ShopState = { cards: [], refreshesLeft: SHOP_REFRESHES, removeUsed: false, firstPurchaseUsed: false };
const emptyAlchemist: AlchemistState = {
  potions: [],
  refreshesLeft: ALCHEMIST_REFRESHES,
  mixUsed: false,
  firstPurchaseUsed: false,
};

type ShimmerState = { cardId: string; token: number } | null;

type ScreenStore = {
  hoveredCardId: string | null;
  shimmerState: ShimmerState;
  hasActiveRun: boolean;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  activeLabyrinthPendingNode: LabyrinthNodePosition | null;
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  runEndMaterials: MaterialInventory;
  corruptionResult: CorruptionResult | null;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap;
  shopState: ShopState;
  alchemistState: AlchemistState;
  mysteryEvent: MysteryEvent | null;
  mysteryCardChoices: BattleCard[] | null;

  setHoveredCardId: (id: string | null | ((prev: string | null) => string | null)) => void;
  clearCardHover: () => void;
  maybeTriggerShimmer: (cardId: string) => void;
  setHasActiveRun: (active: boolean) => void;
  setActiveLabyrinthModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthRewardModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthPendingNode: (node: LabyrinthNodePosition | null) => void;
  setRewardState: Setter<RewardState>;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setRunEndMaterials: (materials: MaterialInventory) => void;
  setCorruptionResult: (result: CorruptionResult | null) => void;
  setPendingCharacterId: (id: CharacterId | null) => void;
  setPendingContentSystemType: (type: ContentSystemId) => void;
  setLabyrinthMap: Setter<LabyrinthMap>;
  setShopState: Setter<ShopState>;
  setAlchemistState: Setter<AlchemistState>;
  setMysteryEvent: (event: MysteryEvent | null) => void;
  setMysteryCardChoices: (choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null)) => void;

  initShop: () => void;
  initAlchemist: () => void;
  resetLabyrinthMap: () => void;
};

export const useScreenStore = create<ScreenStore>()((set, get) => ({
  hoveredCardId: null,
  shimmerState: null,
  hasActiveRun: false,
  activeLabyrinthModifiers: [],
  activeLabyrinthRewardModifiers: [],
  activeLabyrinthPendingNode: null,
  rewardState: createEmptyRewardState(),
  companionRewardCards: null,
  runEndMaterials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
  corruptionResult: null,
  pendingCharacterId: null,
  pendingContentSystemType: "campaign",
  labyrinthMap: generateLabyrinthMap(),
  shopState: emptyShop,
  alchemistState: emptyAlchemist,
  mysteryEvent: null,
  mysteryCardChoices: null,

  setHoveredCardId: (id) => set((s) => ({ hoveredCardId: typeof id === "function" ? id(s.hoveredCardId) : id })),
  clearCardHover: () => set({ hoveredCardId: null }),
  maybeTriggerShimmer: (cardId) => {
    const state = get();
    if (state.shimmerState && performance.now() - state.shimmerState.token < SHIMMER_COOLDOWN_MS) return;
    set({ shimmerState: { cardId, token: performance.now() } });
  },
  setHasActiveRun: (active) => set({ hasActiveRun: active }),
  setActiveLabyrinthModifiers: (modifiers) => set({ activeLabyrinthModifiers: modifiers }),
  setActiveLabyrinthRewardModifiers: (modifiers) => set({ activeLabyrinthRewardModifiers: modifiers }),
  setActiveLabyrinthPendingNode: (node) => set({ activeLabyrinthPendingNode: node }),
  setRewardState: (action) =>
    set((s) => ({ rewardState: typeof action === "function" ? action(s.rewardState) : action })),
  setCompanionRewardCards: (cards) => set({ companionRewardCards: cards }),
  setRunEndMaterials: (materials) => set({ runEndMaterials: materials }),
  setCorruptionResult: (result) => set({ corruptionResult: result }),
  setPendingCharacterId: (id) => set({ pendingCharacterId: id }),
  setPendingContentSystemType: (type) => set({ pendingContentSystemType: type }),
  setLabyrinthMap: (action) =>
    set((s) => ({ labyrinthMap: typeof action === "function" ? action(s.labyrinthMap) : action })),
  setShopState: (action) => set((s) => ({ shopState: typeof action === "function" ? action(s.shopState) : action })),
  setAlchemistState: (action) =>
    set((s) => ({ alchemistState: typeof action === "function" ? action(s.alchemistState) : action })),
  setMysteryEvent: (event) => set({ mysteryEvent: event }),
  setMysteryCardChoices: (choices) =>
    set((s) => ({ mysteryCardChoices: typeof choices === "function" ? choices(s.mysteryCardChoices) : choices })),

  initShop: () =>
    set({
      shopState: {
        cards: sampleItems(cardLibrary, SHOP_CARDS_OFFERED),
        refreshesLeft: SHOP_REFRESHES,
        removeUsed: false,
        firstPurchaseUsed: false,
      },
    }),

  initAlchemist: () => {
    const potions = sampleItems(getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED);
    set({ alchemistState: { potions, refreshesLeft: ALCHEMIST_REFRESHES, mixUsed: false, firstPurchaseUsed: false } });
  },

  resetLabyrinthMap: () => set({ labyrinthMap: generateLabyrinthMap() }),
}));
