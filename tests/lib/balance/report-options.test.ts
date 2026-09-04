import { describe, expect, it } from "vitest";
import { parseBalanceReportOptions } from "@/lib/balance/report-options";

describe("parseBalanceReportOptions", () => {
  it("preserves the report defaults", () => {
    expect(parseBalanceReportOptions({})).toEqual({
      iterations: 100,
      trinketIterations: 50,
      cardIterations: 33,
      deckSeeds: 3,
      policy: "random-playable",
      loadoutMode: "typical",
      appliesFightPacing: true,
      findingsCap: 100,
    });
  });

  it("accepts every supported choice and derives sweep counts", () => {
    expect(
      parseBalanceReportOptions({
        ALCHEMY_BALANCE_ITERATIONS: "12",
        ALCHEMY_BALANCE_DECK_SEEDS: "2",
        ALCHEMY_BALANCE_POLICY: "greedy-effective-damage",
        ALCHEMY_BALANCE_LOADOUT: "bare",
        ALCHEMY_BALANCE_PACING: "off",
      }),
    ).toEqual({
      iterations: 12,
      trinketIterations: 20,
      cardIterations: 30,
      deckSeeds: 2,
      policy: "greedy-effective-damage",
      loadoutMode: "bare",
      appliesFightPacing: false,
      findingsCap: 100,
    });
  });

  it.each([
    ["ALCHEMY_BALANCE_ITERATIONS", ""],
    ["ALCHEMY_BALANCE_ITERATIONS", "0"],
    ["ALCHEMY_BALANCE_ITERATIONS", "-1"],
    ["ALCHEMY_BALANCE_ITERATIONS", "1.5"],
    ["ALCHEMY_BALANCE_DECK_SEEDS", "many"],
    ["ALCHEMY_BALANCE_POLICY", "fast"],
    ["ALCHEMY_BALANCE_LOADOUT", "loaded"],
    ["ALCHEMY_BALANCE_PACING", "sometimes"],
  ])("rejects invalid %s=%s before report generation", (name, value) => {
    expect(() => parseBalanceReportOptions({ [name]: value })).toThrow(name);
  });

  it.each(["on", "1", "true"])("accepts pacing enabled as %s", (value) => {
    expect(parseBalanceReportOptions({ ALCHEMY_BALANCE_PACING: value }).appliesFightPacing).toBe(true);
  });

  it.each(["off", "0", "false"])("accepts pacing disabled as %s", (value) => {
    expect(parseBalanceReportOptions({ ALCHEMY_BALANCE_PACING: value }).appliesFightPacing).toBe(false);
  });
});
