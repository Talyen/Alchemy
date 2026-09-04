import {
  characters,
  getCardKeywords,
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
import {
  gearDefinitions,
  getGearInstanceKeywordIds,
  getUniqueGearTextShineColors,
  type GearInstance,
} from "@/lib/gear";
import { keywordAliasMap, keywordAliases, keywordPattern } from "./keywords";
import {
  getCompanionShineColors,
  getKeywordShineColors,
  SHINE_PALETTES,
  WILDCARD_KEYWORD_SHINE_COLORS,
} from "./shine-palettes";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

export type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
export { lerpPlasmaColor, parsePlasmaHexColor } from "@/lib/animation/plasma-colors";

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
  const definition = gearDefinitions[gear.definitionId];
  const keywords = new Set<KeywordId>(getGearInstanceKeywordIds(gear));
  if (definition?.affinityKeywords) {
    for (const kw of definition.affinityKeywords) {
      keywords.add(kw);
    }
  }
  return [...keywords];
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
  if (keywordIds.length === 0) return WILDCARD_PLASMA_PAIR;

  const firstPalette = getKeywordShineColors(keywordIds[0]!);
  const primary = firstPalette[0];
  if (!primary) return null;

  const secondary =
    keywordIds.length > 1
      ? (getKeywordShineColors(keywordIds[1]!)[0] ?? firstPalette[1])
      : (firstPalette[1] ?? primary);

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
  return getPlasmaColorPair(getPlasmaKeywordsForGear(gear));
}

export function getPlasmaColorPairForUnique(): PlasmaColorPair | null {
  return getPlasmaColorPairFromColors(getUniqueGearTextShineColors());
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

export function getPlasmaKeywordsForEnemy(
  entry: BestiaryEntry,
  attackEffects?: BestiaryEntry["attackEffects"],
): KeywordId[] {
  const keywords = new Set<KeywordId>();

  const traitText = entry.traits.map((trait) => trait.description).join(" ");
  for (const alias of keywordAliases) {
    if (traitText.includes(alias.match)) keywords.add(alias.keywordId);
  }

  for (const effect of attackEffects ?? entry.attackEffects) {
    if (effect.kind === "damage" && effect.damageType in keywordDefinitions) {
      keywords.add(effect.damageType);
    }
    if (effect.kind === "player-status" && effect.status in keywordDefinitions) {
      keywords.add(effect.status as KeywordId);
    }
  }

  return [...keywords];
}

export function getPlasmaColorPairForEnemy(
  entry: BestiaryEntry,
  attackEffects?: BestiaryEntry["attackEffects"],
): PlasmaColorPair | null {
  return getPlasmaColorPair(getPlasmaKeywordsForEnemy(entry, attackEffects));
}

export function getPlasmaKeywordLabel(keywordId: KeywordId): string {
  return keywordDefinitions[keywordId]?.label ?? keywordId;
}
