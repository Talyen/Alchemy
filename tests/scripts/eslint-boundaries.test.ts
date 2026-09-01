import { describe, expect, it } from "vitest";
import { cruiserPathFromGroups } from "../../eslint/boundaries.js";

describe("cruiserPathFromGroups", () => {
  it("prefers an alias group when one is present", () => {
    expect(cruiserPathFromGroups(["**/stores/run-reads", "@/features/alchemy/shared/stores/run-reads"])).toBe(
      "^src/features/alchemy/shared/stores/run-reads/",
    );
  });

  it("falls back to the deepest glob group", () => {
    expect(cruiserPathFromGroups(["src/features/alchemy/**", "**/run-loop/**"])).toBe(
      "^src/features/alchemy/run-loop/",
    );
  });

  it("uses the final group when no glob marker exists", () => {
    expect(cruiserPathFromGroups(["src/features/alchemy/run-loop"])).toBe("^src/features/alchemy/run-loop/");
  });

  it("uses the feature root for an empty group list", () => {
    expect(cruiserPathFromGroups([])).toBe("^src/features/alchemy/");
  });
});
