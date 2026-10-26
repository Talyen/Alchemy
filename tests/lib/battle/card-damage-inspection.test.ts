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
  it.each([0, 9])("inlines the direct12Block grant without including %i existing Block or proc rewards", (block) => {
    const card = cardById.block!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      hand: [card],
      mana: 4,
      maxMana: 4,
      currentEnemy: enemyById["blood-countess"],
      playerHealth: 31,
      playerMaxHealth: 47,
      enemyHealth: 273,
      enemyMaxHealth: 528,
      turn: 15,
      appliesFightPacing: true,
      playerStatuses: { block, forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
      trinketEffects: { ironwoodBucklerThornsOnBlock: 3 },
      rng,
    });
    const before = JSON.stringify({ state, card });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Gain 12 Block"]);
    expect(JSON.stringify({ state, card })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    const played = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0);
    expect(played.state.playerStatuses.block).toBe(block + 12);
    expect(played.state.playerStatuses.thorns).toBe(3);
    expect(played.combatTexts).toContainEqual(
      expect.objectContaining({ stat: "block", amount: 12, feedback: "primary" }),
    );
  });

  it("adjusts Shield Bash's fixed Block without replacing its authored scaling rule", () => {
    const card = cardById["shield-bash"]!;
    const state = patchBattleState({
      playerStatuses: { block: 12, forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
    });
    const result = getBattleCardDescriptionInspection(card, state);
    expect(result.descriptionLines).toEqual(["Gain 9 Block", "Deal Stun damage equal to half your Block"]);
    expect(result.effects[1]).toEqual(card.effects[1]);
    expect(card.descriptionLines[0]).toBe("Gain 2 Block");
  });

  it("uses ordered production resource changes before a later fixed grant", () => {
    const card = effectsCard({
      id: "forge-then-block",
      art: "",
      effects: [
        { kind: "player-status", status: "forge", amount: 2 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
    });
    const state = patchBattleState({
      playerStatuses: { forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
      gearEffects: { flatBlockGained: 2 },
    });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Gain 2 Forge", "Gain 13 Block"]);
  });

  it("previews adjusted healing power before its Health cap, excluding larger overheal conversions and Consume procs", () => {
    const card = cardById["health-potion"]!;
    const rng = vi.fn(() => {
      throw new Error("live RNG consumed");
    });
    const state = patchBattleState({
      hand: [card],
      playerHealth: 49,
      playerMaxHealth: 50,
      talentEffects: { potionPotency: 2, healMultiplier: 1.5, overhealToBlockRatio: 1, healOnConsume: 7 },
      gearEffects: { flatBlockGained: 2 },
      rng,
    });
    const before = JSON.stringify({ card, state });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(["Restore 24 Health", "Consume"]);
    expect(JSON.stringify({ card, state })).toBe(before);
    expect(rng).not.toHaveBeenCalled();
    const played = playBattleCardResolved({ ...state, rng: () => 0.99 }, card.id, 0);
    expect(played.state.playerHealth).toBe(50);
    expect(played.state.playerStatuses.block).toBe(25);
    expect(played.combatTexts).toContainEqual(
      expect.objectContaining({ kind: "heal", amount: 24, feedback: "primary" }),
    );
  });

  it("inlines deterministic Mana and Gold grants without including their separate healing rewards", () => {
    const mana = cardById["mana-potion"]!;
    const state = patchBattleState({
      hand: [mana],
      mana: 1,
      maxMana: 10,
      talentEffects: { potionPotency: 2, healthPerMana: 3 },
      gearEffects: { blockOnManaRestoreWithoutBlock: 5 },
    });
    expect(getBattleCardDescriptionInspection(mana, state).descriptionLines).toEqual(["Gain 4 Mana", "Consume"]);
    const gold = effectsCard({ id: "gold-grant", art: "", effects: [{ kind: "gain-gold", amount: 5 }] });
    expect(
      getBattleCardDescriptionInspection(
        gold,
        patchBattleState({ gearEffects: { goldGainPercent: 20, healOnCombatGoldGain: 7 } }),
      ).descriptionLines,
    ).toEqual(["Gain 6 Gold"]);
  });

  it("uses known Armor and Forge bonuses without promising random extra grants", () => {
    const armor = cardById["stoneskin-potion"]!;
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 50,
      talentEffects: { potionPotency: 2, armorLowHealthBonusPercent: 50 },
      gearEffects: { flatArmorGained: 2 },
    });
    expect(getBattleCardDescriptionInspection(armor, state).descriptionLines).toEqual(["Gain 15 Armor", "Consume"]);
    expect(
      getBattleCardDescriptionInspection(armor, {
        ...state,
        talentEffects: { ...state.talentEffects, armorDoubleChance: 25 },
      }).descriptionLines,
    ).toEqual(["Gain 15 Armor", "Consume"]);
    const forge = cardById.anvil!;
    expect(
      getBattleCardDescriptionInspection(
        forge,
        patchBattleState({ talentEffects: { forgeBonusChance: 100 }, gearEffects: { blockOnForgeGain: 9 } }),
      ).descriptionLines,
    ).toEqual(["Gain 3 Forge"]);
  });

  it.each([
    { kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 },
    { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 2 },
    { kind: "player-status", status: "haste", amount: 1 },
  ] satisfies BattleCardEffect[])("keeps the authored $status formula or duration", (effect) => {
    const card = effectsCard({ id: "utility-rule", art: "", effects: [effect] });
    const result = getBattleCardDescriptionInspection(
      card,
      patchBattleState({
        playerStatuses: { forge: 20 },
        talentEffects: { forgeBlockPercent: 25 },
        gearEffects: { flatBlockGained: 2 },
      }),
    );
    expect(result.descriptionLines).toEqual(card.descriptionLines);
    expect(result.effects).toEqual(card.effects);
  });

  it("retains an authored utility value when an earlier draw makes its result unknown", () => {
    const card = effectsCard({
      id: "draw-block",
      art: "",
      effects: [
        { kind: "draw-cards", amount: 1 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
    });
    const state = patchBattleState({
      deck: [makeTestCard()],
      playerStatuses: { forge: 20 },
      talentEffects: { forgeBlockPercent: 25 },
    });
    expect(getBattleCardDescriptionInspection(card, state).descriptionLines).toEqual(card.descriptionLines);
  });

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

  it("keeps authored numbers when an unresolved draw can change the attack", () => {
    const card = effectsCard({ id: "draw-attack", art: "", effects: [{ kind: "draw-cards", amount: 1 }, hit()] });
    const result = getBattleCardDescriptionInspection(card, patchBattleState({ deck: [makeTestCard()] }));
    expect(result.descriptionLines).toEqual(card.descriptionLines);
  });

  it("splits shared clauses when their known magnitudes differ while retaining every effect", () => {
    const ray = cardById["ray-of-frost"]!;
    expect(
      getBattleCardDescriptionInspection(ray, patchBattleState({ gearEffects: { flatFreezeDamage: 2 } }))
        .descriptionLines,
    ).toEqual(["Deal 3 Freeze damage twice"]);

    const doubleHit = effectsCard({ id: "double-hit", art: "", effects: [hit(4), hit(4)] });
    expect(
      getBattleCardDescriptionInspection(doubleHit, patchBattleState({ flags: { nextHitPhysicalBonus: 4 } }))
        .descriptionLines,
    ).toEqual(["Deal 8 Physical damage", "Deal 4 Physical damage"]);

    for (const id of ["earthquake", "blizzard"] as const) {
      const card = cardById[id]!;
      const result = getBattleCardDescriptionInspection(
        card,
        patchBattleState({ playerStatuses: { forge: 4 }, gearEffects: { flatFreezeDamage: 2 } }),
      );
      expect(result.descriptionLines).toEqual(
        id === "earthquake"
          ? ["Deal 6 Stun damage", "Deal 2 Stun damage next turn"]
          : ["Deal 4 Freeze damage", "Deal 2 Freeze damage next turn"],
      );
    }

    const dealAndReceive = effectsCard({
      id: "reckless",
      art: "",
      effects: [hit(3), { kind: "self-damage", damageType: "physical", amount: 3 }],
    });
    expect(
      getBattleCardDescriptionInspection(dealAndReceive, patchBattleState({ playerStatuses: { forge: 2 } }))
        .descriptionLines,
    ).toEqual(["Deal 5 Physical damage", "Take 3 Physical damage"]);
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
    for (const card of Object.values(cardById)) {
      expect(() => getBattleDamageInspectionCard(card, state), card.id).not.toThrow();
      expect(() => getBattleCardDescriptionInspection(card, state), card.id).not.toThrow();
    }
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
