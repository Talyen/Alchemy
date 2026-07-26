import type { ReactNode } from "react";
import { GameOverScreen, RunVictoryScreen } from "@/features/alchemy/run-loop/screens";
import { useRunScreenData } from "@/features/alchemy/shared/stores/run-session-facade";
import type { RunEndRouteCtx } from "./route-ctx";

function GameOverScreenRoute({ run }: Pick<RunEndRouteCtx, "run">) {
  const r = useRunScreenData("game-over");
  return (
    <GameOverScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onContinue={run.continueFromRunEnd}
    />
  );
}

function RunVictoryScreenRoute({ run }: Pick<RunEndRouteCtx, "run">) {
  const r = useRunScreenData("run-victory");
  return (
    <RunVictoryScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onContinue={run.continueFromRunEnd}
    />
  );
}

export const runEndScreenRoutes: {
  "game-over": (ctx: RunEndRouteCtx) => ReactNode;
  "run-victory": (ctx: RunEndRouteCtx) => ReactNode;
} = {
  "game-over": ({ run }) => <GameOverScreenRoute run={run} />,
  "run-victory": ({ run }) => <RunVictoryScreenRoute run={run} />,
};
