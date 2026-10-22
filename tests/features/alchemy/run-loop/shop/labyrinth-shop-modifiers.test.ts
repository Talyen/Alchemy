import { ALCHEMIST_REFRESH_PRICE, SHOP_REFRESH_PRICE } from "@/lib/game-constants";
import { initializeShopForTest } from "../../../../helpers/visit-initialization";
import { twoFloorLabyrinthMapFixture } from "../../../../fixtures/labyrinth-map";
import { describe, expect, it } from "vitest";
import { buildActions } from "./shop-actions-harness";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { shopItemSlotKey } from "@/lib/active-run-session";
import { cardById, getCardKeywords } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear";
import { gearBaseItems, type GearBaseItemId } from "@/lib/gear/base-items";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { hydrateAlchemistState, readActivityData } from "@/lib/active-run-session";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { playUISound } from "@/lib/audio";
import { defaultGameSession } from "@/app/application-session";
function room(id: EncounterRewardTraitId) {
  setRunProgress({
    contentSystemType: "labyrinth",
    gold: 500,
    runDeck: [cardById["health-potion"]!, cardById["mana-potion"]!],
  });
  setRunSession({ activeLabyrinthRewardModifiers: [id], labyrinthMap: twoFloorLabyrinthMapFixture() });
  return buildActions();
}

describe("Labyrinth shops", () => {
  it.each([
    ["fletchers-market", "archery"],
    ["beast-market", "companion"],
    ["ember-market", "burn"],
    ["wishing-market", "wish"],
  ] as const)("%s keeps its specialty through refreshes", (id, theme) => {
    const actions = room(id);
    initializeShopForTest("shop", defaultGameSession);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "shop").cards).toHaveLength(3);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "shop").cards.every((card) =>
        getCardKeywords(card).includes(theme),
      ),
    ).toBe(true);
    expect(actions.merchant.refresh()).toBe(true);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "shop").cards).toHaveLength(3);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "shop").cards.every((card) =>
        getCardKeywords(card).includes(theme),
      ),
    ).toBe(true);
  });

  it("Bargain Bin charges its displayed price once", () => {
    const actions = room("bargain-bin");
    initializeShopForTest("shop", defaultGameSession);
    const card = readActivityData(readRunSession(defaultGameSession).activity, "shop").cards[0]!;
    expect(actions.merchant.getCardBuyPrice(card)).toBe(15);
    const slot = shopItemSlotKey(card.id, 0);
    expect(actions.merchant.buyCard(slot)).toBe(true);
    expect(readRunProfile(defaultGameSession).gold).toBe(485);
    expect(actions.merchant.buyCard(slot)).toBe(false);
    expect(readRunProfile(defaultGameSession).gold).toBe(485);
  });

  it("Clean Slate keeps the normal one-removal limit", () => {
    const actions = room("clean-slate");
    initializeShopForTest("shop", defaultGameSession);
    expect(actions.merchant.getRemoveCardPrice()).toBe(0);
    expect(actions.merchant.removeCard(0)).toBe(true);
    expect(actions.merchant.removeCard(0)).toBe(false);
    expect(readRunProfile(defaultGameSession).gold).toBe(500);
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("shopRemove");
  });

  it("Strong Spirits preserves potency on refresh, purchase, hydration, and mixing", () => {
    const actions = room("strong-spirits");
    initializeShopForTest("alchemist", defaultGameSession);
    const verify = () => {
      for (const card of readActivityData(readRunSession(defaultGameSession).activity, "alchemist").potions)
        expect(card).toEqual(doublePotionPotency(cardById[card.id]!));
    };
    verify();
    expect(actions.alchemist.refresh()).toBe(true);
    verify();
    const saved = readActivityData(readRunSession(defaultGameSession).activity, "alchemist");
    expect(hydrateAlchemistState(JSON.parse(JSON.stringify(saved)))).toEqual(
      readActivityData(readRunSession(defaultGameSession).activity, "alchemist"),
    );
    const offered = readActivityData(readRunSession(defaultGameSession).activity, "alchemist").potions[0]!;
    expect(actions.alchemist.buyPotion(shopItemSlotKey(offered.id, 0))).toBe(true);
    const bought = readActiveRun(defaultGameSession).runDeck.at(-1)!;
    expect(bought.effects).toEqual(offered.effects);
    expect(hydrateCard(JSON.parse(JSON.stringify(bought))).effects).toEqual(offered.effects);
    expect(bought.cost).toBe(cardById[bought.id]!.cost);
    expect(bought.consume).toBe(true);
  });

  it("mixing normal and stronger copies preserves both ingredient amounts", () => {
    const normal = cardById["health-potion"]!;
    const strong = doublePotionPotency(normal);
    const forward = createMixedPotion(strong, normal);
    const reverse = createMixedPotion(normal, strong);
    expect(forward.effects).toEqual([
      { kind: "heal", amount: 16 },
      { kind: "heal", amount: 8 },
    ]);
    expect(reverse.effects).toEqual([
      { kind: "heal", amount: 8 },
      { kind: "heal", amount: 16 },
    ]);
    expect(forward.descriptionLines).toEqual(["Restore 16 Health", "Restore 8 Health", "Consume"]);
  });

  it("Strong Spirits preserves probabilities in Luck Potion", () => {
    const doubled = doublePotionPotency(cardById["luck-potion"]!);
    expect(doubled.descriptionLines[0]).toBe("50% chance: Gain 8 Mana");
    expect(doubled.descriptionLines[1]).toBe("Otherwise: Gain 8 Gold or Block");
    expect(doubled.effects[0]).toMatchObject({
      probability: 0.5,
      successEffects: [{ amount: 8 }],
      failureEffects: [{ probability: 0.5, successEffects: [{ amount: 8 }] }],
    });
  });

  it("Open Kitchen mixes once for free", () => {
    const actions = room("open-kitchen");
    initializeShopForTest("alchemist", defaultGameSession);
    expect(actions.alchemist.getMixPrice()).toBe(0);
    expect(actions.alchemist.mixPotions(0, 1)).not.toBeNull();
    expect(readRunProfile(defaultGameSession).gold).toBe(500);
    expect(actions.alchemist.mixPotions(0, 1)).toBeNull();
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("alchemistMix");
  });

  it("free Potion and Trinket refreshes keep their existing limits", () => {
    const actions = room("fresh-batch");
    initializeShopForTest("alchemist", defaultGameSession);
    expect(actions.alchemist.getRefreshPrice()).toBe(0);
    expect(actions.alchemist.refresh()).toBe(true);
    expect(actions.alchemist.getRefreshPrice()).toBe(ALCHEMIST_REFRESH_PRICE);
    expect(actions.alchemist.refresh()).toBe(false);
    expect(readRunProfile(defaultGameSession).gold).toBe(500);
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("shopRefresh");
    setRunSession({ activeLabyrinthRewardModifiers: ["fresh-curios"] });
    initializeShopForTest("trinket-shop", defaultGameSession);
    expect(actions.trinket.getRefreshPrice()).toBe(0);
    expect(actions.trinket.refresh()).toBe(true);
    expect(actions.trinket.getRefreshPrice()).toBe(SHOP_REFRESH_PRICE);
    expect(actions.trinket.refresh()).toBe(false);
    expect(readRunProfile(defaultGameSession).gold).toBe(500);
    expect(playUISound).toHaveBeenCalledTimes(2);
  });

  it("Happy Hour and Collector’s Favor charge discounted prices", () => {
    const actions = room("happy-hour");
    initializeShopForTest("alchemist", defaultGameSession);
    const potion = readActivityData(readRunSession(defaultGameSession).activity, "alchemist").potions[0]!;
    expect(actions.alchemist.getPotionBuyPrice(potion)).toBe(15);
    expect(actions.alchemist.buyPotion(shopItemSlotKey(potion.id, 0))).toBe(true);
    setRunSession({ activeLabyrinthRewardModifiers: ["collectors-favor"] });
    initializeShopForTest("trinket-shop", defaultGameSession);
    const trinket = readActivityData(readRunSession(defaultGameSession).activity, "trinket-shop").trinkets[0]!;
    expect(actions.trinket.getBuyPrice(trinket)).toBe(75);
    expect(actions.trinket.buy(shopItemSlotKey(trinket.id, 0))).toBe(true);
    expect(readRunProfile(defaultGameSession).gold).toBe(410);
  });

  it.each(["bowyer", "armorer", "masterwork"] as const)("%s keeps all Gear offers eligible after a refresh", (id) => {
    const actions = room(id);
    initializeShopForTest("equipment-shop", defaultGameSession);
    const verify = () => {
      const items = readActivityData(readRunSession(defaultGameSession).activity, "equipment-shop").gear;
      expect(items).toHaveLength(3);
      for (const item of items) {
        const def = gearDefinitions[item.definitionId]!;
        if (id === "masterwork") expect(def.rarity).toBe("astral");
        else if (id === "bowyer") expect(["shortbow", "longbow", "recurve-bow"]).toContain(def.baseItemId);
        else expect(gearBaseItems[def.baseItemId as GearBaseItemId].compatibleSlots).toContain("body");
      }
    };
    verify();
    expect(actions.equipment.refresh()).toBe(true);
    verify();
  });

  it("room discounts do not leak into Campaign", () => {
    const actions = room("bargain-bin");
    setRunProgress({ contentSystemType: "campaign" });
    initializeShopForTest("shop", defaultGameSession);
    expect(
      actions.merchant.getCardBuyPrice(readActivityData(readRunSession(defaultGameSession).activity, "shop").cards[0]!),
    ).toBe(30);
  });
});
