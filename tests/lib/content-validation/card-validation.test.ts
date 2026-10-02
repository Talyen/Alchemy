import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleCard, BattleCardEffect, CompanionId } from "@/lib/game-data";
import { validateCards } from "@/lib/content-validation/validators-cards";
import { createCollector } from "@/lib/content-validation/utils";

const { cards } = vi.hoisted(() => ({ cards: [] as BattleCard[] }));
vi.mock("@/lib/game-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/game-data")>()),
  cardLibrary: cards,
}));
vi.mock("@/lib/game-data/cards/card-pools", () => ({ getOfferableCardPool: () => cards }));

function checkEffects(effects: BattleCardEffect[]): string[] {
  cards.push({ id: "nested-card", title: "Nested Card", art: "", cost: 1, descriptionLines: [], effects });
  const collector = createCollector();
  validateCards(collector);
  return collector.issues
    .filter(
      (issue) =>
        issue.message.startsWith("References unknown companion:") || issue.message.startsWith("Authored chance"),
    )
    .map((issue) => issue.message);
}

describe("authored card effect validation", () => {
  beforeEach(() => {
    cards.length = 0;
  });

  it("checks both chance outcomes inside delayed effects, preserving diagnostic order", () => {
    expect(
      checkEffects([
        {
          kind: "repeat-over-turns",
          remainingTurns: 2,
          effects: [
            {
              kind: "chance",
              probability: 0.5,
              successEffects: [
                // Deliberately invalid catalog IDs exercise authoring diagnostics.
                { kind: "summon-companion", companionId: "missing-success" as CompanionId },
                { kind: "chance", probability: 0.5, successEffects: [{ kind: "heal", amount: 1 }], failureEffects: [] },
              ],
              failureEffects: [{ kind: "summon-companion", companionId: "missing-failure" as CompanionId }],
            },
          ],
        },
      ]),
    ).toEqual([
      "References unknown companion: missing-success",
      "References unknown companion: missing-failure",
      "Authored chance effect has an empty failure branch",
    ]);
  });

  it("reports each authored empty chance branch, including a delayed nested branch", () => {
    expect(
      checkEffects([
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [
            {
              kind: "repeat-over-turns",
              remainingTurns: 1,
              effects: [
                { kind: "chance", probability: 0.5, successEffects: [{ kind: "heal", amount: 1 }], failureEffects: [] },
              ],
            },
          ],
          failureEffects: [],
        },
      ]),
    ).toEqual([
      "Authored chance effect has an empty failure branch",
      "Authored chance effect has an empty failure branch",
    ]);
  });
});
