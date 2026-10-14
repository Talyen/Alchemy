import { BoardRewardScreen } from "@/features/alchemy/shared/ui/board-reward-screen";
import { useBoards } from "@/features/alchemy/shared/stores/use-profile-store";
import { IS_DEMO, isEditionCharacterAvailable } from "@/lib/game-edition";
import { isDesktop, openFullGameWishlist } from "@/lib/platform";
import { useEffect, useState } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { DemoCompletionScreen } from "@/features/alchemy/run-loop/screens/demo-completion-screen";
import { HeroUnlockedScreen } from "@/features/alchemy/run-loop/screens/hero-unlocked-screen";
import { RunEndScreen } from "@/features/alchemy/run-loop/screens/run-end-screen";
import { useRunEndScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import type { RunEndRouteCtx } from "./route-ctx";

const RUN_END_COPY = {
  defeat: { title: "Journey’s End", subtitle: "" },
  victory: {
    title: "Victory",
    subtitle: "The primordial evils have been vanquished. Alchemy is saved.",
  },
} as const;

function RunEndScreenRoute({ screen, routeCommands }: RunEndRouteCtx) {
  const outcome = screen === "run-victory" ? "victory" : "defeat";
  const commands = routeCommands.runEnd;
  const {
    characterId,
    runEndTalentXP,
    talentXP,
    runEndMaterials,
    runEndCurrencies,
    runEndItems,
    runEndUnlockedCharacters,
    runEndLabyrinthFloor,
    runRecap,
  } = useRunEndScreenData();
  const { pendingBoardRewardId } = useBoards();
  const [showBoard, setShowBoard] = useState<string | null>(null);
  const [marketing, setMarketing] = useState(false);
  const [unlockIndex, setUnlockIndex] = useState<number | null>(null);
  const unlockedCharacters = runEndUnlockedCharacters.filter(isEditionCharacterAvailable);
  const revealedCharacter = unlockIndex === null ? undefined : unlockedCharacters[unlockIndex];
  const demoVictory = IS_DEMO && outcome === "victory";
  useEffect(() => {
    if (!marketing) return;
    return pushEscapeHandler({
      id: "demo-completion",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => commands.continueFromRunEnd(),
    });
  }, [marketing, commands]);
  function continueAfterBoard() {
    setShowBoard(null);
    if (demoVictory) setMarketing(true);
    else commands.continueFromRunEnd();
  }
  function continueAfterRewards() {
    if (pendingBoardRewardId) setShowBoard(pendingBoardRewardId);
    else continueAfterBoard();
  }
  if (showBoard)
    return (
      <BoardRewardScreen
        boardId={showBoard}
        continueLabel={demoVictory ? "Continue" : "Main Menu"}
        onUseBoard={() => {
          if (routeCommands.boards.acknowledgeReward(showBoard, true))
            routeCommands.progress.afterSaved(continueAfterBoard);
        }}
        onContinue={() => {
          if (routeCommands.boards.acknowledgeReward(showBoard, false))
            routeCommands.progress.afterSaved(continueAfterBoard);
        }}
      />
    );
  if (revealedCharacter) {
    const hasNextHero = unlockIndex !== null && unlockIndex + 1 < unlockedCharacters.length;
    return (
      <HeroUnlockedScreen
        characterId={revealedCharacter}
        continueLabel={hasNextHero || demoVictory || pendingBoardRewardId ? "Continue" : "Main Menu"}
        onContinue={() => {
          if (hasNextHero) setUnlockIndex((index) => (index ?? 0) + 1);
          else {
            setUnlockIndex(null);
            continueAfterRewards();
          }
        }}
      />
    );
  }
  if (marketing && demoVictory)
    return (
      <DemoCompletionScreen
        onMainMenu={commands.continueFromRunEnd}
        {...(isDesktop() ? { onWishlist: openFullGameWishlist } : {})}
      />
    );
  const { title } = RUN_END_COPY[outcome];
  const subtitle =
    outcome === "defeat" && runEndLabyrinthFloor
      ? `Your descent reached floor ${runEndLabyrinthFloor}.`
      : RUN_END_COPY[outcome].subtitle;
  return (
    <RunEndScreen
      title={title}
      runRecap={runRecap}
      subtitle={demoVictory ? "" : subtitle}
      continueLabel={demoVictory || unlockedCharacters.length > 0 || pendingBoardRewardId ? "Continue" : "Main Menu"}
      outcome={outcome}
      characterId={characterId}
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      runEndCurrencies={runEndCurrencies}
      runEndItems={runEndItems}
      onContinue={unlockedCharacters.length > 0 ? () => setUnlockIndex(0) : continueAfterRewards}
    />
  );
}

export const runEndScreenRoutes = {
  "game-over": RunEndScreenRoute,
  "run-victory": RunEndScreenRoute,
};
