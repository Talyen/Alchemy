import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeCardRefreshHandler, makeShopRefreshHandler } from "@/features/alchemy/run-loop/shop-transactions";
import type { BattleCard } from "@/lib/game-data";
import { makeTestCardWithId } from "../../../fixtures/battle";

vi.mock("@/lib/audio", () => ({
  playGoldSpend: vi.fn(),
}));

vi.mock("@/lib/game-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game-data")>();
  return { ...actual, selectRewardCards: vi.fn() };
});

import { playGoldSpend } from "@/lib/audio";
import { selectRewardCards } from "@/lib/game-data";

const makeCard = (id: string): BattleCard =>
  makeTestCardWithId(id, { effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("makeShopRefreshHandler", () => {
  const newItems = [makeCard("b"), makeCard("c")];

  function makeHandler(overrides: Partial<Parameters<typeof makeShopRefreshHandler>[0]> = {}) {
    return makeShopRefreshHandler({
      getPrice: () => 5,
      getRefreshesLeft: () => 1,
      getRunGold: () => 10,
      setRunGold: vi.fn(),
      setState: vi.fn(),
      resample: vi.fn(() => newItems),
      getMapState: (prev, items) => ({ ...(prev as object), items }),
      ...overrides,
    });
  }

  it("returns false when refreshesLeft <= 0", () => {
    const setRunGold = vi.fn();
    const setState = vi.fn();
    const handler = makeHandler({ getRefreshesLeft: () => 0, setRunGold, setState });
    expect(handler()).toBe(false);
    expect(playGoldSpend).not.toHaveBeenCalled();
    expect(setRunGold).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it("returns false when runGold < price", () => {
    const handler = makeHandler({ getRunGold: () => 2 });
    expect(handler()).toBe(false);
    expect(playGoldSpend).not.toHaveBeenCalled();
  });

  it("on success spends gold and maps the resampled items into state", () => {
    const setRunGold = vi.fn();
    const setState = vi.fn();
    const handler = makeHandler({ setRunGold, setState });

    expect(handler()).toBe(true);
    expect(playGoldSpend).toHaveBeenCalled();
    expect(setRunGold).toHaveBeenCalled();
    expect(vi.mocked(setRunGold).mock.calls[0][1](100)).toBe(95);
    expect(setState).toHaveBeenCalled();
    const next = vi.mocked(setState).mock.calls[0][1]({ cards: [] });
    expect(next.items).toEqual(newItems);
  });
});

describe("makeCardRefreshHandler", () => {
  it("delegates resampling to selectRewardCards with the deck pool", () => {
    const deck = [makeCard("d")];
    const pool = [makeCard("x")];
    const currentItems = [makeCard("a")];
    const newItems = [makeCard("b")];
    const rng = () => 0.5;
    vi.mocked(selectRewardCards).mockReturnValue(newItems);
    const setState = vi.fn();

    const handler = makeCardRefreshHandler({
      getPrice: () => 5,
      getRefreshesLeft: () => 1,
      getRunGold: () => 10,
      setRunGold: vi.fn(),
      getPool: () => pool,
      getCurrentItems: () => currentItems,
      count: 2,
      setState,
      getDeck: () => deck,
      rng,
      getMapState: (prev, items) => ({ ...(prev as object), cards: items }),
    });

    expect(handler()).toBe(true);
    expect(selectRewardCards).toHaveBeenCalledWith(deck, pool, 2, currentItems, rng);
    const next = vi.mocked(setState).mock.calls[0][1]({ cards: currentItems });
    expect(next.cards).toEqual(newItems);
  });
});
