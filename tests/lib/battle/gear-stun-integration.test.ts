import { describe, expect, it } from "vitest";
import { addPlayerStatus } from "@/lib/battle/types";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { defaultGearEffects } from "@/lib/gear";
import { patchBattleState } from "../../fixtures/battle";

describe("gear stun integration", () => {
  it("adds flatBlockGained when gaining block via addPlayerStatus", () => {
    const state = patchBattleState({
      playerStatuses: { ...patchBattleState().playerStatuses, block: 2 },
      gearEffects: { ...defaultGearEffects, flatBlockGained: 3 },
    });
    const next = addPlayerStatus(state, "block", 4);
    expect(next.playerStatuses.block).toBe(9);
  });

  it("applies gear blockOnStun when enemy is stunned", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyStatuses: { ...patchBattleState().enemyStatuses, stun: 20 },
      gearEffects: { ...defaultGearEffects, blockOnStun: 2, flatBlockGained: 1 },
    });
    const texts: Parameters<typeof resolveStunTrigger>[1] = [];
    const next = resolveStunTrigger(state, texts);
    expect(next.playerStatuses.block).toBeGreaterThanOrEqual(3);
    const blockText = texts.find((t) => t.stat === "block");
    expect((blockText as { amount: number } | undefined)?.amount).toBe(3);
  });

  it("awards healOnKill when stun proc damage kills the enemy", () => {
    const state = patchBattleState({
      enemyHealth: 3,
      enemyMaxHealth: 30,
      playerHealth: 10,
      playerMaxHealth: 20,
      enemyStatuses: { ...patchBattleState().enemyStatuses, stun: 20 },
      gearEffects: { ...defaultGearEffects, damageOnStunPhysical: 5, healOnKill: 4 },
    });
    const texts: Parameters<typeof resolveStunTrigger>[1] = [];
    const next = resolveStunTrigger(state, texts);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(14);
    expect(texts.some((t) => t.kind === "heal" && t.amount === 4)).toBe(true);
  });
});
