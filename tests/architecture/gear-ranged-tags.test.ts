import { describe, expect, it } from "vitest";
import type { GearBaseItemDefinition } from "@/lib/gear/base-items";
import { gearBaseItemList } from "@/lib/gear/base-items";

const list = gearBaseItemList as GearBaseItemDefinition[];

describe("ranged weapon tagging", () => {
  it("every base item has an explicit slotRule", () => {
    const untagged = list.filter((item) => item.slotRule === undefined);
    expect(untagged, untagged.map((i) => i.id).join(", ")).toEqual([]);
  });

  it("only known ranged weapons have slotRule 'ranged'", () => {
    const ranged = list.filter((item) => item.slotRule === "ranged");
    const ids = ranged.map((item) => item.id).sort();
    expect(ids).toEqual(["crossbow", "longbow", "recurve-bow", "shortbow"]);
  });

  it("quiver has slotRule 'quiver'", () => {
    const quiver = list.find((item) => item.id === "quiver");
    expect(quiver?.slotRule).toBe("quiver");
  });

  it("no item other than quiver has slotRule 'quiver'", () => {
    const quivers = list.filter((item) => item.slotRule === "quiver");
    expect(quivers).toHaveLength(1);
    expect(quivers[0]!.id).toBe("quiver");
  });
});
