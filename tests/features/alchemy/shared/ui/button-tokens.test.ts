import { describe, expect, it } from "vitest";

import { destinationMeta } from "@/features/alchemy/shared/config";

describe("destinationMeta", () => {
  it("uses accent text classes instead of colored button fills", () => {
    for (const meta of Object.values(destinationMeta)) {
      expect(meta.accentClassName).toMatch(/^text-/);
      expect(meta.plasmaColorPair.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.plasmaColorPair.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.accentClassName).not.toMatch(/bg-/);
    }
  });

  it("keeps boss and corruption on the same red accent", () => {
    expect(destinationMeta["Boss Combat"].accentClassName).toBe("text-red-400");
    expect(destinationMeta.Corruption.accentClassName).toBe("text-red-400");
  });
});
