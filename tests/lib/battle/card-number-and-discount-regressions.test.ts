import { describe, expect, it } from "vitest";
import { cardById, cardLibrary, BattleCardEffectSchema } from "@/lib/game-data";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { buildWishOptions } from "@/lib/battle/wish";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { patchBattleState } from "../../fixtures/battle";

describe("card number and discount regressions", () => {
  it.each(["quickdraw", "burn talent", "knight"] as const)(
    "a saved zero-cost card preserves the %s discount for the next paid card",
    (source) => {
      const card = cardById[source === "burn talent" ? "fireball" : "venom-arrow"]!;
      const free = { ...card, cost: 0, uid: 1 };
      const paid = { ...card, uid: 2 };
      const state = patchBattleState({
        rng: () => 0.99,
        hand: [free, paid],
        mana: 0,
        enemyHealth: 100,
        enemyMaxHealth: 100,
        encounterBenefits: source === "quickdraw" ? ["quickdraw"] : [],
        talentEffects: { firstBurnCardFree: source === "burn talent" },
        gearEffects: { blockReadiesFreePhysical: source === "knight" ? 1 : 0 },
        uniqueGear: { knightsAnswerReady: source === "knight" },
      });
      const first = playBattleCardResolved(state, free.id, 0).state;
      const second = playBattleCardResolved(first, paid.id, 0).state;
      expect(second.cardsPlayedThisTurn).toBe(2);
      expect(second.mana).toBe(0);
      expect(second.hand).toHaveLength(0);
    },
  );

  it.each(["maul"])("updates the pooled damage amount on %s", (id) => {
    const original = cardById[id]!;
    const target = getEditableCorruptionTargets(original)[0]!;
    const changed = applyNumericCorruption(original, target, 1);
    expect(changed.descriptionLines[0]).toContain("Deal 4 ");
    expect(changed.effects[0]).toMatchObject({
      kind: "damage",
      amount: 4,
      damageType: "bleed",
      damageTypePool: ["bleed", "stun"],
    });
    expect(original.effects[0]).toMatchObject({ amount: 3 });
    expect(changed.descriptionLines[0]).toBe("Deal 4 Bleed or Stun damage");
  });

  it("Powerful Wish upgrades Tithe's fixed damage and Gold values", () => {
    const state = patchBattleState({
      talentEffects: { wishCardsUpgraded: true, wishExtraChoices: cardLibrary.length },
      rng: () => 0.99,
    });
    const tithe = buildWishOptions(state, cardById.wish!).find((card) => card.id === "tithe")!;
    expect(tithe.descriptionLines).toEqual(["Deal 2 Holy damage", "Gain 2 Gold"]);
    expect(tithe.effects).toEqual([
      { kind: "damage", damageType: "holy", amount: 2 },
      { kind: "gain-gold", amount: 2 },
    ]);
    expect(tithe.effects.every((effect) => BattleCardEffectSchema.safeParse(effect).success)).toBe(true);
    const played = playBattleCardResolved(
      patchBattleState({ hand: [tithe], gold: 100, enemyHealth: 100, enemyMaxHealth: 100, rng: () => 0.99 }),
      tithe.id,
      0,
    ).state;
    expect(played.enemyHealth).toBe(98);
    expect(played.gold).toBe(102);
  });

  it("keeps a shared conditional number separate from an equal-valued added effect", () => {
    const original = cardById.maul!;
    const card = {
      ...original,
      descriptionLines: [...original.descriptionLines, "Gain 3 Gold"],
      effects: [...original.effects, { kind: "gain-gold" as const, amount: 3 }],
    };
    const targets = getEditableCorruptionTargets(card);
    expect(targets).toHaveLength(2);
    const changed = applyNumericCorruption(card, targets[1]!, 1);
    expect(changed.effects[0]).toEqual(original.effects[0]);
    expect(changed.effects[1]).toEqual({ kind: "gain-gold", amount: 4 });
    expect(changed.descriptionLines[1]).toBe("Gain 4 Gold");
  });

  it.each(["armed", "first", "encounter"])("applies the %s Archery discount to Sniff Out", (kind) => {
    const card = cardById["sniff-out"]!;
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      enemyHealth: 100,
      flags: { nextArcheryCardFree: kind === "armed" },
      talentEffects: { firstArcheryCardFree: kind === "first" },
      encounterBenefits: kind === "encounter" ? ["quickdraw"] : [],
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.exhausted.map((entry) => entry.id)).not.toContain(card.id);
    expect(result.mana).toBe(0);
    expect(result.enemyStatuses.bleed).toBe(1);
    expect(result.flags.nextArcheryCardFree).toBe(true);
    if (kind === "first") expect(result.flags.firstArcheryCardFreeUsed).toBe(true);
    if (kind === "encounter") expect(result.flags.encounterArcheryUsed).toBe(true);
  });

  it("Lingering Bell cannot extend an active Stun or pay Stun rewards again after Health falls", () => {
    const stunned = resolveStunTrigger(
      patchBattleState({
        enemyHealth: 40,
        enemyMaxHealth: 40,
        enemyStatuses: { stun: 20 },
        gearEffects: { retainStunBuildup: 1 },
        talentEffects: { manaOnStun: 1 },
        mana: 0,
      }),
    );
    const weakened = { ...stunned, enemyHealth: 8 };
    const result = resolveStunTrigger(weakened);
    expect(result.enemyCC).toEqual(stunned.enemyCC);
    expect(result.enemyStatuses.stun).toBe(5);
    expect(result.mana).toBe(stunned.mana);
  });
});
