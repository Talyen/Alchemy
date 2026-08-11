import { describe, expect, it } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";
import { parseActiveRun } from "@/lib/active-run-session";
import { cardLibrary } from "@/lib/game-data";
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { makeMinimalActiveRunInput } from "../../../../fixtures/active-run";

/** Schema-only parse for ActiveRunDataSchema coercion/default tests (no runtime guards). */
const parseActiveRunSchema = (value: unknown) => ActiveRunDataSchema.nullable().catch(null).parse(value);

describe("ActiveRunDataSchema", () => {
  it("preserves corrupted cards in active runs", () => {
    const result = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: [
          {
            id: "slash",
            title: "Slash",
            descriptionLines: ["Deal 8 Physical damage"],
            art: "",
            cost: 1,
            effects: [{ kind: "damage", damageType: "physical", amount: 8 }],
            corrupted: true,
            corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }],
          },
        ],
      }),
    );

    expect(result?.runDeck[0].corrupted).toBe(true);
    expect(result?.runDeck[0].descriptionLines).toEqual(["Deal 8 Physical damage"]);
    expect(result?.runDeck[0].effects[0]).toMatchObject({ amount: 8 });
    expect(result?.runDeck[0].corruptedValuePositions).toEqual([{ lineIndex: 0, matchIndex: 5 }]);
    expect(result?.runDeck[0].art).toBe(cardLibrary.find((card) => card.id === "slash")?.art);
  });

  it("refreshes known saved card art without changing saved gameplay fields", () => {
    const result = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: [
          {
            id: "block",
            title: "Block",
            descriptionLines: ["Gain 9 Block"],
            art: "stale-build-url.webp",
            cost: 2,
            effects: [{ kind: "player-status", status: "block", amount: 9 }],
          },
        ],
      }),
    );

    expect(result?.runDeck[0]).toMatchObject({
      id: "block",
      title: "Block",
      descriptionLines: ["Gain 9 Block"],
      cost: 2,
      effects: [{ kind: "player-status", status: "block", amount: 9 }],
    });
    expect(result?.runDeck[0].art).toBe(cardLibrary.find((card) => card.id === "block")?.art);
  });

  it("does not let saved card data override library-owned fields", () => {
    const result = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: [
          {
            id: "slash",
            uid: 7,
            title: "Malicious Slash",
            descriptionLines: ["Deal 8 Physical damage"],
            art: "stale-build-url.webp",
            cost: 1,
            effects: [{ kind: "damage", damageType: "physical", amount: 8 }],
            hackedField: true,
          },
        ],
      }),
    );

    const card = result?.runDeck[0];
    expect(card?.title).toBe(cardLibrary.find((c) => c.id === "slash")?.title);
    expect(card?.art).toBe(cardLibrary.find((c) => c.id === "slash")?.art);
    expect(card?.uid).toBe(7);
    expect((card as unknown as { hackedField?: boolean })?.hackedField).toBeUndefined();
  });

  it("drops malformed saved card mutation fields", () => {
    const result = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: [
          {
            id: "bash",
            title: "Bash",
            descriptionLines: ["bad", 42],
            art: "stale-build-url.webp",
            cost: Number.NaN,
            effects: [null],
            corrupted: true,
            corruptedValuePositions: [{ lineIndex: 0, matchIndex: 3 }, null, { lineIndex: -1, matchIndex: 2 }],
          } as never,
        ],
      }),
    );

    const libraryCard = cardLibrary.find((card) => card.id === "bash");
    expect(result?.runDeck[0].descriptionLines).toEqual(libraryCard?.descriptionLines);
    expect(result?.runDeck[0].cost).toBe(libraryCard?.cost);
    expect(result?.runDeck[0].effects).toEqual(libraryCard?.effects);
    // Zod recovers the negative lineIndex to 0 for the second position
    expect(result?.runDeck[0].corruptedValuePositions).toEqual([
      { lineIndex: 0, matchIndex: 3 },
      { lineIndex: 0, matchIndex: 2 },
    ]);
  });

  it("falls back to library effects when a known card has malformed saved effects", () => {
    const result = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: [
          {
            id: "slash",
            title: "Slash",
            descriptionLines: ["Deal broken damage"],
            art: "stale-build-url.webp",
            cost: 1,
            effects: [
              { kind: "damage", damageType: "physical", amount: "bad" },
              { kind: "summon-companion", companionId: "missing" },
              { kind: "unknown", amount: 99 },
            ],
          },
        ],
      }),
    );

    const libraryCard = cardLibrary.find((card) => card.id === "slash");
    expect(result?.runDeck[0].effects).toEqual(libraryCard?.effects);
  });

  it("keeps valid saved effects after dropping invalid ones for known cards", () => {
    const result = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: [
          {
            id: "fireball",
            title: "Fireball",
            descriptionLines: ["Deal 10 Burn damage", "Gain 3 Gold"],
            art: "stale-build-url.webp",
            cost: 2,
            effects: [
              { kind: "damage", damageType: "burn", amount: 10 },
              { kind: "gain-gold", amount: "bad" },
            ],
          },
        ],
      }),
    );

    expect(result?.runDeck[0].effects).toEqual([{ kind: "damage", damageType: "burn", amount: 10 }]);
  });

  it("keeps only valid saved effects for unknown cards", () => {
    const result = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: [
          {
            id: "custom-card",
            title: "Custom Card",
            descriptionLines: ["Custom"],
            art: "custom.webp",
            cost: 1,
            effects: [
              { kind: "heal", amount: 4 },
              { kind: "damage", damageType: "physical", amount: "bad" },
            ],
          },
        ],
      }),
    );

    expect(result?.runDeck[0].effects).toEqual([{ kind: "heal", amount: 4 }]);
  });

  it.each(["ranger", "rogue", "wizard"] as const)("passes through valid %s characterId", (characterId) => {
    const result = parseActiveRun(makeMinimalActiveRunInput({ characterId }));
    expect(result?.characterId).toBe(characterId);
  });

  it("returns null for unknown characterId", () => {
    const result = parseActiveRun(makeMinimalActiveRunInput({ characterId: "bard" }));
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

  it("sets selectedDifficulty to null for invalid value", () => {
    const result = parseActiveRunSchema(makeMinimalActiveRunInput({ selectedDifficulty: "difficulty-999" }));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("sets selectedDifficulty to null when missing", () => {
    const result = parseActiveRunSchema(makeMinimalActiveRunInput({}));
    expect(result?.selectedDifficulty).toBeNull();
  });

  it("sets selectedDifficulty to null for non-string value", () => {
    const result = parseActiveRunSchema(makeMinimalActiveRunInput({ selectedDifficulty: 42 }));
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
  });

  it("drops labyrinth runs without a valid map", () => {
    const result = parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth" }));
    expect(result).toBeNull();
  });

  it("preserves valid labyrinth map state", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const result = parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "labyrinth", labyrinthMap }));
    expect(result?.labyrinthMap).toEqual(labyrinthMap);
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
