import { describe, expect, it } from "vitest";

import {
  emptyHydratedMysteryVisit,
  hydrateMysteryVisit,
  hydratePersistedMysteryChoice,
  serializeMysteryVisit,
} from "@/lib/active-run-session";
import { getStartingDeck } from "@/lib/game-data";
import { findMysteryEvent } from "@/lib/mystery";

import { ANCIENT_ALTAR_MYSTERY_VISIT } from "../../features/alchemy/shared/stores/active-run-data-fixture";

describe("serializeMysteryVisit", () => {
  it("returns null when no event is in progress", () => {
    expect(
      serializeMysteryVisit({
        ...emptyHydratedMysteryVisit(),
      }),
    ).toBeNull();
  });

  it("serializes the live visit fields", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    const event = findMysteryEvent("ancient-altar");
    expect(event).not.toBeUndefined();

    expect(
      serializeMysteryVisit({
        mysteryEvent: event!,
        mysteryChosenChoice: ANCIENT_ALTAR_MYSTERY_VISIT.chosenChoice,
        mysteryPendingRemoval: true,
        mysteryCardChoices: [slash],
        mysteryGrantedTrinketIds: ["bone-charm"],
        mysteryChosenCardId: "slash",
      }),
    ).toEqual({
      eventId: "ancient-altar",
      chosenChoice: ANCIENT_ALTAR_MYSTERY_VISIT.chosenChoice,
      pendingRemoval: true,
      cardChoices: [slash],
      grantedTrinketIds: ["bone-charm"],
      chosenCardId: "slash",
    });
  });
});

describe("hydrateMysteryVisit", () => {
  it("returns empty fields for a null visit", () => {
    expect(hydrateMysteryVisit(null)).toEqual(emptyHydratedMysteryVisit());
  });

  it("returns empty fields for an unknown event id", () => {
    expect(hydrateMysteryVisit({ ...ANCIENT_ALTAR_MYSTERY_VISIT, eventId: "gone" })).toEqual(
      emptyHydratedMysteryVisit(),
    );
  });

  it("hydrates a known visit and normalizes chooseCard choices", () => {
    const hydrated = hydrateMysteryVisit({
      ...ANCIENT_ALTAR_MYSTERY_VISIT,
      chosenChoice: { label: "Browse", effects: [{ kind: "chooseCard" }] },
    });

    expect(hydrated.mysteryEvent?.id).toBe("ancient-altar");
    expect(hydrated.mysteryChosenChoice).toEqual({ label: "Browse", effects: [{ kind: "chooseCard" }] });
  });
});

describe("hydratePersistedMysteryChoice", () => {
  it("returns null for a missing choice", () => {
    expect(hydratePersistedMysteryChoice(null)).toBeNull();
  });

  it("keeps a tagged chooseCard effect", () => {
    expect(
      hydratePersistedMysteryChoice({
        label: "Browse",
        effects: [{ kind: "chooseCard", tag: "archery" }],
      }),
    ).toEqual({
      label: "Browse",
      effects: [{ kind: "chooseCard", tag: "archery" }],
    });
  });
});
