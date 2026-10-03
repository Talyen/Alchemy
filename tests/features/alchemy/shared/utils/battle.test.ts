import { describe, expect, it } from "vitest";
import { createBattleState } from "@/lib/battle";
import {
  getPlayerStatusChips,
  getEnemyStatusChips,
  getCombatImpactVisual,
} from "@/features/alchemy/shared/utils/battle";
import { enemyBestiary, keywordDefinitions } from "@/lib/game-data";
import { makeTestCard } from "../../../../fixtures/battle";

const skeleton = enemyBestiary.find((enemy) => enemy.id === "skeleton")!;

function makeProductionBattleState() {
  return createBattleState({ runDeck: [makeTestCard()], currentEnemy: skeleton });
}

describe("getPlayerStatusChips", () => {
  it.each([null, undefined] as const)("returns empty array when state is %s", (state) => {
    expect(getPlayerStatusChips(state)).toEqual([]);
  });

  it("surfaces armed CombatFlags as badge-less buff chips", () => {
    const state = makeProductionBattleState();
    state.flags.playNextCardTwice = true;
    state.flags.nextHitCrit = true;
    state.flags.nextHitLeech = true;
    state.flags.nextHitPhysicalBonus = 4;
    state.flags.nextPhysicalDealsBleed = true;
    state.flags.nextArcheryCardFree = true;
    state.flags.nextHolyCardFree = true;
    state.flags.nextWishExtraChoice = true;
    state.flags.hawkEyeReady = true;
    const chips = getPlayerStatusChips(state);
    expect(chips).toContainEqual({ id: "playNextCardTwice", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextHitCrit", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextHitLeech", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextHitPhysicalBonus", value: 4 });
    expect(chips).toContainEqual({ id: "nextPhysicalDealsBleed", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextArcheryCardFree", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextHolyCardFree", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextWishExtraChoice", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "hawkEyeReady", value: 1, hideValue: true });
    expect(chips.find((chip) => chip.id === "nextHitPoison")).toBeUndefined();
  });

  it("counts mixed pending pulses as a hero Echo chip", () => {
    const state = makeProductionBattleState();
    state.pendingTurnStartEffects = [
      {
        remainingTurns: 1,
        effects: [
          { kind: "player-status", status: "block", amount: 4 },
          { kind: "damage", damageType: "holy", amount: 4 },
        ],
      },
      { remainingTurns: 1, effects: [] },
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] },
    ];
    expect(getPlayerStatusChips(state)).toEqual([{ id: "echo", value: 1 }]);
    expect(getEnemyStatusChips(state)).toEqual([{ id: "pending-freeze", value: 2 }]);
  });

  it("orders armed chips after buffs and before harmful build-ups", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.block = 10;
    state.playerStatuses.burn = 3;
    state.flags.nextHitCrit = true;
    expect(getPlayerStatusChips(state)).toEqual([
      { id: "block", value: 10 },
      { id: "nextHitCrit", value: 1, hideValue: true },
      { id: "burn", value: 3 },
    ]);
  });

  it("surfaces the player's CC immunity cooldown only after active CC ends", () => {
    const state = makeProductionBattleState();
    state.playerCC.cooldown = 2;
    expect(getPlayerStatusChips(state)).toEqual([{ id: "ccImmunity", value: 2, hideValue: true }]);
  });

  it("surfaces Stunned and Frozen chips while skip turns are active", () => {
    const state = makeProductionBattleState();
    state.playerCC.stunSkipTurns = 1;
    state.playerCC.freezeSkipTurns = 1;
    expect(getPlayerStatusChips(state)).toEqual([
      { id: "stunned", value: 1, hideValue: true },
      { id: "frozen", value: 1, hideValue: true },
    ]);
  });

  it("prefers active CC chips over immunity and buildup stacks", () => {
    const state = makeProductionBattleState();
    state.playerCC.stunSkipTurns = 1;
    state.playerCC.cooldown = 2;
    state.playerStatuses.stun = 8;
    expect(getPlayerStatusChips(state)).toEqual([{ id: "stunned", value: 1, hideValue: true }]);
  });

  it("surfaces Phoenix Feather as a badge-less binary effect", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.phoenixFeather = 1;
    expect(getPlayerStatusChips(state)).toEqual([{ id: "phoenixFeather", value: 1, hideValue: true }]);
  });
});

describe("getEnemyStatusChips", () => {
  it.each([null, undefined] as const)("returns empty array when state is %s", (state) => {
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("does not expose pending bleed leech healing as a status chip", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.bleed = 2;
    state.pendingBleedLeechHealing = 4;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "bleed", value: 2 }]);
  });

  it("surfaces purely-offensive pending pulses as incoming damage chips", () => {
    const state = makeProductionBattleState();
    state.pendingTurnStartEffects = [
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] },
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "stun", amount: 2 }] },
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 3 }] },
    ];
    const chips = getEnemyStatusChips(state);
    expect(chips).toEqual([
      { id: "pending-stun", value: 2 },
      { id: "pending-freeze", value: 5 },
    ]);
  });

  it("exposes onAttackBleed as a status chip", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.onAttackBleed = 2;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "onAttackBleed", value: 2 }]);
  });

  it("exposes thorns as a status chip", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.thorns = 1;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "thorns", value: 1 }]);
  });

  it("surfaces the enemy's CC immunity cooldown only after active CC ends", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.stun = 1;
    state.enemyCC.cooldown = 2;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "ccImmunity", value: 2, hideValue: true }]);
  });

  it("surfaces enemy Stunned chip while skip turns are active", () => {
    const state = makeProductionBattleState();
    state.enemyCC.stunSkipTurns = 1;
    state.enemyCC.cooldown = 2;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "stunned", value: 1, hideValue: true }]);
  });
});

describe("getCombatImpactVisual", () => {
  it.each(["physical", "burn", "freeze"] as const)("uses the %s keyword palette for damage", (stat) => {
    expect(getCombatImpactVisual({ target: "enemy", kind: "damage", stat, amount: 5 })).toEqual({
      colors: keywordDefinitions[stat].shineColors,
      healthLost: true,
    });
  });

  it("uses Block blue without marking Health loss", () => {
    expect(getCombatImpactVisual({ target: "player", kind: "damage", stat: "block", amount: 5 })).toEqual({
      colors: keywordDefinitions.block.shineColors,
      healthLost: false,
    });
  });

  it.each([
    { target: "player", kind: "heal", stat: "health", amount: 5 },
    { target: "player", kind: "status", stat: "block", amount: 5 },
    { target: "player", kind: "damage", stat: "mana", amount: 2 },
    { target: "player", kind: "notice", stat: "dodge", text: "Dodge" },
  ] as const)("does not create an impact for $kind $stat text", (event) => {
    expect(getCombatImpactVisual(event)).toBeNull();
  });
});
