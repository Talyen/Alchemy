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
  it("preserves exact RGB channels across short, full, trimmed and case-insensitive input", () => {
    for (const hex of ["#f80", "f80", "#ff8800", " FF8800 "]) {
      expect(parseHexRgbBytes(hex)).toEqual([255, 136, 0]);
      expect(parseHexRgbNormalized(hex)).toEqual([1, 136 / 255, 0]);
      expect(parsePlasmaHexColor(hex)).toEqual([1, 136 / 255, 0]);
    }
  });

  it("rejects partial hex parses and returns independent fallback channels", () => {
    const fallback = [10, 20, 30] as const;
    for (const hex of ["", "invalid", "#zz0", "#00gg00", "#12", "#12345", "##fff"]) {
      expect(parseHexRgbBytes(hex, fallback)).toEqual(fallback);
      expect(parsePlasmaHexColor(hex)).toEqual([0.8, 0.8, 0.8]);
    }
    const result = parseHexRgbBytes("bad-input", fallback);
    result[0] = 0;
    expect(fallback).toEqual([10, 20, 30]);
  });

  describe("lerpParsedRgbFloats", () => {
    it("reuses an output tuple with exactly the same channels as allocating interpolation", () => {
      const from = parsePlasmaHexColor("#137abd");
      const to = parsePlasmaHexColor("#e25409");
      const target: [number, number, number] = [0, 0, 0];
      for (const t of [0, 0.001, 0.25, 0.5, 0.999, 1]) {
        const expected = from.map((channel, index) => channel + (to[index]! - channel) * t);
        expect(lerpParsedRgbFloats(from, to, t, target)).toBe(target);
        expect(target).toEqual(expected);
      }
      expect(from).toEqual(parsePlasmaHexColor("#137abd"));
      expect(to).toEqual(parsePlasmaHexColor("#e25409"));
    });
  });

  describe("lerpParsedPlasmaColor", () => {
    it("interpolates between two parsed colors", () => {
      const from: [number, number, number] = [0, 0, 0];
      const to: [number, number, number] = [1, 1, 1];

      expect(lerpParsedPlasmaColor(from, to, 0)).toBe("#000000");
      expect(lerpParsedPlasmaColor(from, to, 1)).toBe("#ffffff");
      expect(lerpParsedPlasmaColor(from, to, 0.5)).toBe("#808080");
      expect(lerpPlasmaColor("#000000", "#ffffff", 0.5)).toBe("#808080");
    });
  });
});
