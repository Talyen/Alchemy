import { describe, expect, it } from "vitest";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
  targetingRingClass,
} from "@/features/alchemy/meta/screens/armory/targeting-highlight";

describe("targetingRingClass", () => {
  it("returns the salvage ring set for salvage mode", () => {
    expect(targetingRingClass("salvage")).toEqual([SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW, "rounded-shell-hero"]);
  });

  it("returns the currency ring set for currency mode", () => {
    expect(targetingRingClass("currency")).toEqual([VALID_TARGET_RING, VALID_TARGET_SHADOW, "rounded-shell-hero"]);
  });

  it("returns no classes when there is no targeting mode", () => {
    expect(targetingRingClass(null)).toEqual([]);
  });

  it("keeps salvage and currency treatments distinct", () => {
    expect(targetingRingClass("salvage")).not.toEqual(targetingRingClass("currency"));
  });
});
