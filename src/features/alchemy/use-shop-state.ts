import { useState } from "react";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { ALCHEMIST_POTIONS_OFFERED, ALCHEMIST_REFRESHES, SHOP_CARDS_OFFERED, SHOP_REFRESHES } from "@/lib/game-constants";
import { sampleItems } from "./utils";

export interface ShopState {
  cards: BattleCard[];
  refreshesLeft: number;
  removeUsed: boolean;
  firstPurchaseUsed: boolean;
}

export interface AlchemistState {
  potions: BattleCard[];
  refreshesLeft: number;
  mixUsed: boolean;
  firstPurchaseUsed: boolean;
}

const emptyShop: ShopState = { cards: [], refreshesLeft: SHOP_REFRESHES, removeUsed: false, firstPurchaseUsed: false };
const emptyAlchemist: AlchemistState = { potions: [], refreshesLeft: ALCHEMIST_REFRESHES, mixUsed: false, firstPurchaseUsed: false };

export function useShopState() {
  const [shopState, setShopState] = useState<ShopState>(emptyShop);
  const [alchemistState, setAlchemistState] = useState<AlchemistState>(emptyAlchemist);

  function initShop() {
    setShopState({ cards: sampleItems(cardLibrary, SHOP_CARDS_OFFERED), refreshesLeft: SHOP_REFRESHES, removeUsed: false, firstPurchaseUsed: false });
  }

  function initAlchemist() {
    const potions = sampleItems(cardLibrary.filter((c) => c.id.includes("potion") && c.id !== "mixed-potion"), ALCHEMIST_POTIONS_OFFERED);
    setAlchemistState({ potions, refreshesLeft: ALCHEMIST_REFRESHES, mixUsed: false, firstPurchaseUsed: false });
  }

  function resetShop() { setShopState(emptyShop); }
  function resetAlchemist() { setAlchemistState(emptyAlchemist); }

  return { shopState, setShopState, alchemistState, setAlchemistState, initShop, initAlchemist, resetShop, resetAlchemist };
}
