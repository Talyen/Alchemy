import type { BestiaryEntry } from "@/lib/game-data";
import { TRAIT_DAMAGE_RULES } from "@/lib/game-constants";
import type { ContentValidationIssue } from "../types";

// Damage types and magnitudes come from TRAIT_DAMAGE_RULES. These terms cover
// the other effects described by native Traits; nested terms are alternatives.
export const TRAIT_REQUIRED_TERMS: Record<string, ReadonlyArray<string | readonly string[]>> = {
  "hollow-frame": ["cannot", "leeched"],
  pilfer: ["steals", "block", "before attacking"],
  "snap-shut": ["block", "after attacking"],
  "soul-harvest": ["purge", "leech", "below half health"],
  contagion: ["restores", "health", "opponent", "poison damage"],
  "frost-elemental": ["freeze"],
  "iron-hide": ["armor"],
  "rusting-carapace": ["forge"],
  "starting-block": ["block"],
  "glacial-shell": ["freeze"],
  regeneration: [["health", "heal"]],
  "living-armor": ["armor"],
  "gold-trove": ["gold"],
  "cinder-skin": ["burn"],
  bandit: ["double", "first", "landed", "hit"],
  ogre: ["physical", "block"],
  "fire-imp": ["burn"],
  hellhound: ["burn"],
  pyromancer: ["burn"],
  "giant-spider": ["poison"],
  "giant-snake": ["poison", "block"],
  "blood-cultist": ["bleed"],
  "dire-wolf": ["bleed"],
  vampire: ["bleed", "health"],
  "blood-countess": ["restores health"],
  "zealot-enemy": ["holy", "forge"],
  cleric: ["block", "holy", "health"],
  inquisitor: ["holy", "burn"],
  paladin: ["block", "stun"],
  seraph: ["holy", "health"],
  "winter-wolf": ["freeze"],
  "ice-wraith": ["restores", "health", "opponent", "frozen"],
  yeti: ["block", "frozen"],
  banshee: ["purge"],
  brawler: ["damage", "stun"],
  "stone-golem": ["block", "damage"],
  "earth-elemental": ["block", "physical"],
  "stone-titan": ["stun"],
};

function damageMagnitudePhrase(multiplier: number): string {
  if (multiplier === 0.5) return "half";
  if (multiplier === 2) return "double";
  const percent = Number((Math.abs(multiplier - 1) * 100).toFixed(2));
  return `${percent}% ${multiplier < 1 ? "less" : "more"}`;
}

interface TraitDamageExpectation {
  damageType: string;
  magnitude: string;
}

// Grouped once so per-trait validation does not scan the whole rule table or
// reformat the same magnitudes for every enemy.
const DAMAGE_EXPECTATIONS_BY_TRAIT: ReadonlyMap<string, readonly TraitDamageExpectation[]> = (() => {
  const grouped = new Map<string, TraitDamageExpectation[]>();
  for (const rule of TRAIT_DAMAGE_RULES) {
    const expectation = { damageType: rule.damageType, magnitude: damageMagnitudePhrase(rule.multiplier) };
    const list = grouped.get(rule.traitId);
    if (list) list.push(expectation);
    else grouped.set(rule.traitId, [expectation]);
  }
  return grouped;
})();

export function validateEnemyTraitDescriptionParity(enemy: BestiaryEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  for (const trait of enemy.traits) {
    const description = trait.description.toLowerCase();
    const requirements = Object.hasOwn(TRAIT_REQUIRED_TERMS, trait.id) ? TRAIT_REQUIRED_TERMS[trait.id]! : [];
    for (const requirement of requirements) {
      const alternatives = typeof requirement === "string" ? [requirement] : requirement;
      if (alternatives.some((term) => description.includes(term))) continue;
      issues.push({
        severity: "error",
        area: "enemies",
        id: enemy.id,
        message: `Trait "${trait.id}" description does not mention ${alternatives.join(" or ")}`,
      });
    }

    const damageExpectations = DAMAGE_EXPECTATIONS_BY_TRAIT.get(trait.id) ?? [];
    if (damageExpectations.length > 0) {
      const lines = description.split("\n");
      for (const expectation of damageExpectations) {
        if (lines.some((line) => line.includes(expectation.damageType) && line.includes(expectation.magnitude)))
          continue;
        issues.push({
          severity: "error",
          area: "enemies",
          id: enemy.id,
          message: `Trait "${trait.id}" description does not mention ${expectation.magnitude} ${expectation.damageType} damage`,
        });
      }
    }
  }
  return issues;
}
