import { computeTrinketManifest } from "@/lib/trinkets";

export function getBattleStartPlayerHealth(runPlayerHealth: number, runMaxHealth: number, runBoons: string[]) {
  const grovesHeal = computeTrinketManifest(runBoons).grovesFavorStartHeal;
  return grovesHeal > 0 ? Math.min(runMaxHealth, runPlayerHealth + grovesHeal) : runPlayerHealth;
}
