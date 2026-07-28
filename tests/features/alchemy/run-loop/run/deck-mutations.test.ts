import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeDiscoveryCard } from "../../../../helpers/discovery-store-mock";
import {
  appendCardToRunWithDiscovery,
  appendTrinketToRunWithDiscovery,
} from "@/features/alchemy/run-loop/run/deck-mutations";
import type { BattleCard } from "@/lib/game-data";

const discoveryMocks = vi.hoisted(() => ({
  setDiscoveredCardIds: vi.fn(),
  setDiscoveredTrinketIds: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/profile-store", () => ({
  useProfileStore: {
    getState: () => ({
      setDiscoveredCardIds: discoveryMocks.setDiscoveredCardIds,
      setDiscoveredTrinketIds: discoveryMocks.setDiscoveredTrinketIds,
    }),
  },
}));

beforeEach(() => {
  discoveryMocks.setDiscoveredCardIds.mockClear();
  discoveryMocks.setDiscoveredTrinketIds.mockClear();
});

describe("appendCardToRunWithDiscovery", () => {
  it("appends card to deck and updates discovered IDs", () => {
    const card = makeDiscoveryCard();
    const setRunDeck = vi.fn();

    appendCardToRunWithDiscovery(card, setRunDeck);

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([{ id: "stab" } as BattleCard])).toEqual([{ id: "stab" }, card]);

    const discUpdater = discoveryMocks.setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater(["stab"])).toEqual(["stab", "fireball"]);
  });

  it("does not duplicate discovered card ids", () => {
    const card = makeDiscoveryCard();

    appendCardToRunWithDiscovery(card, vi.fn());
    appendCardToRunWithDiscovery(card, vi.fn());

    const secondUpdater = discoveryMocks.setDiscoveredCardIds.mock.calls[1][0];
    expect(secondUpdater(["fireball"])).toEqual(["fireball"]);
  });
});

describe("appendTrinketToRunWithDiscovery", () => {
  it("appends boon and discovers it", () => {
    const setRunTrinkets = vi.fn();

    appendTrinketToRunWithDiscovery("bone-charm", setRunTrinkets);

    const boonUpdater = setRunTrinkets.mock.calls[0][0];
    expect(boonUpdater([])).toEqual(["bone-charm"]);

    const discUpdater = discoveryMocks.setDiscoveredTrinketIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["bone-charm"]);
  });
});
