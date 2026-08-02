import { describe, expect, it } from "vitest";

import { gearDefinitions } from "@/lib/gear";
import { gearInstanceAspectClass } from "@/features/alchemy/shared/ui/gear-aspect";

const ALLOWED_ASPECT_CLASSES = new Set(["aspect-square", "aspect-[2/3]", "aspect-[2/1]"]);

describe("gearInstanceAspectClass", () => {
  it("returns only static Tailwind aspect classes for every definition", () => {
    for (const definition of Object.values(gearDefinitions)) {
      const aspectClass = gearInstanceAspectClass(definition);
      expect(ALLOWED_ASPECT_CLASSES.has(aspectClass), `${definition.id} → ${aspectClass}`).toBe(true);
    }
  });

  it("uses tall aspect for body/weapons and wide for belts", () => {
    const body = Object.values(gearDefinitions).find((d) => d.compatibleSlots[0] === "body");
    const belt = Object.values(gearDefinitions).find((d) => d.compatibleSlots[0] === "belt");
    const ring = Object.values(gearDefinitions).find((d) => d.compatibleSlots[0] === "left-ring");

    expect(body).toBeDefined();
    expect(belt).toBeDefined();
    expect(ring).toBeDefined();
    expect(gearInstanceAspectClass(body)).toBe("aspect-[2/3]");
    expect(gearInstanceAspectClass(belt)).toBe("aspect-[2/1]");
    expect(gearInstanceAspectClass(ring)).toBe("aspect-square");
  });

  it("falls back to aspect-square when definition is missing", () => {
    expect(gearInstanceAspectClass(undefined)).toBe("aspect-square");
  });
});
