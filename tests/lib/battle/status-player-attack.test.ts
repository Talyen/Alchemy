import { describe, expect, it } from "vitest";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";

describe("applyPlayerStatusFromAttack", () => {
  describe("direct harmful statuses (burn, poison, bleed)", () => {
    it.each([
      { status: "burn", expectedAmount: 5 },
      { status: "poison", expectedAmount: 5 },
      { status: "bleed", expectedAmount: 5 },
    ] as const)("applies $status status from enemy attack", ({ status, expectedAmount }) => {
      const state = makeTestBattleState();
      const texts: CombatTextEvent[] = [];
      const effect = { kind: "player-status" as const, status, amount: 5 };
      const result = applyPlayerStatusFromAttack(state, effect, texts);
      expect(result.playerStatuses[status]).toBe(expectedAmount);

      expect(texts).toEqual([]);
    });

    it("does not mutate original state", () => {
      const state = makeTestBattleState();
      const texts: CombatTextEvent[] = [];
      applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(state.playerStatuses.burn).toBe(0);
    });
  });

  describe("beneficial statuses (armor, block, forge, haste)", () => {
    it.each(["armor", "block", "forge", "haste"] as const)(
      "applies %s status from enemy attack with status combat text kind",
      (status) => {
        const state = makeTestBattleState();
        const texts: CombatTextEvent[] = [];
        const effect = { kind: "player-status" as const, status, amount: 4 };
        const result = applyPlayerStatusFromAttack(state, effect, texts);
        expect(result.playerStatuses[status as keyof typeof result.playerStatuses]).toBe(4);
        expect(texts).toEqual([{ target: "player", kind: "status", stat: status, amount: 4 }]);
      },
    );

    it("adds beneficial status to existing stack", () => {
      const state = makeTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, armor: 3 }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "armor", amount: 2 }, texts);
      expect(result.playerStatuses.armor).toBe(5);
    });
  });

  describe("block prevents status via talents", () => {
    it.each([
      { status: "bleed" as const, talentKey: "blockPreventsBleed" as const },
      { status: "poison" as const, talentKey: "blockPreventsPoison" as const },
    ] as const)("prevents $status when player has block and $talentKey talent", ({ status, talentKey }) => {
      const state = makeTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, block: 5 }),
        talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, [talentKey]: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status, amount: 4 }, texts);
      expect(result.playerStatuses[status as keyof typeof result.playerStatuses]).toBe(0);
      expect(texts).toEqual([]);
    });

    it.each([
      { status: "bleed" as const, talentKey: "blockPreventsBleed" as const },
      { status: "poison" as const, talentKey: "blockPreventsPoison" as const },
    ] as const)("does not block $status when talent is inactive even with block", ({ status, talentKey }) => {
      const state = makeTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, block: 5 }),
        talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, [talentKey]: false },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status, amount: 4 }, texts);
      expect(result.playerStatuses[status as keyof typeof result.playerStatuses]).toBe(4);
    });

    it("does not block burn even with block and talents", () => {
      const state = makeTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, block: 5 }),
        talentEffects: {
          ...defaultTalentEffects,
          ...makeTestBattleState().talentEffects,
          blockPreventsBleed: true,
          blockPreventsPoison: true,
        },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(result.playerStatuses.burn).toBe(3);
    });
  });

  it("the Mask allows incoming Poison before cleansing on the next turn", () => {
    const state = makeTestBattleState({
      trinketEffects: defaultTrinketManifest({ plagueDoctorPoisonCleanse: 2 }),
    });
    const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, []);
    expect(result.playerStatuses.poison).toBe(3);
  });
});
