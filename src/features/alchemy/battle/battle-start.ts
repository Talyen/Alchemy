// Pure battle-start setup helpers shared by the React battle controller and tests.
// Depends on trinket manifest calculation so start-of-battle trinket rules stay centralized.
import { computeTrinketManifest } from "@/lib/trinkets";

// Computes the HP snapshot used to create BattleState so React state timing cannot skip start-heal effects.
export function getBattleStartPlayerHealth(runPlayerHealth: number, runMaxHealth: number, runTrinkets: string[]) {
  const grovesHeal = computeTrinketManifest(runTrinkets).grovesFavorStartHeal;
  return grovesHeal > 0 ? Math.min(runMaxHealth, runPlayerHealth + grovesHeal) : runPlayerHealth;
}
