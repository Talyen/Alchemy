import { describe, expect, it } from "vitest";
import { getGearInstanceTitle } from "@/lib/gear/item-names";
import type { GearInstance } from "@/lib/gear/types";

function instance(
  overrides: Partial<GearInstance> & Pick<GearInstance, "instanceId" | "definitionId">,
): GearInstance {
  return {
    affixes: [],
    ...overrides,
  };
}

describe("getGearInstanceTitle", () => {
  it("returns the base display name when an item has no affixes", () => {
    expect(
      getGearInstanceTitle(
        instance({
          instanceId: "helm-1",
          definitionId: "leather-helm-basic",
        }),
      ),
    ).toBe("Leather Helm");
  });

  it("returns a deterministic title for the same instance", () => {
    const gear = instance({
      instanceId: "sword-a",
      definitionId: "longsword-basic",
      affixes: [
        { id: "flat-burn", value: 2 },
        { id: "gold-on-kill", value: 1 },
        { id: "leech-potency", value: 10 },
      ],
    });

    const first = getGearInstanceTitle(gear);
    const second = getGearInstanceTitle(gear);
    expect(first).toBe(second);
    expect(first).toContain("Longsword");
  });

  it("can change the picked affix epithets when the instance id changes", () => {
    const affixes = [
      { id: "flat-burn", value: 2 },
      { id: "gold-on-kill", value: 1 },
    ];
    const left = getGearInstanceTitle(
      instance({ instanceId: "item-left", definitionId: "longsword-basic", affixes }),
    );
    const right = getGearInstanceTitle(
      instance({ instanceId: "item-right", definitionId: "longsword-basic", affixes }),
    );

    expect(left).toContain("Longsword");
    expect(right).toContain("Longsword");
  });

  it("uses prefix-only, suffix-only, and combined templates", () => {
    expect(
      getGearInstanceTitle(
        instance({
          instanceId: "prefix-only",
          definitionId: "longsword-basic",
          affixes: [{ id: "leech-potency", value: 10 }],
        }),
      ),
    ).toBe("Leeching Longsword");

    expect(
      getGearInstanceTitle(
        instance({
          instanceId: "suffix-only",
          definitionId: "longsword-basic",
          affixes: [{ id: "gold-on-kill", value: 1 }],
        }),
      ),
    ).toBe("Longsword of Greed");

    expect(
      getGearInstanceTitle(
        instance({
          instanceId: "both-parts",
          definitionId: "longsword-basic",
          affixes: [{ id: "flat-burn", value: 1 }],
        }),
      ),
    ).toBe("Blazing Longsword of Embers");
  });
});
