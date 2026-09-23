import type { BestiaryEntry } from "@/lib/game-data";
import { TRAIT_DAMAGE_RULES } from "@/lib/game-constants";
import type { ContentValidationIssue } from "../types";

// Damage types and magnitudes come from TRAIT_DAMAGE_RULES. These terms cover
// the other effects described by native Traits; nested terms are alternatives.
export const TRAIT_REQUIRED_TERMS: Record<string, ReadonlyArray<string | readonly string[]>> = {
  "frost-elemental": ["freeze"],
  "iron-hide": ["armor"],
  "rusting-carapace": ["forge"],
  "starting-block": ["block"],
  "glacial-shell": ["freeze"],
  regeneration: [["health", "heal"]],
  "living-armor": ["armor"],
  "gold-trove": ["gold"],
  "cinder-skin": ["burn"],
  bandit: ["attack"],
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
  "ice-wraith": ["freeze"],
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

export function validateEnemyTraitDescriptionParity(enemy: BestiaryEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  for (const trait of enemy.traits) {
    const description = trait.description.toLowerCase();
    for (const requirement of TRAIT_REQUIRED_TERMS[trait.id] ?? []) {
      const alternatives = typeof requirement === "string" ? [requirement] : requirement;
      if (alternatives.some((term) => description.includes(term))) continue;
      issues.push({
        severity: "error",
        area: "enemies",
        id: enemy.id,
        message: `Trait "${trait.id}" description does not mention ${alternatives.join(" or ")}`,
      });
    }

    const lines = description.split("\n");
    for (const rule of TRAIT_DAMAGE_RULES) {
      if (rule.traitId !== trait.id) continue;
      const magnitude = damageMagnitudePhrase(rule.multiplier);
      if (lines.some((line) => line.includes(rule.damageType) && line.includes(magnitude))) continue;
      issues.push({
        severity: "error",
        area: "enemies",
        id: enemy.id,
        message: `Trait "${trait.id}" description does not mention ${magnitude} ${rule.damageType} damage`,
      });
    }
  }
  return issues;
}
