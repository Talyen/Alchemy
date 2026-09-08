import { describe, expect, it } from "vitest";
import {
  createStarterDraftChoices,
  wildcardStarterResumeTarget,
} from "@/features/alchemy/shared/run-flow/starter-draft";
import { makeTestCard } from "../../../../fixtures/battle";
import { DRAFT_CHOICES, DRAFT_ROUNDS } from "@/lib/game-constants";

const drafted = Array.from({ length: DRAFT_ROUNDS }, (_, index) => makeTestCard({ id: `card-${index}` }));

describe("createStarterDraftChoices", () => {
  it("returns the standard number of distinct draft choices", () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const choices = createStarterDraftChoices([], rng);
    expect(choices).toHaveLength(DRAFT_CHOICES);
    const uniqueIds = new Set(choices.map((c) => c.id));
    expect(uniqueIds.size).toBe(DRAFT_CHOICES);
  });
});

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

  it("returns difficulty-select for a completed campaign wildcard draft awaiting difficulty choice", () => {
    expect(
      wildcardStarterResumeTarget({
        characterId: "wildcard",
        contentSystemType: "campaign",
        selectedDifficulty: null,
        runDeckLength: drafted.length,
        starterDraftChoices: null,
      }),
    ).toBe("difficulty-select");
  });

  it("returns null for non-wildcard runs", () => {
    expect(
      wildcardStarterResumeTarget({
        characterId: "knight",
        contentSystemType: "campaign",
        selectedDifficulty: null,
        runDeckLength: 0,
        starterDraftChoices: null,
      }),
    ).toBeNull();
  });

  it("returns null for wildwood runs", () => {
    expect(
      wildcardStarterResumeTarget({
        characterId: "wildcard",
        contentSystemType: "wildwood",
        selectedDifficulty: null,
        runDeckLength: 0,
        starterDraftChoices: [makeTestCard({ id: "a" })],
      }),
    ).toBeNull();
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
