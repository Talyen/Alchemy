import { describe, expect, it } from "vitest";
import { repairShopOfferings, shopItemSlotKey } from "@/lib/active-run-session/shop-offering-repair";

describe("repairShopOfferings", () => {
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
