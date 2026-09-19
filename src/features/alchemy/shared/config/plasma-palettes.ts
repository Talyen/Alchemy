import {
  characters,
  getCardKeywords,
  getEnemyAbilities,
  getCompanionKeywords,
  getTrinketKeywords,
  keywordDefinitions,
  type BattleCard,
  type BestiaryEntry,
  type CharacterId,
  type CompanionDefinition,
  type KeywordId,
  type TalentDefinition,
  type TrinketEntry,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { gearDefinitions, getGearInstanceKeywordIds, getUniqueGearShineColors, type GearInstance } from "@/lib/gear";
import { keywordAliasMap, keywordPattern } from "./keywords";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
import {
  getCompanionShineColors,
  getKeywordShineColors,
  SHINE_PALETTES,
  WILDCARD_KEYWORD_SHINE_COLORS,
} from "./shine-palettes";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

export type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
export { lerpParsedPlasmaColor, lerpPlasmaColor, parsePlasmaHexColor } from "@/lib/animation/plasma-colors";

export const DEATHS_DOOR_PLASMA_PAIR: PlasmaColorPair = {
  primary: SHINE_PALETTES.deathsDoorArt[1] ?? "#dc2626",
  secondary: SHINE_PALETTES.deathsDoorArt[0] ?? "#450a0a",
};

export const HASTE_PLASMA_PAIR: PlasmaColorPair = { primary: "#f0abfc", secondary: "#701a75" };

export const WILDCARD_PLASMA_PAIR: PlasmaColorPair | null = (() => {
  const primary = WILDCARD_KEYWORD_SHINE_COLORS[0];
  const secondary = WILDCARD_KEYWORD_SHINE_COLORS[1] ?? WILDCARD_KEYWORD_SHINE_COLORS[2];
  if (!primary || !secondary) return null;
  return { primary, secondary };
})();

export function getPlasmaColorPairFromColors(colors: readonly string[]): PlasmaColorPair | null {
  const primary = colors[0];
  if (!primary) return null;
  const secondary = colors.find((color, index) => index > 0 && color !== primary) ?? primary;
  return { primary, secondary };
}

export function getPlasmaKeywordsForCharacter(id?: CharacterId | null): KeywordId[] {
  if (!id || !characters[id]) return [];
  return [...characters[id].keywords];
}

export function getPlasmaKeywordsForGear(gear: GearInstance): KeywordId[] {
  return getGearInstanceKeywordIds(gear);
}

export function getPlasmaKeywordsForTalent(talent: Pick<TalentDefinition, "keywordId">): KeywordId[] {
  return [talent.keywordId];
}

export function getPlasmaKeywordsForText(text: string): KeywordId[] {
  const keywords = new Set<KeywordId>();
  const matches = text.matchAll(keywordPattern);
  for (const match of matches) {
    const keywordId = keywordAliasMap.get(match[0].toLowerCase());
    if (keywordId) {
      keywords.add(keywordId);
    }
  }

  return [...keywords];
}

export function getPlasmaColorPair(keywordIds: readonly KeywordId[]): PlasmaColorPair | null {
  const [firstId, secondId] = keywordIds;
  if (!firstId) return WILDCARD_PLASMA_PAIR;

  const firstPalette = getKeywordShineColors(firstId);
  const primary = firstPalette[0];
  if (!primary) return null;

  const secondary =
    secondId !== undefined ? (getKeywordShineColors(secondId)[0] ?? firstPalette[1]) : (firstPalette[1] ?? primary);

  return { primary, secondary: secondary ?? primary };
}

export function getPlasmaColorPairForCharacter(id: CharacterId): PlasmaColorPair | null {
  return getPlasmaColorPair(getPlasmaKeywordsForCharacter(id));
}

export function getPlasmaColorPairForCard(card: BattleCard): PlasmaColorPair | null {
  return getPlasmaColorPair(getCardKeywords(card));
}

export function getPlasmaColorPairForTrinket(trinket: TrinketEntry | string): PlasmaColorPair | null {
  return getPlasmaColorPair(getTrinketKeywords(typeof trinket === "string" ? trinket : trinket.id));
}

export function getPlasmaColorPairForGear(gear: GearInstance): PlasmaColorPair | null {
  if (gearDefinitions[gear.definitionId]?.rarity === "unique") return getPlasmaColorPairForUnique();
  const keywords = getPlasmaKeywordsForGear(gear);
  return getPlasmaColorPair(keywords.length > 0 ? keywords : ["physical"]);
}

export function getPlasmaColorPairForUnique(): PlasmaColorPair | null {
  return getPlasmaColorPairFromColors(getUniqueGearShineColors());
}

export function getPlasmaColorPairForTalent(talent: Pick<TalentDefinition, "keywordId">): PlasmaColorPair | null {
  return getPlasmaColorPair(getPlasmaKeywordsForTalent(talent));
}

export function getPlasmaColorPairForCompanion(companion: CompanionDefinition): PlasmaColorPair | null {
  return (
    getPlasmaColorPair(getCompanionKeywords(companion)) ??
    getPlasmaColorPairFromColors(getCompanionShineColors(companion))
  );
}

export function getPlasmaKeywordsForEnemy(entry: BestiaryEntry): KeywordId[] {
  return [
    ...new Set([
      ...getPlasmaKeywordsForText(entry.traits.map((trait) => trait.description).join(" ")),
      ...getEnemyAbilities(entry).flatMap(getCardKeywords),
    ]),
  ];
}

export function getEnemyKeywordShineColors(entry: BestiaryEntry): readonly string[] {
  return getKeywordBorderShineColors(getPlasmaKeywordsForEnemy(entry));
}

export function getBossShineColors(boss: BestiaryEntry): readonly string[] {
  const matchedIds = getPlasmaKeywordsForEnemy(boss);

  const colors: string[] = [];
  for (const id of matchedIds) {
    const def = keywordDefinitions[id];
    if (def?.shineColors) colors.push(...def.shineColors);
  }
  return colors.length > 0 ? colors : [...SHINE_PALETTES.bossVictoryFallback];
}

export function getBossTextShineColors(boss: BestiaryEntry): readonly string[] {
  return [...new Set(getBossShineColors(boss))];
}

export function getPlasmaColorPairForEnemy(entry: BestiaryEntry): PlasmaColorPair | null {
  return getPlasmaColorPair(getPlasmaKeywordsForEnemy(entry));
}

export function getPlasmaKeywordLabel(keywordId: KeywordId): string {
  return keywordDefinitions[keywordId]?.label ?? keywordId;
}
