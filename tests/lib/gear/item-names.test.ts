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
  it("returns the base display name for basic items", () => {
    expect(
      getGearInstanceTitle(
        instance({
          instanceId: "helm-1",
          definitionId: "leather-helm-basic",
        }),
      ),
    ).toBe("Leather Helm");
  });

  it("prefixes astral items with Astral", () => {
    expect(
      getGearInstanceTitle(
        instance({
          instanceId: "helm-astral",
          definitionId: "leather-helm-astral",
        }),
      ),
    ).toBe("Astral Leather Helm");
  });

  it("ignores affix rolls when naming items", () => {
    expect(
      getGearInstanceTitle(
        instance({
          instanceId: "sword-a",
          definitionId: "longsword-basic",
          affixes: [
            { id: "flat-burn", value: 2 },
            { id: "gold-on-kill", value: 1 },
          ],
        }),
      ),
    ).toBe("Longsword");
  });
});
