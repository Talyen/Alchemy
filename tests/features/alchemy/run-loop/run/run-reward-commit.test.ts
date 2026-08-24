import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeDiscoveryCard } from "../../../../helpers/discovery-store-mock";
import { applyAlchemistPotion, applyRewardSelection } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import * as rewardGold from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

const discoveryMocks = vi.hoisted(() => ({
  discoverCardIds: vi.fn(),
  discoverTrinketIds: vi.fn(),
  setRunDeck: vi.fn(),
  setRunBoons: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-session-write-port")>();
  return { ...actual, setRunDeck: discoveryMocks.setRunDeck, setRunBoons: discoveryMocks.setRunBoons };
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
  discoveryMocks.setRunBoons.mockClear();
});

describe("applyRewardSelection", () => {
  it("appends card rewards with discovery", () => {
    const card = makeDiscoveryCard({ id: "slash", title: "Slash", cost: 1 });
    const draft = {} as GameplayDraft;
    applyRewardSelection({ choice: card, type: "card", draft });

    const deckUpdater = discoveryMocks.setRunDeck.mock.calls[0][1];
    expect(deckUpdater([])).toEqual([card]);
    expect(discoveryMocks.discoverCardIds).toHaveBeenCalledWith(draft, ["slash"]);
  });

  it("appends boon rewards with discovery", () => {
    const draft = {} as GameplayDraft;

    applyRewardSelection({
      choice: { id: "bone-charm" },
      type: "boon",
      draft,
    });

    const boonUpdater = discoveryMocks.setRunBoons.mock.calls[0][1];
    expect(boonUpdater([])).toEqual(["bone-charm"]);
    expect(discoveryMocks.discoverTrinketIds).toHaveBeenCalledWith(draft, ["bone-charm"]);
  });
});

describe("applyAlchemistPotion", () => {
  it("adds a random potion card with discovery", () => {
    const potion = makeDiscoveryCard({ id: "mana-potion" });
    vi.spyOn(rewardGold, "getRandomPotionCard").mockReturnValue(potion);

    const draft = {} as GameplayDraft;
    applyAlchemistPotion({ draft, rng: () => 0.5 });

    const deckUpdater = discoveryMocks.setRunDeck.mock.calls[0][1];
    expect(deckUpdater([])).toEqual([potion]);
    expect(discoveryMocks.discoverCardIds).toHaveBeenCalledWith(draft, ["mana-potion"]);
  });
});
