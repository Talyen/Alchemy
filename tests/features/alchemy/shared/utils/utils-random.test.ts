import { describe, expect, it, vi } from "vitest";
import { sampleItems } from "@/lib/utils";

const testRng = () => 0.5;

describe("sampleItems", () => {
  it("returns the requested number of items", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const items = [1, 2, 3, 4, 5];
    const result = sampleItems(items, 3, testRng);
    expect(result).toHaveLength(3);
  });

  it("returns all items when count exceeds length", () => {
    const items = [1, 2, 3];
    const result = sampleItems(items, 10, testRng);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(sampleItems([], 3, testRng)).toEqual([]);
  });

  it("returns empty array when count is 0", () => {
    expect(sampleItems([1, 2, 3], 0, testRng)).toEqual([]);
  });
});
