import { IS_DEMO } from "@/lib/game-edition";
import { isDesktop, openFullGameWishlist } from "@/lib/platform";
import { useEffect, useState } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { DemoCompletionScreen } from "@/features/alchemy/run-loop/screens/demo-completion-screen";
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
    runEndLabyrinthFloor,
    runRecap,
  } = useRunEndScreenData();
  const [marketing, setMarketing] = useState(false);
  const demoVictory = IS_DEMO && outcome === "victory";
  useEffect(() => {
    if (!marketing) return;
    return pushEscapeHandler({
      id: "demo-completion",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => commands.continueFromRunEnd(),
    });
  }, [marketing, commands]);
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
      continueLabel={demoVictory ? "Continue" : "Main Menu"}
      outcome={outcome}
      characterId={characterId}
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      runEndCurrencies={runEndCurrencies}
      runEndItems={runEndItems}
      onContinue={demoVictory ? () => setMarketing(true) : commands.continueFromRunEnd}
    />
  );
}

export const runEndScreenRoutes = {
  "game-over": RunEndScreenRoute,
  "run-victory": RunEndScreenRoute,
};
