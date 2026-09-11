import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CRAFTING_CURRENCY_LIST } from "@/lib/gear";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
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
