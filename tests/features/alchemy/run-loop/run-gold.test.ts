import { describe, expect, it, vi, beforeEach } from "vitest";
import { spendRunGold } from "@/features/alchemy/run-loop/run-gold";

vi.mock("@/lib/audio", () => ({
  playGoldSpend: vi.fn(),
}));

import { playGoldSpend } from "@/lib/audio";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("spendRunGold", () => {
  it("calls playGoldSpend only when price > 0", () => {
    const setRunGold = vi.fn();
    spendRunGold(0, setRunGold);
    expect(playGoldSpend).not.toHaveBeenCalled();

    spendRunGold(5, setRunGold);
    expect(playGoldSpend).toHaveBeenCalledOnce();
  });

  it("clamps gold at 0", () => {
    let gold = 3;
    spendRunGold(10, (fn) => {
      gold = fn(gold);
    });
    expect(gold).toBe(0);
  });
});
