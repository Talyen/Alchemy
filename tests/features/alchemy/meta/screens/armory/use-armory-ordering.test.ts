import { createElement, StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_ARMORY_INVENTORY_FILTERS } from "@/features/alchemy/meta/screens/armory/armory-inventory-filtering";
import { useArmoryOrdering } from "@/features/alchemy/meta/screens/armory/use-armory-ordering";
import type { GearInstance } from "@/lib/gear";
import type { TrinketEntry } from "@/lib/game-data";

describe("useArmoryOrdering", () => {
  const swordBasic1: GearInstance = {
    instanceId: "sword-b1",
    definitionId: "longsword-basic",
    affixes: [],
  };
  const swordBasic2: GearInstance = {
    instanceId: "sword-b2",
    definitionId: "longsword-basic",
    affixes: [],
  };
  const swordAstral: GearInstance = {
    instanceId: "sword-astral",
    definitionId: "longsword-astral",
    affixes: [],
  };
  const swordUnique: GearInstance = {
    instanceId: "sword-unique",
    definitionId: "oathkeeper",
    affixes: [],
  };
  const hatchetBasic: GearInstance = {
    instanceId: "hatchet-b1",
    definitionId: "hatchet-basic",
    affixes: [],
  };

  const trinketA: TrinketEntry = {
    id: "trinket-a",
    title: "Amber Charm",
    art: "",
    descriptionLines: [],
    effects: {},
  };
  const trinketB: TrinketEntry = {
    id: "trinket-b",
    title: "Ruby Ring",
    art: "",
    descriptionLines: [],
    effects: {},
  };

  it("switches between Gear and Trinkets without leaking items that share the same identity", () => {
    const gear = { ...swordBasic1, instanceId: trinketA.id };
    const initial = {
      characterId: "knight" as const,
      selectedSlot: "main-hand" as "main-hand" | "trinket",
      pickerItems: [gear, gear],
      ownedTrinkets: [trinketB, trinketA],
    };
    const { result, rerender } = renderHook(useArmoryOrdering, { initialProps: initial });
    expect(result.current.visibleGear).toEqual([gear]);
    act(() => result.current.onSort("name"));
    expect(result.current.visibleGear).toEqual([gear]);
    expect(result.current.visibleTrinkets).toEqual([]);
    rerender({ ...initial, selectedSlot: "trinket" });
    expect(result.current.visibleTrinkets).toEqual([trinketA, trinketB]);
    expect(result.current.visibleGear).toEqual([]);
    rerender(initial);
    expect(result.current.visibleGear).toEqual([gear]);
    expect(result.current.visibleTrinkets).toEqual([]);
  });

  it("filters without losing hidden order and sorts the full category", () => {
    const { result } = renderHook(() =>
      useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "main-hand",
        pickerItems: [swordBasic1, hatchetBasic, swordAstral, swordUnique],
        ownedTrinkets: [],
      }),
    );
    const before = result.current.visibleGear.map((item) => item.instanceId);
    act(() => result.current.setFilters({ ...DEFAULT_ARMORY_INVENTORY_FILTERS, search: "hatchet" }));
    expect(result.current.pagedGear.map((item) => item.instanceId)).toEqual(["hatchet-b1"]);
    act(() => result.current.setFilters(DEFAULT_ARMORY_INVENTORY_FILTERS));
    expect(result.current.visibleGear.map((item) => item.instanceId)).toEqual(before);
    act(() => result.current.setFilters({ ...DEFAULT_ARMORY_INVENTORY_FILTERS, search: "hatchet" }));
    act(() => result.current.onSort("base-type"));
    expect(result.current.pagedGear.map((item) => item.instanceId)).toEqual(["hatchet-b1"]);
    act(() => result.current.setFilters(DEFAULT_ARMORY_INVENTORY_FILTERS));
    expect(result.current.visibleGear.map((item) => item.instanceId)).toEqual([
      "hatchet-b1",
      "sword-astral",
      "sword-b1",
      "sword-unique",
    ]);
  });

  it("preserves a sort committed in the same batch as a filter change", () => {
    const { result } = renderHook(() =>
      useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "main-hand",
        pickerItems: [swordBasic1, hatchetBasic, swordAstral, swordUnique],
        ownedTrinkets: [],
      }),
    );
    act(() => {
      result.current.onSort("base-type");
      result.current.setFilters({ ...DEFAULT_ARMORY_INVENTORY_FILTERS, search: "hatchet" });
    });
    expect(result.current.pagedGear.map((item) => item.instanceId)).toEqual(["hatchet-b1"]);
    act(() => result.current.setFilters(DEFAULT_ARMORY_INVENTORY_FILTERS));
    expect(result.current.visibleGear.map((item) => item.instanceId)).toEqual([
      "hatchet-b1",
      "sword-astral",
      "sword-b1",
      "sword-unique",
    ]);
  });

  it("remembers criteria and filtered pages by hero/slot and clamps after crafting", () => {
    const items: GearInstance[] = Array.from({ length: 14 }, (_, index) => ({
      ...swordBasic1,
      instanceId: `sword-${String(index).padStart(2, "0")}`,
      affixes: index % 2 === 0 ? [{ id: "flat-physical", value: 1 }] : [],
    }));
    const { result, rerender } = renderHook(
      ({ hero, slot, pool }: { hero: "knight" | "rogue"; slot: "main-hand" | "body"; pool: GearInstance[] }) =>
        useArmoryOrdering({ characterId: hero, selectedSlot: slot, pickerItems: pool, ownedTrinkets: [] }),
      { initialProps: { hero: "knight", slot: "main-hand", pool: items } },
    );
    act(() => result.current.setFilters({ ...DEFAULT_ARMORY_INVENTORY_FILTERS, keywords: ["physical"] }));
    expect(result.current.matchCount).toBe(7);
    act(() => result.current.setPage(1));
    rerender({ hero: "rogue", slot: "main-hand", pool: items });
    expect(result.current.filters.keywords).toEqual([]);
    rerender({ hero: "knight", slot: "body", pool: items });
    expect(result.current.filters.keywords).toEqual([]);
    rerender({ hero: "knight", slot: "main-hand", pool: items });
    expect(result.current.safePage).toBe(1);
    expect(result.current.filters.keywords).toEqual(["physical"]);
    const crafted = items.map((item, index) => (index === 12 ? { ...item, affixes: [] } : item));
    rerender({ hero: "knight", slot: "main-hand", pool: crafted });
    expect(result.current.safePage).toBe(0);
    rerender({ hero: "knight", slot: "main-hand", pool: items });
    expect(result.current.safePage).toBe(0);
  });

  it("places filtered replacements in the full order and unequips before the visible page anchor", () => {
    const items: GearInstance[] = Array.from({ length: 15 }, (_, index) => ({
      ...swordBasic1,
      instanceId: `sword-${String(index).padStart(2, "0")}`,
      affixes: index % 2 === 0 ? [{ id: "flat-physical", value: 1 }] : [],
    }));
    const returned = { ...hatchetBasic, instanceId: "returned" };
    const { result, rerender } = renderHook(
      ({ pool }) =>
        useArmoryOrdering({ characterId: "knight", selectedSlot: "main-hand", pickerItems: pool, ownedTrinkets: [] }),
      { initialProps: { pool: items } },
    );
    act(() => result.current.setFilters({ ...DEFAULT_ARMORY_INVENTORY_FILTERS, keywords: ["physical"] }));
    act(() => result.current.setPage(1));
    act(() => result.current.commitEquip("sword-12", returned.instanceId));
    rerender({ pool: [...items.filter((item) => item.instanceId !== "sword-12"), returned] });
    expect(result.current.pagedGear.map((item) => item.instanceId)).toEqual(["sword-14"]);
    expect(result.current.placeholderLocalIndex).toBeNull();
    const unequipped = {
      ...swordBasic2,
      instanceId: "unequipped",
      affixes: [{ id: "flat-physical" as const, value: 1 }],
    };
    act(() => result.current.commitUnequip(unequipped.instanceId));
    rerender({ pool: [...items.filter((item) => item.instanceId !== "sword-12"), returned, unequipped] });
    expect(result.current.visibleGear.slice(-2).map((item) => item.instanceId)).toEqual(["unequipped", "sword-14"]);
    expect(result.current.pagedGear.map((item) => item.instanceId)).toEqual(["unequipped", "sword-14"]);
    act(() => result.current.setFilters({ ...DEFAULT_ARMORY_INVENTORY_FILTERS, search: "no matches" }));
    const secondReturn = { ...returned, instanceId: "second-return" };
    act(() => result.current.commitUnequip(secondReturn.instanceId));
    rerender({ pool: [...items.filter((item) => item.instanceId !== "sword-12"), returned, unequipped, secondReturn] });
    expect(result.current.matchCount).toBe(0);
    act(() => result.current.setFilters(DEFAULT_ARMORY_INVENTORY_FILTERS));
    expect(result.current.visibleGear[0]?.instanceId).toBe("second-return");
  });

  it("keeps crafted gear in place until explicitly sorted, then resets on remount", () => {
    const initial = {
      characterId: "knight" as const,
      selectedSlot: "main-hand" as const,
      pickerItems: [hatchetBasic, swordBasic1],
      ownedTrinkets: [],
    };
    const crafted = { ...swordBasic1, definitionId: "longsword-astral" };
    const updated = { ...initial, pickerItems: [hatchetBasic, crafted] };
    const { result, rerender, unmount } = renderHook(useArmoryOrdering, { initialProps: initial });
    rerender(updated);
    expect(result.current.visibleGear).toEqual([hatchetBasic, crafted]);
    act(() => result.current.onSort("rarity"));
    expect(result.current.visibleGear).toEqual([crafted, hatchetBasic]);
    act(() => result.current.commitUnequip(hatchetBasic.instanceId));
    expect(result.current.visibleGear).toEqual([hatchetBasic, crafted]);
    unmount();
    const remounted = renderHook(useArmoryOrdering, { initialProps: updated });
    expect(remounted.result.current.visibleGear).toEqual([crafted, hatchetBasic]);
    expect(remounted.result.current.safePage).toBe(0);
  });

  describe.each(["gear", "trinkets"] as const)("%s inventory lifecycle", (kind) => {
    function props(ids: string[]): Parameters<typeof useArmoryOrdering>[0] {
      return {
        characterId: "knight",
        selectedSlot: kind === "gear" ? "main-hand" : "trinket",
        pickerItems: kind === "gear" ? ids.map((instanceId) => ({ ...swordBasic1, instanceId })) : [],
        ownedTrinkets: kind === "trinkets" ? ids.map((id) => ({ ...trinketA, id, title: id })) : [],
      };
    }
    function ids(ordering: ReturnType<typeof useArmoryOrdering>) {
      return kind === "gear"
        ? ordering.visibleGear.map((item) => item.instanceId)
        : ordering.visibleTrinkets.map((item) => item.id);
    }

    it("retains successive arrival batches and removes missing items under Strict Mode", () => {
      const { result, rerender } = renderHook((input) => useArmoryOrdering(props(input)), {
        initialProps: ["a"],
        wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
      });
      rerender(["z", "a"]);
      expect(ids(result.current)).toEqual(["a", "z"]);
      rerender(["b", "z", "a", "c"]);
      expect(ids(result.current)).toEqual(["a", "z", "b", "c"]);
      rerender(["c", "b", "a", "z"]);
      expect(ids(result.current)).toEqual(["a", "z", "b", "c"]);
      rerender(["c", "b", "a"]);
      expect(ids(result.current)).toEqual(["a", "b", "c"]);
      rerender(["z", "c", "b", "a"]);
      expect(ids(result.current)).toEqual(["a", "b", "c", "z"]);
    });

    it("remembers a clamped page through regrowth and an empty inventory", () => {
      const all = ["a", "b", "c", "d", "e", "f", "g"];
      const { result, rerender } = renderHook(useArmoryOrdering, { initialProps: props(all) });
      act(() => result.current.setPage(1));
      rerender(props(all.slice(0, 6)));
      expect(result.current.safePage).toBe(0);
      rerender(props(all));
      expect(result.current.safePage).toBe(0);
      act(() => result.current.setPage(1));
      act(() => result.current.onSort("name"));
      expect(result.current.safePage).toBe(0);
      expect(ids(result.current)).toEqual(all);
      act(() => result.current.setPage(1));
      rerender(props([]));
      expect(result.current.safePage).toBe(0);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.fillerCount).toBe(6);
      rerender(props(all));
      expect(result.current.safePage).toBe(0);
      expect(ids(result.current)).toEqual(all);
    });

    it("reconciles a remembered category only when revisited", () => {
      const initial = props(["a", "b", "c", "d", "e", "f", "g"]);
      const { result, rerender } = renderHook(useArmoryOrdering, { initialProps: initial });
      act(() => result.current.setPage(1));
      rerender({ ...initial, characterId: "rogue" });
      expect(result.current.safePage).toBe(0);
      const reduced = props(["b", "z"]);
      rerender({ ...reduced, characterId: "rogue" });
      rerender(reduced);
      expect(ids(result.current)).toEqual(["b", "z"]);
      expect(result.current.safePage).toBe(0);
      rerender({ ...reduced, selectedSlot: "body" });
      rerender(props(["a", "b", "c", "d", "e", "f", "g", "z"]));
      expect(ids(result.current)).toEqual(["b", "z", "a", "c", "d", "e", "f", "g"]);
      expect(result.current.safePage).toBe(0);
    });

    it("preserves transfer placement before and after refreshed inventory arrives", () => {
      const { result, rerender } = renderHook(useArmoryOrdering, { initialProps: props(["a", "b", "c"]) });
      act(() => result.current.commitEquip("b", "z"));
      rerender(props(["c", "b", "a"]));
      expect(ids(result.current)).toEqual(["a", "c"]);
      rerender(props(["z", "c", "a"]));
      expect(ids(result.current)).toEqual(["a", "z", "c"]);
      act(() => result.current.commitEquip("z", null));
      rerender(props(["a", "z", "c"]));
      expect(ids(result.current)).toEqual(["a", "c"]);
      rerender(props(["c", "a"]));
      expect(ids(result.current)).toEqual(["a", "c"]);
      expect(result.current.placeholderLocalIndex).toBe(1);
      act(() => result.current.commitUnequip("b"));
      rerender(props(["a", "c"]));
      rerender(props(["a", "b", "c"]));
      expect(ids(result.current)).toEqual(["b", "a", "c"]);
      expect(result.current.placeholderLocalIndex).toBeNull();
    });
  });

  it("preserves compatible hand-conflict placement through inventory refresh", () => {
    const displaced = { ...hatchetBasic, instanceId: "displaced" };
    const replacement = { ...swordBasic1, instanceId: "replacement" };
    const initial = {
      characterId: "knight" as const,
      selectedSlot: "main-hand" as const,
      pickerItems: [swordAstral, swordBasic1, swordBasic2, displaced],
      ownedTrinkets: [],
    };
    const { result, rerender } = renderHook(useArmoryOrdering, { initialProps: initial });
    act(() =>
      result.current.commitEquip(swordBasic1.instanceId, replacement.instanceId, [
        { slot: "off-hand", instance: displaced },
      ]),
    );
    rerender({ ...initial, pickerItems: [...initial.pickerItems] });
    rerender({ ...initial, pickerItems: [swordAstral, replacement, swordBasic2, displaced] });
    expect(result.current.visibleGear.map((item) => item.instanceId)).toEqual([
      swordAstral.instanceId,
      replacement.instanceId,
      displaced.instanceId,
      swordBasic2.instanceId,
    ]);
  });
});
