import { createElement, StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

  it("initializes gear with default sort (Unique -> Astral -> Basic, Name A-Z, ID)", () => {
    const pickerItems = [swordBasic2, hatchetBasic, swordUnique, swordBasic1, swordAstral];
    const { result } = renderHook(() =>
      useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "main-hand",
        pickerItems,
        ownedTrinkets: [],
      }),
    );

    expect(result.current.orderedGear.map((i) => i.instanceId)).toEqual([
      "sword-unique",
      "sword-astral",
      "hatchet-b1",
      "sword-b1",
      "sword-b2",
    ]);
    expect(result.current.safePage).toBe(0);
  });

  it("initializes trinkets with default sort (Name A-Z, ID)", () => {
    const ownedTrinkets = [trinketB, trinketA];
    const { result } = renderHook(() =>
      useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "trinket",
        pickerItems: [],
        ownedTrinkets,
      }),
    );

    expect(result.current.orderedTrinkets.map((t) => t.id)).toEqual(["trinket-a", "trinket-b"]);
  });

  it("preserves working order and page when switching heroes or categories", () => {
    // 8 items = 2 pages
    const manyItems = Array.from({ length: 8 }, (_, i) => ({
      instanceId: `sword-${i}`,
      definitionId: "longsword-basic",
      affixes: [],
    }));

    const { result, rerender } = renderHook(
      ({ charId, slot }: { charId: "knight" | "rogue"; slot: "main-hand" | "body" }) =>
        useArmoryOrdering({
          characterId: charId,
          selectedSlot: slot,
          pickerItems: manyItems,
          ownedTrinkets: [],
        }),
      {
        initialProps: { charId: "knight", slot: "main-hand" },
      },
    );

    // Change to page 1 on knight:main-hand
    act(() => {
      result.current.setPage(1);
    });
    expect(result.current.safePage).toBe(1);

    // Switch to rogue:main-hand
    rerender({ charId: "rogue", slot: "main-hand" });
    expect(result.current.safePage).toBe(0); // rogue starts on page 0

    // Switch back to knight:main-hand
    rerender({ charId: "knight", slot: "main-hand" });
    expect(result.current.safePage).toBe(1); // knight remembered page 1
  });

  it("sorts on demand and resets to page 0", () => {
    const items = [swordBasic1, hatchetBasic, swordAstral, swordUnique];
    const { result } = renderHook(() =>
      useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "main-hand",
        pickerItems: items,
        ownedTrinkets: [],
      }),
    );

    act(() => {
      result.current.onSort("name");
    });

    expect(result.current.orderedGear.map((i) => i.instanceId)).toEqual([
      "sword-astral", // Astral Longsword
      "hatchet-b1", // Hatchet
      "sword-b1", // Longsword
      "sword-unique", // Oathkeeper
    ]);
    expect(result.current.safePage).toBe(0);
  });

  it("places the replaced item at the incoming item's position after inventory refresh", () => {
    const replacement = { ...swordBasic2, instanceId: "replacement" };
    const { result, rerender } = renderHook(
      ({ items }) =>
        useArmoryOrdering({
          characterId: "knight",
          selectedSlot: "main-hand",
          pickerItems: items,
          ownedTrinkets: [],
        }),
      { initialProps: { items: [swordBasic1, hatchetBasic, swordAstral] } },
    );
    act(() => result.current.commitEquip(hatchetBasic.instanceId, replacement.instanceId));
    rerender({ items: [replacement, swordBasic1, swordAstral] });
    expect(result.current.orderedGear.map((item) => item.instanceId)).toEqual([
      "sword-astral",
      "replacement",
      "sword-b1",
    ]);
    expect(result.current.placeholderLocalIndex).toBeNull();
  });

  it("inserts unequipped items at the start of the current page after inventory refresh", () => {
    const items: GearInstance[] = Array.from({ length: 8 }, (_, i) => ({
      instanceId: `sword-${i}`,
      definitionId: "longsword-basic",
      affixes: [],
    }));
    const returned = { ...swordBasic1, instanceId: "returned" };
    const { result, rerender } = renderHook(
      ({ pool }) =>
        useArmoryOrdering({
          characterId: "knight",
          selectedSlot: "main-hand",
          pickerItems: pool,
          ownedTrinkets: [],
        }),
      { initialProps: { pool: items } },
    );
    act(() => result.current.setPage(1));
    act(() => result.current.commitUnequip(returned.instanceId));
    rerender({ pool: [...items, returned] });
    expect(result.current.safePage).toBe(1);
    expect(result.current.pagedGear.map((item) => item.instanceId)).toEqual(["returned", "sword-6", "sword-7"]);
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
    expect(result.current.orderedGear).toEqual([hatchetBasic, crafted]);
    act(() => result.current.onSort("rarity"));
    expect(result.current.orderedGear).toEqual([crafted, hatchetBasic]);
    act(() => result.current.commitUnequip(hatchetBasic.instanceId));
    expect(result.current.orderedGear).toEqual([hatchetBasic, crafted]);
    unmount();
    const remounted = renderHook(useArmoryOrdering, { initialProps: updated });
    expect(remounted.result.current.orderedGear).toEqual([crafted, hatchetBasic]);
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
        ? ordering.orderedGear.map((item) => item.instanceId)
        : ordering.orderedTrinkets.map((item) => item.id);
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
    expect(result.current.orderedGear.map((item) => item.instanceId)).toEqual([
      swordAstral.instanceId,
      replacement.instanceId,
      displaced.instanceId,
      swordBasic2.instanceId,
    ]);
  });
});
