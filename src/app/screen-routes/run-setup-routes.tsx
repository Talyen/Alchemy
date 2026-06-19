import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { CharacterSelectScreen, DifficultySelectScreen, DraftDeckScreen } from "@/features/alchemy/shared/screens";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";

function DifficultySelectScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const { pendingCharacterId, selectedDifficulty } = useRunDomainStore(
    useShallow((s) => ({
      pendingCharacterId: s.session.pendingCharacterId,
      selectedDifficulty: s.progress.selectedDifficulty,
    })),
  );
  const characterId = pendingCharacterId ?? "knight";
  const completedDifficulties = useAppStore((s) => s.completedDifficulties[characterId]);

  return (
    <DifficultySelectScreen
      characterId={characterId}
      selectedDifficulty={selectedDifficulty}
      completedDifficulties={completedDifficulties}
      onSelect={run.handleDifficultySelect}
      onBack={run.handleBackFromDifficultySelect}
    />
  );
}

function DraftDeckScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
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
      onComplete={run.handleDraftComplete}
      {...(isWildwoodDraft
        ? {
            draftedCards: draft.runDeck,
            draftChoices: draft.wildwoodDraft?.draftChoices ?? [],
            onPick: run.handleDraftPick,
          }
        : {})}
    />
  );
}

export const runSetupScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
  "character-select": ({ run }) => (
    <CharacterSelectScreen onConfirm={run.handleCharacterSelect} onBack={() => run.goToScreen("game-mode-select")} />
  ),
  "draft-deck": ({ run }) => <DraftDeckScreenRoute run={run} />,
  "difficulty-select": ({ run }) => <DifficultySelectScreenRoute run={run} />,
};
