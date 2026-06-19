import { describe, expect, it } from "vitest";
import { gearBaseItemList } from "@/lib/gear/base-items";

describe("ranged weapon tagging", () => {
  it("every main-hand base item has an explicit rangedWeapon value", () => {
    const mainHandItems = gearBaseItemList.filter((item) => item.compatibleSlots.includes("main-hand"));
    const untagged = mainHandItems.filter((item) => item.rangedWeapon === undefined);
    expect(untagged, untagged.map((i) => i.id).join(", ")).toEqual([]);
  });

  it("only known ranged weapons are tagged true", () => {
    const ranged = gearBaseItemList.filter((item) => item.rangedWeapon === true);
    const ids = ranged.map((item) => item.id).sort();
    expect(ids).toEqual(["crossbow", "longbow", "recurve-bow", "shortbow"]);
  });

  it("quiver is tagged quiver: true", () => {
    const quiver = gearBaseItemList.find((item) => item.id === "quiver");
    expect(quiver?.quiver).toBe(true);
  });

  it("no off-hand item other than quiver is tagged quiver: true", () => {
    const quivers = gearBaseItemList.filter((item) => item.quiver === true);
    expect(quivers).toHaveLength(1);
    expect(quivers[0]!.id).toBe("quiver");
  });
});
