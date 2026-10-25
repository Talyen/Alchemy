import { describe, expect, it, vi } from "vitest";
import { effectsCard } from "@/lib/game-data/cards/card-builders";
import { cardById, enemyById, getEnemyAbilities, getEnemyAbilityCard, type BattleCardEffect } from "@/lib/game-data";
import { getBattleDamageInspectionCard, getBattleCardDescriptionInspection } from "@/lib/battle/card-damage-inspection";
import type { CombatTextEvent } from "@/lib/battle";
import { battleSnapshot } from "@/lib/battle/battle-snapshot";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const hit = (amount = 6): BattleCardEffect => ({ kind: "damage", damageType: "physical", amount });

describe("rule-preserving tooltip inspection", () => {
  it.each([0, 6, 20])(
    "keeps Shield Bash's rule and separately previews its own Block gain at %i starting Block",
    (block) => {
      const card = cardById["shield-bash"]!;
      const rng = vi.fn(() => {
        throw new Error("live RNG consumed");
      });
      const state = patchBattleState({ hand: [card], mana: 3, playerStatuses: { block }, rng });
      const before = JSON.stringify({ card, state });
      const result = getBattleCardDescriptionInspection(card, state);
      expect(result.card).toBe(card);
      expect(result.card.descriptionLines).toEqual(["Gain 2 Block", "Deal Stun damage equal to half your Block"]);
      expect(result.attackPreview?.lineIndices).toEqual([1]);
      expect(result.attackPreview?.card.descriptionLines[1]).toBe(`Deal ${Math.round((block + 2) / 2)} Stun damage`);
      expect(JSON.stringify({ card, state })).toBe(before);
      expect(rng).not.toHaveBeenCalled();
    },
  );

  it("includes known bonuses but excludes enemy defenses, Dodge and Critical outcomes from the preview", () => {
    const card = cardById["shield-bash"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      hand: [card],
      mana: 3,
      currentEnemy: enemyById["will-o-wisp"],
      playerStatuses: { block: 6, forge: 3 },
      enemyMitigation: { block: 50, armor: 20 },
      flags: { nextHitCrit: true },
      rng,
    });
    const result = getBattleCardDescriptionInspection(card, state);
    expect(result.card.effects).toBe(card.effects);
    expect(result.card.descriptionLines[1]).toContain("half your Block");
    expect(result.attackPreview?.card.descriptionLines[1]).toBe("Deal 7 Stun damage");
    expect(state.flags.nextHitCrit).toBe(true);
    expect(state.enemyMitigation).toMatchObject({ block: 50, armor: 20 });
    expect(rng).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "damage", damageType: "physical", amount: 0, equalToArmor: true },
    { kind: "damage", damageType: "stun", amount: 3, forgeBonusPercent: 50 },
    { kind: "damage", damageType: "physical", amount: 3, damageTypeIfTargetFrozen: "freeze", amountIfTargetFrozen: 8 },
  ] as const)("retains the complete $damageType scaling/conditional rule", (effect) => {
    const card = effectsCard({ id: "formula", art: "", effects: [effect] });
    const result = getBattleCardDescriptionInspection(
      card,
      patchBattleState({ playerStatuses: { armor: 8, forge: 6 }, enemyCC: { freezeSkipTurns: 1 } }),
    );
    expect(result.card.descriptionLines).toEqual(card.descriptionLines);
    expect(result.card.effects[0]).toEqual(effect);
    expect(result.attackPreview?.card.descriptionLines).not.toEqual(card.descriptionLines);
  });

  it("does not add a redundant preview to an unchanged attack", () => {
    const card = effectsCard({ id: "plain", art: "", effects: [hit()] });
    expect(getBattleCardDescriptionInspection(card, patchBattleState())).toEqual({ card });
  });

  it("preserves rules without inventing a preview when an unknown draw can change the attack", () => {
    const card = effectsCard({ id: "draw-attack", art: "", effects: [{ kind: "draw-cards", amount: 1 }, hit()] });
    const state = patchBattleState({ deck: [makeTestCard()] });
    const result = getBattleCardDescriptionInspection(card, state);
    expect(result.card).toBe(card);
    expect(result.attackPreview).toBeUndefined();
  });
});

describe("battle damage inspection", () => {
  it("shows offensive power before defenses and crits without consuming state or RNG", () => {
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
    const before = JSON.stringify({ state, card });
    expect(getBattleDamageInspectionCard(card, state).descriptionLines).toEqual(["Deal 15 Physical damage"]);
    expect(getBattleDamageInspectionCard(card, state).descriptionLines).toEqual(["Deal 15 Physical damage"]);
    expect(rng).not.toHaveBeenCalled();
    expect(JSON.stringify({ state, card })).toBe(before);
  });

  it("uses prepared poison's damage type and bonuses, preserving the real preparation", () => {
    const state = patchBattleState({
      flags: { nextHitPoison: true },
      playerStatuses: { forge: 10 },
      gearEffects: { flatPoisonDamage: 2 },
    });
    expect(
      getBattleDamageInspectionCard(makeTestCard({ effects: [hit()] }), battleSnapshot(state)).descriptionLines,
    ).toEqual(["Deal 8 Poison damage"]);
    expect(state.flags.nextHitPoison).toBe(true);
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
  ])("matches actual noncritical damage for %s with resource bonuses and pacing", (id) => {
    const card = cardById[id]!;
    expect(card).toBeDefined();
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
    const preview = getBattleDamageInspectionCard(card, battleSnapshot(state));
    const projected = preview.effects.filter((effect) => effect.kind === "damage").map((effect) => effect.amount);
    const result = playBattleCardResolved(state, card.id, 0);
    const damage = result.combatTexts
      .filter(
        (text) => text.target === "enemy" && text.kind === "damage" && text.stat !== "armor" && text.stat !== "block",
      )
      .map((text) => ("amount" in text ? text.amount : 0));
    expect(
      projected.reduce((a, b) => a + b, 0),
      JSON.stringify({ preview: preview.effects, texts: result.combatTexts }),
    ).toEqual(damage.reduce((a, b) => a + b, 0));
  });

  it("separates repeated hits when a prepared bonus applies only once", () => {
    const state = patchBattleState({ flags: { nextHitPhysicalBonus: 4 } });
    const card = makeTestCard({ effects: [hit(), hit()] });
    expect(getBattleDamageInspectionCard(card, state).descriptionLines).toEqual([
      "Deal 10 Physical damage",
      "Deal 6 Physical damage",
    ]);
  });

  it("does not invent negative Block when inspecting an unaffordable Freeze card", () => {
    const card = makeTestCard({
      cost: 2,
      effects: [{ kind: "damage", damageType: "freeze", amount: 1 }, hit()],
    });
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      playerStatuses: { block: 1 },
      gearEffects: { blockPaysFreezeMana: 1 },
      talentEffects: { blockToPhysicalDamageMultiplier: 1 },
    });
    expect(getBattleDamageInspectionCard(card, state).descriptionLines).toEqual([
      "Deal 1 Freeze damage",
      "Deal 6 Physical damage",
    ]);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(state.playerStatuses.block).toBe(1);
  });

  it("resolves current conditional damage and keeps random alternatives as a range", () => {
    const state = patchBattleState({ playerStatuses: { forge: 4 }, enemyCC: { freezeSkipTurns: 1 } });
    const card = makeTestCard({
      effects: [
        {
          kind: "damage",
          damageType: "physical",
          amount: 3,
          damageTypeIfTargetFrozen: "freeze",
          amountIfTargetFrozen: 8,
        },
        { kind: "random-damage", minAmount: 2, maxAmount: 5, damageTypePool: ["physical", "poison"] },
      ],
    });
    expect(getBattleDamageInspectionCard(card, state).descriptionLines).toEqual([
      "Deal 8 Freeze damage",
      "Deal 2–9 Physical, or Poison damage",
    ]);
  });

  it("adjusts both chance branches without choosing one or changing utility descriptions", () => {
    const state = patchBattleState({ playerStatuses: { forge: 3 } });
    const card = makeTestCard({
      effects: [
        { kind: "chance", probability: 0.5, successEffects: [hit()], failureEffects: [{ kind: "heal", amount: 2 }] },
      ],
    });
    expect(getBattleDamageInspectionCard(card, state).descriptionLines).toEqual([
      "50% chance: Deal 9 Physical damage",
      "Otherwise: Restore 2 Health",
    ]);
    const utility = makeTestCard({ effects: [], descriptionLines: ["Custom utility text"] });
    expect(getBattleDamageInspectionCard(utility, state)).toBe(utility);
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
        const preview = getBattleDamageInspectionCard(card, battleSnapshot(state), "enemy");
        const projected = preview.effects.filter((effect) => effect.kind === "damage").map((effect) => effect.amount);
        const texts: CombatTextEvent[] = [];
        const result = applyEnemyAbility(state, card, texts);
        expect(
          state.playerHealth - result.playerHealth,
          JSON.stringify({ card, preview: preview.effects, texts }),
        ).toBe(projected.reduce((a, b) => a + b, 0));
      }
    },
  );

  it("spends a known preparation once across random damage without selecting an outcome", () => {
    const state = patchBattleState({
      flags: { nextHitPoison: true },
      playerStatuses: { forge: 4 },
      gearEffects: { flatPoisonDamage: 2 },
    });
    const card = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: ["physical", "poison"] }, hit()],
    });
    expect(getBattleDamageInspectionCard(card, state).descriptionLines).toEqual([
      "Deal 3–5 Poison damage",
      "Deal 10 Physical damage",
    ]);
    const zero = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0 }, hit()] });
    expect(
      getBattleDamageInspectionCard(zero, patchBattleState({ flags: { nextHitPoison: true } })).descriptionLines,
    ).toEqual(["Deal 0 Poison damage", "Deal 6 Poison damage"]);
    expect(state.flags.nextHitPoison).toBe(true);
  });

  it("applies Bandit's opening bonus to the first packet rather than every hit", () => {
    const state = patchBattleState({ currentEnemy: enemyById.bandit });
    const card = { ...getEnemyAbilityCard("slash"), effects: [hit(4), hit(4)] };
    expect(getBattleDamageInspectionCard(card, state, "enemy").descriptionLines).toEqual([
      "Deal 10 Physical damage",
      "Deal 5 Physical damage",
    ]);
    expect(state.flags.enemyFirstHitDoubleUsed).toBe(false);
  });

  it("shows Exorcism's current conversion damage while preserving its self cost and cleanse", () => {
    const state = patchBattleState({ playerStatuses: { burn: 4 }, playerHealth: 30, playerMaxHealth: 30 });
    const preview = getBattleDamageInspectionCard(cardById.exorcism!, state);
    expect(preview.descriptionLines).toEqual(["Take 1 Burn damage", "Cleanse Burn", "Deal 5 Holy damage"]);
    expect(state.playerStatuses.burn).toBe(4);
  });

  it("inspects the catalog without rolling RNG or modifying its definitions", () => {
    const state = battleSnapshot(
      patchBattleState({ playerStatuses: { forge: 4, block: 6, armor: 3 }, mana: 7, maxMana: 7 }),
    );
    const before = JSON.stringify(cardById);
    for (const card of Object.values(cardById))
      expect(() => getBattleDamageInspectionCard(card, state), card.id).not.toThrow();
    expect(JSON.stringify(cardById)).toBe(before);
  });

  it("includes flat Glacial Surge and ignores the hero's mitigation", () => {
    const state = patchBattleState({
      currentEnemy: enemyById.frostwarden,
      playerStatuses: { block: 50, armor: 50 },
      gearEffects: { resistFreeze: 100 },
    });
    const card = getEnemyAbilityCard("frostbolt");
    const base = getBattleDamageInspectionCard(
      card,
      { ...state, currentEnemy: { ...state.currentEnemy, traits: [] } },
      "enemy",
    );
    const frost = getBattleDamageInspectionCard(card, state, "enemy");
    expect(frost.effects[0]).toMatchObject({ amount: (base.effects[0] as { amount: number }).amount + 1 });
  });

  it("projects guaranteed hit reactions, Opening follow-ups, and target defeat across multi-packet cards", () => {
    const fireball = cardById.fireball!;
    const openingState = patchBattleState({
      hand: [fireball],
      rng: () => 0.99,
      flags: { nextHitPhysicalBonus: 4 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
    });
    expect(getBattleDamageInspectionCard(fireball, openingState).effects).toEqual([
      { kind: "damage", damageType: "burn", amount: 2 },
      { kind: "damage", damageType: "physical", amount: 4 },
    ]);
    expect(playBattleCardResolved(openingState, fireball.id, 0).state.enemyHealth).toBe(94);

    // Guaranteed Emberforged Forge and Elemental Mana on an opening Burn hit scale subsequent packets.
    const burnThenFollowUps = makeTestCard({
      effects: [
        { kind: "damage", damageType: "burn", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "burn", amount: 2 },
      ],
    });
    const emberState = patchBattleState({
      hand: [burnThenFollowUps],
      rng: () => 0.99,
      mana: 1,
      maxMana: 4,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      gearEffects: { forgeOnBurnVsUnburnedChances: [100], elementalDamageManaChance: 100 },
      talentEffects: { burnDamagePerMana: 100 },
    });
    const emberPreview = getBattleDamageInspectionCard(burnThenFollowUps, emberState);
    const emberPlayed = playBattleCardResolved(emberState, burnThenFollowUps.id, 0);
    expect(emberPreview.effects).toEqual([
      { kind: "damage", damageType: "burn", amount: 2 },
      { kind: "damage", damageType: "physical", amount: 3 },
      { kind: "damage", damageType: "burn", amount: 3 },
    ]);
    expect(emberPlayed.state.enemyHealth).toBe(92);

    // Frostfire reaction killing the target zeroes out later packets.
    const ray = cardById["ray-of-frost"]!;
    const frostfireState = patchBattleState({
      hand: [ray],
      rng: () => 0.99,
      enemyHealth: 2,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 1, freeze: 1 },
    });
    expect(getBattleDamageInspectionCard(ray, frostfireState).effects).toMatchObject([{ amount: 1 }, { amount: 0 }]);
    expect(playBattleCardResolved(frostfireState, ray.id, 0).state.enemyHealth).toBe(0);

    // Detonation consumes existing buildup even when Block absorbs the direct hit.
    for (const [id, status, detonateFlag] of [
      ["combustion", "burn", { detonateAllBurn: true }],
      ["hemorrhage", "bleed", { detonateAllBleed: true }],
    ] as const) {
      const detonateCard = makeTestCard({
        id,
        effects: [
          { kind: "damage", damageType: status, amount: 2, ...detonateFlag },
          { kind: "damage", damageType: "poison", amount: 3 },
        ],
      });
      const detonateState = patchBattleState({
        hand: [detonateCard],
        rng: () => 0.99,
        enemyHealth: 3,
        enemyMaxHealth: 100,
        enemyMitigation: { block: 10 },
        enemyStatuses: { [status]: 4 },
      });
      expect(getBattleDamageInspectionCard(detonateCard, detonateState).effects).toMatchObject([
        { amount: 2 },
        { amount: 0 },
      ]);
      expect(playBattleCardResolved(detonateState, detonateCard.id, 0).state.enemyHealth).toBe(0);
    }
  });
});
