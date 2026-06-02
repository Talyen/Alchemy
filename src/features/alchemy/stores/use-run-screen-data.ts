// Subscribed run/session fields for screens — use via ScreenRouteContext instead of per-screen stores.
import { useShallow } from "zustand/react/shallow";
import { useBattleStore } from "./battle-store";
import { useRunSessionStore } from "./run-session-store";
import { useRunStore } from "./run-store";
import type { RunSessionSnapshot } from "./run-session-facade";

export type RunScreenData = RunSessionSnapshot;

export function useRunScreenData(): RunScreenData {
  const run = useRunStore(
    useShallow((s) => ({
      runPlayerHealth: s.runPlayerHealth,
      runMaxHealth: s.runMaxHealth,
      runGold: s.runGold,
      runDeck: s.runDeck,
      selectedDifficulty: s.selectedDifficulty,
      talentXP: s.talentXP,
      unlockedTalents: s.unlockedTalents,
      runTalentXP: s.runTalentXP,
    })),
  );
  const session = useRunSessionStore(
    useShallow((s) => ({
      hasActiveRun: s.hasActiveRun,
      rewardState: s.rewardState,
      labyrinthMap: s.labyrinthMap,
      mysteryEvent: s.mysteryEvent,
      mysteryCardChoices: s.mysteryCardChoices,
      corruptionResult: s.corruptionResult,
      shopState: s.shopState,
      alchemistState: s.alchemistState,
      runEndMaterials: s.runEndMaterials,
      pendingCharacterId: s.pendingCharacterId,
    })),
  );
  const battle = useBattleStore(
    useShallow((s) => ({
      hasActiveBattle: s.hasActiveBattle,
      battleState: s.battleState,
    })),
  );
  return { ...run, ...session, ...battle };
}
