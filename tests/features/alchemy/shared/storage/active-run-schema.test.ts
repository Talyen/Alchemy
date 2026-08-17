import { describe, expect, it } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";
import { parseActiveRun } from "@/lib/active-run-session";
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { makeMinimalActiveRunInput } from "../../../../fixtures/active-run";

/** Schema-only parse for ActiveRunDataSchema coercion/default tests (no runtime guards). */
const parseActiveRunSchema = (value: unknown) => ActiveRunDataSchema.nullable().catch(null).parse(value);

describe("active run field parsing and normalization", () => {
  it.each(["ranger", "rogue", "wizard"] as const)("passes through valid %s characterId", (characterId) => {
    const result = parseActiveRun(makeMinimalActiveRunInput({ characterId }));
    expect(result?.characterId).toBe(characterId);
  });

  it.each(["bard", "sorcerer"])("returns null for unknown or retired characterId %s", (characterId) => {
    const result = parseActiveRunSchema(makeMinimalActiveRunInput({ characterId }));
    expect(result).toBeNull();
  });

  it("returns null for character-only fragments", () => {
    const result = parseActiveRun({ characterId: "knight" });
    expect(result).toBeNull();
  });

  it("preserves valid selectedDifficulty", () => {
    const result = parseActiveRun(makeMinimalActiveRunInput({ selectedDifficulty: "difficulty-2" }));
    expect(result?.selectedDifficulty).toBe("difficulty-2");
  });

  it.each([
    ["an unknown id", { selectedDifficulty: "difficulty-999" }],
    ["a missing value", {}],
    ["a non-string value", { selectedDifficulty: 42 }],
  ])("sets selectedDifficulty to null for %s", (_label, overrides) => {
    const result = parseActiveRunSchema(makeMinimalActiveRunInput(overrides));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("recovers from corrupt numeric run fields with defaults", () => {
    // Zod recovers individual corrupt fields with catch()/defaults instead of discarding the whole run.
    // runPlayerHealth > maxHealth is clamped.
    expect(parseActiveRunSchema(makeMinimalActiveRunInput({ runGold: Number.NaN }))?.runGold).toBe(0);
    expect(parseActiveRunSchema(makeMinimalActiveRunInput({ runPlayerHealth: 31 }))?.runPlayerHealth).toBe(30);
    expect(parseActiveRunSchema(makeMinimalActiveRunInput({ runMaxHealth: 0 }))?.runMaxHealth).toBe(30);
    expect(parseActiveRunSchema(makeMinimalActiveRunInput({ roomsEncountered: -1 }))?.roomsEncountered).toBe(0);
    expect(parseActiveRunSchema(makeMinimalActiveRunInput({ currentAct: 999 }))?.currentAct).toBe(1);
    expect(parseActiveRunSchema(makeMinimalActiveRunInput({ destinationIndexInAct: 1.5 }))?.destinationIndexInAct).toBe(
      0,
    );
  });

  it("defaults contentSystemType to campaign when missing", () => {
    const result = parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: undefined }));
    expect(result?.contentSystemType).toBe("campaign");
  });

  it("preserves contentSystemType labyrinth when set with a valid map", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap }));
    expect(result?.contentSystemType).toBe("labyrinth");
    expect(result?.labyrinthMap).toEqual(labyrinthMap);
  });

  it("drops labyrinth runs without a valid map", () => {
    const result = parseActiveRunSchema(makeMinimalActiveRunInput({ contentSystemType: "labyrinth" }));
    expect(result).toBeNull();
  });

  it("drops unknown labyrinth modifiers from persisted maps", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const firstCombat = labyrinthMap.grid.flat().find((node) => node?.type === "combat");
    expect(firstCombat).not.toBeUndefined();
    firstCombat!.modifiers = ["tempered", "missing-modifier" as never];
    firstCombat!.rewardModifiers = ["generous", "old-reward" as never];

    const result = parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap }));

    const normalizedCombat = result?.labyrinthMap?.grid.flat().find((node) => node?.type === "combat");
    expect(normalizedCombat?.modifiers).toEqual(["tempered"]);
    expect(normalizedCombat?.rewardModifiers).toEqual(["generous"]);
  });

  it("drops runs with malformed labyrinth maps", () => {
    const mismatchedRows = generateLabyrinthMap(createSeededRng(42));
    mismatchedRows.rows += 1;

    const invalidConnection = generateLabyrinthMap(createSeededRng(42));
    const firstNode = invalidConnection.grid.flat().find(Boolean);
    firstNode!.connections = [{ row: 999, col: 999 }];

    expect(
      parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap: mismatchedRows })),
    ).toBeNull();
    expect(
      parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap: invalidConnection })),
    ).toBeNull();
  });

  it("drops runs with labyrinth maps that have impossible current or endpoint state", () => {
    const multipleCurrent = generateLabyrinthMap(createSeededRng(42));
    const firstVisible = multipleCurrent.grid.flat().find((node) => node?.state === "visible");
    firstVisible!.state = "current";

    const mismatchedCurrent = generateLabyrinthMap(createSeededRng(42));
    mismatchedCurrent.currentNode = { row: 1, col: 4 };

    const missingEntrance = generateLabyrinthMap(createSeededRng(42));
    missingEntrance.grid[0][4]!.type = "combat";

    const missingBoss = generateLabyrinthMap(createSeededRng(42));
    const boss = missingBoss.grid.flat().find((node) => node?.type === "boss");
    boss!.type = "combat";

    expect(
      parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap: multipleCurrent })),
    ).toBeNull();
    expect(
      parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap: mismatchedCurrent })),
    ).toBeNull();
    expect(
      parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap: missingEntrance })),
    ).toBeNull();
    expect(
      parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap: missingBoss })),
    ).toBeNull();
  });

  it("drops labyrinth map state for campaign runs", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "campaign", labyrinthMap }));
    expect(result?.labyrinthMap).toBeNull();
  });

  it("defaults missing runTalentXP to empty object", () => {
    const result = parseActiveRun(makeMinimalActiveRunInput({}));
    expect(result?.runTalentXP).toEqual({});
  });

  it("preserves runTalentXP when present", () => {
    const result = parseActiveRun(makeMinimalActiveRunInput({ runTalentXP: { burn: 10, poison: 5 } }));
    expect(result?.runTalentXP).toEqual({ burn: 10, poison: 5 });
  });

  it("rejects invalid runTalentXP values and falls back to empty object", () => {
    const result = parseActiveRunSchema(makeMinimalActiveRunInput({ runTalentXP: "invalid" }));
    expect(result?.runTalentXP).toEqual({});
  });
});
