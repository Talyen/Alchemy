import { describe, expect, it } from "vitest";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "@/features/alchemy/meta/screens/armory/targeting-highlight";

describe("targetingHighlight", () => {
  it("valid-target tokens stay emerald with inset ring and hover escalation", () => {
    expect(VALID_TARGET_RING).toContain("ring-inset");
    expect(VALID_TARGET_RING).toContain("emerald-400");
    expect(VALID_TARGET_RING).toContain("hover:ring-emerald-400/80");
    expect(VALID_TARGET_SHADOW).toContain("shadow-[");
    expect(VALID_TARGET_SHADOW).toContain("rgba(134,239,172");
  });

  it("salvage-target tokens stay red with inset ring", () => {
    expect(SALVAGE_TARGET_RING).toContain("ring-inset");
    expect(SALVAGE_TARGET_RING).toContain("red-400");
    expect(SALVAGE_TARGET_SHADOW).toContain("shadow-[");
    expect(SALVAGE_TARGET_SHADOW).toContain("rgba(239,68,68");
  });

  it("valid and salvage palettes do not bleed into each other", () => {
    for (const [valid, salvage] of [
      [VALID_TARGET_RING, SALVAGE_TARGET_RING],
      [VALID_TARGET_SHADOW, SALVAGE_TARGET_SHADOW],
    ]) {
      expect(valid).not.toContain("red-4");
      expect(salvage).not.toContain("emerald");
      expect(valid.length).toBeGreaterThan(0);
      expect(salvage.length).toBeGreaterThan(0);
    }
  });
});
