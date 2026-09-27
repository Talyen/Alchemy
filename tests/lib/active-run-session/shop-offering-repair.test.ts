import { describe, expect, it } from "vitest";
import {
  defaultShopSlotKeyOf,
  repairShopOfferings,
  shopItemSlotKey,
} from "@/lib/active-run-session/shop-offering-repair";

describe("defaultShopSlotKeyOf", () => {
  it("extracts instanceId from gear instances", () => {
    expect(defaultShopSlotKeyOf({ instanceId: "inst-1", definitionId: "ring" }, 0)).toBe("inst-1");
  });

  it("extracts id with index from object with id", () => {
    expect(defaultShopSlotKeyOf({ id: "bone-charm" }, 2)).toBe("bone-charm-2");
  });

  it("extracts primitive string id with index", () => {
    expect(defaultShopSlotKeyOf("slash", 1)).toBe("slash-1");
  });
});

describe("repairShopOfferings", () => {
  it("defaults to defaultShopSlotKeyOf when slotKeyOf is omitted", () => {
    const repaired = repairShopOfferings(
      [{ instanceId: "gear-1" }, { instanceId: "gear-2" }],
      ["gear-2"],
      (item) => item.instanceId === "gear-2",
    );
    expect(repaired.items).toEqual([{ instanceId: "gear-2" }]);
    expect(repaired.purchasedSlotKeys).toEqual(["gear-2"]);
  });

  it("remaps purchased id-index keys after an earlier offering is dropped", () => {
    const repaired = repairShopOfferings(
      ["tombstone", "slash", "bash"],
      [shopItemSlotKey("slash", 1), shopItemSlotKey("tombstone", 0)],
      (id) => id !== "tombstone",
      shopItemSlotKey,
    );

    expect(repaired.items).toEqual(["slash", "bash"]);
    expect(repaired.purchasedSlotKeys).toEqual([shopItemSlotKey("slash", 0)]);
  });

  it("keeps identity keys unchanged when dropping a sibling offering", () => {
    const repaired = repairShopOfferings(
      [{ id: "owned-unique" }, { id: "keep-basic" }],
      ["keep-basic", "owned-unique"],
      (item) => item.id !== "owned-unique",
      (item) => item.id,
    );

    expect(repaired.items).toEqual([{ id: "keep-basic" }]);
    expect(repaired.purchasedSlotKeys).toEqual(["keep-basic"]);
  });

  it("yields an empty shelf when every offering is dropped", () => {
    const repaired = repairShopOfferings(["a", "b"], [shopItemSlotKey("a", 0)], () => false, shopItemSlotKey);
    expect(repaired.items).toEqual([]);
    expect(repaired.purchasedSlotKeys).toEqual([]);
  });

  it("drops orphan purchased keys that match no offering", () => {
    const repaired = repairShopOfferings(
      ["slash"],
      [shopItemSlotKey("slash", 0), "slot-0", shopItemSlotKey("missing", 3)],
      () => true,
      shopItemSlotKey,
    );
    expect(repaired.items).toEqual(["slash"]);
    expect(repaired.purchasedSlotKeys).toEqual([shopItemSlotKey("slash", 0)]);
  });
});
