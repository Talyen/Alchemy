import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gearBaseItems } from "@/lib/gear/base-items";
import { GEAR_FILE_PATTERN, slugifyGearName } from "../../../scripts/assets/gear-filenames.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const gearDir = path.join(rootDir, "Raw Assets", "Gear");

const rawGearPresent = existsSync(gearDir);

describe.skipIf(!rawGearPresent)("raw gear assets", () => {
  it("has exactly the catalog's Basic and Astral source variants, with no orphaned or duplicate item art", async () => {
    const variants = (await readdir(gearDir)).flatMap((name) => {
      const match = name.match(GEAR_FILE_PATTERN);
      return match ? [`${slugifyGearName(match[1]!)}-${match[2]!.toLowerCase()}`] : [];
    });
    const expected = Object.keys(gearBaseItems).flatMap((id) => [`${id}-basic`, `${id}-astral`]);
    expect(variants.sort()).toEqual(expected.sort());
  });
});

describe("gear filename conventions", () => {
  it("strips apostrophes before slugging (Smith's -> smiths, not smith-s)", () => {
    expect(slugifyGearName("Smith's Whetstone")).toBe("smiths-whetstone");
    expect(slugifyGearName("Sin-Eater's Lantern")).toBe("sin-eaters-lantern");
  });
});
