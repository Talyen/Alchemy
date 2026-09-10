import { twoFloorLabyrinthMapFixture } from "../../../../fixtures/labyrinth-map";
import { describe, expect, it } from "vitest";
import { buildActions } from "./shop-actions-harness";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { getCardKeywords, cardById } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear";
import { gearBaseItems, type GearBaseItemId } from "@/lib/gear/base-items";
import { doublePotionPotency, createMixedPotion } from "@/lib/alchemist";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { hydrateAlchemistState, serializeAlchemistState } from "@/lib/active-run-session";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";

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
    actions.merchant.initialize();
    expect(readRunSession().shopState.cards).toHaveLength(3);
    expect(readRunSession().shopState.cards.every((card) => getCardKeywords(card).includes(theme))).toBe(true);
    expect(actions.merchant.refresh()).toBe(true);
    expect(readRunSession().shopState.cards).toHaveLength(3);
    expect(readRunSession().shopState.cards.every((card) => getCardKeywords(card).includes(theme))).toBe(true);
  });

  it("Bargain Bin charges its displayed price once", () => {
    const actions = room("bargain-bin");
    actions.merchant.initialize();
    const card = readRunSession().shopState.cards[0]!;
    expect(actions.merchant.getCardBuyPrice(card)).toBe(15);
    const slot = shopItemSlotKey(card.id, 0);
    expect(actions.merchant.buyCard(card, slot)).toBe(true);
    expect(readRunProfile().gold).toBe(485);
    expect(actions.merchant.buyCard(card, slot)).toBe(false);
    expect(readRunProfile().gold).toBe(485);
  });

  it("Clean Slate keeps the normal one-removal limit", () => {
    const actions = room("clean-slate");
    actions.merchant.initialize();
    expect(actions.merchant.getRemoveCardPrice()).toBe(0);
    expect(actions.merchant.removeCard(0)).toBe(true);
    expect(actions.merchant.removeCard(0)).toBe(false);
    expect(readRunProfile().gold).toBe(500);
  });

  it("Strong Spirits preserves potency on refresh, purchase, hydration, and mixing", () => {
    const actions = room("strong-spirits");
    actions.alchemist.initialize();
    const verify = () => {
      for (const card of readRunSession().alchemistState.potions)
        expect(card).toEqual(doublePotionPotency(cardById[card.id]!));
    };
    verify();
    expect(actions.alchemist.refresh()).toBe(true);
    verify();
    const saved = serializeAlchemistState(readRunSession().alchemistState);
    expect(hydrateAlchemistState(JSON.parse(JSON.stringify(saved)))).toEqual(readRunSession().alchemistState);
    const offered = readRunSession().alchemistState.potions[0]!;
    expect(actions.alchemist.buyPotion(cardById[offered.id]!, shopItemSlotKey(offered.id, 0))).toBe(true);
    const bought = readActiveRun().runDeck.at(-1)!;
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
    expect(doubled.descriptionLines[0]).toBe("Gain 8 Mana or gain 8 Gold or gain 8 Block");
    expect(doubled.effects[0]).toMatchObject({
      probability: 0.5,
      successEffects: [{ amount: 8 }],
      failureEffects: [{ probability: 0.5, successEffects: [{ amount: 8 }] }],
    });
  });

  it("Open Kitchen mixes once for free", () => {
    const actions = room("open-kitchen");
    actions.alchemist.initialize();
    expect(actions.alchemist.getMixPrice()).toBe(0);
    expect(actions.alchemist.mixPotions(0, 1)).not.toBeNull();
    expect(readRunProfile().gold).toBe(500);
    expect(actions.alchemist.mixPotions(0, 1)).toBeNull();
  });

  it("free Potion and Trinket refreshes keep their existing limits", () => {
    const actions = room("fresh-batch");
    actions.alchemist.initialize();
    expect(actions.alchemist.getRefreshPrice(1)).toBe(0);
    expect(actions.alchemist.refresh()).toBe(true);
    expect(actions.alchemist.refresh()).toBe(false);
    expect(readRunProfile().gold).toBe(500);
    setRunSession({ activeLabyrinthRewardModifiers: ["fresh-curios"] });
    actions.trinket.initialize();
    expect(actions.trinket.getRefreshPrice(1)).toBe(0);
    expect(actions.trinket.refresh()).toBe(true);
    expect(actions.trinket.refresh()).toBe(false);
    expect(readRunProfile().gold).toBe(500);
  });

  it("Happy Hour and Collector’s Favor charge discounted prices", () => {
    const actions = room("happy-hour");
    actions.alchemist.initialize();
    const potion = readRunSession().alchemistState.potions[0]!;
    expect(actions.alchemist.getPotionBuyPrice(potion)).toBe(15);
    expect(actions.alchemist.buyPotion(potion, shopItemSlotKey(potion.id, 0))).toBe(true);
    setRunSession({ activeLabyrinthRewardModifiers: ["collectors-favor"] });
    actions.trinket.initialize();
    const trinket = readRunSession().trinketShopState.trinkets[0]!;
    expect(actions.trinket.getBuyPrice(trinket)).toBe(75);
    expect(actions.trinket.buy(trinket, shopItemSlotKey(trinket.id, 0))).toBe(true);
    expect(readRunProfile().gold).toBe(410);
  });

  it.each(["bowyer", "armorer", "masterwork"] as const)("%s keeps all Gear offers eligible after a refresh", (id) => {
    const actions = room(id);
    actions.equipment.initialize();
    const verify = () => {
      const items = readRunSession().equipmentShopState.gear;
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
    actions.merchant.initialize();
    expect(actions.merchant.getCardBuyPrice(readRunSession().shopState.cards[0]!)).toBe(30);
  });
});
