import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  appendUnique,
  appendUniqueMany,
  clamp,
  clamp01,
  createInstanceId,
  formatLargeAmount,
  isValidDeckIndex,
} from "@/lib/utils";

it("numeric bounds keeps invalid volume/opacity inputs bounded and rejects reversed ranges", () => {
  expect(clamp01(Number.NaN)).toBe(0);
  expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
  expect(clamp01(0.5)).toBe(0.5);
  expect(() => clamp(5, 10, 0)).toThrow();
});

it("formatLargeAmount maps non-finite amounts to zero and defaults to English", () => {
  expect(formatLargeAmount(Number.NaN)).toBe("0");
  expect(formatLargeAmount(Number.POSITIVE_INFINITY)).toBe("0");
  expect(formatLargeAmount(Number.NEGATIVE_INFINITY, "de")).toBe("0");
  expect(formatLargeAmount(12345.6)).toBe("12,345.6");
});

it.each([
  ["en", "12,345.6", "123.5K"],
  ["de", "12.345,6", "123.456,7"],
  ["zh-Hans", "12,345.6", "12.3万"],
  ["ru", "12\u00a0345,6", "123,5\u00a0тыс."],
  ["es", "12.345,6", "123,5\u00a0mil"],
  ["pt-BR", "12.345,6", "123,5\u00a0mil"],
  ["en-XA", "12,345.6", "123.5K"],
])("formats resource amounts for %s independently of the host locale", (locale, standard, compact) => {
  expect(formatLargeAmount(12345.6, locale)).toBe(standard);
  expect(formatLargeAmount(123456.7, locale)).toBe(compact);
  expect(formatLargeAmount(-123456.7, locale)).toBe(`-${compact}`);
});

it("keeps the compact threshold and supports the full safe resource range", () => {
  expect(formatLargeAmount(99999, "en")).toBe("99,999");
  expect(formatLargeAmount(100000, "en")).toBe("100K");
  expect(formatLargeAmount(100000000, "zh-Hans")).toBe("1亿");
  expect(formatLargeAmount(Number.MAX_SAFE_INTEGER, "zh-Hans")).toBe("9007.2万亿");
});

it("survives more locales than the formatter cache holds without dropping hot entries", () => {
  const locales = [
    "en",
    "de",
    "fr",
    "es",
    "it",
    "pt-BR",
    "ru",
    "zh-Hans",
    "zh-Hant",
    "ja",
    "ko",
    "ar",
    "hi",
    "tr",
    "pl",
    "nl",
    "sv",
    "da",
    "fi",
    "no",
    "cs",
    "sk",
    "hu",
    "ro",
    "el",
    "he",
    "th",
    "vi",
    "id",
    "ms",
    "uk",
    "bg",
    "hr",
    "sr",
    "en-XA",
  ];
  for (const locale of locales) {
    expect(typeof formatLargeAmount(123456.7, locale)).toBe("string");
    expect(typeof formatLargeAmount(12345.6, locale)).toBe("string");
  }
  expect(formatLargeAmount(12345.6, "en")).toBe("12,345.6");
  expect(formatLargeAmount(123456.7, "en")).toBe("123.5K");
});

describe("createInstanceId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps bulk-generated fallback ids unique when the clock repeats", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Date, "now").mockReturnValue(123);
    const ids = Array.from({ length: 100 }, createInstanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("appendUniqueMany", () => {
  it("retains the base reference for no-op merges, including frozen inputs", () => {
    const base = Object.freeze(["a", "b"]);
    expect(appendUniqueMany(base, [])).toBe(base);
    expect(appendUniqueMany(base, ["b", "a", "b"])).toBe(base);
    expect(appendUnique(base, "a")).toBe(base);
    expect(appendUniqueMany(base, ["b", "c", "c"])).toEqual(["a", "b", "c"]);
    expect(base).toEqual(["a", "b"]);
    expectTypeOf(appendUniqueMany(base, [])).toEqualTypeOf<readonly string[]>();
    expectTypeOf(appendUnique(base, "a")).toEqualTypeOf<readonly string[]>();
    expectTypeOf(appendUniqueMany(["a"], ["b"])).toEqualTypeOf<string[]>();
    expectTypeOf(appendUnique(["a"], "b")).toEqualTypeOf<string[]>();
  });

  it("adds each new identity once, in order, without changing either input", () => {
    const base = Object.freeze(["a", "b"]);
    const additions = Object.freeze(["b", "c", "c", "d"]);
    expect(appendUniqueMany(base, additions)).toEqual(["a", "b", "c", "d"]);
    expect(appendUniqueMany([], additions)).toEqual(["b", "c", "d"]);
    expect(appendUnique(base, "c")).toEqual(["a", "b", "c"]);
    expect(base).toEqual(["a", "b"]);
    expect(additions).toEqual(["b", "c", "c", "d"]);
  });
});

describe("isValidDeckIndex", () => {
  it("accepts valid integer indices", () => {
    expect(isValidDeckIndex(0, 3)).toBe(true);
    expect(isValidDeckIndex(2, 3)).toBe(true);
  });
  it("rejects fractional, NaN, Infinity, out of bounds", () => {
    expect(isValidDeckIndex(0.5, 3)).toBe(false);
    expect(isValidDeckIndex(NaN, 3)).toBe(false);
    expect(isValidDeckIndex(Infinity, 3)).toBe(false);
    expect(isValidDeckIndex(-1, 3)).toBe(false);
    expect(isValidDeckIndex(3, 3)).toBe(false);
    expect(isValidDeckIndex(10, 3)).toBe(false);
  });
});
