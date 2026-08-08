import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gearBaseItems } from "@/lib/gear/base-items";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const gearDir = path.join(rootDir, "Raw Assets", "Gear");
// CI sparse-checkouts omit Raw Assets except in the assets drift job.
const rawGearPresent = existsSync(gearDir);

function slugifyGearName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

describe.skipIf(!rawGearPresent)("raw gear assets", () => {
  it("matches catalog rarities for every named gear source file", async () => {
    let entries: string[];
    try {
      entries = await readdir(gearDir);
    } catch {
      entries = [];
    }

    const parsed = entries.flatMap((name) => {
      const match = name.match(/^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i);
      return match ? [{ displayName: match[1]!, rarity: match[2]!.toLowerCase() as "basic" | "astral" }] : [];
    });

    for (const asset of parsed) {
      const baseItemId = slugifyGearName(asset.displayName);
      const baseItem = gearBaseItems[baseItemId as keyof typeof gearBaseItems];
      expect(baseItem, `missing base item for raw asset ${asset.displayName}`).toBeDefined();
      expect(baseItem?.availableRarities).toContain(asset.rarity);
    }
  });

  it("has a raw asset for every catalog rarity variant", async () => {
    let entries: string[];
    try {
      entries = await readdir(gearDir);
    } catch {
      entries = [];
    }

    const assetsBySlug = new Map<string, Set<string>>();
    for (const name of entries) {
      const match = name.match(/^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i);
      if (!match) continue;
      const slug = slugifyGearName(match[1]!);
      const rarity = match[2]!.toLowerCase();
      const rarities = assetsBySlug.get(slug) ?? new Set<string>();
      rarities.add(rarity);
      assetsBySlug.set(slug, rarities);
    }

    for (const baseItem of Object.values(gearBaseItems)) {
      const rarities = assetsBySlug.get(baseItem.id) ?? new Set<string>();
      for (const rarity of baseItem.availableRarities) {
        expect(rarities.has(rarity), `${baseItem.id} missing ${rarity} raw art`).toBe(true);
      }
    }
  });

  it("has no raw gear art without a matching base item", async () => {
    let entries: string[];
    try {
      entries = await readdir(gearDir);
    } catch {
      entries = [];
    }

    const baseItemIds = new Set(Object.keys(gearBaseItems));
    const unmatched = entries.flatMap((name) => {
      const match = name.match(/^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i);
      if (!match) return [];
      const baseItemId = slugifyGearName(match[1]!);
      return baseItemIds.has(baseItemId) ? [] : [name];
    });

    expect(unmatched, `unmapped raw gear art: ${unmatched.join(", ")}`).toEqual([]);
  });
});
