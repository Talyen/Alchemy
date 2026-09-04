import type { ReactNode } from "react";
import { CharacterSelectScreen, DifficultySelectScreen, DraftDeckScreen } from "@/features/alchemy/run-setup/screens";
import { useCompletedDifficulties, useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useDifficultySelectSlice, useDraftDeckSlice } from "@/features/alchemy/shared/stores/run-reads";
import type { RunSetupCommands, RunSetupRouteCtx } from "./route-ctx";

function CharacterSelectScreenRoute({
  commands,
  onBack,
  onOpenGameMenu,
}: {
  commands: RunSetupCommands;
  onBack?: (() => void) | undefined;
  onOpenGameMenu: (rect: DOMRect) => void;
}) {
  const finishedRunCharacters = useFinishedRunCharacters();

  return (
    <CharacterSelectScreen
      onSelect={commands.handleCharacterSelect}
      finishedRunCharacters={finishedRunCharacters}
      onBack={onBack}
      onMenu={onOpenGameMenu}
    />
  );
}

function DifficultySelectScreenRoute({
  commands,
  onOpenGameMenu,
}: {
  commands: RunSetupCommands;
  onOpenGameMenu: (rect: DOMRect) => void;
}) {
  const { characterId, selectedDifficulty } = useDifficultySelectSlice();
  const completedDifficulties = useCompletedDifficulties()[characterId];

  return (
    <DifficultySelectScreen
      characterId={characterId}
      selectedDifficulty={selectedDifficulty}
      completedDifficulties={completedDifficulties}
      onSelect={commands.handleDifficultySelect}
      onBack={commands.handleBackFromDifficultySelect}
      onMenu={onOpenGameMenu}
    />
  );
}

function DraftDeckScreenRoute({ commands }: { commands: RunSetupCommands }) {
  const draft = useDraftDeckSlice();
  const isWildwoodDraft = draft.contentSystemType === "wildwood" && draft.wildwoodDraft?.phase === "draft";
  const draftChoices = isWildwoodDraft ? (draft.wildwoodDraft?.draftChoices ?? []) : (draft.starterDraftChoices ?? []);
  return (
    <DraftDeckScreen
      onComplete={isWildwoodDraft ? commands.handleWildwoodDraftComplete : commands.handleStandardDraftComplete}
      draftedCards={draft.runDeck}
      draftChoices={draftChoices}
      onPick={isWildwoodDraft ? commands.handleWildwoodDraftPick : commands.handleStarterDraftPick}
    />
  );
}

export const runSetupScreenRoutes: {
  "character-select": (ctx: RunSetupRouteCtx) => ReactNode;
  "draft-deck": (ctx: RunSetupRouteCtx) => ReactNode;
  "difficulty-select": (ctx: RunSetupRouteCtx) => ReactNode;
} = {
  "character-select": ({ routeCommands, onBack, onOpenGameMenu }) => (
    <CharacterSelectScreenRoute commands={routeCommands.runSetup} onBack={onBack} onOpenGameMenu={onOpenGameMenu} />
  ),
  "draft-deck": ({ routeCommands }) => <DraftDeckScreenRoute commands={routeCommands.runSetup} />,
  "difficulty-select": ({ routeCommands, onOpenGameMenu }) => (
    <DifficultySelectScreenRoute commands={routeCommands.runSetup} onOpenGameMenu={onOpenGameMenu} />
  ),
};
