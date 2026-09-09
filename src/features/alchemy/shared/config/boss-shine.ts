import { keywordDefinitions, type BestiaryEntry } from "@/features/alchemy/shared/config/game-data-catalog";

import { getPlasmaKeywordsForEnemy } from "./plasma-palettes";
import { buildSmoothShineGradient, SHINE_PALETTES } from "./shine-palettes";

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

export function getBossShineGradient(boss: BestiaryEntry): string {
  return (
    buildSmoothShineGradient(getBossShineColors(boss)) ??
    `linear-gradient(in oklab 90deg, ${SHINE_PALETTES.bossVictoryFallback.join(", ")})`
  );
}
