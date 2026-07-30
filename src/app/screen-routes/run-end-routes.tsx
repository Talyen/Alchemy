import type { ReactNode } from "react";
import { GameOverScreen, RunVictoryScreen } from "@/features/alchemy/run-loop/screens";
import { useGameOverScreenData, useRunVictoryScreenData } from "@/features/alchemy/shared/stores/run-session-facade";
import type { RunEndRouteCtx } from "./route-ctx";

function GameOverScreenRoute({ commands }: { commands: RunEndRouteCtx["routeCommands"]["runEnd"] }) {
  const r = useGameOverScreenData();
  return (
    <GameOverScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onContinue={commands.continueFromRunEnd}
    />
  );
}

function RunVictoryScreenRoute({ commands }: { commands: RunEndRouteCtx["routeCommands"]["runEnd"] }) {
  const r = useRunVictoryScreenData();
  return (
    <RunVictoryScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onContinue={commands.continueFromRunEnd}
    />
  );
}

export const runEndScreenRoutes: {
  "game-over": (ctx: RunEndRouteCtx) => ReactNode;
  "run-victory": (ctx: RunEndRouteCtx) => ReactNode;
} = {
  "game-over": ({ routeCommands }) => <GameOverScreenRoute commands={routeCommands.runEnd} />,
  "run-victory": ({ routeCommands }) => <RunVictoryScreenRoute commands={routeCommands.runEnd} />,
};
