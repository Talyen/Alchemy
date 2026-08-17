import { describe, expect, it } from "vitest";
import { wildcardStarterResumeTarget } from "@/features/alchemy/shared/run-flow/starter-draft";
import { makeTestCard } from "../../../../fixtures/battle";
import { DRAFT_ROUNDS } from "@/lib/game-constants";

const drafted = Array.from({ length: DRAFT_ROUNDS }, (_, index) => makeTestCard({ id: `card-${index}` }));

describe("wildcardStarterResumeTarget", () => {
  it("returns draft-deck for an incomplete campaign draft", () => {
    expect(
      wildcardStarterResumeTarget({
        characterId: "wildcard",
        contentSystemType: "campaign",
        selectedDifficulty: null,
        runDeckLength: 1,
        starterDraftChoices: [makeTestCard({ id: "a" })],
      }),
    ).toBe("draft-deck");
  });

  it("returns draft-deck for a finished labyrinth draft awaiting confirm", () => {
    expect(
      wildcardStarterResumeTarget({
        characterId: "wildcard",
        contentSystemType: "labyrinth",
        selectedDifficulty: null,
        runDeckLength: drafted.length,
        starterDraftChoices: [],
      }),
    ).toBe("draft-deck");
  });

  it("returns null for an initialized labyrinth Wildcard run", () => {
    expect(
      wildcardStarterResumeTarget({
        characterId: "wildcard",
        contentSystemType: "labyrinth",
        selectedDifficulty: null,
        runDeckLength: drafted.length,
        starterDraftChoices: null,
      }),
    ).toBeNull();
  });
});
