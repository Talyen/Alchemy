import { isRecord, migrateRunTree, type RawSaveData } from "./types";

function migrateRun(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.activeCombat) || !isRecord(value.activeCombat.battleState)) return value;
  const battle = value.activeCombat.battleState;
  const trinketEffects = { ...(isRecord(battle.trinketEffects) ? battle.trinketEffects : {}) };
  const flags = { ...(isRecord(battle.flags) ? battle.flags : {}) };
  if (trinketEffects.firstHolyDamageDoubled === true) trinketEffects.brassCenserProcChance = 20;
  if (trinketEffects.plagueDoctorImmunity === true) trinketEffects.plagueDoctorPoisonCleanse = 2;
  delete trinketEffects.firstHolyDamageDoubled;
  delete trinketEffects.plagueDoctorImmunity;
  delete flags.firstHolyDamageBonusUsed;
  delete flags.firstHarmfulStatusPrevented;
  return {
    ...value,
    activeCombat: {
      ...value.activeCombat,
      battleState: { ...battle, trinketEffects, flags },
    },
  };
}

export function migrateV14ToV15(parsed: RawSaveData): RawSaveData {
  return migrateRunTree(parsed, migrateRun);
}
