import type { ReactNode } from "react";
import { GameOverScreen, RunVictoryScreen } from "@/features/alchemy/shared/screens";
import { useRunScreenData } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";

function GameOverScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("game-over");
  return (
    <GameOverScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onMainMenu={a.runFlow.resetRunState}
    />
  );
}

function RunVictoryScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("run-victory");
  return (
    <RunVictoryScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onMainMenu={a.runFlow.resetRunState}
    />
  );
}

export const runEndScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
  "game-over": ({ actions: a }) => <GameOverScreenRoute actions={a} />,
  "run-victory": ({ actions: a }) => <RunVictoryScreenRoute actions={a} />,
};
