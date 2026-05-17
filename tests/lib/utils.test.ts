import { describe, expect, it, vi } from "vitest";
import { clamp, shuffle, pickRandom, appendUnique, appendUniqueMany } from "@/lib/utils";

vi.spyOn(Math, "random").mockReturnValue(0.5);

describe("clamp", () => {
  it("returns value when within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns min when value is below", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns max when value is above", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles negative bounds", () => {
    expect(clamp(-10, -20, -5)).toBe(-10);
  });

  it("handles floating point", () => {
    expect(clamp(3.5, 0, 10)).toBe(3.5);
    expect(clamp(-0.5, 0, 10)).toBe(0);
  });
});

describe("shuffle", () => {
  it("returns all items", () => {
    const result = shuffle([1, 2, 3, 4]);
    expect(result).toHaveLength(4);
    expect(result.sort()).toEqual([1, 2, 3, 4]);
  });

  it("does not mutate the original array", () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it("handles empty array", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("handles single element", () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

describe("pickRandom", () => {
  it("returns an item from the array", () => {
    expect(pickRandom([1, 2, 3])).toBeDefined();
  });

  it("returns the item at the selected index", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0);
    expect(pickRandom([10, 20, 30])).toBe(10);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5);
    expect(pickRandom([10, 20, 30])).toBe(20);
  });

  it("returns undefined for empty array", () => {
    expect(pickRandom([])).toBeUndefined();
  });

  it("returns the only element for single-element array", () => {
    expect(pickRandom([7])).toBe(7);
  });
});

describe("appendUnique", () => {
  it("appends a new item", () => {
    expect(appendUnique([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("does not append a duplicate", () => {
    expect(appendUnique([1, 2], 2)).toEqual([1, 2]);
  });

  it("does not mutate the original array", () => {
    const input = [1, 2];
    appendUnique(input, 3);
    expect(input).toEqual([1, 2]);
  });

  it("works with strings", () => {
    expect(appendUnique(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(appendUnique(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("handles empty initial array", () => {
    expect(appendUnique([], 1)).toEqual([1]);
  });
});

describe("appendUniqueMany", () => {
  it("merges unique items preserving order", () => {
    expect(appendUniqueMany([1, 2], [2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it("does not mutate original arrays", () => {
    const base = [1, 2];
    const additions = [2, 3];
    appendUniqueMany(base, additions);
    expect(base).toEqual([1, 2]);
    expect(additions).toEqual([2, 3]);
  });

  it("handles empty base", () => {
    expect(appendUniqueMany([], [1, 2])).toEqual([1, 2]);
  });

  it("handles empty additions", () => {
    expect(appendUniqueMany([1, 2], [])).toEqual([1, 2]);
  });

  it("works with strings", () => {
    expect(appendUniqueMany(["a", "b"], ["b", "c", "a"])).toEqual(["a", "b", "c"]);
  });
});
