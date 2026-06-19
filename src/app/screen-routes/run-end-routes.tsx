import type { ReactNode } from "react";
import { GameOverScreen, RunVictoryScreen } from "@/features/alchemy/shared/screens";
import { useRunScreenData } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";

function GameOverScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
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

function RunVictoryScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
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

export const runEndScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
  "game-over": ({ run }) => <GameOverScreenRoute run={run} />,
  "run-victory": ({ run }) => <RunVictoryScreenRoute run={run} />,
};
