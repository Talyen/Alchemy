import { describe, expect, it } from "vitest";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-application";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultEnemyMitigation,
  defaultTalentEffects,
  defaultTrinketManifest,
  defaultCcState,
  defaultCombatFlags,
} from "../../fixtures/default-battle-state";

describe("applyPlayerStatusFromAttack", () => {
  describe("harmful statuses (burn, poison, bleed, freeze, stun)", () => {
    it.each(["burn", "poison", "bleed", "freeze", "stun"] as const)("applies %s status from enemy attack", (status) => {
      const state = createTestBattleState();
      const texts: CombatTextEvent[] = [];
      const effect = { kind: "player-status" as const, status, amount: 5 };
      const result = applyPlayerStatusFromAttack(state, effect, texts);
      expect(result.playerStatuses[status]).toBe(5);
      expect(texts).toEqual([{ target: "player", kind: "damage", stat: status, amount: 5 }]);
    });

    it("does not mutate original state", () => {
      const state = createTestBattleState();
      const texts: CombatTextEvent[] = [];
      applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(state.playerStatuses.burn).toBe(0);
    });
  });

  describe("beneficial statuses (armor, block, forge, haste)", () => {
    it.each(["armor", "block", "forge", "haste"] as const)(
      "applies %s status from enemy attack with status combat text kind",
      (status) => {
        const state = createTestBattleState();
        const texts: CombatTextEvent[] = [];
        const effect = { kind: "player-status" as const, status, amount: 4 };
        const result = applyPlayerStatusFromAttack(state, effect, texts);
        expect(result.playerStatuses[status]).toBe(4);
        expect(texts).toEqual([{ target: "player", kind: "status", stat: status, amount: 4 }]);
      },
    );

    it("adds beneficial status to existing stack", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 3 }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "armor", amount: 2 }, texts);
      expect(result.playerStatuses.armor).toBe(5);
    });
  });

  describe("freeze bonus from enemy mitigation", () => {
    it("adds freezeBonus to freeze amount when enemy has Glacial-Shell active", () => {
      const state = createTestBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 0, forge: 0, freezeBonus: 2 }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "freeze", amount: 3 }, texts);
      expect(result.playerStatuses.freeze).toBe(5);
    });

    it("does not add freezeBonus to non-freeze statuses", () => {
      const state = createTestBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 0, forge: 0, freezeBonus: 2 }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(result.playerStatuses.burn).toBe(3);
    });
  });

  describe("block prevents status via talents", () => {
    it.each([
      { status: "bleed", talentKey: "blockPreventsBleed" as const },
      { status: "poison", talentKey: "blockPreventsPoison" as const },
      { status: "stun", talentKey: "blockPreventsStun" as const },
    ])("prevents $status when player has block and $talentKey talent", ({ status, talentKey }) => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, block: 5 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, [talentKey]: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(
        state,
        { kind: "player-status", status: status as "bleed" | "poison" | "stun", amount: 4 },
        texts,
      );
      expect(result.playerStatuses[status]).toBe(0);
      expect(texts).toEqual([]);
    });

    it.each([
      { status: "bleed", talentKey: "blockPreventsBleed" as const },
      { status: "poison", talentKey: "blockPreventsPoison" as const },
      { status: "stun", talentKey: "blockPreventsStun" as const },
    ])("does not block $status when talent is inactive even with block", ({ status, talentKey }) => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, block: 5 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, [talentKey]: false },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(
        state,
        { kind: "player-status", status: status as "bleed" | "poison" | "stun", amount: 4 },
        texts,
      );
      expect(result.playerStatuses[status]).toBe(4);
    });

    it("does not block burn even with block and talents", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, block: 5 }),
        talentEffects: {
          ...defaultTalentEffects,
          ...createTestBattleState().talentEffects,
          blockPreventsBleed: true,
          blockPreventsPoison: true,
          blockPreventsStun: true,
        },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "burn", amount: 3 }, texts);
      expect(result.playerStatuses.burn).toBe(3);
    });

    it("does not block freeze even with block and talents", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, block: 5 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, blockPreventsBleed: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "freeze", amount: 3 }, texts);
      expect(result.playerStatuses.freeze).toBe(3);
    });
  });

  describe("armor mitigates stun", () => {
    it("reduces stun amount by player armor when armorMitigatesStun is active", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 3 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, armorMitigatesStun: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "stun", amount: 5 }, texts);
      expect(result.playerStatuses.stun).toBe(2);
    });

    it("reduces stun to 0 when armor exceeds stun amount", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 10 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, armorMitigatesStun: true },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "stun", amount: 5 }, texts);
      expect(result.playerStatuses.stun).toBe(0);
    });

    it("does not reduce stun when armorMitigatesStun is inactive", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 3 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, armorMitigatesStun: false },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "stun", amount: 5 }, texts);
      expect(result.playerStatuses.stun).toBe(5);
    });
  });

  describe("plague doctor immunity boon", () => {
    it("prevents first harmful status application when boon is active", () => {
      const state = createTestBattleState({
        trinketEffects: defaultTrinketManifest({
          ...createTestBattleState().trinketEffects,
          plagueDoctorImmunity: true,
        }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, texts);
      expect(result.playerStatuses.poison).toBe(0);
      expect(result.flags.firstHarmfulStatusPrevented).toBe(true);
    });

    it("allows second harmful status after first was already prevented", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, poison: 2 }),
        trinketEffects: defaultTrinketManifest({
          ...createTestBattleState().trinketEffects,
          plagueDoctorImmunity: true,
        }),
        flags: defaultCombatFlags({ ...createTestBattleState().flags, firstHarmfulStatusPrevented: true }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, texts);
      expect(result.playerStatuses.poison).toBe(5);
    });

    it("does not prevent beneficial statuses", () => {
      const state = createTestBattleState({
        trinketEffects: defaultTrinketManifest({
          ...createTestBattleState().trinketEffects,
          plagueDoctorImmunity: true,
        }),
      });
      const texts: CombatTextEvent[] = [];
      const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "armor", amount: 3 }, texts);
      expect(result.playerStatuses.armor).toBe(3);
    });
  });
});
