import { describe, expect, it } from "vitest";
import {
  armoryTargetingReducer,
  initialArmoryTargetingState,
  type ArmoryTargetingState,
} from "@/features/alchemy/meta/screens/armory/armory-targeting-state";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";

const helm: GearInstance = { instanceId: "helm-1", definitionId: "leather-helm-basic", affixes: [] };
const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };
const discordant: CraftingCurrencyId = "discordant-dice";
const voidstone: CraftingCurrencyId = "voidstone";

function apply(
  state: ArmoryTargetingState,
  ...actions: Parameters<typeof armoryTargetingReducer>[1][]
): ArmoryTargetingState {
  return actions.reduce((acc, action) => armoryTargetingReducer(acc, action), state);
}

describe("armoryTargetingReducer", () => {
  it("starts with all targeting fields empty", () => {
    expect(initialArmoryTargetingState).toEqual({
      salvageMode: false,
      salvageTarget: null,
      activeCurrencyId: null,
      cursorPoint: null,
      transferMenu: null,
    });
  });

  describe("TOGGLE_SALVAGE_MODE", () => {
    it("enables salvage mode and clears the active currency", () => {
      const next = apply(initialArmoryTargetingState, { type: "TOGGLE_SALVAGE_MODE" });
      expect(next.salvageMode).toBe(true);
      expect(next.activeCurrencyId).toBeNull();
    });

    it("disables salvage mode when invoked twice", () => {
      const next = apply(initialArmoryTargetingState, { type: "TOGGLE_SALVAGE_MODE" }, { type: "TOGGLE_SALVAGE_MODE" });
      expect(next.salvageMode).toBe(false);
    });
  });

  describe("salvage target lifecycle", () => {
    it("START_SALVAGE_TARGET records the target", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, { type: "START_SALVAGE_TARGET", target: helm });
      expect(next.salvageTarget).toBe(helm);
    });

    it("CLEAR_SALVAGE_TARGET is a no-op when no target is set", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, { type: "CLEAR_SALVAGE_TARGET" });
      expect(next).toBe(initialArmoryTargetingState);
    });

    it("CLEAR_SALVAGE_TARGET drops the target", () => {
      const withTarget = { ...initialArmoryTargetingState, salvageTarget: ring };
      const next = armoryTargetingReducer(withTarget, { type: "CLEAR_SALVAGE_TARGET" });
      expect(next.salvageTarget).toBeNull();
    });

    it("SALVAGE_TARGET_GONE drops the target only when one is set", () => {
      const withTarget = { ...initialArmoryTargetingState, salvageTarget: ring };
      const next = armoryTargetingReducer(withTarget, { type: "SALVAGE_TARGET_GONE" });
      expect(next.salvageTarget).toBeNull();
      expect(armoryTargetingReducer(initialArmoryTargetingState, { type: "SALVAGE_TARGET_GONE" })).toBe(
        initialArmoryTargetingState,
      );
    });
  });

  describe("currency targeting", () => {
    it("TOGGLE_CURRENCY switches between two currencies", () => {
      const on = { ...initialArmoryTargetingState, activeCurrencyId: discordant };
      const next = armoryTargetingReducer(on, { type: "TOGGLE_CURRENCY", currencyId: voidstone });
      expect(next.activeCurrencyId).toBe(voidstone);
    });

    it("TOGGLE_CURRENCY deselects when invoked with the active currency", () => {
      const on = { ...initialArmoryTargetingState, activeCurrencyId: discordant };
      const next = armoryTargetingReducer(on, { type: "TOGGLE_CURRENCY", currencyId: discordant });
      expect(next.activeCurrencyId).toBeNull();
    });

    it("DESELECT_CURRENCY is a no-op when no currency is active", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, { type: "DESELECT_CURRENCY" });
      expect(next).toBe(initialArmoryTargetingState);
    });

    it("CURRENCY_DEPLETED is a no-op when no currency is active", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, { type: "CURRENCY_DEPLETED" });
      expect(next).toBe(initialArmoryTargetingState);
    });

    it("CURRENCY_DEPLETED clears the active currency", () => {
      const on = { ...initialArmoryTargetingState, activeCurrencyId: discordant };
      const next = armoryTargetingReducer(on, { type: "CURRENCY_DEPLETED" });
      expect(next.activeCurrencyId).toBeNull();
    });
  });

  describe("cursor", () => {
    it("SET_CURSOR stores the point", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, { type: "SET_CURSOR", point: { x: 10, y: 20 } });
      expect(next.cursorPoint).toEqual({ x: 10, y: 20 });
    });

    it("SET_CURSOR is a no-op when the point is the same", () => {
      const on = { ...initialArmoryTargetingState, cursorPoint: { x: 10, y: 20 } };
      const next = armoryTargetingReducer(on, { type: "SET_CURSOR", point: { x: 10, y: 20 } });
      expect(next).toBe(on);
    });
  });

  describe("composite clear actions", () => {
    it("CLEAR_TARGETING resets all targeting fields but preserves the salvage target", () => {
      const dirty: ArmoryTargetingState = {
        salvageMode: true,
        salvageTarget: helm,
        activeCurrencyId: discordant,
        transferMenu: null,
        cursorPoint: { x: 1, y: 2 },
      };
      const next = armoryTargetingReducer(dirty, { type: "CLEAR_TARGETING" });
      expect(next.salvageMode).toBe(false);
      expect(next.activeCurrencyId).toBeNull();
      expect(next.cursorPoint).toBeNull();
      expect(next.salvageTarget).toBe(helm);
    });

    it("CLEAR_TARGETING is a no-op when nothing is set", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, { type: "CLEAR_TARGETING" });
      expect(next).toBe(initialArmoryTargetingState);
    });

    it("EDITABLE_LOST resets all four fields including the salvage target", () => {
      const dirty: ArmoryTargetingState = {
        salvageMode: true,
        salvageTarget: helm,
        activeCurrencyId: discordant,
        transferMenu: null,
        cursorPoint: { x: 1, y: 2 },
      };
      const next = armoryTargetingReducer(dirty, { type: "EDITABLE_LOST" });
      expect(next).toEqual({
        salvageMode: false,
        salvageTarget: null,
        activeCurrencyId: null,
        transferMenu: null,
        cursorPoint: null,
      });
    });

    it("SELECT_CHARACTER resets all four fields including the salvage target", () => {
      const dirty: ArmoryTargetingState = {
        salvageMode: true,
        salvageTarget: helm,
        activeCurrencyId: discordant,
        transferMenu: null,
        cursorPoint: { x: 1, y: 2 },
      };
      const next = armoryTargetingReducer(dirty, { type: "SELECT_CHARACTER" });
      expect(next).toEqual({
        salvageMode: false,
        salvageTarget: null,
        activeCurrencyId: null,
        transferMenu: null,
        cursorPoint: null,
      });
    });
  });

  describe("transfer menu", () => {
    it("OPEN_TRANSFER_MENU stores the instanceId, sourceCharacterId, and anchor point", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, {
        type: "OPEN_TRANSFER_MENU",
        instanceId: "helm-1",
        sourceCharacterId: "knight",
        anchor: { x: 100, y: 200 },
      });
      expect(next.transferMenu).toEqual({
        instanceId: "helm-1",
        sourceCharacterId: "knight",
        anchor: { x: 100, y: 200 },
      });
    });

    it("CLOSE_TRANSFER_MENU is a no-op when the menu is already closed", () => {
      const next = armoryTargetingReducer(initialArmoryTargetingState, { type: "CLOSE_TRANSFER_MENU" });
      expect(next).toBe(initialArmoryTargetingState);
    });

    it("CLOSE_TRANSFER_MENU clears the transfer menu state", () => {
      const withMenu = {
        ...initialArmoryTargetingState,
        transferMenu: { instanceId: "helm-1", sourceCharacterId: "knight" as const, anchor: { x: 100, y: 200 } },
      };
      const next = armoryTargetingReducer(withMenu, { type: "CLOSE_TRANSFER_MENU" });
      expect(next.transferMenu).toBeNull();
    });
  });
});
