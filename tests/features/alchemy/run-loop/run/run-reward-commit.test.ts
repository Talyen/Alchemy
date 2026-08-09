import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeDiscoveryCard } from "../../../../helpers/discovery-store-mock";
import { applyAlchemistPotion, applyRewardSelection } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import * as rewardGold from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

const discoveryMocks = vi.hoisted(() => ({
  setDiscoveredCardIds: vi.fn(),
  setDiscoveredTrinketIds: vi.fn(),
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
    setDiscoveredCardIds: discoveryMocks.setDiscoveredCardIds,
    setDiscoveredTrinketIds: discoveryMocks.setDiscoveredTrinketIds,
  };
});

beforeEach(() => {
  discoveryMocks.setDiscoveredCardIds.mockClear();
  discoveryMocks.setDiscoveredTrinketIds.mockClear();
  discoveryMocks.setRunDeck.mockClear();
  discoveryMocks.setRunTrinkets.mockClear();
});

describe("applyRewardSelection", () => {
  it("appends card rewards with discovery", () => {
    const card = makeDiscoveryCard({ id: "slash", title: "Slash", cost: 1 });
    const draft = {} as GameplayDraft;
    applyRewardSelection({ choice: card, type: "card", draft });

    const deckUpdater = discoveryMocks.setRunDeck.mock.calls[0][1];
    expect(deckUpdater([])).toEqual([card]);
    const discUpdater = discoveryMocks.setDiscoveredCardIds.mock.calls[0][1];
    expect(discUpdater([])).toEqual(["slash"]);
  });

  it("appends boon rewards with discovery", () => {
    const draft = {} as GameplayDraft;

    applyRewardSelection({
      choice: { id: "bone-charm" },
      type: "trinket",
      draft,
    });

    const boonUpdater = discoveryMocks.setRunTrinkets.mock.calls[0][1];
    expect(boonUpdater([])).toEqual(["bone-charm"]);
    const discUpdater = discoveryMocks.setDiscoveredTrinketIds.mock.calls[0][1];
    expect(discUpdater([])).toEqual(["bone-charm"]);
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
    const discUpdater = discoveryMocks.setDiscoveredCardIds.mock.calls[0][1];
    expect(discUpdater([])).toEqual(["mana-potion"]);

    vi.restoreAllMocks();
  });
});
