import { describe, expect, it } from "vitest";
import { tickEnemyStatuses, tickPlayerStatuses } from "@/lib/battle/status-ticks";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultTalentEffects,
  defaultCcState,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, makeTestBattleState, patchBattleState } from "../../fixtures/battle";

describe("tickEnemyStatuses", () => {
  it("deals burn damage and halves burn stack", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(20);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 10 });
  });

  it("fully clears enemy burn at 1 stack", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ burn: 1 }),
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(29);
    expect(next.enemyStatuses.burn).toBe(0);
  });

  it("deals poison damage and decays poison by 20% (minimum 1)", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ poison: 8 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.enemyStatuses.poison).toBe(6);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 8 });
  });

  it("deals bleed damage equal to stack and resets bleed to 0", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(24);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 6 });
  });

  it("heals player from pending bleed leech healing", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      pendingBleedLeechHealing: 3,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.playerHealth).toBe(22);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
  });

  it("scales pending bleed leech healing by leechHealBonusPercent", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      playerMaxHealth: 40,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      pendingBleedLeechHealing: 4,
      gearEffects: { ...makeTestBattleState().gearEffects, leechHealBonusPercent: 50 },
    });
    const texts = makeTexts();
    // computeLeechHeal(4) = 2, scaled by +50% -> 3.
    const next = tickEnemyStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("caps pending bleed leech at the health the tick actually removed", () => {
    const state = patchBattleState({
      enemyHealth: 3,
      enemyMaxHealth: 30,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      pendingBleedLeechHealing: 10,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
    // Only 3 health was lost, so leech pays round(3 / 2) — not the queued round(10 / 2).
    expect(next.playerHealth).toBe(22);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
  });

  it("skips tick when burn is 0", () => {
    const state = patchBattleState();
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(30);
    expect(texts).toEqual([]);
  });

  it("applies all DoTs in sequence", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10, poison: 5, bleed: 8 }),
      pendingBleedLeechHealing: 2,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(27);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(next.enemyStatuses.poison).toBe(4);
    expect(next.enemyStatuses.bleed).toBe(0);
  });

  it("applies burn damage before any CC logic runs on player ticks", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ burn: 8, stun: 20 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(12);
    expect(next.playerCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 8 });
  });

  it("burnDoubleChance doubles burn when triggered", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      talentEffects: { ...defaultTalentEffects, burnDoubleChance: 50 },
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.burn).toBe(20);
  });

  it("poisonGainChance increases poison when triggered", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ poison: 5 }),
      talentEffects: { ...defaultTalentEffects, poisonGainChance: 50 },
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.poison).toBe(6);
  });

  it("parasiticBloomLeechChance heals player on poison tick", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ poison: 8 }),
      trinketEffects: defaultTrinketManifest({ parasiticBloomLeechChance: 50 }),
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });

  it("clamps enemy health at 0", () => {
    const state = patchBattleState({
      enemyHealth: 3,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
  });

  it("applies resistance multiplier for burn", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      currentEnemy: {
        id: "fire-elemental",
        title: "Fire Elemental",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "Half burn damage" }],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(45);
  });

  it("applies vulnerability multiplier for burn", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      currentEnemy: {
        id: "blight-treant",
        title: "The Blight Treant",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "boss",
        traits: [
          { id: "burn-vulnerability", title: "Burn Vulnerability", description: "Receives 50% more Burn damage" },
        ],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    // 10 burn damage * 1.5 (vulnerability multiplier) = 15 damage. Health: 50 -> 35.
    expect(next.enemyHealth).toBe(35);
  });

  it("applies resistance multiplier for bleed against living-armor", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 10 }),
      currentEnemy: {
        id: "living-armor",
        title: "Living Armor",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "elite",
        traits: [{ id: "living-armor", title: "Living Armor", description: "Receives 25% less Bleed damage" }],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    // 10 bleed damage * 0.75 (resistance multiplier) = 8 damage. Health: 50 -> 42.
    expect(next.enemyHealth).toBe(42);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 8 });
  });
});

describe("DoT tick kills pay lethality payouts", () => {
  it("a lethal burn tick pays Bone Charm and gear rewards once", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(25); // +2 bone charm, +3 heal-on-kill
    expect(next.gold).toBe(4);
  });

  it("a lethal burn tick still counts as defeated while burning", () => {
    const state = patchBattleState({
      // 1-stack burn is lethal here and decays to 0 after the tick; the payout
      // must run before that decay to see burn > 0.
      enemyHealth: 1,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 1 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnBurnEnemyDefeated: 6 },
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(26);
  });

  it.each(["poison", "bleed"] as const)("a lethal %s tick pays the same rewards", (status) => {
    const state = patchBattleState({
      enemyHealth: 5,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ [status]: 8 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(25);
    expect(next.gold).toBe(4);
  });

  it("does not double-pay when later DoTs tick an already-dead enemy", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      playerHealth: 20,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10, poison: 8, bleed: 6 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.gold).toBe(4); // single goldOnKill payment
    expect(next.playerHealth).toBe(25); // +2 +3 paid once
  });
});

describe("tickPlayerStatuses", () => {
  it("deals burn damage to player and halves burn", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ burn: 8 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(22);
    expect(next.playerStatuses.burn).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 8 });
  });

  it("fully clears player burn at 1 stack", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ burn: 1 }),
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerHealth).toBe(29);
    expect(next.playerStatuses.burn).toBe(0);
  });

  it("receiveHalfBurnDamage halves burn damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ burn: 8 }),
      talentEffects: { ...defaultTalentEffects, receiveHalfBurnDamage: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 4 });
  });

  it.each<{
    name: string;
    burn: number;
    armor: number;
    maxHealth?: number;
    expectedHealth: number;
    expectedArmor: number;
    expectedBurnAfter?: number;
    expectedDamageText?: number;
  }>([
    {
      name: "reduces burn damage by armor",
      burn: 8,
      armor: 3,
      expectedHealth: 25,
      expectedArmor: 2,
      expectedDamageText: 5,
    },
    {
      name: "with high armor results in 0 damage",
      burn: 3,
      armor: 10,
      maxHealth: 30,
      expectedHealth: 30,
      expectedArmor: 10,
      expectedBurnAfter: 2,
    },
  ])(
    "armorMitigatesBurn $name",
    ({ burn, armor, maxHealth, expectedHealth, expectedArmor, expectedBurnAfter, expectedDamageText }) => {
      const state = patchBattleState({
        playerHealth: 30,
        ...(maxHealth !== undefined ? { playerMaxHealth: maxHealth } : {}),
        playerStatuses: defaultPlayerStatusValues({ burn, armor }),
        talentEffects: { ...defaultTalentEffects, armorMitigatesBurn: true },
      });
      const texts = makeTexts();
      const next = tickPlayerStatuses(state, texts);
      expect(next.playerHealth).toBe(expectedHealth);
      expect(next.playerStatuses.armor).toBe(expectedArmor);
      if (expectedBurnAfter !== undefined) expect(next.playerStatuses.burn).toBe(expectedBurnAfter);
      if (expectedDamageText !== undefined) {
        expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: expectedDamageText });
      }
    },
  );

  it.each<{
    name: string;
    burn: number;
    block: number;
    armor?: number;
    withArmorMitigatesBurn?: boolean;
    expectedHealth: number;
    expectedBurnAfter?: number;
    expectedDamageText?: number;
  }>([
    {
      name: "reduces burn damage when block is active",
      burn: 8,
      block: 5,
      expectedHealth: 23,
      expectedDamageText: 7,
    },
    {
      name: "reduces burn to 0 when block is active and damage is 1",
      burn: 1,
      block: 5,
      expectedHealth: 30,
      expectedBurnAfter: 0,
    },
    {
      name: "does nothing when block is 0",
      burn: 8,
      block: 0,
      expectedHealth: 22,
      expectedDamageText: 8,
    },
    {
      // block reduces: 8 -> 7, armor reduces: 7 -> 4
      name: "stacks with armorMitigatesBurn",
      burn: 8,
      block: 5,
      armor: 3,
      withArmorMitigatesBurn: true,
      expectedHealth: 26,
      expectedDamageText: 4,
    },
  ])(
    "blockReduceBurnDamage $name",
    ({ burn, block, armor, withArmorMitigatesBurn, expectedHealth, expectedBurnAfter, expectedDamageText }) => {
      const state = patchBattleState({
        playerHealth: 30,
        playerStatuses: defaultPlayerStatusValues({ burn, block, ...(armor !== undefined ? { armor } : {}) }),
        talentEffects: {
          ...defaultTalentEffects,
          blockReduceBurnDamage: 1,
          ...(withArmorMitigatesBurn ? { armorMitigatesBurn: true } : {}),
        },
      });
      const texts = makeTexts();
      const next = tickPlayerStatuses(state, texts);
      expect(next.playerHealth).toBe(expectedHealth);
      if (expectedBurnAfter !== undefined) expect(next.playerStatuses.burn).toBe(expectedBurnAfter);
      if (expectedDamageText !== undefined) {
        expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: expectedDamageText });
      }
    },
  );

  it("deals poison damage to player and decays poison by 20% (minimum 1)", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ poison: 5 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(25);
    expect(next.playerStatuses.poison).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 5 });
  });

  it("decays high player poison stacks by 20%", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ poison: 100 }),
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerStatuses.poison).toBe(80);
  });

  it("receiveHalfPoisonDamage halves poison damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ poison: 8 }),
      talentEffects: { ...defaultTalentEffects, receiveHalfPoisonDamage: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 4 });
  });

  it("deals bleed damage and clears bleed", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ bleed: 7 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "bleed", amount: 7 });
  });

  it.each(["burn", "bleed"] as const)("receiveHalf%sDamage applies resists before armor", (status) => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ [status]: 10, armor: 3 }),
      talentEffects: {
        ...defaultTalentEffects,
        [`receiveHalf${status === "burn" ? "Burn" : "Bleed"}Damage`]: true,
        [`armorMitigates${status === "burn" ? "Burn" : "Bleed"}`]: true,
      },
    });
    const texts = makeTexts();
    // Canonical chain (scale -> armor): round(10/2) - 3 = 2. Armor-subtract-first would give round(7/2) = 4.
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(28);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: status, amount: 2 });
  });

  it("clears stun and triggers turn skip when threshold exceeded", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ stun: 20 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // Stun threshold: 30 * 0.5 = 15, stun is 20 > 15, so triggers.
    expect(next.playerHealth).toBe(30); // no damage from stun
    expect(next.playerStatuses.stun).toBe(0);
    expect(next.playerCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("does not apply offensive stun talents to player stun triggers", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ stun: 14 }),
      talentEffects: { ...defaultTalentEffects, stunThresholdReduction: 0.25, stunDurationExtension: 2 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerCC.stunSkipTurns).toBe(0);
    expect(next.playerStatuses.stun).toBe(14);
  });

  it("does not trigger stun skip when stun is below threshold", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ stun: 5 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.stun).toBe(5); // unchanged, below threshold
    expect(next.playerCC.stunSkipTurns).toBe(0);
  });

  it("clears freeze and triggers turn skip when threshold exceeded", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ freeze: 30 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // Freeze threshold: 30 * 0.5 = 15, freeze is 30 >= 15, so triggers.
    expect(next.playerHealth).toBe(30); // no damage from freeze
    expect(next.playerStatuses.freeze).toBe(0);
    expect(next.playerCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "freeze", text: "Frozen" });
  });

  it("does not apply offensive freeze duration bonuses to player freeze triggers", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ freeze: 30 }),
      trinketEffects: defaultTrinketManifest({ freezeDurationExtension: 2 }),
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerCC.freezeSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    // First trigger: stun exceeds threshold, sets skip + cooldown.
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ stun: 20 }),
    });
    const texts = makeTexts();
    const afterFirst = tickPlayerStatuses(state, texts);
    expect(afterFirst.playerCC.stunSkipTurns).toBe(1);
    expect(afterFirst.playerCC.cooldown).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });

    // Second trigger: cooldown active, stun cleared silently, no extra skip.
    const texts2 = makeTexts();
    const afterSecond = tickPlayerStatuses(afterFirst, texts2);
    expect(afterSecond.playerCC.stunSkipTurns).toBe(1); // unchanged
    expect(afterSecond.playerStatuses.stun).toBe(0);
    expect(texts2).not.toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("CC immunity cooldown expires and allows another stun", () => {
    // Trigger stun, tick down cooldown to 1, then 0, then trigger again.
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ stun: 20 }),
    });
    const texts = makeTexts();
    const afterTrigger = tickPlayerStatuses(state, texts);
    expect(afterTrigger.playerCC.cooldown).toBe(2);

    // Simulate two turn advances by manually decrementing cooldown to 0.
    const cooledDown = {
      ...afterTrigger,
      playerCC: defaultCcState({ ...afterTrigger.playerCC, cooldown: 0 }),
      playerStatuses: defaultPlayerStatusValues({ ...afterTrigger.playerStatuses, stun: 20 }),
    };
    const texts3 = makeTexts();
    const afterReTrigger = tickPlayerStatuses(cooledDown, texts3);
    expect(afterReTrigger.playerCC.stunSkipTurns).toBe(2); // triggered again
    expect(afterReTrigger.playerCC.cooldown).toBe(2); // refreshed
  });

  it("skips ticks when all statuses are 0", () => {
    const state = patchBattleState();
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(texts).toEqual([]);
  });

  it("applies all player DoTs in sequence", () => {
    const state = patchBattleState({
      playerHealth: 50,
      playerMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ burn: 8, poison: 4, bleed: 5, stun: 3, freeze: 2 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    // burn: 8 damage (no receiveHalfBurnDamage talent), decays to 4.
    // poison: 4 damage, decays to 3. bleed: 5 damage, cleared to 0.
    // stun and freeze: below threshold, no damage, unchanged.
    expect(next.playerHealth).toBe(33);
    expect(next.playerStatuses.burn).toBe(4);
    expect(next.playerStatuses.poison).toBe(3);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(next.playerStatuses.stun).toBe(3); // below threshold (50*0.5=25), unchanged
    expect(next.playerStatuses.freeze).toBe(2); // below threshold, unchanged
  });
});
