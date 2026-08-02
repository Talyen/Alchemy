import { describe, expect, it, vi, beforeEach } from "vitest";
import { refreshOfferings } from "@/features/alchemy/run-loop/shop-transactions";
import type { BattleCard } from "@/lib/game-data";
import { makeTestCardWithId } from "../../../fixtures/battle";

vi.mock("@/lib/audio", () => ({
  playGoldSpend: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/utils", () => ({
  resampleItems: vi.fn(),
}));

import { playGoldSpend } from "@/lib/audio";
import { resampleItems } from "@/features/alchemy/shared/utils";

const makeCard = (id: string): BattleCard =>
  makeTestCardWithId(id, { effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("refreshOfferings", () => {
  const currentItems = [makeCard("a")];
  const newItems = [makeCard("b"), makeCard("c")];

  function makeInput(overrides: Partial<Parameters<typeof refreshOfferings>[0]> = {}) {
    return {
      price: 5,
      refreshesLeft: 1,
      runGold: 10,
      pool: [makeCard("x")],
      currentItems,
      count: 2,
      setRunGold: vi.fn((fn: (g: number) => number) => fn(10)),
      setState: vi.fn(),
      mapState: (prev: unknown, items: BattleCard[]) => ({ ...(prev as { cards: BattleCard[] }), cards: items }),
      rng: () => 0.5,
      ...overrides,
    };
  }

  it("returns false when refreshesLeft <= 0", () => {
    const input = makeInput({ refreshesLeft: 0 });
    expect(refreshOfferings(input)).toBe(false);
    expect(input.setState).not.toHaveBeenCalled();
  });

  it("returns false when runGold < price", () => {
    const input = makeInput({ runGold: 2 });
    expect(refreshOfferings(input)).toBe(false);
    expect(playGoldSpend).not.toHaveBeenCalled();
  });

  it("on success spends gold and resamples", () => {
    vi.mocked(resampleItems).mockReturnValue(newItems);
    const setRunGold = vi.fn((fn: (g: number) => number) => fn(10));
    const setState = vi.fn();
    const prev = { cards: currentItems };
    const input = makeInput({ setRunGold, setState });

    expect(refreshOfferings(input)).toBe(true);
    expect(playGoldSpend).toHaveBeenCalled();
    expect(setRunGold).toHaveBeenCalled();
    expect(resampleItems).toHaveBeenCalledWith(input.pool, currentItems, 2, input.rng);
    expect(setState).toHaveBeenCalled();
    const next = vi.mocked(setState).mock.calls[0][0](prev);
    expect(next.cards).toEqual(newItems);
  });
});
