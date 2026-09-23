import { enemyById, isEnemyId } from "@/lib/game-data";
import type { EnemyTypeBand } from "./findings-bands";

export const ENEMY_CAUSE_HINTS: Record<string, string> = {
  "iron-bear": "Iron Hide grants 1 Armor every other enemy turn.",
  frostwarden: "Glacial Surge: half Freeze, 30% more Burn, +1 Freeze damage every other turn up to +2.",
  "forge-golem": "Rusting Carapace grants Forge every other turn; starts with Block.",
  "blight-treant": "Regeneration plus Burn vulnerability.",
  "fire-elemental": "Cinder Skin deals Burn when attacked.",
  "living-armor": "Starts combat with Armor; 25% less Bleed.",
  slime: "Amorphous: 10% less Physical and Poison.",
  necromancer: "Fangs, Bloodthorn, and Rend; double Holy damage received.",
};

export const REVIEW_SUFFIX = " Discuss before applying a change.";

export function enemyTypeOf(id: string): EnemyTypeBand | undefined {
  return isEnemyId(id) ? enemyById[id].enemyType : undefined;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const high = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return high;
  const low = sorted[mid - 1] ?? high;
  return (low + high) / 2;
}
