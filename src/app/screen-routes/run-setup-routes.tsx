import { CharacterSelectScreen, DifficultySelectScreen, DraftDeckScreen } from "@/features/alchemy/run-setup/screens";
import { useCompletedDifficulties, useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useDifficultySelectSlice, useDraftDeckSlice } from "@/features/alchemy/shared/stores/run-reads";
import type { RunSetupRouteCtx } from "./route-ctx";

function CharacterSelectScreenRoute({ routeCommands, onBack, onOpenGameMenu }: RunSetupRouteCtx) {
  const commands = routeCommands.runSetup;
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

function DifficultySelectScreenRoute({ routeCommands, onBack, onOpenGameMenu }: RunSetupRouteCtx) {
  const commands = routeCommands.runSetup;
  const { characterId, selectedDifficulty } = useDifficultySelectSlice();
  const completedDifficulties = useCompletedDifficulties()[characterId];

  return (
    <DifficultySelectScreen
      // Remount per hero so the local draft selection never goes stale when
      // the store character changes underneath (e.g. back-navigation).
      key={characterId}
      characterId={characterId}
      selectedDifficulty={selectedDifficulty}
      completedDifficulties={completedDifficulties}
      onSelect={commands.handleDifficultySelect}
      onBack={onBack ?? commands.handleBackFromDifficultySelect}
      onMenu={onOpenGameMenu}
    />
  );
}

function DraftDeckScreenRoute({ routeCommands }: RunSetupRouteCtx) {
  const commands = routeCommands.runSetup;
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

export const runSetupScreenRoutes = {
  "character-select": CharacterSelectScreenRoute,
  "draft-deck": DraftDeckScreenRoute,
  "difficulty-select": DifficultySelectScreenRoute,
};
