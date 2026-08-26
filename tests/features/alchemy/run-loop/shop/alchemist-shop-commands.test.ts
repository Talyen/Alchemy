import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { createEmptyTalentEffectManifest, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setAlchemistState as mutateAlchemistState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createInitialAlchemistState as createInitialAlchemistStateImpl } from "@/features/alchemy/run-loop/shop/shop-state-init";
import { ALCHEMIST_POTION_PRICE, ALCHEMIST_MIX_PRICE } from "@/lib/game-constants";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { makeTestCard } from "../../../../fixtures/cards";
import { makeEffect } from "../../../../fixtures/battle";

const setAlchemistState = createRunSessionCommand(mutateAlchemistState);
const defaultTalentEffects: TalentEffectManifest = createEmptyTalentEffectManifest();
const testRng = () => 0.5;
const createInitialAlchemistState = (deck: BattleCard[] = []) => createInitialAlchemistStateImpl(deck, testRng);

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({ cost: 2, effects: [makeEffect("physical", 5)], ...overrides });
}

function requiredItem<T>(value: T | undefined, label: string): T {
  expect(value, `${label} fixture should exist`).toBeDefined();
  return value as T;
}

function buildActions() {
  return createShopActions({
    talentEffects: defaultTalentEffects,
    homesteadEffects: defaultHomesteadEffects,
  });
}

beforeEach(() => {
  resetAllTestStores();
});

describe("alchemist buyPotion", () => {
  it("deducts gold and appends the potion on a successful purchase", () => {
    setRunProgress({ runGold: 999 });
    setAlchemistState(createInitialAlchemistState());
    const actions = buildActions();
    const potion = requiredItem(getRunSessionStoreView().alchemistState.potions[0], "alchemist potion");
    const slotKey = shopItemSlotKey(potion.id, 0);
    const deckBefore = getRunProgressStoreView().runDeck.length;

    expect(actions.alchemist.buyPotion(potion, slotKey)).toBe(true);
    expect(getRunProgressStoreView().runGold).toBe(999 - ALCHEMIST_POTION_PRICE);
    expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore + 1);
    expect(getRunSessionStoreView().alchemistState.purchasedSlotKeys).toContain(slotKey);
  });

  it("returns false and does nothing when gold is insufficient", () => {
    setRunProgress({ runGold: 0 });
    setAlchemistState(createInitialAlchemistState());
    const actions = buildActions();
    const potion = requiredItem(getRunSessionStoreView().alchemistState.potions[0], "alchemist potion");
    const slotKey = shopItemSlotKey(potion.id, 0);
    const deckBefore = getRunProgressStoreView().runDeck.length;

    expect(actions.alchemist.buyPotion(potion, slotKey)).toBe(false);
    expect(getRunProgressStoreView().runGold).toBe(0);
    expect(getRunProgressStoreView().runDeck.length).toBe(deckBefore);
    expect(getRunSessionStoreView().alchemistState.purchasedSlotKeys).toEqual([]);
  });

  it("rejects a second buy of the same purchased slot", () => {
    setRunProgress({ runGold: 999 });
    setAlchemistState(createInitialAlchemistState());
    const actions = buildActions();
    const potion = requiredItem(getRunSessionStoreView().alchemistState.potions[0], "alchemist potion");
    const slotKey = shopItemSlotKey(potion.id, 0);

    expect(actions.alchemist.buyPotion(potion, slotKey)).toBe(true);
    const goldAfterFirst = getRunProgressStoreView().runGold;
    const deckAfterFirst = getRunProgressStoreView().runDeck.length;

    expect(actions.alchemist.buyPotion(potion, slotKey)).toBe(false);
    expect(getRunProgressStoreView().runGold).toBe(goldAfterFirst);
    expect(getRunProgressStoreView().runDeck.length).toBe(deckAfterFirst);
  });
});

describe("alchemist mixPotions", () => {
  it("returns null when mixing two non-potions", () => {
    setRunProgress({
      runGold: 999,
      runDeck: [makeCard({ id: "slash", title: "Slash" }), makeCard({ id: "bash", title: "Bash" })],
    });
    setAlchemistState(createInitialAlchemistState());
    const actions = buildActions();

    expect(actions.alchemist.mixPotions(0, 1)).toBeNull();
    expect(getRunProgressStoreView().runGold).toBe(999);
    expect(getRunSessionStoreView().alchemistState.mixUsed).toBe(false);
    expect(getRunProgressStoreView().runDeck.map((card) => card.id)).toEqual(["slash", "bash"]);
  });

  it("still charges mix price only for standard potions", () => {
    setRunProgress({
      runGold: 999,
      runDeck: [
        makeCard({ id: "health-potion", title: "Health Potion" }),
        makeCard({ id: "mana-potion", title: "Mana Potion" }),
      ],
    });
    setAlchemistState(createInitialAlchemistState());
    const actions = buildActions();

    expect(actions.alchemist.mixPotions(0, 1)).not.toBeNull();
    expect(getRunProgressStoreView().runGold).toBe(999 - ALCHEMIST_MIX_PRICE);
  });
});
