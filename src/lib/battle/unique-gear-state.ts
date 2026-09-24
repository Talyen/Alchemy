import type { BattleCard } from "@/lib/game-data";

export interface UniqueGearBattleState {
  everkeenReady: boolean;
  spentForge: number;
  viperReady: boolean;
  wildheartReady: boolean;
  knightsAnswerReady: boolean;
  wrenflightActive: boolean;
  wardbreakerPurgeUsed: boolean;
  finalSparkUsed: boolean;
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
    wrenflightActive: false,
    wardbreakerPurgeUsed: false,
    finalSparkUsed: false,
    lastArcheryUid: null,
    returningFlightUid: null,
    archeryEchoes: [],
  };
}

type PerTurnUniqueGearReset = Pick<
  UniqueGearBattleState,
  "wrenflightActive" | "wardbreakerPurgeUsed" | "finalSparkUsed" | "lastArcheryUid" | "returningFlightUid"
>;

// The only unique-gear fields that reset each player turn. Everything else
// persists for the combat or is consumed explicitly where it is used
// (everkeen/viper/wildheart/knightsAnswer readiness, spentForge,
// archeryEchoes), so add new per-turn fields here — not at the reset site.
export const PER_TURN_UNIQUE_GEAR_RESET: PerTurnUniqueGearReset = {
  wrenflightActive: false,
  wardbreakerPurgeUsed: false,
  finalSparkUsed: false,
  lastArcheryUid: null,
  returningFlightUid: null,
};
