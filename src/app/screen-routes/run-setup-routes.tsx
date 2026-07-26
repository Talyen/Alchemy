import type { ReactNode } from "react";
import { CharacterSelectScreen, DifficultySelectScreen, DraftDeckScreen } from "@/features/alchemy/run-setup/screens";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useDifficultySelectSlice, useDraftDeckSlice } from "@/features/alchemy/shared/stores/run-session-facade";
import type { RunSetupRouteCtx } from "./route-ctx";

function DifficultySelectScreenRoute({ run }: Pick<RunSetupRouteCtx, "run">) {
  const { pendingCharacterId, selectedDifficulty } = useDifficultySelectSlice();
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

function DraftDeckScreenRoute({ run }: Pick<RunSetupRouteCtx, "run">) {
  const draft = useDraftDeckSlice();
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

export const runSetupScreenRoutes: {
  "character-select": (ctx: RunSetupRouteCtx) => ReactNode;
  "draft-deck": (ctx: RunSetupRouteCtx) => ReactNode;
  "difficulty-select": (ctx: RunSetupRouteCtx) => ReactNode;
} = {
  "character-select": ({ run }) => (
    <CharacterSelectScreen onConfirm={run.handleCharacterSelect} onBack={() => run.goToScreen("game-mode-select")} />
  ),
  "draft-deck": ({ run }) => <DraftDeckScreenRoute run={run} />,
  "difficulty-select": ({ run }) => <DifficultySelectScreenRoute run={run} />,
};
