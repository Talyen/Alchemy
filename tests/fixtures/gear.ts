import type { GearInstance } from "@/lib/gear";

// Shared gear instance factory for tests. Prefer this over inline literals so
// new tests do not invent another "ring-1" / "shield-1" variant; existing
// tests keep their literals until they are next touched.
export function makeGearInstance(
  definitionId: string,
  instanceId = `${definitionId}-test`,
  affixes: GearInstance["affixes"] = [],
): GearInstance {
  return { instanceId, definitionId, affixes };
}
