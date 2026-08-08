import { describe, expect, it } from "vitest";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
  defaultCombatFlags,
} from "../../fixtures/default-battle-state";

describe("applyPlayerStatusFromAttack", () => {
  describe("direct harmful statuses (burn, poison, bleed)", () => {
    it.each([
      { status: "burn", expectedAmount: 5 },
      { status: "poison", expectedAmount: 5 },
      { status: "bleed", expectedAmount: 10 },
    ] as const)("applies $status status from enemy attack", ({ status, expectedAmount }) => {
      const state = makeTestBattleState();
      const texts: CombatTextEvent[] = [];
      const effect = { kind: "player-status" as const, status, amount: 5 };
      const result = applyPlayerStatusFromAttack(state, effect, texts);
      expect(result.playerStatuses[status]).toBe(expectedAmount);
      expect(texts).toEqual([{ target: "player", kind: "damage", stat: status, amount: expectedAmount }]);
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
      expect(result.playerStatuses[status as keyof typeof result.playerStatuses]).toBe(status === "bleed" ? 8 : 4);
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

  describe("plague doctor immunity boon", () => {
    it("prevents first harmful status application when boon is active", () => {
      const state = makeTestBattleState({
        trinketEffects: defaultTrinketManifest({
          ...makeTestBattleState().trinketEffects,
          plagueDoctorImmunity: true,
        }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, texts);
      expect(result.playerStatuses.poison).toBe(0);
      expect(result.flags.firstHarmfulStatusPrevented).toBe(true);
    });

    it("allows second harmful status after first was already prevented", () => {
      const state = makeTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...makeTestBattleState().playerStatuses, poison: 2 }),
        trinketEffects: defaultTrinketManifest({
          ...makeTestBattleState().trinketEffects,
          plagueDoctorImmunity: true,
        }),
        flags: defaultCombatFlags({ ...makeTestBattleState().flags, firstHarmfulStatusPrevented: true }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, texts);
      expect(result.playerStatuses.poison).toBe(5);
    });

    it("does not prevent beneficial statuses", () => {
      const state = makeTestBattleState({
        trinketEffects: defaultTrinketManifest({
          ...makeTestBattleState().trinketEffects,
          plagueDoctorImmunity: true,
        }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "armor", amount: 3 }, texts);
      expect(result.playerStatuses.armor).toBe(3);
    });
  });
});
