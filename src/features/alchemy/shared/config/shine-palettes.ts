// Hex palettes for ShineBorder gradients and boss/map accent effects — keep full strings for Tailwind JIT safety.
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";

export const SHINE_PALETTES = {
  talentDefault: ["#fcd34d", "#d97706", "#fcd34d"],
  bossVictoryFallback: ["#cbd5e1", "#64748b", "#cbd5e1"],
  deathsDoorArt: ["#450a0a", "#dc2626", "#7f1d1d", "#111827"],
  deathsDoorStats: ["#450a0a", "#ef4444", "#991b1b", "#1f0505"],
  wildwoodBossSelection: ["#450a0a", "#ef4444", "#991b1b", "#7f1d1d"],
  labyrinth: {
    entrance: ["#292524", "#57534e", "#a8a29e", "#44403c"],
    combat: ["#450a0a", "#dc2626", "#f87171", "#7f1d1d"],
    elite: ["#3b0764", "#9333ea", "#c084fc", "#581c87"],
    rest: ["#431407", "#d97706", "#fb923c", "#78350f"],
    mystery: ["#27272a", "#a1a1aa", "#e4e4e7", "#525252"],
    shop: ["#422006", "#eab308", "#fde047", "#78350f"],
    alchemist: ["#022c22", "#10b981", "#6ee7b7", "#064e3b"],
    boss: ["#450a0a", "#b91c1c", "#fca5a5", "#7f1d1d"],
  },
} as const;

export function getKeywordShineColors(keywordId: KeywordId): readonly string[] {
  return keywordDefinitions[keywordId]?.shineColors ?? SHINE_PALETTES.talentDefault;
}
