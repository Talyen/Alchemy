import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CharacterId } from "@/lib/game-data";
import { CharacterSelectScreen, DifficultySelectScreen, DraftDeckScreen } from "@/features/alchemy/shared/screens";
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

function DraftDeckScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const draft = useRunDomainStore(
    useShallow((s) => ({
      contentSystemType: s.progress.contentSystemType,
      runDeck: s.progress.runDeck,
      wildwoodDraft: s.session.wildwoodDraft,
    })),
  );
  const isWildwoodDraft = draft.contentSystemType === "wildwood" && draft.wildwoodDraft?.phase === "draft";
  return (
    <DraftDeckScreen
      onComplete={a.runStart.handleDraftComplete}
      {...(isWildwoodDraft
        ? {
            draftedCards: draft.runDeck,
            draftChoices: draft.wildwoodDraft?.draftChoices ?? [],
            onPick: a.runStart.handleDraftPick,
          }
        : {})}
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
  "draft-deck": ({ actions: a }) => <DraftDeckScreenRoute actions={a} />,
  "difficulty-select": ({ actions: a }) => <DifficultySelectScreenRoute actions={a} />,
};
