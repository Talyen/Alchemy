// Flattened run session fields for screen routes (derived from RunSession).
import type { RunPhase, Screen } from "@/lib/routing";
import type { RunSession } from "./run-session-model";

export function flattenRunSessionForScreens({ phase, run, session, battle }: RunSession & { screen: Screen }) {
  return {
    phase,
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    runGold: run.runGold,
    runDeck: run.runDeck,
    selectedDifficulty: run.selectedDifficulty,
    talentXP: run.talentXP,
    unlockedTalents: run.unlockedTalents,
    runTalentXP: run.runTalentXP,
    runEndTalentXP: session.runEndTalentXP,
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
    trinketShopState: session.trinketShopState,
    equipmentShopState: session.equipmentShopState,
    runEndMaterials: session.runEndMaterials,
    pendingCharacterId: session.pendingCharacterId,
  };
}

export type RunScreenData = ReturnType<typeof flattenRunSessionForScreens> & { phase: RunPhase };
