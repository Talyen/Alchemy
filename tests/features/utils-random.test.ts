import { describe, expect, it, vi } from "vitest";
import { sampleItems, resampleItems } from "@/features/alchemy/utils/random";

describe("sampleItems", () => {
  it("returns the requested number of items", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const items = [1, 2, 3, 4, 5];
    const result = sampleItems(items, 3);
    expect(result).toHaveLength(3);
    vi.restoreAllMocks();
  });

  it("returns all items when count exceeds length", () => {
    const items = [1, 2, 3];
    const result = sampleItems(items, 10);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(sampleItems([], 3)).toEqual([]);
  });

  it("returns empty array when count is 0", () => {
    expect(sampleItems([1, 2, 3], 0)).toEqual([]);
  });
});

describe("resampleItems", () => {
  it("excludes specified items", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const items = [1, 2, 3, 4, 5];
    const result = resampleItems(items, [1, 3], 2);
    expect(result).toHaveLength(2);
    expect(result).not.toContain(1);
    expect(result).not.toContain(3);
    vi.restoreAllMocks();
  });

  it("returns all available items if enough remain after exclusion", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const items = [1, 2, 3, 4, 5];
    const result = resampleItems(items, [1, 2], 3);
    expect(result).toHaveLength(3);
    expect(result).not.toContain(1);
    expect(result).not.toContain(2);
    vi.restoreAllMocks();
  });

  it("falls back to sampling from all items when not enough unique items", () => {
    const items = [1, 2];
    const result = resampleItems(items, [1, 2], 5);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(resampleItems([], [], 3)).toEqual([]);
  });

  it("returns empty array when count is 0", () => {
    expect(resampleItems([1, 2, 3], [], 0)).toEqual([]);
  });

  it("returns fewer items when count exceeds available", () => {
    const result = resampleItems([1], [2], 5);
    expect(result).toHaveLength(1);
  });
});
