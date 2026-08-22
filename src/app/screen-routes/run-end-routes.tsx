import type { ReactNode } from "react";
import { RunEndScreen } from "@/features/alchemy/run-loop/screens/run-end-screen";
import { useRunEndScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import type { RunEndCommands, RunEndRouteCtx } from "./route-ctx";

const RUN_END_COPY = {
  defeat: { title: "Defeat", subtitle: "Your run has ended." },
  victory: {
    title: "Victory",
    subtitle: "The primordial evils have been vanquished. Alchemy is saved.",
  },
} as const;

function RunEndScreenRoute({
  outcome,
  commands,
  onOpenBattleMenu,
}: {
  outcome: keyof typeof RUN_END_COPY;
  commands: RunEndCommands;
  onOpenBattleMenu: RunEndRouteCtx["onOpenBattleMenu"];
}) {
  const { runEndTalentXP, talentXP, runEndMaterials } = useRunEndScreenData();
  const { title, subtitle } = RUN_END_COPY[outcome];
  return (
    <RunEndScreen
      title={title}
      subtitle={subtitle}
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
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
    <RunEndScreenRoute outcome="defeat" commands={routeCommands.runEnd} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  "run-victory": ({ routeCommands, onOpenBattleMenu }) => (
    <RunEndScreenRoute outcome="victory" commands={routeCommands.runEnd} onOpenBattleMenu={onOpenBattleMenu} />
  ),
};
