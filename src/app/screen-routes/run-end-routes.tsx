import { useGameTranslation } from "@/components/use-game-translation";

import { IS_DEMO, isEditionCharacterAvailable } from "@/lib/game-edition";
import { isDesktop, openFullGameWishlist } from "@/lib/platform";
import { useEffect, useState } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { DemoCompletionScreen } from "@/features/alchemy/run-loop/screens/demo-completion-screen";
import { HeroUnlockedScreen } from "@/features/alchemy/run-loop/screens/hero-unlocked-screen";
import { RunEndScreen } from "@/features/alchemy/run-loop/screens/run-end-screen";
import { useRunScreenData } from "@/features/alchemy/shared/stores/react/use-run-screen-data";
import type { RunEndRouteCtx } from "./route-ctx";

const RUN_END_COPY = {
  defeat: { title: "Journey’s End", subtitle: "" },
  victory: {
    title: "Victory",
    subtitle: "The primordial evils have been vanquished. Alchemy is saved.",
  },
} as const;

type RunEndStage = { kind: "recap" } | { kind: "hero"; index: number } | { kind: "demo-completion" };

function RunEndScreenRoute({ screen, routeCommands }: RunEndRouteCtx) {
  const i18n = useGameTranslation();
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
  } = useRunScreenData("game-over");
  const [stage, setStage] = useState<RunEndStage>({ kind: "recap" });
  const unlockedCharacters = runEndUnlockedCharacters.filter(isEditionCharacterAvailable);
  const revealedCharacter = stage.kind === "hero" ? unlockedCharacters[stage.index] : undefined;
  const demoVictory = IS_DEMO && outcome === "victory";
  useEffect(() => {
    if (stage.kind !== "demo-completion") return;
    return pushEscapeHandler({
      id: "demo-completion",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => commands.resetRunState(),
    });
  }, [stage.kind, commands]);
  function continueAfterRewards() {
    // Keep the outgoing stage intact while saving and the menu fade finish.
    if (demoVictory) setStage({ kind: "demo-completion" });
    else commands.resetRunState();
  }
  if (stage.kind === "hero" && revealedCharacter) {
    const hasNextHero = stage.index + 1 < unlockedCharacters.length;
    return (
      <HeroUnlockedScreen
        characterId={revealedCharacter}
        continueLabel={
          hasNextHero || demoVictory
            ? i18n.text("run-end.continue", "Continue")
            : i18n.text("run-end.menu", "Main Menu")
        }
        onContinue={() => {
          if (hasNextHero) setStage({ kind: "hero", index: stage.index + 1 });
          else continueAfterRewards();
        }}
      />
    );
  }
  if (stage.kind === "demo-completion" && demoVictory)
    return (
      <DemoCompletionScreen
        onMainMenu={commands.resetRunState}
        {...(isDesktop() ? { onWishlist: openFullGameWishlist } : {})}
      />
    );
  const { title } = RUN_END_COPY[outcome];
  const subtitle =
    outcome === "defeat" && runEndLabyrinthFloor
      ? i18n.text("ui.run-end-routes.msg1", "Your descent reached floor {{value0}}.", {
          value0: i18n.displayText(runEndLabyrinthFloor),
        })
      : RUN_END_COPY[outcome].subtitle;
  return (
    <RunEndScreen
      title={i18n.displayText(title)}
      runRecap={runRecap}
      subtitle={demoVictory ? "" : subtitle}
      continueLabel={
        demoVictory || unlockedCharacters.length > 0
          ? i18n.text("run-end.continue", "Continue")
          : i18n.text("run-end.menu", "Main Menu")
      }
      outcome={outcome}
      characterId={characterId}
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      runEndCurrencies={runEndCurrencies}
      runEndItems={runEndItems}
      onContinue={unlockedCharacters.length > 0 ? () => setStage({ kind: "hero", index: 0 }) : continueAfterRewards}
    />
  );
}

export const runEndScreenRoutes = {
  "game-over": RunEndScreenRoute,
  "run-victory": RunEndScreenRoute,
};
