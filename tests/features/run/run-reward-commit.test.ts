import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyAlchemistPotion, applyRewardSelection } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import * as rewardGold from "@/features/alchemy/run-loop/navigation/reward-flow";
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
  return { id: "health-potion", title: "Heal", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

describe("applyRewardSelection", () => {
  it("appends card rewards with discovery", () => {
    const card = makeCard({ id: "slash" });
    const setRunDeck = vi.fn();

    applyRewardSelection({ choice: card, type: "card", setRunDeck, setRunBoons: vi.fn() });

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([])).toEqual([card]);
    const discUpdater = setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["slash"]);
  });

  it("appends boon rewards with discovery", () => {
    const setRunBoons = vi.fn();

    applyRewardSelection({
      choice: { id: "bone-charm" },
      type: "boon",
      setRunDeck: vi.fn(),
      setRunBoons,
    });

    const boonUpdater = setRunBoons.mock.calls[0][0];
    expect(boonUpdater([])).toEqual(["bone-charm"]);
    const discUpdater = setDiscoveredBoonIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["bone-charm"]);
  });
});

describe("applyAlchemistPotion", () => {
  it("adds a random potion card with discovery", () => {
    const potion = makeCard({ id: "mana-potion" });
    vi.spyOn(rewardGold, "getRandomPotionCard").mockReturnValue(potion);

    const setRunDeck = vi.fn();
    applyAlchemistPotion({ setRunDeck });

    const deckUpdater = setRunDeck.mock.calls[0][0];
    expect(deckUpdater([])).toEqual([potion]);
    const discUpdater = setDiscoveredCardIds.mock.calls[0][0];
    expect(discUpdater([])).toEqual(["mana-potion"]);

    vi.restoreAllMocks();
  });
});
