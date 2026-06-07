import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CharacterId } from "@/lib/game-data";
import {
  CharacterSelectScreen,
  DifficultySelectScreen,
  DraftDeckScreen,
  WildwoodSelectScreen,
} from "@/features/alchemy/shared/screens";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";

function DifficultySelectScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const { pendingCharacterId, selectedDifficulty } = useRunDomainStore(
    useShallow((s) => ({
      pendingCharacterId: s.session.pendingCharacterId,
      selectedDifficulty: s.progress.selectedDifficulty,
    })),
  );
  const characterId = (pendingCharacterId ?? "knight") as CharacterId;
  const completedDifficulties = useAppStore((s) => s.completedDifficulties[characterId] ?? []);

  return (
    <DifficultySelectScreen
      characterId={characterId}
      selectedDifficulty={selectedDifficulty}
      completedDifficulties={completedDifficulties}
      onSelect={a.runStart.handleDifficultySelect}
      onBack={a.runStart.handleBackFromDifficultySelect}
    />
  );
}

export const runSetupScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
  "character-select": ({ actions: a }) => (
    <CharacterSelectScreen
      onConfirm={a.runStart.handleCharacterSelect}
      onBack={() => a.navigation.goToScreen("game-mode-select")}
    />
  ),
  "draft-deck": ({ actions: a }) => <DraftDeckScreen onComplete={a.runStart.handleDraftComplete} />,
  "difficulty-select": ({ actions: a }) => <DifficultySelectScreenRoute actions={a} />,
  "wildwood-select": ({ actions: a }) => (
    <WildwoodSelectScreen
      onSelect={a.runStart.handleWildwoodBossSelect}
      onBack={() => a.navigation.goToScreen("character-select")}
    />
  ),
};
