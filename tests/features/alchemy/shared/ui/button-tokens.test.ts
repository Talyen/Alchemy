import { describe, expect, it } from "vitest";

import { BUTTON_HOVER_PRIMARY, BUTTON_HOVER_SECONDARY } from "@/lib/ui/button-hover";
import { destinationMeta } from "@/features/alchemy/shared/config";

describe("destinationMeta", () => {
  it("uses accent text classes instead of colored button fills", () => {
    for (const meta of Object.values(destinationMeta)) {
      expect(meta.accentClassName).toMatch(/^text-/);
      expect(meta.accentClassName).not.toMatch(/bg-/);
    }
  });

  it("keeps boss and corruption on the same red accent", () => {
    expect(destinationMeta["Boss Combat"].accentClassName).toBe("text-red-400");
    expect(destinationMeta.Corruption.accentClassName).toBe("text-red-400");
  });
});

describe("button hover tokens", () => {
  it("uses animated bloom class on primary hover", () => {
    expect(BUTTON_HOVER_PRIMARY).toBe("button-primary-bloom");
  });

  it("uses muted background hover for secondary", () => {
    expect(BUTTON_HOVER_SECONDARY).toContain("hover:bg-muted/80");
  });
});
