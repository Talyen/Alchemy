import { describe, expect, it, vi } from "vitest";
import { effectsCard } from "@/lib/game-data/cards/card-builders";
import {
  cardById,
  enemyById,
  getCardDescription,
  getEnemyAbilities,
  getEnemyAbilityCard,
  withCardDescription,
  type BattleCardEffect,
} from "@/lib/game-data";
import { getBattleCardDescriptionInspection } from "@/lib/battle/card-damage-inspection";
import type { CombatTextEvent } from "@/lib/battle";
import { battleSnapshot } from "@/lib/battle/battle-snapshot";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";
import { inspectedAttackAmounts } from "../../fixtures/inspection";

const hit = (amount = 6): BattleCardEffect => ({ kind: "damage", damageType: "physical", amount });

describe("rule-preserving tooltip inspection", () => {
  it.each([0, 6, 20])("keeps Shield Bash's scaling rule at %i starting Block", (block) => {
    const card = cardById["shield-bash"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({ hand: [card], mana: 3, playerStatuses: { block }, rng });
    const before = JSON.stringify({ card, state });
    const result = getBattleCardDescriptionInspection(card, state);
    expect(result.descriptionLines).toEqual(["Gain 2 Block", "Deal Stun damage equal to half your Block"]);
    expect(result.effects).toEqual(card.effects);
    expect(JSON.stringify({ card, state })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
  });

  it("adjusts known gear and talent bonuses inside the original fixed-damage sentence", () => {
    const card = effectsCard({ id: "plain", art: "", effects: [hit(3)] });
    const state = patchBattleState({
      gearEffects: { flatPhysicalDamage: 1 },
      talentEffects: { flatPhysicalDamage: 1 },
    });
    expect(card.descriptionLines).toEqual(["Deal 3 Physical damage"]);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Deal 5 Physical damage"]);
    expect(card.effects).toEqual([hit(3)]);
  });

  it("excludes enemy defenses, Dodge and Critical outcomes from fixed attack numbers", () => {
    const card = effectsCard({ id: "plain", art: "", effects: [hit(3)] });
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      currentEnemy: enemyById["will-o-wisp"],
      gearEffects: { flatPhysicalDamage: 1 },
      talentEffects: { flatPhysicalDamage: 1 },
      enemyMitigation: { block: 50, armor: 20 },
      flags: { nextHitCrit: true },
      rng,
    });
    const before = JSON.stringify(state);
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Deal 5 Physical damage"]);
    expect(JSON.stringify(state)).toBe(before);
    expect(rng).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "damage", damageType: "physical", amount: 0, equalToArmor: true },
    { kind: "damage", damageType: "stun", amount: 3, forgeBonusPercent: 50 },
    { kind: "damage", damageType: "physical", amount: 3, damageTypeIfTargetFrozen: "freeze", amountIfTargetFrozen: 8 },
    { kind: "damage", damageType: "physical", amount: 3, doubleIfEnemyBleeding: true },
    { kind: "damage", damageType: "burn", amount: 3, tripleIfEnemyNotBurning: true },
  ] as const)("retains the complete $damageType scaling/conditional rule", (effect) => {
    const card = effectsCard({ id: "formula", art: "", effects: [effect] });
    const result = getBattleCardDescriptionInspection(
      card,
      patchBattleState({
        playerStatuses: { armor: 8, forge: 6 },
        enemyCC: { freezeSkipTurns: 1 },
        enemyStatuses: { bleed: 2 },
      }),
    );
    expect(result.descriptionLines).toEqual(card.descriptionLines);
    expect(result.effects[0]).toEqual(effect);
  });

  it("does not append triggered follow-ups or duplicate the original effect sentence", () => {
    const card = cardById.fireball!;
    const result = getBattleCardDescriptionInspection(card, patchBattleState({ flags: { nextHitPhysicalBonus: 4 } }));
    expect(result.descriptionLines).toEqual(card.descriptionLines);
    expect(result.effects).toEqual(card.effects);
  });

  it.each(["corrupted", "distilled"] as const)("retains %s marks when a known number changes", (mark) => {
    const card = effectsCard({ id: "marked", art: "", effects: [hit(3)] });
    const marked = withCardDescription(
      card,
      getCardDescription(card).map((line) => ({
        ...line,
        parts: line.parts.map((part) => (typeof part === "string" ? part : { ...part, [mark]: true })),
      })),
    );
    const result = getBattleCardDescriptionInspection(
      marked,
      patchBattleState({ gearEffects: { flatPhysicalDamage: 2 } }),
    );
    expect(result.descriptionLines).toEqual(["Deal 5 Physical damage"]);
    expect(result.description![0]!.parts).toContainEqual(expect.objectContaining({ [mark]: true }));
  });

  it("keeps authored numbers when an unresolved draw can change the attack", () => {
    const card = effectsCard({ id: "draw-attack", art: "", effects: [{ kind: "draw-cards", amount: 1 }, hit()] });
    const result = getBattleCardDescriptionInspection(card, patchBattleState({ deck: [makeTestCard()] }));
    expect(result.descriptionLines).toEqual(card.descriptionLines);
  });

  it("inlines shared magnitudes only when every referenced effect resolves to the same value", () => {
    const ray = cardById["ray-of-frost"]!;
    expect(
      getBattleCardDescriptionInspection(ray, patchBattleState({ gearEffects: { flatFreezeDamage: 2 } }))
        .descriptionLines,
    ).toEqual(["Deal 3 Freeze damage twice"]);

    const doubleHit = effectsCard({ id: "double-hit", art: "", effects: [hit(4), hit(4)] });
    expect(
      getBattleCardDescriptionInspection(doubleHit, patchBattleState({ flags: { nextHitPhysicalBonus: 4 } }))
        .descriptionLines,
    ).toEqual(["Deal 4 Physical damage twice"]);

    for (const id of ["earthquake", "blizzard"] as const) {
      const card = cardById[id]!;
      const result = getBattleCardDescriptionInspection(
        card,
        patchBattleState({ playerStatuses: { forge: 4 }, gearEffects: { flatFreezeDamage: 2 } }),
      );
      expect(result.descriptionLines).toEqual(card.descriptionLines);
      expect(result.effects).toEqual(card.effects);
    }

    const dealAndReceive = effectsCard({
      id: "reckless",
      art: "",
      effects: [hit(3), { kind: "self-damage", damageType: "physical", amount: 3 }],
    });
    expect(
      getBattleCardDescriptionInspection(dealAndReceive, patchBattleState({ playerStatuses: { forge: 2 } }))
        .descriptionLines,
    ).toEqual(["Deal and Receive 3 Physical damage"]);
  });
});

describe("inspection observations", () => {
  it("observes prepared attacks before defenses without consuming live RNG", () => {
    const rng = vi.fn(() => {
      throw new Error("inspection rolled");
    });
    const state = patchBattleState({
      rng,
      currentEnemy: enemyById["will-o-wisp"],
      playerStatuses: { forge: 3 },
      gearEffects: { flatPhysicalDamage: 2 },
      flags: { nextHitPhysicalBonus: 4, nextHitCrit: true },
      enemyMitigation: { block: 50, armor: 20 },
    });
    const card = makeTestCard({ effects: [hit()] });
    const before = JSON.stringify({ card, state });
    expect(inspectedAttackAmounts(card, state)).toEqual([15]);
    expect(inspectedAttackAmounts(card, state)).toEqual([15]);
    expect(rng).not.toHaveBeenCalled();
    expect(JSON.stringify({ card, state })).toBe(before);
  });

  it.each([
    "frostbolt",
    "blessed-aegis",
    "burning-blade",
    "ray-of-frost",
    "fireball",
    "stab",
    "sunburst",
    "holy-radiance",
    "acid-potion",
  ])("matches live noncritical packets for %s with resource bonuses and pacing", (id) => {
    const card = cardById[id]!;
    const state = patchBattleState({
      rng: () => 0.99,
      currentEnemy: { ...enemyById["blood-countess"], traits: [] },
      enemyHealth: 999,
      enemyMaxHealth: 999,
      playerHealth: 100,
      playerMaxHealth: 100,
      mana: 8,
      maxMana: 8,
      hand: [card],
      appliesFightPacing: true,
      turn: 13,
      playerStatuses: { forge: 3, block: 5 },
      talentEffects: { freezeDamagePerMana: 100 },
    });
    const amounts = inspectedAttackAmounts(card, state);
    const result = playBattleCardResolved(state, card.id, 0);
    const damage = result.combatTexts
      .filter(
        (text) => text.target === "enemy" && text.kind === "damage" && text.stat !== "armor" && text.stat !== "block",
      )
      .reduce((sum, text) => sum + ("amount" in text ? text.amount : 0), 0);
    expect(amounts.reduce<number>((sum, amount) => sum + (typeof amount === "number" ? amount : 0), 0)).toBe(damage);
  });

  it("tracks preparations and random alternatives without selecting an outcome", () => {
    const state = patchBattleState({
      flags: { nextHitPoison: true },
      playerStatuses: { forge: 4 },
      gearEffects: { flatPoisonDamage: 2 },
    });
    const card = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: ["physical", "poison"] }, hit()],
    });
    expect(inspectedAttackAmounts(card, state)).toEqual([[3, 5], 10]);
    expect(state.flags.nextHitPoison).toBe(true);
  });

  it("does not spend unavailable Block when inspecting an unaffordable card", () => {
    const card = makeTestCard({ cost: 2, effects: [{ kind: "damage", damageType: "freeze", amount: 1 }, hit()] });
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      playerStatuses: { block: 1 },
      gearEffects: { blockPaysFreezeMana: 1 },
      talentEffects: { blockToPhysicalDamageMultiplier: 1 },
    });
    expect(inspectedAttackAmounts(card, state)).toEqual([1, 6]);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(state.playerStatuses.block).toBe(1);
  });

  it("includes Glacial Surge before hero defenses and spends Bandit's bonus once", () => {
    const state = patchBattleState({
      currentEnemy: enemyById.frostwarden,
      playerStatuses: { block: 50, armor: 50 },
      gearEffects: { resistFreeze: 100 },
    });
    const frost = getEnemyAbilityCard("frostbolt");
    const base = inspectedAttackAmounts(
      frost,
      { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
      "enemy",
    );
    const boosted = inspectedAttackAmounts(frost, state, "enemy");
    expect(boosted[0]).toBe((base[0] as number) + 1);
    const bandit = patchBattleState({ currentEnemy: enemyById.bandit });
    const double = { ...getEnemyAbilityCard("slash"), effects: [hit(4), hit(4)] };
    expect(inspectedAttackAmounts(double, bandit, "enemy")).toEqual([10, 5]);
    expect(bandit.flags.enemyFirstHitDoubleUsed).toBe(false);
  });

  it.each(["frostwarden", "dire-wolf", "stone-golem", "bandit", "hellhound"])(
    "matches %s's live offensive stage without borrowing hero bonuses",
    (id) => {
      const enemy = enemyById[id]!;
      for (const card of getEnemyAbilities(enemy)) {
        if (
          card.effects.some((effect) => effect.kind === "chance" || (effect.kind === "damage" && effect.damageTypePool))
        )
          continue;
        const state = patchBattleState({
          rng: () => 0.99,
          currentEnemy: enemy,
          enemyHealth: 999,
          enemyMaxHealth: 999,
          playerHealth: 999,
          playerMaxHealth: 999,
          roomScalingMultiplier: 2.2,
          playerStatuses: { burn: 2, bleed: 2, forge: 90 },
          enemyMitigation: { forge: 3, block: 8 },
          appliesFightPacing: true,
          turn: 13,
          gearEffects: { flatPhysicalDamage: 90, flatFreezeDamage: 90 },
        });
        const amounts = inspectedAttackAmounts(card, state, "enemy");
        const texts: CombatTextEvent[] = [];
        const result = applyEnemyAbility(state, card, texts);
        expect(state.playerHealth - result.playerHealth, JSON.stringify({ card, texts })).toBe(
          amounts.reduce<number>((sum, amount) => sum + (typeof amount === "number" ? amount : 0), 0),
        );
      }
    },
  );

  it("inspects the catalog without modifying definitions", () => {
    const state = battleSnapshot(
      patchBattleState({ playerStatuses: { forge: 4, block: 6, armor: 3 }, mana: 7, maxMana: 7 }),
    );
    const before = JSON.stringify(cardById);
    for (const card of Object.values(cardById)) {
      expect(() => getBattleCardDescriptionInspection(card, state), card.id).not.toThrow();
    }
    expect(JSON.stringify(cardById)).toBe(before);
  });
});
