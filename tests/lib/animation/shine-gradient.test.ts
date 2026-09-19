import { describe, expect, it } from "vitest";
import { buildSmoothShineGradient } from "@/lib/animation/shine-gradient";

describe("shine-gradient", () => {
  it("returns null when colors array is empty", () => {
    expect(buildSmoothShineGradient([])).toBeNull();
  });

  describe("buildSmoothShineGradient", () => {
    it("creates a looped highlight gradient with white accent", () => {
      const gradient = buildSmoothShineGradient(["#ff0000", "#00ff00"]);
      expect(gradient).toBe(
        "linear-gradient(in oklab 90deg, #ff0000, #00ff00, #ffffff, #ff0000, #00ff00, #ffffff, #ff0000)",
      );
    });
  });
});
