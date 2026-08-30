import { describe, expect, it } from "vitest";
import { shouldConvertCrystalWishToGold } from "@/lib/content-systems/battle-content";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

describe("battle content helpers", () => {
  it("converts crystal wish to gold exclusively in Wildwood", () => {
    expect(shouldConvertCrystalWishToGold(CONTENT_SYSTEMS.WILDWOOD)).toBe(true);
    expect(shouldConvertCrystalWishToGold(CONTENT_SYSTEMS.CAMPAIGN)).toBe(false);
    expect(shouldConvertCrystalWishToGold(CONTENT_SYSTEMS.LABYRINTH)).toBe(false);
  });
});
