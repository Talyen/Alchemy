import { describe, expect, it } from "vitest";
import { addTalentXP, computeRunEndTalentXPSnapshot, mergeTalentXPAwards } from "@/lib/game-data";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { MaterialInventorySchema, TalentXPSchema } from "@/lib/validation/save-schemas/schema-enums";

describe("progression award round trips", () => {
  it("preserves earned Talent XP at the supported limit through ordinary awards", () => {
    const xp = { physical: Number.MAX_SAFE_INTEGER };
    const awarded = addTalentXP(xp, ["physical"]);
    expect(TalentXPSchema.parse(awarded)).toEqual(xp);
  });

  it("keeps difficulty-scaled XP and its permanent merge within the save format", () => {
    expect(TalentXPSchema.parse(computeRunEndTalentXPSnapshot({ physical: Number.MAX_SAFE_INTEGER }, 2))).toEqual({
      physical: Number.MAX_SAFE_INTEGER,
    });
    expect(
      TalentXPSchema.parse(mergeTalentXPAwards({ physical: Number.MAX_SAFE_INTEGER - 3 }, { physical: 10 })),
    ).toEqual({ physical: Number.MAX_SAFE_INTEGER });
  });

  it("ignores absent optional XP awards without corrupting earned progress", () => {
    const xp = { physical: 42 };
    const result = mergeTalentXPAwards(xp, { physical: undefined, burn: undefined });
    expect(TalentXPSchema.parse(result)).toEqual(xp);
    expect(result).not.toHaveProperty("burn");
    expect(xp).toEqual({ physical: 42 });
  });

  it("preserves a full material stockpile when another bundle is awarded", () => {
    const inventory = { ...emptyInventory(), wood: Number.MAX_SAFE_INTEGER, stone: 7 };
    const awarded = addInventory(inventory, { ...emptyInventory(), wood: 3 });
    expect(MaterialInventorySchema.parse(awarded)).toEqual(inventory);
  });
});
