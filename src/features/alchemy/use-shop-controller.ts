import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { playGoldSpend } from "@/lib/audio";
import { computeTrinketManifest } from "@/lib/trinkets";
import { createMixedPotion, applyMixToDeck } from "./potion-mixer";
import { useShopState } from "./use-shop-state";
import {
  ALCHEMIST_MIX_PRICE, ALCHEMIST_POTION_PRICE, ALCHEMIST_REFRESH_PRICE,
  SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE,
  SHOP_CARDS_OFFERED, ALCHEMIST_POTIONS_OFFERED,
} from "@/lib/game-constants";
import { resampleItems } from "./utils";
import type { useRunState } from "./use-run-state";
import type { useTalentState } from "./use-talent-state";

export function useShopController({
  run, talents,
  setDiscoveredCardIds,
}: {
  run: ReturnType<typeof useRunState>;
  talents: ReturnType<typeof useTalentState>;
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { shopState, setShopState, alchemistState, setAlchemistState, initShop, initAlchemist } = useShopState();

  function handleShopBuyCard(card: BattleCard) {
    let price = Math.max(0, SHOP_CARD_PRICE - talents.talentEffects.shopCardDiscount);
    if (!shopState.firstPurchaseUsed) {
      price = Math.max(0, price - computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount);
    }
    if (run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
    setShopState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleShopRemoveCard(index: number) {
    const price = Math.max(0, SHOP_REMOVE_PRICE - talents.talentEffects.removeCardDiscount);
    if (run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    const price = talents.talentEffects.shopFreeRefresh && shopState.refreshesLeft > 0 ? 0 : SHOP_REFRESH_PRICE;
    if (shopState.refreshesLeft <= 0 || run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - price));
    setShopState((p) => ({ ...p, cards: resampleItems(cardLibrary, p.cards, SHOP_CARDS_OFFERED), refreshesLeft: 0 }));
  }

  function handleAlchemistBuyCard(card: BattleCard) {
    let price = Math.max(0, ALCHEMIST_POTION_PRICE - talents.talentEffects.potionDiscount);
    if (!alchemistState.firstPurchaseUsed) {
      price = Math.max(0, price - computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount);
    }
    if (run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
    setAlchemistState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleAlchemistRefresh() {
    const potionPool = cardLibrary.filter((c) => c.id.includes("potion") && c.id !== "mixed-potion");
    if (alchemistState.refreshesLeft <= 0 || run.runGold < ALCHEMIST_REFRESH_PRICE) return;
    playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - ALCHEMIST_REFRESH_PRICE));
    setAlchemistState((p) => ({ ...p, potions: resampleItems(potionPool, p.potions, ALCHEMIST_POTIONS_OFFERED), refreshesLeft: 0 }));
  }

  function handleAlchemistMixPotions(indexA: number, indexB: number) {
    const price = Math.max(0, ALCHEMIST_MIX_PRICE - talents.talentEffects.mixPotionDiscount);
    if (run.runGold < price) return;
    const deck = run.runDeck;
    const highIdx = Math.max(indexA, indexB);
    const lowIdx = Math.min(indexA, indexB);
    const cardA = deck[highIdx];
    const cardB = deck[lowIdx];

    let mixed: BattleCard;
    try {
      mixed = createMixedPotion(cardA, cardB);
    } catch {
      return;
    }

    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price));
    run.setRunDeck((p) => applyMixToDeck(p, indexA, indexB, mixed));
    setAlchemistState((p) => ({ ...p, mixUsed: true }));
    setDiscoveredCardIds((cur) => cur.includes("mixed-potion") ? cur : [...cur, "mixed-potion"]);
  }

  return {
    shopState, setShopState,
    alchemistState, setAlchemistState,
    initShop, initAlchemist,
    handleShopBuyCard, handleShopRemoveCard, handleShopRefresh,
    handleAlchemistBuyCard, handleAlchemistRefresh, handleAlchemistMixPotions,
    get shopCards() { return shopState.cards; },
    get shopRefreshesLeft() { return shopState.refreshesLeft; },
    get shopRemoveUsed() { return shopState.removeUsed; },
    get alchemistPotions() { return alchemistState.potions; },
    get alchemistRefreshesLeft() { return alchemistState.refreshesLeft; },
    get alchemistPotionPrice() {
      const favorDiscount = !alchemistState.firstPurchaseUsed ? computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount : 0;
      return Math.max(0, ALCHEMIST_POTION_PRICE - talents.talentEffects.potionDiscount - favorDiscount);
    },
    get alchemistMixPrice() { return Math.max(0, ALCHEMIST_MIX_PRICE - talents.talentEffects.mixPotionDiscount); },
    get alchemistMixUsed() { return alchemistState.mixUsed; },
  };
}
