import { describe, expect, it } from "vitest";
import { buildSmoothShineBorderGradient, buildSmoothShineGradient } from "@/lib/animation/shine-gradient";

describe("shine-gradient", () => {
  it("returns null when colors array is empty", () => {
    expect(buildSmoothShineGradient([])).toBeNull();
    expect(buildSmoothShineBorderGradient([])).toBeNull();
  });

  describe("buildSmoothShineBorderGradient", () => {
    it("duplicates single color across start and end", () => {
      const gradient = buildSmoothShineBorderGradient(["#ff0000"]);
      expect(gradient).toBe("linear-gradient(in oklab 90deg, #ff0000, #ff0000)");
    });

    it("mirrors interior colors and loops back to first color for multiple colors", () => {
      const gradient = buildSmoothShineBorderGradient(["#111111", "#222222", "#333333"]);
      expect(gradient).toBe("linear-gradient(in oklab 90deg, #111111, #222222, #333333, #222222, #111111)");
    });
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
