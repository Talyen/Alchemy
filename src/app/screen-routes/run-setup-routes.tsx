import type { ReactNode } from "react";
import type { CharacterId } from "@/lib/game-data";
import {
  CharacterSelectScreen,
  DifficultySelectScreen,
  DraftDeckScreen,
  WildwoodSelectScreen,
} from "@/features/alchemy/screens";
import type { ScreenRouteContext } from "./types";

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
  "difficulty-select": ({ actions: a, appValues, pendingCharacterId, runScreenData: r }) => (
    <DifficultySelectScreen
      characterId={(pendingCharacterId ?? r.pendingCharacterId ?? "knight") as CharacterId}
      selectedDifficulty={r.selectedDifficulty}
      completedDifficulties={
        appValues.completedDifficulties[(pendingCharacterId ?? r.pendingCharacterId ?? "knight") as CharacterId] ?? []
      }
      onSelect={a.runStart.handleDifficultySelect}
      onBack={a.runStart.handleBackFromDifficultySelect}
    />
  ),
  "wildwood-select": ({ actions: a }) => (
    <WildwoodSelectScreen
      onSelect={a.runStart.handleWildwoodBossSelect}
      onBack={() => a.navigation.goToScreen("character-select")}
    />
  ),
};
