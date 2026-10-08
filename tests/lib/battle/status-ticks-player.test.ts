import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { addPlayerStatus } from "@/lib/battle/status-state";
import {
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultCcState,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("tickPlayerStatuses", () => {
  it("combines Burn reductions before Armor and decays Armor only after Health loss", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { burn: 10, block: 5, armor: 3 },
      talentEffects: { receiveHalfBurnDamage: true, blockReduceBurnDamage: 1, armorMitigatesBurn: true },
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(29);
    expect(next.playerStatuses).toMatchObject({ burn: 5, armor: 2, block: 5 });
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 1, periodic: true });
    expect(state.playerStatuses).toMatchObject({ burn: 10, armor: 3 });
  });

  it("keeps Armor and suppresses damage feedback when mitigation absorbs the whole Burn tick", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { burn: 1, block: 5, armor: 3 },
      talentEffects: { blockReduceBurnDamage: 1, armorMitigatesBurn: true },
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

  it("deals poison damage to player and decays poison by 20% (minimum 1)", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ poison: 5 }),
    });
    const texts = makeTexts();
    const next = tickPlayerStatuses(state, texts);
    expect(next.playerHealth).toBe(25);
    expect(next.playerStatuses.poison).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 5, periodic: true });
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
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "poison", amount: 4, periodic: true });
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
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "bleed", amount: 7, periodic: true });
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
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: status, amount: 2, periodic: true });
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

  it("settles all player DoTs in order before crowd-control feedback", () => {
    const state = patchBattleState({
      playerHealth: 50,
      playerMaxHealth: 50,
      playerStatuses: defaultPlayerStatusValues({ burn: 8, poison: 4, bleed: 5, stun: 30, freeze: 2 }),
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
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      playerStatuses: defaultPlayerStatusValues({ burn: lethal === "burn" ? 10 : 0, poison: 10, bleed: 10 }),
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
      playerHealth: 30,
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
        playerHealth: 30,
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
});
