import { savedActivityFixture, savedActivityData } from "../../fixtures/run-activity";
import { describe, expect, it } from "vitest";
import {
  emptyHydratedMysteryVisit,
  hydrateMysteryVisit,
  parseActiveRun,
  serializeMysteryVisit,
} from "@/lib/active-run-session";
import { getStartingDeck } from "@/lib/game-data";
import type { MysteryEvent } from "@/lib/mystery";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";

describe("Mystery visit resume", () => {
  it("preserves the offered event, selected reward and claim markers across repeated save/resume", () => {
    const event: MysteryEvent = {
      id: "removed-from-live-pool",
      title: "Saved offer",
      art: "",
      narrative: "Saved narrative",
      choices: [
        {
          label: "Claim the offer",
          effects: [
            { kind: "gainGold", amount: 40 },
            { kind: "gainXP", keyword: "holy", amount: 8 },
            { kind: "healHealth", amount: 5, chance: 0 },
            { kind: "gainRandomTrinket", fromIds: ["bone-charm"] },
            { kind: "gainGeneratedGear", baseItemId: "emerald-ring", astral: true },
            { kind: "chooseCard", tag: "archery" },
          ],
        },
      ],
    };
    const card = getStartingDeck("knight")[0]!;
    const visit = {
      mysteryEvent: event,
      mysteryChosenChoice: event.choices[0]!,
      mysteryCardChoices: [card],
      mysteryGrantedTrinketIds: ["bone-charm"],
      mysteryGrantedGearInstances: [{ instanceId: "claimed-gear", definitionId: "emerald-ring-basic", affixes: [] }],
      mysteryChosenCardId: card.id,
    };
    let persisted = serializeMysteryVisit(visit);
    for (let resume = 0; resume < 2; resume++) {
      const restored = parseActiveRun(
        JSON.parse(JSON.stringify(makeMinimalActiveRunInput({ activity: savedActivityFixture("mystery", persisted) }))),
      );
      expect(restored).not.toBeNull();
      const hydrated = hydrateMysteryVisit(savedActivityData(restored!, "mystery"));
      expect(hydrated).toEqual(visit);
      persisted = serializeMysteryVisit(hydrated);
    }
  });

  it("preserves a pending untagged card choice without inventing a chosen reward", () => {
    const restored = parseActiveRun(
      makeMinimalActiveRunInput({
        activity: savedActivityFixture("mystery", {
          event: {
            id: "saved",
            title: "Saved",
            art: "",
            narrative: "",
            choices: [
              {
                label: "Browse",
                effects: [
                  { kind: "chooseCard", tag: "" },
                  { kind: "healHealth", amount: 5, chance: undefined },
                  { kind: "gainRandomTrinket", fromIds: undefined },
                  { kind: "gainGeneratedGear", baseItemId: "emerald-ring", astral: undefined },
                ],
              },
            ],
          },
          chosenChoice: null,
          cardChoices: null,
          grantedTrinketIds: [],
          grantedGear: [],
          chosenCardId: null,
        }),
      }),
    );
    const visit = hydrateMysteryVisit(savedActivityData(restored!, "mystery"));
    const effects = [
      { kind: "chooseCard" },
      { kind: "healHealth", amount: 5 },
      { kind: "gainRandomTrinket" },
      { kind: "gainGeneratedGear", baseItemId: "emerald-ring" },
    ];
    expect(visit.mysteryEvent?.choices).toStrictEqual([{ label: "Browse", effects }]);
    expect(visit.mysteryChosenChoice).toBeNull();
    expect(visit.mysteryChosenCardId).toBeNull();
  });

  it("keeps an absent visit absent when saved and restores neutral live fields", () => {
    expect(serializeMysteryVisit(emptyHydratedMysteryVisit())).toBeNull();
    expect(hydrateMysteryVisit(null)).toEqual(emptyHydratedMysteryVisit());
  });
});
