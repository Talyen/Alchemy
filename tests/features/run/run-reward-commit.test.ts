import { describe, expect, it, vi } from "vitest";
import { applyAlchemistPotion, applyRewardSelection } from "@/features/alchemy/run/run-destination-handlers";
import * as rewardGold from "@/features/alchemy/navigation/reward-gold";
import type { BattleCard } from "@/lib/game-data";

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "health-potion", title: "Heal", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

describe("applyRewardSelection", () => {
  it("appends card rewards with discovery", () => {
    const card = makeCard({ id: "slash" });
    const setRunDeck = vi.fn();
    const setDiscoveredCardIds = vi.fn();

    applyRewardSelection({
      choice: card,
      type: "card",
      setRunDeck,
      setRunTrinkets: vi.fn(),
      setDiscoveredCardIds,
      setDiscoveredTrinketIds: vi.fn(),
    });

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([])).toEqual([card]);
    const discUpdater = setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["slash"]);
  });

  it("appends trinket rewards with discovery", () => {
    const setRunTrinkets = vi.fn();
    const setDiscoveredTrinketIds = vi.fn();

    applyRewardSelection({
      choice: { id: "bone-charm" },
      type: "trinket",
      setRunDeck: vi.fn(),
      setRunTrinkets,
      setDiscoveredCardIds: vi.fn(),
      setDiscoveredTrinketIds,
    });

    const trinketUpdater = setRunTrinkets.mock.calls[0][0];
    expect(trinketUpdater([])).toEqual(["bone-charm"]);
    const discUpdater = setDiscoveredTrinketIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["bone-charm"]);
  });
});

describe("applyAlchemistPotion", () => {
  it("adds a random potion card with discovery", () => {
    const potion = makeCard({ id: "mana-potion" });
    vi.spyOn(rewardGold, "getRandomPotionCard").mockReturnValue(potion);

    const setRunDeck = vi.fn();
    const setDiscoveredCardIds = vi.fn();
    applyAlchemistPotion({ setRunDeck, setDiscoveredCardIds });

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([])).toEqual([potion]);
    const discUpdater = setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["mana-potion"]);

    vi.restoreAllMocks();
  });
});
