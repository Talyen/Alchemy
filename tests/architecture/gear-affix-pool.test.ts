import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { buildEligibleAffixPool } from "@/lib/gear/generation";
import { gearDefinitions } from "@/lib/gear/definitions";

describe("gear affix pool guard", () => {
  it("every gear definition has an eligible pool at least as large as its minimum affix count", () => {
    const failures: string[] = [];

    for (const definition of Object.values(gearDefinitions)) {
      if (definition.rarity === null) continue;
      const pool = buildEligibleAffixPool(definition);
      const minCount = GEAR_AFFIX_COUNT[definition.rarity].min;
      if (pool.length < minCount) {
        failures.push(`${definition.id}: pool ${pool.length} < min ${minCount}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
