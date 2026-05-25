import { describe, expect, it, vi } from "vitest";
import { applyIronwoodBuckler, applyBoneCharmHeal, applyLuckyCloverGold } from "@/lib/battle/trinket-effects";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

vi.spyOn(Math, "random").mockReturnValue(0.99);

describe("applyIronwoodBuckler", () => {
  it("converts block to armor when block >= threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 10 },
      trinketEffects: { ...createTestBattleState().trinketEffects, blockToArmorThreshold: 5, blockToArmorAmount: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(3);
    expect(next.playerStatuses.block).toBe(10);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "armor", amount: 3 }]);
  });

  it("does nothing when block is below threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 3 },
      trinketEffects: { ...createTestBattleState().trinketEffects, blockToArmorThreshold: 5, blockToArmorAmount: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does nothing when threshold is 0 (trinket not owned)", () => {
    const state = createTestBattleState({ playerStatuses: { ...createTestBattleState().playerStatuses, block: 10 } });
    const texts: CombatTextEvent[] = [];
    const next = applyIronwoodBuckler(state, texts);
    expect(next.playerStatuses.armor).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does not mutate original state", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 10 },
      trinketEffects: { ...createTestBattleState().trinketEffects, blockToArmorThreshold: 5, blockToArmorAmount: 3 },
    });
    const texts: CombatTextEvent[] = [];
    applyIronwoodBuckler(state, texts);
    expect(state.playerStatuses.armor).toBe(0);
  });
});

describe("applyBoneCharmHeal", () => {
  it("heals player on enemy kill when boneCharmHealOnKill > 0", () => {
    const state = createTestBattleState({
      enemyHealth: 0,
      playerHealth: 20,
      trinketEffects: { ...createTestBattleState().trinketEffects, boneCharmHealOnKill: 5 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, true, texts);
    expect(next.playerHealth).toBe(25);
    expect(texts).toEqual([{ target: "player", kind: "heal", stat: "health", amount: 5 }]);
  });

  it("does nothing when enemy was not alive before this hit", () => {
    const state = createTestBattleState({ enemyHealth: 0 });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, false, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when enemy is still alive", () => {
    const state = createTestBattleState({ enemyHealth: 10 });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, true, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when boneCharmHealOnKill is 0", () => {
    const state = createTestBattleState({ enemyHealth: 0 });
    const texts: CombatTextEvent[] = [];
    const next = applyBoneCharmHeal(state, true, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });
});

describe("applyLuckyCloverGold", () => {
  it("grants gold on damage when luckyCloverGoldChance triggers", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.01);
    const state = createTestBattleState({
      trinketEffects: { ...createTestBattleState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next.gold).toBe(7);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 7 }]);
  });

  it("does nothing when random does not trigger", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99);
    const state = createTestBattleState({
      trinketEffects: { ...createTestBattleState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next.gold).toBe(0);
    expect(texts).toEqual([]);
  });

  it("does nothing when luckyCloverGoldChance is 0", () => {
    const state = createTestBattleState();
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 7, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when damage is 0", () => {
    const state = createTestBattleState({
      trinketEffects: { ...createTestBattleState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, 0, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });

  it("does nothing when damage is negative", () => {
    const state = createTestBattleState({
      trinketEffects: { ...createTestBattleState().trinketEffects, luckyCloverGoldChance: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyLuckyCloverGold(state, -3, texts);
    expect(next).toBe(state);
    expect(texts).toEqual([]);
  });
});
