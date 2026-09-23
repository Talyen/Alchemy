import { describe, expect, it } from "vitest";

import {
  emptyHydratedMysteryVisit,
  hydrateMysteryVisit,
  hydratePersistedMysteryChoice,
  serializeMysteryVisit,
} from "@/lib/active-run-session";
import { getStartingDeck } from "@/lib/game-data";
import { findMysteryEvent } from "@/lib/mystery";
import { resolveMysteryEventTrinkets } from "@/lib/mystery/resolve-trinkets";

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
      event,
      chosenChoice: ANCIENT_ALTAR_MYSTERY_VISIT.chosenChoice,
      pendingRemoval: true,
      cardChoices: [slash],
      grantedTrinketIds: ["bone-charm"],
      grantedGear: [],
      chosenCardId: "slash",
    });
  });

  it("round-trips a claimed random Gear reward through grantedGear", () => {
    const event = findMysteryEvent("overgrown-temple");
    const choice = event?.choices.find((candidate) => candidate.label === "Search the Crypt");
    const instance = { instanceId: "mystery-random-gear", definitionId: "emerald-ring-basic", affixes: [] };
    expect(event).not.toBeUndefined();
    expect(choice).not.toBeUndefined();

    const persisted = serializeMysteryVisit({
      mysteryEvent: event!,
      mysteryChosenChoice: choice!,
      mysteryPendingRemoval: false,
      mysteryCardChoices: null,
      mysteryGrantedTrinketIds: [],
      mysteryGrantedGearInstances: [instance],
      mysteryChosenCardId: null,
    });

    expect(persisted?.chosenChoice).toEqual(choice);
    expect(persisted?.grantedGear).toEqual([instance]);

    const hydrated = hydrateMysteryVisit(persisted);
    expect(hydrated.mysteryChosenChoice).toEqual(choice);
    expect(hydrated.mysteryGrantedGearInstances).toEqual([instance]);
  });
});

describe("hydrateMysteryVisit", () => {
  it("returns empty fields for a null visit", () => {
    expect(hydrateMysteryVisit(null)).toEqual(emptyHydratedMysteryVisit());
  });

  it("keeps a saved offer after its event leaves the live pool", () => {
    const event = { ...ANCIENT_ALTAR_MYSTERY_VISIT.event, id: "gone" };
    expect(hydrateMysteryVisit({ ...ANCIENT_ALTAR_MYSTERY_VISIT, event }).mysteryEvent).toBe(event);
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

  it("keeps the exact offered choices rather than rebuilding them from the pool", () => {
    const base = findMysteryEvent("enchanted-spring")!;
    const offered = {
      ...base,
      choices: base.choices.map((choice) => ({
        ...choice,
        effects: choice.effects.map((effect) =>
          effect.kind === "gainTrinket" && effect.trinketId === "icy-heart"
            ? { kind: "gainTrinket" as const, trinketId: "merchants-favor" }
            : effect,
        ),
      })),
    };
    const hydrated = hydrateMysteryVisit({
      event: offered,
      chosenChoice: null,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
    });

    expect(hydrated.mysteryEvent).toBe(offered);
    expect(serializeMysteryVisit(hydrated)?.event).toBe(offered);
  });

  it("keeps the revised random Gear reward when a visit is hydrated", () => {
    const hydrated = hydrateMysteryVisit({
      event: findMysteryEvent("overgrown-temple")!,
      chosenChoice: null,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
    });

    const search = hydrated.mysteryEvent?.choices.find((choice) => choice.label === "Search the Crypt");
    expect(search?.effects).toContainEqual({ kind: "gainRandomGear" });
    expect(search?.effects).toContainEqual({ kind: "gainMaterial", material: "iron", amount: 3 });
  });

  it("keeps the resolved Astral fallback Gear on resume", () => {
    const event = resolveMysteryEventTrinkets(findMysteryEvent("enchanted-spring")!, ["groves-favor"], () => 0);
    const hydrated = hydrateMysteryVisit({
      event,
      chosenChoice: null,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
    });

    const moss = hydrated.mysteryEvent?.choices.find((choice) => choice.label === "Gather the Moss");
    expect(moss?.effects).toContainEqual(expect.objectContaining({ kind: "gainGeneratedGear", astral: true }));
    expect(hydrated.mysteryEvent).toEqual(event);
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
