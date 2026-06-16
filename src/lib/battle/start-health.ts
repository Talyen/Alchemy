import { computeTrinketManifest } from "@/lib/trinkets";

/** Health used when creating BattleState so start-of-battle boon heals apply before combat. */
export function getBattleStartPlayerHealth(runPlayerHealth: number, runMaxHealth: number, runTrinkets: string[]) {
  const grovesHeal = computeTrinketManifest(runTrinkets).grovesFavorStartHeal;
  return grovesHeal > 0 ? Math.min(runMaxHealth, runPlayerHealth + grovesHeal) : runPlayerHealth;
}
