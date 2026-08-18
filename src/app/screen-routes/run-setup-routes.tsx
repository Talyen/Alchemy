import type { ReactNode } from "react";
import { CharacterSelectScreen, DifficultySelectScreen, DraftDeckScreen } from "@/features/alchemy/run-setup/screens";
import { useCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { useDifficultySelectSlice, useDraftDeckSlice } from "@/features/alchemy/shared/stores/run-session-react-ports";
import type { RunSetupCommands, RunSetupRouteCtx } from "./route-ctx";

function DifficultySelectScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunSetupCommands;
  onOpenBattleMenu: RunSetupRouteCtx["onOpenBattleMenu"];
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
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function DraftDeckScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunSetupCommands;
  onOpenBattleMenu: RunSetupRouteCtx["onOpenBattleMenu"];
}) {
  const draft = useDraftDeckSlice();
  const isWildwoodDraft = draft.contentSystemType === "wildwood" && draft.wildwoodDraft?.phase === "draft";
  const draftChoices = isWildwoodDraft ? (draft.wildwoodDraft?.draftChoices ?? []) : (draft.starterDraftChoices ?? []);
  return (
    <DraftDeckScreen
      onComplete={isWildwoodDraft ? commands.handleWildwoodDraftComplete : commands.handleStandardDraftComplete}
      onOpenMenu={onOpenBattleMenu}
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
  "character-select": ({ routeCommands, onOpenBattleMenu }) => (
    <CharacterSelectScreen onSelect={routeCommands.runSetup.handleCharacterSelect} onOpenMenu={onOpenBattleMenu} />
  ),
  "draft-deck": ({ routeCommands, onOpenBattleMenu }) => (
    <DraftDeckScreenRoute commands={routeCommands.runSetup} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  "difficulty-select": ({ routeCommands, onOpenBattleMenu }) => (
    <DifficultySelectScreenRoute commands={routeCommands.runSetup} onOpenBattleMenu={onOpenBattleMenu} />
  ),
};
