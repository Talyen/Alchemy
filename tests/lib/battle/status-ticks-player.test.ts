import { describe, expect, it } from "vitest";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import {
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultCcState,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";

describe("tickPlayerStatuses", () => {
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

    expect(next.playerHealth).toBe(30);
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
    expect(next.playerStatuses.stun).toBe(5);
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

    expect(next.playerHealth).toBe(30);
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
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ stun: 20 }),
    });
    const texts = makeTexts();
    const afterFirst = tickPlayerStatuses(state, texts);
    expect(afterFirst.playerCC.stunSkipTurns).toBe(1);
    expect(afterFirst.playerCC.cooldown).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });

    const immuneState = {
      ...afterFirst,
      playerCC: defaultCcState({ ...afterFirst.playerCC, stunSkipTurns: 0, cooldown: 2 }),
      playerStatuses: defaultPlayerStatusValues({ stun: 20 }),
    };
    const texts2 = makeTexts();
    const afterSecond = tickPlayerStatuses(immuneState, texts2);
    expect(afterSecond.playerCC.stunSkipTurns).toBe(0);
    expect(afterSecond.playerStatuses.stun).toBe(0);
    expect(texts2).not.toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("CC immunity cooldown expires and allows another stun", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ stun: 20 }),
    });
    const texts = makeTexts();
    const afterTrigger = tickPlayerStatuses(state, texts);
    expect(afterTrigger.playerCC.cooldown).toBe(0);

    const cooledDown = {
      ...afterTrigger,
      playerCC: defaultCcState({ ...afterTrigger.playerCC, stunSkipTurns: 0, cooldown: 0 }),
      playerStatuses: defaultPlayerStatusValues({ ...afterTrigger.playerStatuses, stun: 20 }),
    };
    const texts3 = makeTexts();
    const afterReTrigger = tickPlayerStatuses(cooledDown, texts3);
    expect(afterReTrigger.playerCC.stunSkipTurns).toBe(1);
    expect(afterReTrigger.playerCC.cooldown).toBe(0);
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

    expect(next.playerHealth).toBe(33);
    expect(next.playerStatuses.burn).toBe(4);
    expect(next.playerStatuses.poison).toBe(3);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(next.playerStatuses.stun).toBe(3);
    expect(next.playerStatuses.freeze).toBe(2);
  });
});
