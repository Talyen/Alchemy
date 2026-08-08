import { describe, expect, it } from "vitest";
import { spendRunGold } from "@/features/alchemy/run-loop/run-gold";

describe("spendRunGold", () => {
  it("clamps gold at 0", () => {
    let gold = 3;
    spendRunGold(10, (fn) => {
      gold = fn(gold);
    });
    expect(gold).toBe(0);
  });

  it("only applies the supplied state update", () => {
    let gold = 10;
    let updates = 0;

    spendRunGold(0, (update) => {
      updates += 1;
      gold = update(gold);
    });

    expect(updates).toBe(1);
    expect(gold).toBe(10);
  });
});
