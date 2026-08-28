import type { TalentEffectManifest } from "@/lib/game-data";
import { isTalentPlaceholder, talentPool, type TalentDefinition, type TalentEffectOperation } from "@/lib/game-data";

export const META_ONLY_TALENT_FIELDS: ReadonlySet<keyof TalentEffectManifest> = new Set([
  "shopCardDiscount",
  "shopFreeRefresh",
  "goldPerCombat",
  "potionDiscount",
  "removeCardDiscount",
  "enemyGoldDropBonus",
  "eliteGoldDropBonus",
  "mixPotionDiscount",
  "campfireHealBonus",
  "maxHealthPerCombat",
  "wishCrystalGold",
]);

function operationField(effect: TalentEffectOperation): keyof TalentEffectManifest {
  return effect.field;
}

export function isCombatTalent(talent: TalentDefinition): boolean {
  if (isTalentPlaceholder(talent)) return false;
  const effects = talent.effects ?? [];
  if (effects.length === 0) return false;
  return effects.some((effect) => !META_ONLY_TALENT_FIELDS.has(operationField(effect)));
}

export function combatTalentsInPoolOrder(keywordId: TalentDefinition["keywordId"]): TalentDefinition[] {
  return talentPool.filter((talent) => talent.keywordId === keywordId && isCombatTalent(talent));
}
