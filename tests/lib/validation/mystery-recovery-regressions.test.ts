import { describe, expect, it } from "vitest";
import { parseActiveRun } from "@/lib/validation";
import { cardById, getCardKeywords } from "@/lib/game-data";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";
import { savedActivityData, savedActivityFixture } from "../../fixtures/run-activity";

function restoreMystery(effects: unknown[], fields: Record<string, unknown> = {}) {
  const choice = { label: "Saved choice", effects };
  return savedActivityData(
    parseActiveRun(
      makeMinimalActiveRunInput({
        activity: savedActivityFixture("mystery", {
          event: { id: "saved", title: "Saved", art: "", narrative: "", choices: [choice] },
          chosenChoice: choice,
          cardChoices: null,
          grantedGear: [],
          chosenCardId: null,
          ...fields,
        }),
      }),
    ),
    "mystery",
  );
}

describe("Mystery recovery", () => {
  it("repairs invalid signed Health effects before they can reverse the promised action", () => {
    const visit = restoreMystery([{ kind: "healHealth", amount: -100 }]);
    expect(visit?.event.choices[0]!.effects).toEqual([{ kind: "healHealth", amount: 0 }]);
  });

  it("restores an unclaimed card reward when its saved offers are missing", () => {
    const visit = restoreMystery([{ kind: "chooseCard" }]);
    expect(visit?.chosenChoice).not.toBeNull();
    expect(visit?.chosenCardId).toBeNull();
    expect(visit?.cardChoices).toHaveLength(3);
  });

  it("drops an unknown XP keyword while retaining valid rewards and the claim marker", () => {
    const visit = restoreMystery([
      { kind: "gainXP", keyword: "missing-keyword", amount: 8 },
      { kind: "gainGold", amount: 20 },
    ]);
    expect(visit?.chosenChoice?.effects).toEqual([{ kind: "gainGold", amount: 20 }]);
    expect(visit?.event.choices[0]!.effects).toEqual([{ kind: "gainGold", amount: 20 }]);
  });

  it("repairs a negative XP reward before it can subtract earned Talent XP", () => {
    const visit = restoreMystery([{ kind: "gainXP", keyword: "holy", amount: -100 }]);
    expect(visit?.event.choices[0]!.effects).toEqual([{ kind: "gainXP", keyword: "holy", amount: 0 }]);
  });

  it("exits an empty saved event through the unusable-visit recovery path", () => {
    const visit = restoreMystery([], {
      event: { id: "empty", title: "Empty", art: "", narrative: "", choices: [] },
      chosenChoice: null,
    });
    expect(visit).toBeNull();
  });

  it("keeps a tagged card reward's promised keyword when repairing lost offers", () => {
    const visit = restoreMystery([{ kind: "chooseCard", tag: "archery" }], { cardChoices: [] });
    expect(visit?.cardChoices).toHaveLength(3);
    expect(visit?.cardChoices?.every((card) => getCardKeywords(card).includes("archery"))).toBe(true);
  });

  it("closes stale card offers when the saved card reward was already claimed", () => {
    const visit = restoreMystery([{ kind: "chooseCard" }], {
      chosenCardId: "slash",
      cardChoices: [cardById.slash!],
    });
    expect(visit?.chosenCardId).toBe("slash");
    expect(visit?.cardChoices).toBeNull();
  });
});
