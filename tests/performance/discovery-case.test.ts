import { expect, it } from "vitest";
import { isUsableDiscoveryResult, selectCase } from "../../performance/case-selection.mjs";

it("admits bounded exploratory combat while rejecting failed or otherwise incomplete careers", () => {
  const stalled = { status: "incomplete", error: "Incomplete: battle turn budget exhausted" };
  const discovery = selectCase("seeded-discovery");
  expect(isUsableDiscoveryResult(discovery, stalled)).toBe(true);
  expect(isUsableDiscoveryResult(selectCase("campaign-early"), stalled)).toBe(false);
  expect(isUsableDiscoveryResult(discovery, { status: "incomplete", error: "Invariant violation" })).toBe(false);
  expect(isUsableDiscoveryResult(discovery, { status: "failed" })).toBe(false);
  expect(isUsableDiscoveryResult(discovery, { status: "completed" })).toBe(true);
});
