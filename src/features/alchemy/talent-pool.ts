import type { KeywordId } from "@/lib/game-data";
import type { TalentEffectManifest } from "@/lib/battle/types";

export interface TalentDefinition {
  id: string;
  keywordId: KeywordId;
  description: string;
}

export const talentPool: TalentDefinition[] = [
  { id: "physical-dmg-1", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-2", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-3", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-4", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-5", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-dmg-6", keywordId: "physical", description: "Increase Physical Damage by 1" },
  { id: "physical-armor", keywordId: "physical", description: "Physical Damage is increased by your Armor" },
  { id: "physical-crit", keywordId: "physical", description: "Physical Damage has +5% Critical Chance" },

  { id: "stun-1", keywordId: "stun", description: "Stun effects last 1 turn longer" },
  { id: "stun-2", keywordId: "stun", description: "Stun effects last 1 turn longer" },
  { id: "stun-3", keywordId: "stun", description: "Stun effects last 1 turn longer" },
  { id: "stun-4", keywordId: "stun", description: "Stun effects last 1 turn longer" },

  { id: "block-1", keywordId: "block", description: "+1 Block when blocking" },
  { id: "block-2", keywordId: "block", description: "+1 Block when blocking" },
  { id: "block-3", keywordId: "block", description: "+1 Block when blocking" },
  { id: "block-4", keywordId: "block", description: "+1 Block when blocking" },

  { id: "forge-1", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-2", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-3", keywordId: "forge", description: "Forge effects are 1 stronger" },
  { id: "forge-4", keywordId: "forge", description: "Forge effects are 1 stronger" },

  { id: "armor-1", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-2", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-3", keywordId: "armor", description: "+1 Armor gained" },
  { id: "armor-4", keywordId: "armor", description: "+1 Armor gained" },

  { id: "health-1", keywordId: "health", description: "+5 Max Health" },
  { id: "health-2", keywordId: "health", description: "+5 Max Health" },
  { id: "health-3", keywordId: "health", description: "+5 Max Health" },
  { id: "health-4", keywordId: "health", description: "+5 Max Health" },

  { id: "burn-1", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-2", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-3", keywordId: "burn", description: "Burn deals 1 extra damage" },
  { id: "burn-4", keywordId: "burn", description: "Burn deals 1 extra damage" },

  { id: "gold-1", keywordId: "gold", description: "+1 Gold earned per battle" },
  { id: "gold-2", keywordId: "gold", description: "+1 Gold earned per battle" },
  { id: "gold-3", keywordId: "gold", description: "+1 Gold earned per battle" },
  { id: "gold-4", keywordId: "gold", description: "+1 Gold earned per battle" },

  { id: "holy-1", keywordId: "holy", description: "+1 Holy damage dealt" },
  { id: "holy-2", keywordId: "holy", description: "+1 Holy damage dealt" },
  { id: "holy-3", keywordId: "holy", description: "+1 Holy damage dealt" },
  { id: "holy-4", keywordId: "holy", description: "+1 Holy damage dealt" },

  { id: "wish-1", keywordId: "wish", description: "Wish offers 1 extra choice" },
  { id: "wish-2", keywordId: "wish", description: "Wish offers 1 extra choice" },
  { id: "wish-3", keywordId: "wish", description: "Wish offers 1 extra choice" },

  { id: "ailment-1", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-2", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-3", keywordId: "ailment", description: "Ailments last 1 turn longer" },
  { id: "ailment-4", keywordId: "ailment", description: "Ailments last 1 turn longer" },

  { id: "consume-1", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-2", keywordId: "consume", description: "Draw 1 card when a card is consumed" },
  { id: "consume-3", keywordId: "consume", description: "Draw 1 card when a card is consumed" },

  { id: "poison-1", keywordId: "poison", description: "Poison deals 1 extra damage" },
  { id: "poison-2", keywordId: "poison", description: "Poison deals 1 extra damage" },
  { id: "poison-3", keywordId: "poison", description: "Poison deals 1 extra damage" },
  { id: "poison-4", keywordId: "poison", description: "Poison deals 1 extra damage" },

  { id: "bleed-1", keywordId: "bleed", description: "Bleed deals 1 extra damage" },
  { id: "bleed-2", keywordId: "bleed", description: "Bleed deals 1 extra damage" },
  { id: "bleed-3", keywordId: "bleed", description: "Bleed deals 1 extra damage" },
  { id: "bleed-4", keywordId: "bleed", description: "Bleed deals 1 extra damage" },

  { id: "leech-1", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-2", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-3", keywordId: "leech", description: "Leech heals for 1 more" },
  { id: "leech-4", keywordId: "leech", description: "Leech heals for 1 more" },

  { id: "freeze-1", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-2", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-3", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },
  { id: "freeze-4", keywordId: "freeze", description: "Freeze effects last 1 turn longer" },

  { id: "mana-1", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-2", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-3", keywordId: "mana", description: "+1 Max Mana" },
  { id: "mana-4", keywordId: "mana", description: "+1 Max Mana" },
];

export function getTalentsForKeyword(keywordId: KeywordId): TalentDefinition[] {
  return talentPool.filter((t) => t.keywordId === keywordId);
}

export function getAvailableTalents(
  keywordId: KeywordId,
  unlockedIds: string[],
): TalentDefinition[] {
  return getTalentsForKeyword(keywordId).filter((t) => !unlockedIds.includes(t.id));
}

export function sampleTalentChoices(
  keywordId: KeywordId,
  unlockedIds: string[],
  count: number = 3,
): TalentDefinition[] {
  const available = getAvailableTalents(keywordId, unlockedIds);
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export type UnlockedTalents = Partial<Record<KeywordId, string[]>>;

export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const physIds = unlockedTalents.physical ?? [];
  return {
    flatPhysicalDamage: physIds.filter((id) => id.startsWith("physical-dmg-")).length,
    armorToPhysicalDamage: physIds.includes("physical-armor"),
    physicalCritChance: physIds.includes("physical-crit") ? 5 : 0,
  };
}
