import { describe, expect, it } from "vitest";

import {
  addGoldWithCombatText,
  gainManaWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  payKillPayouts,
} from "@/lib/battle/player-rewards";
import { emitOverhealBlockText } from "@/lib/battle/player-reward-feedback";
import type { GearEffectManifest } from "@/lib/gear";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import type { BattleState } from "@/lib/battle/types";
import { defaultPlayerStatusValues, defaultTrinketManifest } from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";

describe("emitOverhealBlockText", () => {
  it("emits block combat text when overheal increases block", () => {
    const base = defaultPlayerStatusValues({ block: 2 });
    const before = { playerStatuses: base };
    const after = { playerStatuses: { ...base, block: 7 } };
    const texts = makeTexts();
    emitOverhealBlockText(before, after, texts);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 5 }]);
  });

  it("no-ops when block did not increase", () => {
    const statuses = defaultPlayerStatusValues({ block: 4 });
    const texts = makeTexts();
    emitOverhealBlockText({ playerStatuses: statuses }, { playerStatuses: statuses }, texts);
    expect(texts).toEqual([]);
  });
});

describe("applyHealingWithCombatText", () => {
  it("includes overflow in the visible healing amount", () => {
    const state = patchBattleState({ playerHealth: 29, playerMaxHealth: 30 });
    const texts = makeTexts();
    applyHealingWithCombatText(state, 10, texts);
    const healText = texts.find((t) => t.kind === "heal");
    expect(healText).toEqual({ target: "player", kind: "heal", stat: "health", amount: 10 });
  });

  it("grants Grove's Favor Thorns when Health is actually restored", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      trinketEffects: defaultTrinketManifest({ grovesFavorThornsOnHealthRestore: 1 }),
    });
    const texts = makeTexts();

    const result = applyHealingWithCombatText(state, 5, texts);

    expect(result.playerHealth).toBe(15);
    expect(result.playerStatuses.thorns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 5 });
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "thorns", amount: 1 });
  });

  it("does not grant Grove's Favor Thorns at full Health", () => {
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ grovesFavorThornsOnHealthRestore: 1 }),
    });
    const texts = makeTexts();

    const result = applyHealingWithCombatText(state, 5, texts);

    expect(result.playerHealth).toBe(result.playerMaxHealth);
    expect(result.playerStatuses.thorns).toBe(0);
    expect(texts).not.toContainEqual(expect.objectContaining({ stat: "thorns" }));
  });

  it("does not grant Grove's Favor Thorns or Overflow Block for passive overhealing", () => {
    const base = patchBattleState();
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ grovesFavorThornsOnHealthRestore: 1 }),
      talentEffects: { ...base.talentEffects, overhealToBlockRatio: 1 },
    });
    const texts = makeTexts();

    const result = applyHealingWithCombatText(state, 5, texts);

    expect(result.playerHealth).toBe(result.playerMaxHealth);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses.thorns).toBe(0);
    expect(texts).not.toContainEqual(expect.objectContaining({ stat: "thorns" }));
  });

  it("grants Ironwood Buckler Thorns once for each positive Block gain", () => {
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ ironwoodBucklerThornsOnBlock: 1 }),
    });
    const texts = makeTexts();

    const afterFirst = addPlayerStatusWithCombatText(state, "block", 2, texts);
    const result = addPlayerStatusWithCombatText(afterFirst, "block", 4, texts);

    expect(result.playerStatuses.block).toBe(6);
    expect(result.playerStatuses.thorns).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "thorns", amount: 2 });
  });
});

describe("addGoldWithCombatText", () => {
  it("adds gold to battle state and emits scaled combat text", () => {
    const state = patchBattleState({ gold: 10 });
    const texts = makeTexts();
    const nextState = addGoldWithCombatText(state, 5, texts);
    expect(nextState.gold).toBe(15);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 5 }]);
  });

  it("scales gold using gear multiplier when present", () => {
    const state = patchBattleState({
      gold: 10,
      gearEffects: { goldGainPercent: 50 },
    });
    const texts = makeTexts();
    const nextState = addGoldWithCombatText(state, 10, texts);
    expect(nextState.gold).toBe(25);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 15 }]);
  });

  it("no-ops when amount is 0 or negative", () => {
    const state = patchBattleState({ gold: 10 });
    const texts = makeTexts();
    const nextState = addGoldWithCombatText(state, 0, texts);
    expect(nextState.gold).toBe(10);
    expect(texts).toEqual([]);
  });
});

function ccProcKillState(): BattleState {
  return patchBattleState({
    enemyHealth: 5,
    enemyMaxHealth: 30,
    playerHealth: 20,
    playerMaxHealth: 30,
    gold: 0,
  });
}

function withGear(state: BattleState, gear: Partial<GearEffectManifest>): BattleState {
  return { ...state, gearEffects: { ...state.gearEffects, ...gear } };
}

describe("lethality payouts — every kill path pays the same rewards", () => {
  it("shares Health feedback across defeat rewards and pays only once", () => {
    const base = ccProcKillState();
    const state = {
      ...withGear(base, { healOnKill: 3, goldOnKill: 4 }),
      enemyHealth: 0,
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2, grovesFavorThornsOnHealthRestore: 1 }),
    };
    const texts = makeTexts();

    const rewarded = payKillPayouts(state, true, texts);
    expect(rewarded.playerHealth).toBe(25);
    expect(rewarded.playerStatuses.thorns).toBe(2);
    expect(rewarded.gold).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 5 });
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "thorns", amount: 2 });
    expect(payKillPayouts(rewarded, true, texts)).toBe(rewarded);
  });

  it("thunderstone-on-stun kill pays gear kill rewards and Bone Charm heal", () => {
    const base = ccProcKillState();
    const state = {
      ...base,
      enemyStatuses: { ...base.enemyStatuses, stun: 999 },
      gearEffects: { ...base.gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ thunderstoneDamageOnStun: 10, boneCharmHealOnKill: 2 }),
    };
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(25);
    expect(result.gold).toBe(4);
  });

  it("Frozen Heart freeze-proc kill pays gear kill rewards and Bone Charm heal", () => {
    const base = ccProcKillState();
    const state = {
      ...withGear(base, { goldOnKill: 4 }),
      enemyStatuses: { ...base.enemyStatuses, freeze: 999 },
      trinketEffects: defaultTrinketManifest({ frozenHeartDamage: 10, boneCharmHealOnKill: 2 }),
    };
    const texts = makeTexts();
    const result = tryTriggerEnemyFreeze(state, state, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(22);
    expect(result.gold).toBe(4);
  });

  it("follow-up typed hit kills pay Bone Charm heal alongside gear rewards", () => {
    const state = withGear(ccProcKillState(), { healOnKill: 3 });
    const trinketState = { ...state, trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }) };
    const texts = makeTexts();
    const result = resolveFollowUpHit(
      trinketState,
      { source: "player-follow-up", damageType: "physical", amount: 10 },
      texts,
    );
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(25);
  });

  it("does not pay twice when a follow-up path lands after an already-lethal hit", () => {
    const lethal = withGear({ ...ccProcKillState(), enemyHealth: 0 }, { goldOnKill: 4 });
    const texts = makeTexts();

    const afterTypedHit = resolveFollowUpHit(
      lethal,
      { source: "player-follow-up", damageType: "physical", amount: 10 },
      texts,
    );
    expect(afterTypedHit.gold).toBe(0);
    expect(afterTypedHit.playerHealth).toBe(20);
  });
});

describe("Arcane Mending from bonus Mana", () => {
  it.each([true, false])("heals once per gain with combat text enabled: %s", (collectText) => {
    const state = patchBattleState({
      mana: 0,
      maxMana: 4,
      playerHealth: 10,
      talentEffects: { healOnManaGain: 2 },
    });
    const texts = makeTexts();
    const next = gainManaWithCombatText(state, 3, collectText ? texts : undefined);
    expect(next.mana).toBe(3);
    expect(next.playerHealth).toBe(12);
    if (collectText) expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
    expect(state.playerHealth).toBe(10);
  });

  it("does not heal when Mana is already full", () => {
    const state = patchBattleState({
      mana: 4,
      maxMana: 4,
      playerHealth: 10,
      talentEffects: { healOnManaGain: 2 },
    });
    expect(gainManaWithCombatText(state, 3, []).playerHealth).toBe(10);
  });
});
