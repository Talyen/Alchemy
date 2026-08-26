import { describe, expect, it } from "vitest";
import { getCardDisplayTitle } from "@/features/alchemy/shared/ui/card-description-ui";

describe("getCardDisplayTitle", () => {
  it("returns plain title for a normal card", () => {
    expect(getCardDisplayTitle({ title: "Slash" })).toBe("Slash");
  });

  it("prefixes corrupted card title with 'Corrupted '", () => {
    expect(getCardDisplayTitle({ title: "Slash", corrupted: true })).toBe("Corrupted Slash");
  });

  it("handles missing corrupted field as normal", () => {
    expect(getCardDisplayTitle({ title: "Block", corrupted: false })).toBe("Block");
  });
});
