import { describe, expect, it } from "vitest";
import { mysteryPool, pickMysteryEvent } from "@/lib/mystery";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";

describe("mysteryPool", () => {
  it("contains events", () => {
    expect(mysteryPool.length).toBeGreaterThan(0);
  });

  it("each event has required fields and 2 choices", () => {
    for (const event of mysteryPool) {
      expect(event.id).toBeTruthy();
      expect(event.title).toBeTruthy();
      expect(event.narrative).toBeTruthy();
      expect(typeof event.art).toBe("string");
      expect(event.choices).toHaveLength(2);
    }
  });

  it("each event has a unique ID", () => {
    const ids = mysteryPool.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each choice has label and at least one effect", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        expect(choice.label).toBeTruthy();
        expect(choice.effects.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("every event has a non-empty art URL", () => {
    for (const event of mysteryPool) {
      expect(event.art, `Event "${event.id}" has no art URL`).toBeTruthy();
    }
  });

  it("addCard effects reference valid card IDs", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "addCard") {
            const card = cardLibrary.find((c) => c.id === effect.cardId);
            expect(card, `Event "${event.id}" references unknown card "${effect.cardId}"`).toBeDefined();
          }
        }
      }
    }
  });

  it("gainTrinket effects reference valid trinket IDs", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "gainTrinket") {
            const trinket = trinketLibrary.find((t) => t.id === effect.trinketId);
            expect(trinket, `Event "${event.id}" references unknown trinket "${effect.trinketId}"`).toBeDefined();
          }
        }
      }
    }
  });

  it("Abandoned Study 'Search the Scrolls' uses chooseCard effect", () => {
    const study = mysteryPool.find((e) => e.id === "abandoned-study");
    expect(study).toBeDefined();
    const search = study!.choices.find((c) => c.label === "Search the Scrolls");
    expect(search).toBeDefined();
    expect(search!.effects.some((e) => e.kind === "chooseCard")).toBe(true);
  });

  it("Overgrown Temple 'Explore the Crypt' uses gainRandomTrinket", () => {
    const temple = mysteryPool.find((e) => e.id === "overgrown-temple");
    expect(temple).toBeDefined();
    const explore = temple!.choices.find((c) => c.label === "Explore the Crypt");
    expect(explore).toBeDefined();
    expect(explore!.effects.some((e) => e.kind === "gainRandomTrinket")).toBe(true);
  });

  it("Hunter's Lodge 'Take the Arrows' uses chooseCard with archery tag", () => {
    const lodge = mysteryPool.find((e) => e.id === "hunters-lodge");
    expect(lodge).toBeDefined();
    const arrows = lodge!.choices.find((c) => c.label === "Take the Arrows");
    expect(arrows).toBeDefined();
    const effect = arrows!.effects.find((e) => e.kind === "chooseCard");
    expect(effect).toBeDefined();
    if (effect?.kind === "chooseCard") expect(effect.tag).toBe("archery");
  });

  it("Fairy Ring has a 'Make a Wish' choice", () => {
    expect(
      mysteryPool.find((e) => e.id === "fairy-ring")!.choices.find((c) => c.label === "Make a Wish"),
    ).toBeDefined();
  });

  it("Ancient Altar has a 'Pray' choice", () => {
    expect(mysteryPool.find((e) => e.id === "ancient-altar")!.choices.find((c) => c.label === "Pray")).toBeDefined();
  });
});

describe("pickMysteryEvent", () => {
  it("returns a valid event from the pool", () => {
    const event = pickMysteryEvent();
    expect(mysteryPool).toContain(event);
  });
});
