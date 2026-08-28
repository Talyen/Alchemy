import { describe, expect, it } from "vitest";
import { createNumericManifest, mergeNumericManifests } from "@/lib/manifest-utils";

describe("manifest utilities", () => {
  it("creates a zeroed manifest for each declared key", () => {
    expect(createNumericManifest(["damage", "block"] as const)).toEqual({ damage: 0, block: 0 });
  });

  it("merges numeric values while preserving the declared shape", () => {
    const keys = ["damage", "block"] as const;
    const base = { damage: 3, block: 4 };
    const addition = { damage: 2, block: 1 };

    expect(mergeNumericManifests(base, addition, keys)).toEqual({ damage: 5, block: 5 });
    expect(base).toEqual({ damage: 3, block: 4 });
    expect(addition).toEqual({ damage: 2, block: 1 });
  });
});
