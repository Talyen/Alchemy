// Per-boss shine palettes derived from combat keywords — shared by boss title and destination button.
import { keywordDefinitions, type BestiaryEntry } from "@/lib/game-data";

import { keywordAliases } from "./keywords";
import { SHINE_PALETTES } from "./shine-palettes";

export function getBossShineColors(boss: BestiaryEntry): readonly string[] {
  const matchedIds = new Set<string>();

  const traitText = boss.traits.map((t) => t.description).join(" ");
  for (const alias of keywordAliases) {
    if (traitText.includes(alias.match)) {
      matchedIds.add(alias.keywordId);
    }
  }

  for (const effect of boss.attackEffects) {
    if (effect.kind === "damage" && effect.damageType in keywordDefinitions) {
      matchedIds.add(effect.damageType);
    } else if (effect.kind === "player-status" && effect.status in keywordDefinitions) {
      matchedIds.add(effect.status);
    }
  }

  const colors: string[] = [];
  for (const id of matchedIds) {
    const def = keywordDefinitions[id as keyof typeof keywordDefinitions];
    if (def?.shineColors) {
      colors.push(...def.shineColors);
    }
  }
  return colors.length > 0 ? colors : [...SHINE_PALETTES.bossVictoryFallback];
}

export function getBossShineGradient(boss: BestiaryEntry): string {
  return `linear-gradient(60deg, ${getBossShineColors(boss).join(",")})`;
}
