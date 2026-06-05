// Coordinates cross-store initialization when hydrating or bootstrapping an active run.
import type { CharacterId, UnlockedTalents } from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/features/alchemy/types";
import type { TalentXP } from "@/lib/talents";
import { useRunStore } from "./run-progress-store";
import { useNavigationStore } from "./navigation-store";

/** Initialize run progression and restore navigation screen from persisted active-run data. */
export function initializeActiveRunStores(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  fallbackCharacterId: CharacterId = "knight",
): void {
  useRunStore.getState().initialize(activeRun, talentXP, unlockedTalents, fallbackCharacterId);
  if (activeRun?.currentScreen) {
    useNavigationStore.getState().setScreen(activeRun.currentScreen as Screen);
  }
}
