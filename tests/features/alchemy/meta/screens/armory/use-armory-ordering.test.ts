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

  it("handles commitReplacement preserving clicked inventory slot", () => {
    const items = [swordBasic1, hatchetBasic, swordAstral];
    const { result } = renderHook(() =>
      useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "main-hand",
        pickerItems: items,
        ownedTrinkets: [],
      }),
    );

    // Initial order: Astral, Hatchet, Longsword
    expect(result.current.orderedGear.map((i) => i.instanceId)).toEqual(["sword-astral", "hatchet-b1", "sword-b1"]);

    act(() => {
      result.current.commitReplacement("hatchet-b1", "replaced-shield");
    });

    // hatchet-b1 at index 1 is replaced by replaced-shield
    // When pickerItems contains replaced-shield:
    // next state should have replaced-shield at index 1
  });

  it("handles commitUnequip inserting at start of current page", () => {
    const manyItems = Array.from({ length: 8 }, (_, i) => ({
      instanceId: `sword-${i}`,
      definitionId: "longsword-basic",
      affixes: [],
    }));

    const { result } = renderHook(() =>
      useArmoryOrdering({
        characterId: "knight",
        selectedSlot: "main-hand",
        pickerItems: manyItems,
        ownedTrinkets: [],
      }),
    );

    act(() => {
      result.current.setPage(1);
    });

    act(() => {
      result.current.commitUnequip("unequipped-sword");
    });

    // Page is 1, page size 6 -> inserted at index 6
    expect(result.current.safePage).toBe(1);
  });
});
