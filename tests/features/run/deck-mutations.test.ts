import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  appendCardToRunWithDiscovery,
  appendBoonToRunWithDiscovery,
} from "@/features/alchemy/run-loop/run/deck-mutations";
import type { BattleCard } from "@/lib/game-data";

const setDiscoveredCardIds = vi.fn();
const setDiscoveredBoonIds = vi.fn();

vi.mock("@/features/alchemy/shared/stores/app-store", () => ({
  useAppStore: {
    getState: () => ({ setDiscoveredCardIds, setDiscoveredBoonIds }),
  },
}));

beforeEach(() => {
  setDiscoveredCardIds.mockClear();
  setDiscoveredBoonIds.mockClear();
});

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "fireball", title: "Fireball", descriptionLines: [""], art: "", cost: 2, effects: [], ...overrides };
}

describe("appendCardToRunWithDiscovery", () => {
  it("appends card to deck and updates discovered IDs", () => {
    const card = makeCard();
    const setRunDeck = vi.fn();

    appendCardToRunWithDiscovery(card, setRunDeck);

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([{ id: "stab" } as BattleCard])).toEqual([{ id: "stab" }, card]);

    const discUpdater = setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater(["stab"])).toEqual(["stab", "fireball"]);
  });

  it("does not duplicate discovered card ids", () => {
    const card = makeCard();

    appendCardToRunWithDiscovery(card, vi.fn());
    appendCardToRunWithDiscovery(card, vi.fn());

    const secondUpdater = setDiscoveredCardIds.mock.calls[1][0];
    expect(secondUpdater(["fireball"])).toEqual(["fireball"]);
  });
});

describe("appendBoonToRunWithDiscovery", () => {
  it("appends boon and discovers it", () => {
    const setRunBoons = vi.fn();

    appendBoonToRunWithDiscovery("bone-charm", setRunBoons);

    const boonUpdater = setRunBoons.mock.calls[0][0];
    expect(boonUpdater([])).toEqual(["bone-charm"]);

    const discUpdater = setDiscoveredBoonIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["bone-charm"]);
  });
});
