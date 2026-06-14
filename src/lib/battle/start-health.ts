import { computeBoonManifest } from "@/lib/boons";

/** Health used when creating BattleState so start-of-battle boon heals apply before combat. */
export function getBattleStartPlayerHealth(runPlayerHealth: number, runMaxHealth: number, runBoons: string[]) {
  const grovesHeal = computeBoonManifest(runBoons).grovesFavorStartHeal;
  return grovesHeal > 0 ? Math.min(runMaxHealth, runPlayerHealth + grovesHeal) : runPlayerHealth;
}
