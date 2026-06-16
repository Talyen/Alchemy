import { describe, expect, it } from "vitest";
import {
  applyPlayerDamageStatuses,
  applyPlayerStatusEffect,
  removeHarmfulPlayerStatuses,
} from "@/lib/battle/status-player";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState, patchBattleState } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}
describe("removeHarmfulPlayerStatuses", () => {
  it("removes statuses in priority order", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 5, poison: 3, bleed: 2 },
    });
    const result = removeHarmfulPlayerStatuses(state, 2);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });

  it("does not heal with sinEater boon when not owned", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerStatuses: { burn: 5 },
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals with sinEater boon on remove", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerStatuses: { burn: 5, poison: 3 },
      trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 4 },
    });
    const texts = makeTexts();
    const result = removeHarmfulPlayerStatuses(state, 2, texts);
    // sinEaterHealOnHarmfulStatusRemove heals once for the batch, not per status
    expect(result.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });

  it("does nothing when no statuses to remove", () => {
    const state = patchBattleState({
      playerHealth: 20,
      trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 4 },
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals and emits overheal block text when status cleanse heals above max health", () => {
    const state = patchBattleState({
      playerHealth: 28,
      playerMaxHealth: 30,
      playerStatuses: { burn: 5, block: 2 },
      talentEffects: {
        healOnStatusCleanse: 10,
        overhealToBlockRatio: 0.5,
      },
    });
    const texts = makeTexts();
    // cleanses burn, triggers healOnStatusCleanse(10) -> overheal = 8 -> block gained = round(8 * 0.5) = 4.
    const result = removeHarmfulPlayerStatuses(state, 1, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 10 });
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 4 });
  });
});

describe("applyPlayerStatusEffect", () => {
  it("adds the status amount to player", () => {
    const state = createTestBattleState();
    const effect = { kind: "player-status" as const, status: "block" as const, amount: 5 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("doubles armor when player is below half health and armorDoubledBelowHalfHealth is active", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { armorDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
  });

  it("doubles armor on first armor card when firstArmorCardDoubled is active", () => {
    const state = patchBattleState({
      talentEffects: { firstArmorCardDoubled: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
    expect(result.flags.firstArmorCardDoubledUsed).toBe(true);
  });

  it("does not double armor on second armor card when flag is used", () => {
    const state = patchBattleState({
      talentEffects: { firstArmorCardDoubled: true },
      flags: { firstArmorCardDoubledUsed: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
  });

  it("grants block when armor crosses armorBlockThreshold", () => {
    const state = patchBattleState({
      playerStatuses: { armor: 3 },
      talentEffects: { armorBlockThreshold: 5, armorBlockAmount: 3 },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.armor).toBe(6);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("does not grant block when armor does not cross threshold", () => {
    const state = patchBattleState({
      playerStatuses: { armor: 1 },
      talentEffects: { armorBlockThreshold: 5, armorBlockAmount: 3 },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
    expect(result.playerStatuses.block).toBe(0);
  });
});

describe("applyPlayerDamageStatuses", () => {
  it("adds burn stacks from incoming burn damage", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 2 },
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "burn" }, 5);
    expect(result.playerStatuses.burn).toBe(7);
  });

  it("does nothing when actual damage is zero", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 3 },
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "burn" }, 0);
    expect(result).toBe(state);
  });
});
