import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BattleCardSchema,
  SaveDataSchema,
  safeParseWithErrors,
  CURRENT_CONTENT_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { defaultBattleState } from "@/lib/battle";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { savedActivityFixture } from "../../fixtures/run-activity";

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

  it("reports dropped card positions while retaining the active run", () => {
    const result = safeParseWithErrors(SaveDataSchema, {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      activeRun: makeMinimalActiveRunInput({ runDeck: [{ id: "slash" }, null] }),
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.activeRun?.runDeck.map((card) => card.id)).toEqual(["slash"]);
    expect(result.errors).toContainEqual({ path: "runDeck[1]", message: "malformed saved card was dropped" });
  });

  it("loads a damaged deck through the save candidate path with a repair warning", () => {
    const loaded = evaluateSaveCandidates([
      JSON.stringify({
        saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
        contentVersion: CURRENT_CONTENT_VERSION,
        activeRun: makeMinimalActiveRunInput({ runDeck: [{ id: "slash" }, { id: 42 }] }),
      }),
    ]);
    expect(loaded.data.activeRun?.runDeck.map((card) => card.id)).toEqual(["slash"]);
    expect(loaded.status).toMatchObject({
      kind: "ok",
      warnings: [expect.stringContaining("runDeck[1]")],
    });
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

  it("does not leak warnings from direct parses into later calls", () => {
    expect(BattleCardSchema.safeParse(badEffectCard).success).toBe(true);
    const good = safeParseWithErrors(BattleCardSchema, {
      ...badEffectCard,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    expect(good.success && good.errors).toEqual([]);
  });

  it("isolates a nested parse from the enclosing warning sink", () => {
    const outerSchema = z.object({ card: BattleCardSchema }).transform((value) => {
      const inner = safeParseWithErrors(BattleCardSchema, badEffectCard);
      expect(inner.success && inner.errors.length).toBeGreaterThan(0);
      return value;
    });
    const outer = safeParseWithErrors(outerSchema, { card: badEffectCard });
    expect(outer.success).toBe(true);
    if (!outer.success) return;
    // One warning from the outer card; the nested parse kept its own.
    expect(outer.errors.filter((error) => error.path.startsWith("effects["))).toHaveLength(1);
  });

  it("keeps valid scheduled effects and Archery echoes in order with their original warning positions", () => {
    const echo = { id: "slash", title: "Slash", art: "", cost: 1, descriptionLines: [], effects: [] };
    const effect = { remainingTurns: 2, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] };
    const battle = defaultBattleState();
    const result = safeParseWithErrors(PersistedBattleStateSchema, {
      ...battle,
      pendingTurnStartEffects: [effect, null, { ...effect, remainingTurns: 11 }, effect],
      uniqueGear: { ...battle.uniqueGear, archeryEchoes: [echo, null, echo] },
      difficultyModifiers: [{ kind: "start-block", amount: 2 }, null, { kind: "start-max-mana", amount: 1 }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pendingTurnStartEffects).toEqual([effect, effect]);
    expect(result.data.uniqueGear.archeryEchoes).toEqual([echo, echo]);
    expect(result.data.difficultyModifiers).toEqual([
      { kind: "start-block", amount: 2 },
      { kind: "start-max-mana", amount: 1 },
    ]);
    expect(result.errors).toEqual([
      { path: "pendingTurnStartEffects[1]", message: "malformed scheduled effect was dropped" },
      { path: "pendingTurnStartEffects[2]", message: "malformed scheduled effect was dropped" },
      { path: "uniqueGear.archeryEchoes[1]", message: "malformed Archery echo was dropped" },
    ]);
  });

  it("retains valid Mystery effects and reports malformed positions", () => {
    const choice = {
      label: "Choice",
      effects: [{ kind: "gainGold", amount: 2 }, { kind: "unknown" }, { kind: "healHealth", amount: 3 }],
    };
    const result = safeParseWithErrors(SaveDataSchema, {
      activeRun: makeMinimalActiveRunInput({
        activity: savedActivityFixture("mystery", {
          event: { id: "saved", title: "Saved", art: "", narrative: "", choices: [choice] },
          chosenChoice: null,
        }),
      }),
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.activeRun?.activity).toMatchObject({
      kind: "mystery",
      data: { event: { choices: [{ effects: [choice.effects[0], choice.effects[2]] }] } },
    });
    expect(result.errors).toContainEqual({
      path: "mystery.effects[1]",
      message: "malformed Mystery effect was dropped",
    });
  });
});
