import { remapLegacyBoonContentId } from "./migrate-content-v2";
import type { RawSaveData } from "./types";

function remapEnemyTraits(traits: unknown): unknown {
  if (!Array.isArray(traits)) return traits;
  return traits.map((trait) => {
    if (!trait || typeof trait !== "object" || !("id" in trait) || typeof trait.id !== "string") return trait;
    return { ...trait, id: remapLegacyBoonContentId(trait.id) };
  });
}

function migrateCombatFlags(flags: RawSaveData): RawSaveData {
  const next = { ...flags };
  if (next.firstBurnBoonDoubledUsed === true && next.firstBurnTrinketDoubledUsed !== true) {
    next.firstBurnTrinketDoubledUsed = true;
  }
  delete next.firstBurnBoonDoubledUsed;
  return next;
}

/** Renames legacy battle snapshot fields. Idempotent for already-migrated saves. */
export function migrateBattleState(battleState: unknown): unknown {
  if (!battleState || typeof battleState !== "object") return battleState;
  const state = battleState as RawSaveData;
  const next: RawSaveData = { ...state };

  if (!next.trinketEffects && next.boonEffects && typeof next.boonEffects === "object") {
    next.trinketEffects = next.boonEffects;
  }
  delete next.boonEffects;

  if (next.flags && typeof next.flags === "object") {
    next.flags = migrateCombatFlags(next.flags as RawSaveData);
  }

  if (next.currentEnemy && typeof next.currentEnemy === "object") {
    const enemy = next.currentEnemy as RawSaveData;
    next.currentEnemy = {
      ...enemy,
      traits: remapEnemyTraits(enemy.traits),
    };
  }

  return next;
}
