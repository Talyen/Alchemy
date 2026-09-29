import { describe, expect, it } from "vitest";
import {
  lerpParsedPlasmaColor,
  lerpParsedRgbFloats,
  lerpPlasmaColor,
  parseHexRgbBytes,
  parseHexRgbNormalized,
  parsePlasmaHexColor,
} from "@/lib/animation/plasma-colors";

describe("plasma-colors", () => {
  describe("parseHexRgbBytes", () => {
    it("parses 6-character and 3-character hex codes to 0..255 byte tuples", () => {
      expect(parseHexRgbBytes("#ff8000")).toEqual([255, 128, 0]);
      expect(parseHexRgbBytes("#fff")).toEqual([255, 255, 255]);
      expect(parseHexRgbBytes("f00")).toEqual([255, 0, 0]);
    });

    it("uses specified fallback for invalid hex strings", () => {
      expect(parseHexRgbBytes("invalid", [10, 20, 30])).toEqual([10, 20, 30]);
      expect(parseHexRgbBytes("", [0, 0, 0])).toEqual([0, 0, 0]);
    });
  });

  describe("parseHexRgbNormalized", () => {
    it("parses hex codes to 0..1 float tuples", () => {
      const [r, g, b] = parseHexRgbNormalized("#ff0080");
      expect(r).toBeCloseTo(1, 4);
      expect(g).toBeCloseTo(0, 4);
      expect(b).toBeCloseTo(128 / 255, 4);
    });
  });

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

  describe("lerpParsedRgbFloats", () => {
    it("interpolates float tuples directly without string conversions", () => {
      const from: [number, number, number] = [0, 0.2, 0.8];
      const to: [number, number, number] = [1, 0.6, 0.4];
      const mid = lerpParsedRgbFloats(from, to, 0.5);
      expect(mid[0]).toBeCloseTo(0.5);
      expect(mid[1]).toBeCloseTo(0.4);
      expect(mid[2]).toBeCloseTo(0.6);
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
