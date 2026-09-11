import { enemyById, isEnemyId } from "@/lib/game-data";
import { defineRunStep, isRecord } from "./types";

function migrateBattle(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const currentEnemy = isRecord(value.currentEnemy) ? { ...value.currentEnemy } : {};
  const id = typeof currentEnemy.id === "string" ? currentEnemy.id : "";
  const enemy = isEnemyId(id) ? enemyById[id] : undefined;
  if (enemy) {
    currentEnemy.abilityIds = [...enemy.abilityIds];
    if (Array.isArray(currentEnemy.traits)) {
      currentEnemy.traits = currentEnemy.traits.map((trait: unknown) =>
        isRecord(trait) ? (enemy.traits.find((entry) => entry.id === trait.id) ?? trait) : trait,
      );
    }
  }
  delete currentEnemy.attackEffects;
  const flags = { ...(isRecord(value.flags) ? value.flags : {}) };
  flags.legacyEnemyThornsReady =
    Array.isArray(currentEnemy.traits) &&
    currentEnemy.traits.some((trait: unknown) => isRecord(trait) && trait.id === "thorns") &&
    isRecord(value.enemyStatuses) &&
    typeof value.enemyStatuses.thorns === "number" &&
    value.enemyStatuses.thorns > 0;
  delete flags.enemyNextAttackCrit;
  delete flags.enemyNextAttackBonus;
  delete flags.enemyNextAttackHolyBonus;
  const next: Record<string, unknown> = { ...value, currentEnemy, flags, lastEnemyAbilityId: null };
  delete next.enemyAttackEffects;
  return next;
}

function migrateRun(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.activeCombat)) return value;
  const combat = value.activeCombat;
  const pending = combat.pendingBattleTransition;
  return {
    ...value,
    activeCombat: {
      ...combat,
      battleState: migrateBattle(combat.battleState),
      pendingBattleTransition:
        isRecord(pending) && "resultState" in pending
          ? { ...pending, resultState: migrateBattle(pending.resultState) }
          : pending,
    },
  };
}

export const migrateV15ToV16 = defineRunStep(migrateRun);
