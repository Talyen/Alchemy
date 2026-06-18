import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CRAFTING_CURRENCY_LIST } from "@/lib/gear";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const craftingDir = path.join(rootDir, "Raw Assets", "Crafting");
const optimizedDir = path.join(rootDir, "src", "assets", "optimized");

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

describe("crafting currency art", () => {
  it("has one correctly named raw source image per crafting currency", async () => {
    const entries = await readdir(craftingDir);
    const expected = CRAFTING_CURRENCY_LIST.map((currency) => `${currency.displayName}.jpeg`).sort();
    const actual = entries.filter((name) => /\.(jpe?g|png)$/i.test(name)).sort();

    expect(actual).toEqual(expected);
  });

  it("has optimized art for every crafting currency definition", async () => {
    const entries = await readdir(optimizedDir);

    for (const currency of CRAFTING_CURRENCY_LIST) {
      expect(entries, `${currency.displayName} missing optimized art`).toContain(
        `crafting-${slugify(currency.displayName)}.webp`,
      );
      expect(currency.art, `${currency.displayName} missing imported art`).toBeTruthy();
    }
  });
});
