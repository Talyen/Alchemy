import { describe, expect, it } from "vitest";

import {
  GEAR_FILE_PATTERN,
  SLOT_BACKGROUND_PATTERN,
  slugifyGearName,
  toGearTarget,
} from "../../scripts/assets/gear-filenames.mjs";

describe("gear filename conventions", () => {
  it("slugs display names without apostrophe fragments", () => {
    expect(slugifyGearName("Smith's Hammer")).toBe("smiths-hammer");
    expect(slugifyGearName("  Cutpurse  Knife ")).toBe("cutpurse-knife");
  });

  it("derives gear targets with a lowercased rarity and overridable extension", () => {
    expect(toGearTarget("Sword", "Basic")).toBe("gear-sword-basic.webp");
    expect(toGearTarget("Sword", "BASIC")).toBe("gear-sword-basic.webp");
    expect(toGearTarget("Smith's Hammer", "Astral", "png")).toBe("gear-smiths-hammer-astral.png");
  });

  it("matches gear and slot background filenames case-insensitively", () => {
    expect("Sword - Basic.jpeg".match(GEAR_FILE_PATTERN)?.slice(1, 3)).toEqual(["Sword", "Basic"]);
    expect("sword - astral.PNG".match(GEAR_FILE_PATTERN)?.slice(1, 3)).toEqual(["sword", "astral"]);
    expect("Sword - Basic.webp".match(GEAR_FILE_PATTERN)).toBeNull();
    expect("Body Slot.jpg".match(SLOT_BACKGROUND_PATTERN)?.[1]).toBe("Body");
    expect("Body.jpg".match(SLOT_BACKGROUND_PATTERN)).toBeNull();
  });
});
