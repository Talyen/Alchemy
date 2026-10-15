import { describe, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState, subscribeGameplayCommits } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { dispatchGearSalvageWithMaterialGrant } from "@/features/alchemy/shared/stores/gear-session-command";
import { emptyInventory } from "@/lib/homestead/inventory";
import { EMPTY_CRAFTING_CURRENCIES, computeSalvageYield, type GearInstance } from "@/lib/gear";
import {
  salvageGear,
  applyCurrencyToGear,
  equipGear,
  unequipGear,
} from "@/features/alchemy/shared/stores/gear-commands";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import type { SaveData } from "@/features/alchemy/shared/storage/types";

function recordingBackend() {
  const writes: string[] = [];
  return {
    writes,
    backend: {
      readCandidates: async () => ({ ok: true as const, candidates: [] }),
      write: async (_key: string, value: string) => {
        writes.push(value);
        return { ok: true as const };
      },
      writeSync: () => null,
      clear: async () => ({ ok: true as const }),
    },
  };
}

describe("Gear command boundary", () => {
  it("cannot grant salvage payouts supplied by a caller without consuming an owned item", async () => {
    await using session = createGameSession();

    const before = readGameplayState(session);
    const fabricated = () => ({
      yieldedMaterials: { ...emptyInventory(), iron: 999 },
      yieldedCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
    });
    expect(Reflect.apply(dispatchGearSalvageWithMaterialGrant, undefined, [fabricated, session])).toBeNull();
    expect(readGameplayState(session)).toBe(before);
  });
  it.each([false, true])("settles salvage and checkpoints the complete result with active run = %s", async (active) => {
    const { backend, writes } = recordingBackend();
    await using session = createGameSession({ saveBackend: backend });
    const armor: GearInstance = {
      instanceId: "salvaged-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    const yieldResult = computeSalvageYield(armor);

    dispatchGameplayCommand(
      (draft) => {
        mutateGearWithRunHealthSync(draft, {
          mutate: (gear) => {
            gear.addInstance(armor, "knight");
            gear.equip("knight", "body", armor);
          },
        });
        if (active) {
          draft.session.activity = { kind: "destination" };
          Object.assign(draft.run.activeRun, { runPlayerHealth: 37, runMaxHealth: 37, runMetaMaxHealth: 37 });
        }
        return acceptCommand();
      },
      undefined,
      session,
    );
    const before = readGameplayState(session);
    const observed: unknown[] = [];
    // Every observer must see item removal, payout, accounting and Health together.
    const unsubscribe = subscribeGameplayCommits(() => observed.push(readGameplayState(session)), session);
    expect(salvageGear(armor.instanceId, session)).toBe(true);
    const after = readGameplayState(session);
    unsubscribe();
    expect(after.revision).toBe(before.revision + 1);
    expect(observed).toEqual([after]);
    expect(after.gear.inventories.knight).toEqual([]);
    expect(after.gear.loadouts.knight.body).toBeNull();
    expect(after.runProfile.materialInventory).toEqual(yieldResult.materials);
    expect(after.gear.craftingCurrencies).toEqual(yieldResult.currencies);
    expect(after.run.activeRun.runMaterialsEarned).toEqual(active ? yieldResult.materials : emptyInventory());
    expect(after.run.activeRun.runCurrenciesEarned).toEqual(
      active ? yieldResult.currencies : EMPTY_CRAFTING_CURRENCIES,
    );
    if (active) {
      expect(after.run.activeRun.runMaxHealth).toBe(30);
      expect(after.run.activeRun.runPlayerHealth).toBe(30);
    }
    expect(salvageGear(armor.instanceId, session)).toBe(false);
    expect(readGameplayState(session)).toBe(after);
    await session.dispose();
    expect(writes).toHaveLength(1);
    const saved: SaveData = JSON.parse(writes[0]!);
    expect(saved.gearInventories.knight).toEqual([]);
    expect(saved.materialInventory).toEqual(yieldResult.materials);
    expect(saved.craftingCurrencies).toEqual(yieldResult.currencies);
    if (active) {
      expect(saved.activeRun?.runMaterialsEarned).toEqual(yieldResult.materials);
      expect(saved.activeRun?.runCurrenciesEarned).toEqual(yieldResult.currencies);
      expect(saved.activeRun?.runMaxHealth).toBe(after.run.activeRun.runMaxHealth);
    }
  });

  it("uses the intent command for crafting and saves only accepted actions", async () => {
    const { backend, writes } = recordingBackend();
    await using session = createGameSession({ saveBackend: backend });
    const item: GearInstance = {
      instanceId: "crafted-sword",
      definitionId: "shortsword-basic",
      affixes: [{ id: "flat-physical", value: 1 }],
    };
    const rng = vi.fn(() => 0);

    dispatchGameplayCommand(
      (draft) => {
        mutateGearWithRunHealthSync(draft, {
          mutate: (gear) => {
            gear.addInstance(item, "knight");
            gear.addCurrencies({ voidstone: 1 });
          },
        });
        return acceptCommand();
      },
      undefined,
      session,
    );
    expect(applyCurrencyToGear("voidstone", item.instanceId, { rng }, session)).toBe(true);
    const after = readGameplayState(session);
    const calls = rng.mock.calls.length;
    expect(applyCurrencyToGear("voidstone", item.instanceId, { rng }, session)).toBe(false);
    expect(equipGear("knight", "main-hand", { ...item, instanceId: "missing" }, session)).toBe(false);
    expect(unequipGear("knight", "main-hand", session)).toBe(false);
    expect(rng).toHaveBeenCalledTimes(calls);
    expect(readGameplayState(session)).toBe(after);
    await session.dispose();
    expect(writes).toHaveLength(1);
    const saved: SaveData = JSON.parse(writes[0]!);
    expect(saved.gearInventories.knight[0]?.affixes).toEqual([]);
    expect(saved.craftingCurrencies.voidstone).toBe(0);
  });
});
