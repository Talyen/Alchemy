import type { ReactNode } from "react";
import { CharacterSelectScreen, DifficultySelectScreen, DraftDeckScreen } from "@/features/alchemy/run-setup/screens";
import { useCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-port";
import { useDifficultySelectSlice, useDraftDeckSlice } from "@/features/alchemy/shared/stores/run-session-react-ports";
import type { RunSetupRouteCtx } from "./route-ctx";

function DifficultySelectScreenRoute({ commands }: { commands: RunSetupRouteCtx["routeCommands"]["runSetup"] }) {
  const { pendingCharacterId, selectedDifficulty } = useDifficultySelectSlice();
  const characterId = pendingCharacterId ?? "knight";
  const completedDifficulties = useCompletedDifficulties()[characterId];

  return (
    <DifficultySelectScreen
      characterId={characterId}
      selectedDifficulty={selectedDifficulty}
      completedDifficulties={completedDifficulties}
      onSelect={commands.handleDifficultySelect}
      onBack={commands.handleBackFromDifficultySelect}
    />
  );
}

function DraftDeckScreenRoute({ commands }: { commands: RunSetupRouteCtx["routeCommands"]["runSetup"] }) {
  const draft = useDraftDeckSlice();
  const isWildwoodDraft = draft.contentSystemType === "wildwood" && draft.wildwoodDraft?.phase === "draft";
  return (
    <DraftDeckScreen
      onComplete={commands.handleDraftComplete}
      {...(isWildwoodDraft
        ? {
            draftedCards: draft.runDeck,
            draftChoices: draft.wildwoodDraft?.draftChoices ?? [],
            onPick: commands.handleDraftPick,
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
  "character-select": ({ routeCommands }) => (
    <CharacterSelectScreen
      onConfirm={routeCommands.runSetup.handleCharacterSelect}
      onBack={() => routeCommands.runSetup.goToScreen("game-mode-select")}
    />
  ),
  "draft-deck": ({ routeCommands }) => <DraftDeckScreenRoute commands={routeCommands.runSetup} />,
  "difficulty-select": ({ routeCommands }) => <DifficultySelectScreenRoute commands={routeCommands.runSetup} />,
};
