import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { describe, expect, it } from "vitest";
import {
  createEmptyTalentEffectManifest,
  DEFAULT_TALENT_EFFECTS,
  isTalentPlaceholder,
  talentPool,
} from "@/lib/game-data";
describe("talent effect invariants", () => {
  it("keeps only fields granted by current Talents, Homestead tiers, or Companion Bonds", () => {
    const granted = new Set<string>(["companionBondLevels"]);
    for (const talent of talentPool) {
      for (const effect of talent.effects ?? []) granted.add(effect.field);
    }
    for (const item of [...buildings, ...farmPlots, ...researchUpgrades]) {
      for (const tier of item.tiers) {
        for (const field of Object.keys(tier.effects ?? {})) granted.add(field);
      }
    }
    expect(Object.keys(DEFAULT_TALENT_EFFECTS).filter((field) => !granted.has(field))).toEqual([]);
  });

  it("non-boolean set fields have a single writer unless they concatenate as arrays", () => {
    const writers = new Map<string, string[]>();
    for (const talent of talentPool) {
      if (isTalentPlaceholder(talent)) continue;
      for (const effect of talent.effects ?? []) {
        if (effect.kind !== "set" || typeof effect.value === "boolean" || Array.isArray(effect.value)) continue;
        writers.set(effect.field, [...(writers.get(effect.field) ?? []), talent.id]);
      }
    }

    const collisions = [...writers.entries()].filter(([, ids]) => ids.length > 1);

    expect(collisions.map(([field, ids]) => `${field}: ${ids.join(", ")}`)).toEqual([]);
  });

  it("isolates every mutable manifest default across battles", () => {
    const first = createEmptyTalentEffectManifest();
    const next = createEmptyTalentEffectManifest();
    const before = structuredClone(next);
    first.cardHealMultipliers.slash = 99;
    first.companionBondLevels.wolf = 99;
    first.healthThresholdArmor.push({ threshold: 50, amount: 3 });
    expect(next).toEqual(before);
    expect(DEFAULT_TALENT_EFFECTS).toEqual(before);
  });
});
