import { describe, expect, it } from "vitest";
import { buildSmoothShineGradient } from "@/lib/animation/shine-gradient";

describe("shine-gradient", () => {
  it("returns null when colors array is empty", () => {
    expect(buildSmoothShineGradient([])).toBeNull();
  });

  it("preserves exact gradient text across cache reuse, palette edits and eviction", () => {
    const colors = ["rgb(1, 2, 3)", "#abcdef"];
    const reference = (palette: string[]) => {
      const band = [...palette, "#ffffff"];
      return `linear-gradient(in oklab 90deg, ${[...band, ...band, band[0]].join(", ")})`;
    };
    expect(buildSmoothShineGradient(colors)).toBe(reference(colors));
    expect(buildSmoothShineGradient([...colors])).toBe(reference(colors));
    colors[0] = "#123456";
    expect(buildSmoothShineGradient(colors)).toBe(reference(colors));
    for (let i = 0; i < 150; i++) {
      const palette = [`rgb(${i}, 0, 0)`];
      expect(buildSmoothShineGradient(palette)).toBe(reference(palette));
    }
    expect(buildSmoothShineGradient(colors)).toBe(reference(colors));
  });

  it("distinguishes palettes with identical joined text but different first colors", () => {
    expect(buildSmoothShineGradient(["red, blue", "green"])).toBe(
      "linear-gradient(in oklab 90deg, red, blue, green, #ffffff, red, blue, green, #ffffff, red, blue)",
    );
    expect(buildSmoothShineGradient(["red", "blue, green"])).toBe(
      "linear-gradient(in oklab 90deg, red, blue, green, #ffffff, red, blue, green, #ffffff, red)",
    );
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
