import { describe, expect, it } from "vitest";

import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  emitOverhealBlockText,
  mergeCombatText,
  shouldShowCombatText,
} from "@/lib/battle/combat-text";
import type { GearEffectManifest } from "@/lib/gear";
import { dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import type { BattleState } from "@/lib/battle/types";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import { defaultTrinketManifest } from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, makeTestBattleState } from "../../fixtures/battle";

describe("shouldShowCombatText", () => {
  it("hides harmful status application text", () => {
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "burn", amount: 2 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "poison", amount: 3 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "bleed", amount: 4 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "freeze", amount: 5 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "stun", amount: 6 })).toBe(false);
  });

  it("keeps harmful status damage text visible", () => {
    expect(shouldShowCombatText({ target: "player", kind: "damage", stat: "burn", amount: 2 })).toBe(true);
  });

  it("keeps control notices visible", () => {
    expect(shouldShowCombatText({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" })).toBe(true);
    expect(shouldShowCombatText({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" })).toBe(true);
  });

  it("keeps beneficial status and resource text visible", () => {
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "block", amount: 5 })).toBe(true);
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "gold", amount: 3 })).toBe(true);
  });
});

describe("mergeCombatText", () => {
  it("does not add harmful status application events", () => {
    const texts = makeTexts();
    mergeCombatText(texts, { target: "player", kind: "status", stat: "burn", amount: 2 });
    expect(texts).toEqual([]);
  });

  it("still merges visible events", () => {
    const texts = makeTexts();
    mergeCombatText(texts, { target: "player", kind: "status", stat: "block", amount: 2 });
    mergeCombatText(texts, { target: "player", kind: "status", stat: "block", amount: 3 });
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 5 }]);
  });

  it("deduplicates matching control notices", () => {
    const texts = makeTexts();
    mergeCombatText(texts, { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
    mergeCombatText(texts, { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
    expect(texts).toEqual([{ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" }]);
  });
});

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
  it("emits only actual health gained on overheal", () => {
    const state = makeTestBattleState({ playerHealth: 29, playerMaxHealth: 30 });
    const texts = makeTexts();
    applyHealingWithCombatText(state, 10, texts);
    const healText = texts.find((t) => t.kind === "heal");
    expect(healText).toEqual({ target: "player", kind: "heal", stat: "health", amount: 1 });
  });
});

describe("addGoldWithCombatText", () => {
  it("adds gold to battle state and emits scaled combat text", () => {
    const state = makeTestBattleState({ gold: 10 });
    const texts = makeTexts();
    const nextState = addGoldWithCombatText(state, 5, texts);
    expect(nextState.gold).toBe(15);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 5 }]);
  });

  it("scales gold using gear multiplier when present", () => {
    const state = makeTestBattleState({
      gold: 10,
      gearEffects: { ...makeTestBattleState().gearEffects, goldGainPercent: 50 },
    });
    const texts = makeTexts();
    const nextState = addGoldWithCombatText(state, 10, texts);
    expect(nextState.gold).toBe(25);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 15 }]);
  });

  it("no-ops when amount is 0 or negative", () => {
    const state = makeTestBattleState({ gold: 10 });
    const texts = makeTexts();
    const nextState = addGoldWithCombatText(state, 0, texts);
    expect(nextState.gold).toBe(10);
    expect(texts).toEqual([]);
  });
});

function ccProcKillState(): BattleState {
  return makeTestBattleState({
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
    const result = dealPlayerTypedHit(trinketState, "physical", 10, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(25);
  });

  it("does not pay twice when a follow-up path lands after an already-lethal hit", () => {
    const lethal = withGear({ ...ccProcKillState(), enemyHealth: 0 }, { goldOnKill: 4 });
    const texts = makeTexts();

    const afterTypedHit = dealPlayerTypedHit(lethal, "physical", 10, texts);
    expect(afterTypedHit.gold).toBe(0);
    expect(afterTypedHit.playerHealth).toBe(20);
  });
});
