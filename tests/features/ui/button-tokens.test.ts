import { describe, expect, it } from "vitest";

import { BUTTON_HOVER_PRIMARY, BUTTON_HOVER_SECONDARY } from "@/lib/ui/button-hover";
import { destinationMeta } from "@/features/alchemy/shared/config";
import { BUTTON_FOCUS, BUTTON_SURFACE_NEUTRAL } from "@/features/alchemy/shared/config/button-tokens";
import { NO_FOCUS_RING } from "@/lib/ui/focus";

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

describe("button focus token", () => {
  it("re-exports NO_FOCUS_RING without decorative rings", () => {
    expect(BUTTON_FOCUS).toBe(NO_FOCUS_RING);
    expect(BUTTON_FOCUS).toContain("focus-visible:ring-0");
    expect(BUTTON_FOCUS).toContain("focus-visible:ring-offset-0");
    expect(BUTTON_FOCUS).not.toMatch(/focus-visible:ring-(?!0\b|offset-)/);
  });
});

describe("button surface token", () => {
  it("matches outline button background", () => {
    expect(BUTTON_SURFACE_NEUTRAL).toContain("bg-background");
    expect(BUTTON_SURFACE_NEUTRAL).toContain("border");
    expect(BUTTON_SURFACE_NEUTRAL).not.toContain("zinc");
  });
});
