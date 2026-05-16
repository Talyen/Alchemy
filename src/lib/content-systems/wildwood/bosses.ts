// Wildwood boss definitions — list of available boss fights.
// Players choose one boss to challenge directly with their character deck.
import type { WildwoodBossEntry } from "../types";

export const WILDWOOD_BOSSES: WildwoodBossEntry[] = [
  {
    bossId: "rusted-colossus",
    title: "The Forge Golem",
    subtitle: "Act 1 Boss",
    descriptionLines: ["Gains 1 Armor each turn", "Gains 1 Forge each turn"],
  },
  {
    bossId: "frostwarden",
    title: "The Frostwarden",
    subtitle: "Act 2 Boss",
    descriptionLines: ["Receives half Freeze damage", "Receives double Burn damage", "Gains 1 Freeze damage each turn"],
  },
  {
    bossId: "blight-treant",
    title: "The Blight Treant",
    subtitle: "Act 3 Boss",
    descriptionLines: ["Heals 4 Health each turn"],
  },
  {
    bossId: "iron-bear",
    title: "The Iron Bear",
    subtitle: "Wildwood Boss",
    descriptionLines: [
      "Gains 2 Forge each turn",
      "Gains 2 Armor each turn",
      "Receives half Physical damage",
    ],
  },
];

export function getWildwoodBoss(bossId: string): WildwoodBossEntry | undefined {
  return WILDWOOD_BOSSES.find((b) => b.bossId === bossId);
}
