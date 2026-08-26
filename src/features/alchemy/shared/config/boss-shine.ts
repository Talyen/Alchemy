// Per-boss shine palettes derived from combat keywords — shared by boss title and destination button.
import { keywordDefinitions, type BestiaryEntry } from "@/features/alchemy/shared/config/game-data-catalog";

import { keywordAliases } from "./keywords";
import { buildSmoothShineGradient, SHINE_PALETTES } from "./shine-palettes";

function collectBossKeywordFromEffect(effect: BestiaryEntry["attackEffects"][number], ids: Set<string>): void {
  if (effect.kind === "damage" && effect.damageType in keywordDefinitions) ids.add(effect.damageType);
  if (effect.kind === "player-status" && effect.status in keywordDefinitions) ids.add(effect.status);
}

export function getBossShineColors(boss: BestiaryEntry): readonly string[] {
  const matchedIds = new Set<string>();

  const traitText = boss.traits.map((t) => t.description).join(" ");
  for (const alias of keywordAliases) {
    if (traitText.includes(alias.match)) matchedIds.add(alias.keywordId);
  }

  for (const effect of boss.attackEffects) collectBossKeywordFromEffect(effect, matchedIds);

  const colors: string[] = [];
  for (const id of matchedIds) {
    const def = keywordDefinitions[id as keyof typeof keywordDefinitions];
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
