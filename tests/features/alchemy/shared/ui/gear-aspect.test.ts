import { describe, expect, it } from "vitest";

import { gearDefinitions } from "@/lib/gear";
import { gearArtAspectClass } from "@/features/alchemy/shared/config";
import { gearInstanceAspectClass } from "@/features/alchemy/shared/ui/gear-aspect";

describe("gearInstanceAspectClass", () => {
  it("uses 3:4 portrait frames for every definition", () => {
    for (const definition of Object.values(gearDefinitions)) {
      expect(gearInstanceAspectClass(definition), definition.id).toBe(gearArtAspectClass);
    }
  });

  it("falls back to 3:4 when definition is missing", () => {
    expect(gearInstanceAspectClass(undefined)).toBe(gearArtAspectClass);
  });
});
