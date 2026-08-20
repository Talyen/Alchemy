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
        mysteryGrantedGearInstances: [],
        mysteryChosenCardId: "slash",
      }),
    ).toEqual({
      eventId: "ancient-altar",
      chosenChoice: ANCIENT_ALTAR_MYSTERY_VISIT.chosenChoice,
      pendingRemoval: true,
      cardChoices: [slash],
      grantedTrinketIds: ["bone-charm"],
      grantedGear: [],
      chosenCardId: "slash",
      resolvedTrinketIds: [],
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

  it("hydrates a pending legacy card removal", () => {
    const hydrated = hydrateMysteryVisit({ ...ANCIENT_ALTAR_MYSTERY_VISIT, pendingRemoval: true });

    expect(hydrated.mysteryPendingRemoval).toBe(true);
  });

  it("applies persisted trinket substitutions onto the pool event", () => {
    const hydrated = hydrateMysteryVisit({
      eventId: "enchanted-spring",
      chosenChoice: null,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
      resolvedTrinketIds: ["groves-favor", "merchants-favor"],
    });

    const moss = hydrated.mysteryEvent?.choices.find((choice) => choice.label === "Gather the Moss");
    const charm = hydrated.mysteryEvent?.choices.find((choice) => choice.label === "Take the Charm");
    expect(moss?.effects).toContainEqual({ kind: "gainTrinket", trinketId: "groves-favor" });
    expect(charm?.effects).toContainEqual({ kind: "gainTrinket", trinketId: "merchants-favor" });
  });

  it("resolves leftover random trinkets when a legacy visit omitted resolvedTrinketIds", () => {
    const hydrated = hydrateMysteryVisit(
      {
        eventId: "overgrown-temple",
        chosenChoice: null,
        cardChoices: null,
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
        resolvedTrinketIds: [],
      },
      { ownedTrinketIds: [], rng: () => 0 },
    );

    const search = hydrated.mysteryEvent?.choices.find((choice) => choice.label === "Search the Crypt");
    const trinket = search?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(trinket.trinketId);
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
