import { create } from "zustand";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import {
  SHOP_CARDS_OFFERED,
  SHOP_REFRESHES,
  ALCHEMIST_POTIONS_OFFERED,
  ALCHEMIST_REFRESHES,
  POTION_CARD_ID_FRAGMENT,
  MIXED_POTION_CARD_ID,
  NAVIGATION_DELAY_MS,
} from "@/lib/game-constants";
import { sampleItems } from "@/features/alchemy/utils";
import type { Screen } from "@/features/alchemy/types";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import type { MysteryEvent } from "@/features/alchemy/mystery-events";
import { mysteryPool } from "@/features/alchemy/mystery-events";
import type { CorruptionResult } from "@/features/alchemy/corruption";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CharacterId } from "@/lib/game-data";

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

type Setter<T> = (action: T | ((prev: T) => T)) => void;

type ScreenStore = {
  screen: Screen;
  hoveredCardId: string | null;
  hasActiveRun: boolean;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
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

  setScreen: (screen: Screen) => void;
  setHoveredCardId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setHasActiveRun: (active: boolean) => void;
  setActiveLabyrinthModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthRewardModifiers: (modifiers: LabyrinthModifierKind[]) => void;
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
  beginMystery: () => void;
  clearMysteryChoices: () => void;
  navigateTo: (nextScreen: Screen) => void;
  goToScreen: (nextScreen: Screen) => void;
};

export const useScreenStore = create<ScreenStore>()((set) => ({
  screen: "menu",
  hoveredCardId: null,
  hasActiveRun: false,
  activeLabyrinthModifiers: [],
  activeLabyrinthRewardModifiers: [],
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

  setScreen: (screen) => set({ screen }),
  setHoveredCardId: (id) => set((s) => ({ hoveredCardId: typeof id === "function" ? id(s.hoveredCardId) : id })),
  setHasActiveRun: (active) => set({ hasActiveRun: active }),
  setActiveLabyrinthModifiers: (modifiers) => set({ activeLabyrinthModifiers: modifiers }),
  setActiveLabyrinthRewardModifiers: (modifiers) => set({ activeLabyrinthRewardModifiers: modifiers }),
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
    const potions = sampleItems(
      cardLibrary.filter((c) => c.id.includes(POTION_CARD_ID_FRAGMENT) && c.id !== MIXED_POTION_CARD_ID),
      ALCHEMIST_POTIONS_OFFERED,
    );
    set({ alchemistState: { potions, refreshesLeft: ALCHEMIST_REFRESHES, mixUsed: false, firstPurchaseUsed: false } });
  },

  resetLabyrinthMap: () => set({ labyrinthMap: generateLabyrinthMap() }),
  beginMystery: () => set({ mysteryEvent: pickRandom(mysteryPool) ?? mysteryPool[0], mysteryCardChoices: null }),
  clearMysteryChoices: () => set({ mysteryCardChoices: null }),
  navigateTo: (nextScreen) => {
    if (_navTimerRef.current) window.clearTimeout(_navTimerRef.current);
    _navTimerRef.current = window.setTimeout(() => set({ screen: nextScreen }), NAVIGATION_DELAY_MS);
  },
  goToScreen: (nextScreen) => {
    set({ hoveredCardId: null });
    if (_navTimerRef.current) window.clearTimeout(_navTimerRef.current);
    _navTimerRef.current = window.setTimeout(() => set({ screen: nextScreen }), NAVIGATION_DELAY_MS);
  },
}));

const _navTimerRef: { current: number | null } = { current: null };
