import { describe, expect, it } from "vitest";
import {
  createStarterDraftChoices,
  wildcardStarterResumeTarget,
} from "@/features/alchemy/shared/run-flow/starter-draft";
import { makeTestCard } from "../../../../fixtures/battle";
import { DRAFT_CHOICES, DRAFT_ROUNDS } from "@/lib/game-constants";
import { getImmediateDamage, getImmediateDefense } from "@/lib/battle";
import { createSeededRng } from "@/lib/rng";
import { getOfferableCardPool, selectRewardCards, type BattleCard } from "@/lib/game-data";

function referenceDraftChoices(deck: BattleCard[], rng: () => number): BattleCard[] {
  const pool = getOfferableCardPool();
  const selected: BattleCard[] = [];
  for (const eligible of [
    pool.filter((card) => !card.consume && getImmediateDamage(card) > 0),
    pool.filter((card) => !card.consume && getImmediateDefense(card) > 0),
  ]) {
    selected.push(...selectRewardCards(deck, eligible, 1, [...deck, ...selected], rng));
  }
  selected.push(...selectRewardCards(deck, pool, DRAFT_CHOICES - selected.length, [...deck, ...selected], rng));
  return selected;
}

const drafted = Array.from({ length: DRAFT_ROUNDS }, (_, index) => makeTestCard({ id: `card-${index}` }));

it.each([1, 7, 19, 42, 93, 142, 201, 300])(
  "keeps attack and survival options available through all six seeded picks (%i)",
  (seed) => {
    const rng = createSeededRng(seed);
    const replayRng = createSeededRng(seed);
    const deck: BattleCard[] = [];
    for (let round = 0; round < DRAFT_ROUNDS; round++) {
      const before = [...deck];
      const choices = createStarterDraftChoices(deck, rng);
      expect(choices).toEqual(referenceDraftChoices(deck, replayRng));
      expect(deck).toEqual(before);
      expect(choices).toHaveLength(DRAFT_CHOICES);
      expect(new Set(choices.map((card) => card.id)).size).toBe(DRAFT_CHOICES);
      expect(choices.every((card) => !deck.some((owned) => owned.id === card.id))).toBe(true);
      expect(choices[0]!.consume).not.toBe(true);
      expect(getImmediateDamage(choices[0]!)).toBeGreaterThan(0);
      expect(choices[1]!.consume).not.toBe(true);
      expect(getImmediateDefense(choices[1]!)).toBeGreaterThan(0);
      deck.push(choices[(seed + round) % DRAFT_CHOICES]!);
    }
    expect(rng()).toBe(replayRng());
  },
);

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

  it("returns draft-deck for a finished campaign draft awaiting confirm", () => {
    expect(
      wildcardStarterResumeTarget({
        characterId: "wildcard",
        contentSystemType: "campaign",
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
