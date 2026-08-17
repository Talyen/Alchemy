import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeDiscoveryCard } from "../../../../helpers/discovery-store-mock";
import {
  appendCardToRunWithDiscovery,
  appendTrinketToRunWithDiscovery,
} from "@/features/alchemy/run-loop/run/deck-mutations";
import type { BattleCard } from "@/lib/game-data";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

const discoveryMocks = vi.hoisted(() => ({
  discoverCardIds: vi.fn(),
  discoverTrinketIds: vi.fn(),
  setRunDeck: vi.fn(),
  setRunTrinkets: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-session-write-port")>();
  return { ...actual, setRunDeck: discoveryMocks.setRunDeck, setRunTrinkets: discoveryMocks.setRunTrinkets };
});

vi.mock("@/features/alchemy/shared/stores/profile-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/profile-store")>();
  return {
    ...actual,
    discoverCardIds: discoveryMocks.discoverCardIds,
    discoverTrinketIds: discoveryMocks.discoverTrinketIds,
  };
});

beforeEach(() => {
  discoveryMocks.discoverCardIds.mockClear();
  discoveryMocks.discoverTrinketIds.mockClear();
  discoveryMocks.setRunDeck.mockClear();
  discoveryMocks.setRunTrinkets.mockClear();
});

describe("appendCardToRunWithDiscovery", () => {
  it("appends card to deck and updates discovered IDs", () => {
    const card = makeDiscoveryCard();
    const draft = {} as GameplayDraft;
    appendCardToRunWithDiscovery(draft, card);

    const deckUpdater = discoveryMocks.setRunDeck.mock.calls[0][1];
    expect(deckUpdater([{ id: "stab" } as BattleCard])).toEqual([{ id: "stab" }, card]);
    expect(discoveryMocks.discoverCardIds).toHaveBeenCalledWith(draft, [card.id]);
  });

  it("discovers the same card id on each append", () => {
    const card = makeDiscoveryCard();
    const draft = {} as GameplayDraft;
    appendCardToRunWithDiscovery(draft, card);
    appendCardToRunWithDiscovery(draft, card);

    expect(discoveryMocks.discoverCardIds).toHaveBeenNthCalledWith(1, draft, [card.id]);
    expect(discoveryMocks.discoverCardIds).toHaveBeenNthCalledWith(2, draft, [card.id]);
  });
});

describe("appendTrinketToRunWithDiscovery", () => {
  it("appends boon and discovers it", () => {
    const draft = {} as GameplayDraft;
    appendTrinketToRunWithDiscovery(draft, "bone-charm");

    const boonUpdater = discoveryMocks.setRunTrinkets.mock.calls[0][1];
    expect(boonUpdater([])).toEqual(["bone-charm"]);
    expect(discoveryMocks.discoverTrinketIds).toHaveBeenCalledWith(draft, ["bone-charm"]);
  });
});
