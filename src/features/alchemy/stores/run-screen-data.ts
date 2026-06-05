// Flattened run session fields for screen routes (derived from RunSession).
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, UnlockedTalents } from "@/lib/game-data";
import type { RunPhase, Screen } from "@/lib/routing";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";
import type { TalentXP } from "@/lib/talents";
import type { RunSession } from "./run-session-model";
import type { RunStateFields } from "@/features/alchemy/run/run-state-init";

export type RunScreenData = {
  phase: RunPhase;
  runPlayerHealth: number;
  runMaxHealth: number;
  runGold: number;
  runDeck: BattleCard[];
  selectedDifficulty: RunStateFields["selectedDifficulty"];
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  runTalentXP: TalentXP;
  runEndTalentXP: TalentXP;
  hasActiveRun: boolean;
  hasActiveBattle: boolean;
  battleState: BattleState;
  rewardState: RewardState;
  labyrinthMap: LabyrinthMap;
  mysteryEvent: MysteryEvent | null;
  mysteryCardChoices: BattleCard[] | null;
  corruptionResult: CorruptionResult | null;
  shopState: ShopState;
  alchemistState: AlchemistState;
  runEndMaterials: MaterialInventory;
  pendingCharacterId: CharacterId | null;
};

export function flattenRunSessionForScreens({
  phase,
  run,
  session,
  battle,
}: RunSession & { screen: Screen }): RunScreenData {
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
    runEndMaterials: session.runEndMaterials,
    pendingCharacterId: session.pendingCharacterId,
  };
}
