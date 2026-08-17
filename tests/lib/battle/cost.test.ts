import { describe, expect, it } from "vitest";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { FREE_CARD_SENTINEL } from "@/lib/game-constants";
import { defaultBattleState, defaultTalentEffects } from "@/lib/battle";
import type { BattleState, CombatFlags } from "@/lib/battle/types";
import type { BattleCard } from "@/lib/game-data";

function makeState(flags: Partial<CombatFlags> = {}, talentOverrides: Record<string, unknown> = {}): BattleState {
  return {
    ...defaultBattleState(),
    mana: 5,
    maxMana: 5,
    flags: { ...defaultBattleState().flags, ...flags },
    talentEffects: { ...defaultTalentEffects, ...talentOverrides },
  };
}

function physicalCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test",
    title: "Test",
    descriptionLines: [""],
    art: "",
    cost: 2,
    effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    ...overrides,
  };
}

function holyCard(): BattleCard {
  return {
    id: "holy",
    title: "Holy",
    descriptionLines: [""],
    art: "",
    cost: 2,
    effects: [{ kind: "damage", damageType: "holy", amount: 5 }],
  };
}

function poisonCard(): BattleCard {
  return {
    id: "poison",
    title: "Poison",
    descriptionLines: [""],
    art: "",
    cost: 2,
    effects: [{ kind: "damage", damageType: "poison", amount: 2 }],
  };
}

function bleedCard(): BattleCard {
  return {
    id: "bleed",
    title: "Bleed",
    descriptionLines: [""],
    art: "",
    cost: 2,
    effects: [{ kind: "damage", damageType: "bleed", amount: 2 }],
  };
}

function effectiveCost(
  state: Pick<BattleState, "flags" | "talentEffects" | "trinketEffects">,
  card: BattleCard,
): number {
  return computeEffectiveCost(state, card).effectiveCost;
}

describe("computeEffectiveCost", () => {
  it("returns base cost when no modifiers active", () => {
    const state = makeState();
    expect(effectiveCost(state, physicalCard())).toBe(2);
  });

  it("reduces cost by nextCardCostReduction", () => {
    const state = makeState({ nextCardCostReduction: 1 });
    expect(effectiveCost(state, physicalCard())).toBe(1);
  });

  it("does not reduce cost below 0 with nextCardCostReduction", () => {
    const state = makeState({ nextCardCostReduction: 5 });
    expect(effectiveCost(state, physicalCard())).toBe(0);
  });

  it("makes first physical card free when talent is active and flag not used", () => {
    const state = makeState({ firstPhysicalCardFreeUsed: false }, { firstPhysicalCardFree: true });
    expect(effectiveCost(state, physicalCard())).toBe(0);
  });

  it("does not make non-first physical card free when flag is already used", () => {
    const state = makeState({ firstPhysicalCardFreeUsed: true }, { firstPhysicalCardFree: true });
    expect(effectiveCost(state, physicalCard())).toBe(2);
  });

  it("makes first holy card free when talent is active", () => {
    const state = makeState({ firstHolyCardFreeUsed: false }, { firstHolyCardFree: true });
    expect(effectiveCost(state, holyCard())).toBe(0);
  });

  it("makes first poison card free when talent is active", () => {
    const state = makeState({ firstPoisonCardFreeUsed: false }, { firstPoisonCardFree: true });
    expect(effectiveCost(state, poisonCard())).toBe(0);
  });

  it("makes first bleed card free when talent is active", () => {
    const state = makeState({ firstBleedCardFreeUsed: false }, { firstBleedCardFree: true });
    expect(effectiveCost(state, bleedCard())).toBe(0);
  });

  it("makes first companion card free when talent is active", () => {
    const state = makeState({ firstCompanionCardFreeUsed: false }, { firstCompanionCardFree: true });
    const card = physicalCard({
      id: "wolf-companion",
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    expect(effectiveCost(state, card)).toBe(0);
  });

  it("makes first archery card free when talent is active", () => {
    const state = makeState({ firstArcheryCardFreeUsed: false }, { firstArcheryCardFree: true });
    expect(effectiveCost(state, physicalCard({ tags: ["archery"] }))).toBe(0);
  });

  it("does not make a card free if it lacks the matching damage type", () => {
    const state = makeState({}, { firstPhysicalCardFree: true, firstHolyCardFree: true });
    const card = { ...physicalCard(), effects: [{ kind: "heal" as const, amount: 5 }] };
    expect(effectiveCost(state, card)).toBe(2);
  });

  it("honors nextCardCostReduction even when first-card-free is already used", () => {
    const state = makeState(
      { firstPhysicalCardFreeUsed: true, nextCardCostReduction: 1 },
      { firstPhysicalCardFree: true },
    );
    expect(effectiveCost(state, physicalCard())).toBe(1);
  });

  it("stacks nextCardCostReduction with first-card-free (free wins)", () => {
    const state = makeState(
      { firstPhysicalCardFreeUsed: false, nextCardCostReduction: 1 },
      { firstPhysicalCardFree: true },
    );
    expect(effectiveCost(state, physicalCard())).toBe(0);
  });

  it("returns 0 and no consumed flags when FREE_CARD_SENTINEL is set", () => {
    const state = makeState({ nextCardCostReduction: FREE_CARD_SENTINEL });
    const { effectiveCost: cost, consumedFlags } = computeEffectiveCost(state, physicalCard());
    expect(cost).toBe(0);
    expect(consumedFlags.size).toBe(0);
  });

  it("consumes firstPhysicalCardFreeUsed when first physical card is free", () => {
    const state = makeState({ firstPhysicalCardFreeUsed: false }, { firstPhysicalCardFree: true });
    const { effectiveCost: cost, consumedFlags } = computeEffectiveCost(state, physicalCard());
    expect(cost).toBe(0);
    expect(consumedFlags.has("firstPhysicalCardFreeUsed")).toBe(true);
  });
});
