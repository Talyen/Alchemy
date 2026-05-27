import { describe, expect, it, vi } from "vitest";
import {
  appendCardToRunWithDiscovery,
  appendTrinketToRunWithDiscovery,
} from "@/features/alchemy/run/deck-mutations";
import type { BattleCard } from "@/lib/game-data";

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "fireball", title: "Fireball", descriptionLines: [""], art: "", cost: 2, effects: [], ...overrides };
}

describe("appendCardToRunWithDiscovery", () => {
  it("appends card to deck and updates discovered IDs", () => {
    const card = makeCard();
    const setRunDeck = vi.fn();
    const setDiscoveredCardIds = vi.fn();

    appendCardToRunWithDiscovery(card, { setRunDeck, setDiscoveredCardIds });

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([{ id: "stab" } as BattleCard])).toEqual([{ id: "stab" }, card]);

    const discUpdater = setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater(["stab"])).toEqual(["stab", "fireball"]);
  });

  it("does not duplicate discovered card ids", () => {
    const card = makeCard();
    const setDiscoveredCardIds = vi.fn();

    appendCardToRunWithDiscovery(card, { setRunDeck: vi.fn(), setDiscoveredCardIds });
    appendCardToRunWithDiscovery(card, { setRunDeck: vi.fn(), setDiscoveredCardIds });

    const secondUpdater = setDiscoveredCardIds.mock.calls[1][0];
    expect(secondUpdater(["fireball"])).toEqual(["fireball"]);
  });
});

describe("appendTrinketToRunWithDiscovery", () => {
  it("appends trinket and discovers it", () => {
    const setRunTrinkets = vi.fn();
    const setDiscoveredTrinketIds = vi.fn();

    appendTrinketToRunWithDiscovery("bone-charm", { setRunTrinkets, setDiscoveredTrinketIds });

    const trinketUpdater = setRunTrinkets.mock.calls[0][0];
    expect(trinketUpdater([])).toEqual(["bone-charm"]);

    const discUpdater = setDiscoveredTrinketIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["bone-charm"]);
  });
});
