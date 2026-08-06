import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeDiscoveryCard } from "../../../../helpers/discovery-store-mock";
import { applyAlchemistPotion, applyRewardSelection } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import * as rewardGold from "@/features/alchemy/run-loop/navigation/reward-flow";

const discoveryMocks = vi.hoisted(() => ({
  setDiscoveredCardIds: vi.fn(),
  setDiscoveredTrinketIds: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/profile-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/profile-store")>();
  return {
    ...actual,
    setDiscoveredCardIds: discoveryMocks.setDiscoveredCardIds,
    setDiscoveredTrinketIds: discoveryMocks.setDiscoveredTrinketIds,
  };
});

beforeEach(() => {
  discoveryMocks.setDiscoveredCardIds.mockClear();
  discoveryMocks.setDiscoveredTrinketIds.mockClear();
});

describe("applyRewardSelection", () => {
  it("appends card rewards with discovery", () => {
    const card = makeDiscoveryCard({ id: "slash", title: "Slash", cost: 1 });
    const setRunDeck = vi.fn();

    applyRewardSelection({ choice: card, type: "card", setRunDeck, setRunTrinkets: vi.fn() });

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([])).toEqual([card]);
    const discUpdater = discoveryMocks.setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["slash"]);
  });

  it("appends boon rewards with discovery", () => {
    const setRunTrinkets = vi.fn();

    applyRewardSelection({
      choice: { id: "bone-charm" },
      type: "trinket",
      setRunDeck: vi.fn(),
      setRunTrinkets,
    });

    const boonUpdater = setRunTrinkets.mock.calls[0][0];
    expect(boonUpdater([])).toEqual(["bone-charm"]);
    const discUpdater = discoveryMocks.setDiscoveredTrinketIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["bone-charm"]);
  });
});

describe("applyAlchemistPotion", () => {
  it("adds a random potion card with discovery", () => {
    const potion = makeDiscoveryCard({ id: "mana-potion" });
    vi.spyOn(rewardGold, "getRandomPotionCard").mockReturnValue(potion);

    const setRunDeck = vi.fn();
    applyAlchemistPotion({ setRunDeck, rng: () => 0.5 });

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([])).toEqual([potion]);
    const discUpdater = discoveryMocks.setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["mana-potion"]);

    vi.restoreAllMocks();
  });
});
