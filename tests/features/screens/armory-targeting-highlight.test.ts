// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { VALID_TARGET_RING, VALID_TARGET_SHADOW } from "@/features/alchemy/meta/screens/armory/targeting-highlight";

describe("targetingHighlight", () => {
  it("exports VALID_TARGET_RING as a non-empty string", () => {
    expect(VALID_TARGET_RING).toBeTruthy();
    expect(typeof VALID_TARGET_RING).toBe("string");
    expect(VALID_TARGET_RING.length).toBeGreaterThan(0);
  });

  it("exports VALID_TARGET_SHADOW as a non-empty string", () => {
    expect(VALID_TARGET_SHADOW).toBeTruthy();
    expect(typeof VALID_TARGET_SHADOW).toBe("string");
    expect(VALID_TARGET_SHADOW.length).toBeGreaterThan(0);
  });

  it("VALID_TARGET_RING contains the emerald-400 ring token", () => {
    expect(VALID_TARGET_RING).toContain("emerald-400");
    expect(VALID_TARGET_RING).toContain("ring-inset");
    expect(VALID_TARGET_RING).toContain("hover:ring-emerald-400/80");
  });

  it("VALID_TARGET_SHADOW contains rgba(134,239,172)", () => {
    expect(VALID_TARGET_SHADOW).toContain("134,239,172");
    expect(VALID_TARGET_SHADOW).toContain("shadow-[");
  });
});
