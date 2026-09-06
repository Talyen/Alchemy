import type { BattleCard } from "@/lib/game-data";

export interface UniqueGearBattleState {
  everkeenReady: boolean;
  spentForge: number;
  viperReady: boolean;
  wildheartReady: boolean;
  knightsAnswerReady: boolean;
  redHarvestUsed: boolean;
  redHarvestUid: number | null;
  huntsmasterUsed: boolean;
  wrenflightActive: boolean;
  finalSparkUsed: boolean;
  freeBurnUsed: boolean;
  freeFreezeUsed: boolean;
  freeHolyUsed: boolean;
  lastArcheryUid: number | null;
  returningFlightUid: number | null;
  archeryEchoes: BattleCard[];
}

export function createUniqueGearBattleState(): UniqueGearBattleState {
  return {
    everkeenReady: false,
    spentForge: 0,
    viperReady: false,
    wildheartReady: false,
    knightsAnswerReady: false,
    redHarvestUsed: false,
    redHarvestUid: null,
    huntsmasterUsed: false,
    wrenflightActive: false,
    finalSparkUsed: false,
    freeBurnUsed: false,
    freeFreezeUsed: false,
    freeHolyUsed: false,
    lastArcheryUid: null,
    returningFlightUid: null,
    archeryEchoes: [],
  };
}
