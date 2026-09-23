import { describe, expect, it } from "vitest";
import { lerpParsedPlasmaColor, lerpPlasmaColor, parsePlasmaHexColor } from "@/lib/animation/plasma-colors";

describe("plasma-colors", () => {
  describe("parsePlasmaHexColor", () => {
    it("parses 6-character hex codes with leading #", () => {
      const [r, g, b] = parsePlasmaHexColor("#ff0080");
      expect(r).toBeCloseTo(1, 4);
      expect(g).toBeCloseTo(0, 4);
      expect(b).toBeCloseTo(128 / 255, 4);
    });

    it("parses 3-character hex codes", () => {
      const [r, g, b] = parsePlasmaHexColor("#f80");
      expect(r).toBeCloseTo(1, 4);
      expect(g).toBeCloseTo(136 / 255, 4);
      expect(b).toBeCloseTo(0, 4);
    });

    it("falls back to default neutral color for invalid hex strings", () => {
      expect(parsePlasmaHexColor("invalid")).toEqual([0.8, 0.8, 0.8]);
      expect(parsePlasmaHexColor("")).toEqual([0.8, 0.8, 0.8]);
      expect(parsePlasmaHexColor("#zz0")).toEqual([0.8, 0.8, 0.8]);
      expect(parsePlasmaHexColor("#00gg00")).toEqual([0.8, 0.8, 0.8]);
    });
  });

  describe("lerpParsedPlasmaColor", () => {
    it("interpolates between two parsed colors", () => {
      const from: [number, number, number] = [0, 0, 0];
      const to: [number, number, number] = [1, 1, 1];

      expect(lerpParsedPlasmaColor(from, to, 0)).toBe("#000000");
      expect(lerpParsedPlasmaColor(from, to, 1)).toBe("#ffffff");
      expect(lerpParsedPlasmaColor(from, to, 0.5)).toBe("#808080");
    });
  });

  describe("lerpPlasmaColor", () => {
    it("interpolates hex strings directly", () => {
      const result = lerpPlasmaColor("#000000", "#ffffff", 0.5);
      expect(result).toBe("#808080");
    });
  });
});
