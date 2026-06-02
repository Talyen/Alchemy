// Facade over run, battle, and session stores — single entry for sync and teardown.
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { getBattleStartPlayerHealth } from "@/lib/battle";
import { useBattleStore } from "./battle-store";
import { useRunSessionStore } from "./run-session-store";
import { useRunStore } from "./run-store";

export type RunSessionSnapshot = {
  runPlayerHealth: number;
  runMaxHealth: number;
  runGold: number;
  runDeck: BattleCard[];
  selectedDifficulty: ReturnType<typeof useRunStore.getState>["selectedDifficulty"];
  talentXP: ReturnType<typeof useRunStore.getState>["talentXP"];
  unlockedTalents: ReturnType<typeof useRunStore.getState>["unlockedTalents"];
  runTalentXP: ReturnType<typeof useRunStore.getState>["runTalentXP"];
  hasActiveRun: boolean;
  hasActiveBattle: boolean;
  battleState: BattleState;
  rewardState: ReturnType<typeof useRunSessionStore.getState>["rewardState"];
  labyrinthMap: ReturnType<typeof useRunSessionStore.getState>["labyrinthMap"];
  mysteryEvent: ReturnType<typeof useRunSessionStore.getState>["mysteryEvent"];
  mysteryCardChoices: ReturnType<typeof useRunSessionStore.getState>["mysteryCardChoices"];
  corruptionResult: ReturnType<typeof useRunSessionStore.getState>["corruptionResult"];
  shopState: ReturnType<typeof useRunSessionStore.getState>["shopState"];
  alchemistState: ReturnType<typeof useRunSessionStore.getState>["alchemistState"];
  runEndMaterials: ReturnType<typeof useRunSessionStore.getState>["runEndMaterials"];
  pendingCharacterId: ReturnType<typeof useRunSessionStore.getState>["pendingCharacterId"];
};

export function getRunSessionSnapshot(): RunSessionSnapshot {
  const run = useRunStore.getState();
  const battle = useBattleStore.getState();
  const session = useRunSessionStore.getState();
  return {
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    runGold: run.runGold,
    runDeck: run.runDeck,
    selectedDifficulty: run.selectedDifficulty,
    talentXP: run.talentXP,
    unlockedTalents: run.unlockedTalents,
    runTalentXP: run.runTalentXP,
    hasActiveRun: session.hasActiveRun,
    hasActiveBattle: battle.hasActiveBattle,
    battleState: battle.battleState,
    rewardState: session.rewardState,
    labyrinthMap: session.labyrinthMap,
    mysteryEvent: session.mysteryEvent,
    mysteryCardChoices: session.mysteryCardChoices,
    corruptionResult: session.corruptionResult,
    shopState: session.shopState,
    alchemistState: session.alchemistState,
    runEndMaterials: session.runEndMaterials,
    pendingCharacterId: session.pendingCharacterId,
  };
}

/** Map-layer gold plus in-combat gold (e.g. victory totals). */
export function getCombinedRunGold(runGold?: number, battleGold?: number): number {
  const run = runGold ?? useRunStore.getState().runGold;
  const battle = battleGold ?? useBattleStore.getState().battleState.gold;
  return run + battle;
}

/** Clamp run HP for battle entry and persist to the run store before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const run = useRunStore.getState();
  const startingHealth =
    playerHealth ?? getBattleStartPlayerHealth(run.runPlayerHealth, run.runMaxHealth, run.runTrinkets);
  run.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to the run store after victory or when leaving battle. */
export function syncBattleToRun(options?: { playerHealth?: number }): void {
  const battle = useBattleStore.getState().battleState;
  const health = options?.playerHealth ?? battle.playerHealth;
  useRunStore.getState().setRunPlayerHealth(health);
}

/** Clear active combat and transient run UI stores. */
export { resetActiveRunStores as teardownRun } from "./reset";
