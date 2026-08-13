// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SALVAGE_TARGET_SHADOW, VALID_TARGET_SHADOW } from "@/features/alchemy/meta/screens/armory/targeting-highlight";

describe("Armory targeting styles", () => {
  it("has salvage and valid-target shadows defined", () => {
    expect(SALVAGE_TARGET_SHADOW).toContain("shadow-");
    expect(VALID_TARGET_SHADOW).toContain("shadow-");
  });
});
