import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { addPlayerStatus } from "@/lib/battle/status-state";
import { defaultPlayerStatusValues, defaultCcState } from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("tickPlayerStatuses", () => {
  it("combines Burn reductions before Armor and decays Armor only after Health loss", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 10, block: 5, armor: 3 },
      talentEffects: { receiveHalfBurnDamage: true, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(next.playerStatuses).toMatchObject({ burn: 5, armor: 2, block: 5 });
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 4, periodic: true });
    expect(state.playerStatuses).toMatchObject({ burn: 10, armor: 3 });
  });

  it("keeps Armor and suppresses damage feedback when mitigation absorbs the whole Burn tick", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 1, block: 5, armor: 3 },
      talentEffects: { armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses).toMatchObject({ burn: 0, armor: 3, block: 5 });
    expect(texts.filter((text) => text.kind === "damage")).toEqual([]);
    const unblocked = tickPlayerStatuses(
      { ...state, playerStatuses: { ...state.playerStatuses, block: 0, armor: 0 } },
      [],
    );
    expect(unblocked.playerHealth).toBe(29);
  });

  it.each([
    ["poison", 5, 4],
    ["bleed", 7, 0],
  ] as const)("deals periodic %s damage and decays its stacks", (stat, amount, remaining) => {
    const state = patchBattleState({ playerStatuses: { [stat]: amount } });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30 - amount);
    expect(next.playerStatuses[stat]).toBe(remaining);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat, amount, periodic: true });
  });

  it("receiveHalfPoisonDamage halves poison damage", () => {
    const state = patchBattleState({
      playerStatuses: { poison: 8 },
      talentEffects: { receiveHalfPoisonDamage: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 4, periodic: true });
  });

  it.each(["burn", "bleed"] as const)("receiveHalf%sDamage applies resists before armor", (status) => {
    const state = patchBattleState({
      playerStatuses: { [status]: 10, armor: 3 },
      talentEffects: {
        [`receiveHalf${status === "burn" ? "Burn" : "Bleed"}Damage`]: true,
        [`armorMitigates${status === "burn" ? "Burn" : "Bleed"}`]: true,
      },
    });
    const texts = makeTexts();

    const next = tickPlayerStatuses(state, texts);
    const damage = status === "burn" ? 4 : 2;
    expect(next.playerHealth).toBe(30 - damage);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: status, amount: damage, periodic: true });
  });

  it.each([
    ["stun", 20, "stunSkipTurns", "Stunned"],
    ["freeze", 30, "freezeSkipTurns", "Frozen"],
  ] as const)("clears %s buildup and skips a turn above its threshold", (stat, amount, skip, text) => {
    const state = patchBattleState({ playerStatuses: { [stat]: amount } });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses[stat]).toBe(0);
    expect(next.playerCC[skip]).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat, text });
  });

  it("does not apply offensive stun talents to player stun triggers", () => {
    const state = patchBattleState({
      playerStatuses: { stun: 14 },
      talentEffects: { stunThresholdReduction: 0.25, stunDurationExtension: 2 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerCC.stunSkipTurns).toBe(0);
    expect(next.playerStatuses.stun).toBe(14);
  });

  it("does not apply offensive freeze duration bonuses to player freeze triggers", () => {
    const state = patchBattleState({
      playerStatuses: { freeze: 30 },
      trinketEffects: { freezeDurationExtension: 2 },
    });
    const next = tickPlayerStatuses(state, makeTexts());
    expect(next.playerCC.freezeSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    const state = patchBattleState({
      playerStatuses: { stun: 20 },
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

  it("settles all player DoTs in order before crowd-control feedback", () => {
    const state = patchBattleState({
      playerHealth: 50,
      playerMaxHealth: 50,
      playerStatuses: { burn: 8, poison: 4, bleed: 5, stun: 30, freeze: 2 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);

    expect(next.playerHealth).toBe(33);
    expect(next.playerStatuses.burn).toBe(4);
    expect(next.playerStatuses.poison).toBe(3);
    expect(next.playerStatuses.bleed).toBe(0);
    expect(next.playerStatuses.stun).toBe(0);
    expect(next.playerCC.stunSkipTurns).toBe(1);
    expect(texts.at(-1)).toMatchObject({ kind: "notice", stat: "stun", text: "Stunned" });
    expect(texts.filter((text) => text.kind === "damage" && text.target === "player").map((text) => text.stat)).toEqual(
      ["burn", "poison", "bleed"],
    );
    expect(next.playerStatuses.freeze).toBe(2);
  });

  it.each(["burn", "poison"] as const)("stops remaining player DoTs after lethal %s", (lethal) => {
    const state = patchBattleState({
      playerHealth: 5,
      deathsDoorUsed: true,
      playerStatuses: { burn: lethal === "burn" ? 10 : 0, poison: 10, bleed: 10 },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);

    expect(next.playerHealth).toBe(0);
    expect(next.playerStatuses.poison).toBe(lethal === "burn" ? 10 : 8);
    expect(next.playerStatuses.bleed).toBe(10);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: lethal, amount: 5, periodic: true });
    if (lethal === "burn") expect(texts.some((entry) => entry.stat === "poison")).toBe(false);
    expect(texts.some((entry) => entry.stat === "bleed")).toBe(false);
  });
});

describe("cleansed Bleed Leech", () => {
  it("partial Clean Getaway removal caps pending Leech before fresh Bleed is added", () => {
    const state = patchBattleState({
      playerMaxHealth: 40,
      enemyHealth: 10,
      enemyMaxHealth: 40,
      playerStatuses: { bleed: 4 },
      pendingEnemyBleedLeechHealing: 4,
      talentEffects: { cleanseStacksOnDodge: 2 },
    });
    const cleansed = applyDodgeTalentStatuses(state, []);
    const ticked = tickPlayerStatuses(addPlayerStatus(cleansed, "bleed", 4), []);
    expect(ticked.playerHealth).toBe(24);
    expect(ticked.enemyHealth).toBe(11);
  });

  it.each(["cleanse", "specific", "dodge", "subtract"] as const)(
    "%s removes the enemy's claim on cleansed Bleed before fresh Bleed arrives",
    (source) => {
      const state = patchBattleState({
        rng: () => 0.99,
        playerMaxHealth: 40,
        enemyHealth: 10,
        enemyMaxHealth: 40,
        playerStatuses: { bleed: 4 },
        pendingEnemyBleedLeechHealing: 4,
        talentEffects: { cleanseStacksOnDodge: 4 },
      });
      const cleansed =
        source === "subtract"
          ? addPlayerStatus(state, "bleed", -4)
          : source === "dodge"
            ? applyDodgeTalentStatuses(state, [])
            : applyCardEffects(
                state,
                makeTestCard({
                  effects: [
                    source === "cleanse"
                      ? { kind: "remove-harmful-status", amount: 1 }
                      : { kind: "remove-player-status", status: "bleed" },
                  ],
                }),
                [],
              );
      expect(cleansed.playerStatuses.bleed).toBe(0);
      const ticked = tickPlayerStatuses(addPlayerStatus(cleansed, "bleed", 4), []);
      expect(ticked.enemyHealth).toBe(cleansed.enemyHealth);
      expect(ticked.playerHealth).toBe(cleansed.playerHealth - 4);
      expect(state.pendingEnemyBleedLeechHealing).toBe(4);
    },
  );

  it("Emberwake retaliation resolves between player status ticks", () => {
    const state = patchBattleState({
      playerHealth: 2,
      enemyHealth: 2,
      playerStatuses: { burn: 3, poison: 3 },
      gearEffects: { burnOnDeathsDoorEntry: 4 },
      rng: () => 0.99,
    });
    const next = tickPlayerStatuses(state, []);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerStatuses.poison).toBe(3);
  });

  it("pending enemy Bleed Leech survives Phoenix Feather recovery", () => {
    const state = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 40,
      playerStatuses: { bleed: 3, phoenixFeather: 1 },
      pendingEnemyBleedLeechHealing: 3,
      enemyHealth: 20,
      enemyMaxHealth: 40,
    });
    const result = tickPlayerStatuses(state, []);
    expect(result.playerStatuses.phoenixFeather).toBe(0);
    expect(result.enemyHealth).toBe(21);
    expect(result.pendingEnemyBleedLeechHealing).toBe(0);
  });
});
