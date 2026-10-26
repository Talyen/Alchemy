import { expect, it } from "vitest";
import { parseVisualScenarioArgs } from "../../scripts/visual-scenario.mjs";

it("selects an isolated current-source capture with explicit reproducible settings", () => {
  expect(parseVisualScenarioArgs(["battle"])).toEqual({
    list: false,
    scenario: "battle",
    label: "capture",
    locale: "en",
    viewport: { width: 1920, height: 1080 },
    seed: 42,
    port: 4179,
    mode: "dev",
    headed: false,
  });
  expect(
    parseVisualScenarioArgs([
      "options",
      "--locale=de",
      "--viewport",
      "1280x720",
      "--seed",
      "7",
      "--mode",
      "preview",
      "--port",
      "4279",
      "--label",
      "before",
      "--headed",
    ]),
  ).toMatchObject({
    scenario: "options",
    locale: "de",
    viewport: { width: 1280, height: 720 },
    seed: 7,
    mode: "preview",
    port: 4279,
    label: "before",
    headed: true,
  });
});

it("rejects output traversal, invalid selections and resource settings before launching a browser", () => {
  for (const args of [
    ["typo"],
    ["menu", "battle"],
    ["menu", "--label", "../../outside"],
    ["menu", "--locale", "constructor"],
    ["menu", "--viewport", "0x1080"],
    ["menu", "--viewport", "999999x1080"],
    ["menu", "--seed", "NaN"],
    ["menu", "--seed", "2147483648"],
    ["menu", "--port", "0"],
    ["menu", "--mode", "production"],
    ["menu", "--label", "before", "--label", "after"],
    ["menu", "--typo"],
  ])
    expect(() => parseVisualScenarioArgs(args)).toThrow();
});
