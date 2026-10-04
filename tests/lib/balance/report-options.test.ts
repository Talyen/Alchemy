import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBalanceReportOptions } from "@/lib/balance/report-options";

afterEach(() => vi.unstubAllEnvs());

describe("parseBalanceReportOptions", () => {
  it("does not let ambient pacing override an explicitly supplied environment", () => {
    vi.stubEnv("ALCHEMY_BALANCE_PACING", "invalid ambient value");
    expect(parseBalanceReportOptions({}).appliesFightPacing).toBe(true);
    expect(() => parseBalanceReportOptions()).toThrow("ALCHEMY_BALANCE_PACING");
  });
  it.each([
    ["quick", 12, 5, 15, 1],
    ["full", 100, 50, 33, 3],
  ] as const)(
    "sizes the %s sweep without changing policy or pacing defaults",
    (mode, iterations, pairedIterations, cardDeckSamples, deckSeeds) => {
      expect(parseBalanceReportOptions({ ALCHEMY_BALANCE_MODE: mode })).toEqual({
        mode,
        iterations,
        pairedIterations,
        cardDeckSamples,
        deckSeeds,
        policy: "random-playable",
        loadoutMode: "typical",
        appliesFightPacing: true,
        findingsCap: 100,
      });
    },
  );

  it("accepts every supported choice and derives sweep counts", () => {
    expect(
      parseBalanceReportOptions({
        ALCHEMY_BALANCE_MODE: "full",
        ALCHEMY_BALANCE_ITERATIONS: "12",
        ALCHEMY_BALANCE_DECK_SEEDS: "2",
        ALCHEMY_BALANCE_POLICY: "greedy-effective-damage",
        ALCHEMY_BALANCE_LOADOUT: "bare",
        ALCHEMY_BALANCE_PACING: "off",
      }),
    ).toEqual({
      mode: "full",
      iterations: 12,
      pairedIterations: 20,
      cardDeckSamples: 30,
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
    ["ALCHEMY_BALANCE_ITERATIONS", "9007199254740992"],
    ["ALCHEMY_BALANCE_MODE", "sample"],
    ["ALCHEMY_BALANCE_DECK_SEEDS", "many"],
    ["ALCHEMY_BALANCE_POLICY", "fast"],
    ["ALCHEMY_BALANCE_LOADOUT", "loaded"],
    ["ALCHEMY_BALANCE_PACING", "sometimes"],
    ["ALCHEMY_BALANCE_FINDINGS_CAP", "0"],
  ])("rejects invalid %s=%s before report generation", (name, value) => {
    expect(() => parseBalanceReportOptions({ [name]: value })).toThrow(name);
  });
});
