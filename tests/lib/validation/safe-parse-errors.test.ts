import { describe, expect, it } from "vitest";
import {
  BattleCardSchema,
  SaveDataSchema,
  safeParseWithErrors,
  CURRENT_CONTENT_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";

const badEffectCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal 4"],
  art: "",
  cost: 1,
  effects: [{ kind: "not-a-real-kind" }],
};

describe("safeParseWithErrors nested card warnings", () => {
  it("collects per-card repair notes without failing the parse", () => {
    const result = safeParseWithErrors(BattleCardSchema, badEffectCard);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.effects).toEqual([]);
    expect(result.errors.some((error) => error.path.startsWith("effects["))).toBe(true);
  });

  it("collects nested active-run card warnings through SaveDataSchema", () => {
    const save = {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      activeRun: makeMinimalActiveRunInput({ runDeck: [badEffectCard] }),
    };
    const result = safeParseWithErrors(SaveDataSchema, save);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.errors.some((error) => error.path.startsWith("effects["))).toBe(true);
  });

  it("does not clobber errors across sequential parses", () => {
    const bad = safeParseWithErrors(BattleCardSchema, badEffectCard);
    const good = safeParseWithErrors(BattleCardSchema, {
      ...badEffectCard,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    expect(bad.success && bad.errors.length).toBeGreaterThan(0);
    expect(good.success && good.errors).toEqual([]);
  });
});
