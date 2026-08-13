import type { ReactNode } from "react";
import { GameOverScreen, RunVictoryScreen } from "@/features/alchemy/run-loop/screens";
import { useGameOverScreenData, useRunVictoryScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import type { RunEndCommands, RunEndRouteCtx } from "./route-ctx";

function GameOverScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunEndCommands;
  onOpenBattleMenu: RunEndRouteCtx["onOpenBattleMenu"];
}) {
  const r = useGameOverScreenData();
  return (
    <GameOverScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onContinue={commands.continueFromRunEnd}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function RunVictoryScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunEndCommands;
  onOpenBattleMenu: RunEndRouteCtx["onOpenBattleMenu"];
}) {
  const r = useRunVictoryScreenData();
  return (
    <RunVictoryScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onContinue={commands.continueFromRunEnd}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

export const runEndScreenRoutes: {
  "game-over": (ctx: RunEndRouteCtx) => ReactNode;
  "run-victory": (ctx: RunEndRouteCtx) => ReactNode;
} = {
  "game-over": ({ routeCommands, onOpenBattleMenu }) => (
    <GameOverScreenRoute commands={routeCommands.runEnd} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  "run-victory": ({ routeCommands, onOpenBattleMenu }) => (
    <RunVictoryScreenRoute commands={routeCommands.runEnd} onOpenBattleMenu={onOpenBattleMenu} />
  ),
};
