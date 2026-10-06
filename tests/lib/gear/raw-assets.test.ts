import { gearAssets } from "../../../scripts/assets/gear-assets.mjs";
import { describe, expect, it } from "vitest";
import { gearBaseItems } from "@/lib/gear/base-items";

describe("selected gear assets", () => {
  it("selects exactly the catalog's Basic and Astral variants", () => {
    const variants = gearAssets
      .filter(({ target }) => !target.startsWith("gear-slot-"))
      .map(({ target }) => target.replace(/^gear-/u, "").replace(/\.webp$/u, ""));
    const expected = Object.keys(gearBaseItems).flatMap((id) => [`${id}-basic`, `${id}-astral`]);
    expect(variants.sort()).toEqual(expected.sort());
  });
});
