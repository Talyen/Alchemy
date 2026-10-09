import "../helpers/mock-audio";
import { useCallback, useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import { useRenderedScreenTransition } from "@/app/use-app-navigation";
import { isScreenTransitionAllowed, type Screen } from "@/lib/routing";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { createWildwoodGauntletFlow } from "@/features/alchemy/run-loop/run/wildwood-gauntlet-flow";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { defaultGameSession } from "@/app/application-session";
import { readRunSession, readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { setTestRunSeedOverride } from "@/features/alchemy/shared/stores/run-state-init";
import { createRunRngState } from "@/lib/rng";
import { resetAllTestStores, setRunProgress } from "../helpers/run-domain-store-test";
import { defineSequenceFamily, requireProgress } from "./sequence";
import { advance, installFrames } from "./timing";

defineSequenceFamily("navigation", (seed) => {
  resetAllTestStores();
  setTestRunSeedOverride(seed);
  installFrames();
  setRunProgress({ rng: createRunRngState(seed) });
  const mode = (["campaign", "labyrinth", "wildwood"] as const)[seed % 3]!;
  let expected: Screen = "menu";
  let committed: Screen = "menu";
  const mounted = renderHook(() => {
    const [screen, setScreen] = useState<Screen>("menu");
    const show = useCallback((next: Screen) => {
      committed = next;
      setScreen(next);
    }, []);
    const navigation = useScreenTransitions(screen, show);
    return { navigation, ...useRenderedScreenTransition(screen) };
  });
  const starts = createBattleStartCommands(() => {}, defaultGameSession);
  const navigation = {
    navigateTo: (screen: Screen, prepare?: () => void) => {
      expected = screen;
      mounted.result.current.navigation.navigateTo(screen, prepare);
    },
    resumeTo: (screen: Screen, prepare?: () => void) => {
      expected = screen;
      mounted.result.current.navigation.resumeTo(screen, prepare);
    },
  };
  const wildwood = createWildwoodGauntletFlow(
    { ...navigation, presentBattleStart: starts.presentBattleStart, clearCardHover: () => {} },
    defaultGameSession,
  );
  const setup = createContentSystemNavigation(
    {
      navigateTo: (screen, prepare) => {
        expected = screen;
        mounted.result.current.navigation.navigateTo(screen, prepare);
      },
      resumeTo: (screen, prepare) => {
        expected = screen;
        mounted.result.current.navigation.resumeTo(screen, prepare);
      },
      startBattle: starts.startBattle,
      getAvailableDestinations: () => ["Normal Combat"],
      onResumeWildwood: wildwood.resumeWildwoodRun,
    },
    defaultGameSession,
  );
  const observe = () => ({
    committed,
    expected,
    mode,
    activity: readRunSession(defaultGameSession).activity.kind,
    ...mounted.result.current,
    navigation: { pending: mounted.result.current.navigation.navigationPending },
  });
  return {
    fixture: { screen: "menu", mode, seed },
    actions: () => [
      ...(committed === "game-mode-select" ? ["begin"] : []),
      ...(committed === "character-select" ? ["select"] : []),
      "race",
      "redirect",
      "cancel",
      "settle",
      ...(["menu", "options", "collection", "armory", "talents", "homestead", "game-mode-select"] as Screen[])
        .filter((s) => isScreenTransitionAllowed(committed, s))
        .map((s) => `go:${s}`),
    ],
    async run(action) {
      act(() => {
        const nav = mounted.result.current.navigation;
        if (action === "begin") {
          if (mode === "campaign") setup.beginCampaign();
          else if (mode === "labyrinth") setup.beginLabyrinth();
          else setup.beginWildwood();
        } else if (action === "select") {
          setup.handleCharacterSelect("knight");
          requireProgress(
            readActiveRun(defaultGameSession).contentSystemType === mode,
            "setup-selected-mode",
            observe(),
          );
        } else if (action.startsWith("go:")) {
          expected = action.slice(3) as Screen;
          nav.navigateTo(expected);
        } else if (action === "race") {
          nav.navigateTo("collection");
          nav.navigateTo("options");
          expected = "options";
        } else if (action === "redirect") {
          nav.navigateTo("collection", () => nav.navigateTo("armory"));
          expected = "armory";
        } else if (action === "cancel") {
          nav.cancelPending();
          expected = committed;
        }
      });
      // Separate advances let React commit each fade stage before its next effect.
      if (action === "settle" || action === "cancel") {
        await advance(1000);
        await advance(1000);
      } else await advance(1);
    },
    check() {
      if (
        !mounted.result.current.navigation.navigationPending &&
        mounted.result.current.renderedScreen === committed &&
        !mounted.result.current.tooltipBlocked
      ) {
        requireProgress(committed === expected, "navigation-latest-request", observe());
      }
    },
    observe,
    async settle() {
      for (let phase = 0; phase < 3; phase++) await advance(1000);
      requireProgress(
        !mounted.result.current.navigation.navigationPending &&
          mounted.result.current.renderedScreen === expected &&
          !mounted.result.current.tooltipBlocked,
        "navigation-eventual-input",
        observe(),
      );
    },
    async dispose() {
      mounted.unmount();
      await advance(2000);
      cleanup();
      setTestRunSeedOverride(null);
      vi.unstubAllGlobals();
      vi.useRealTimers();
    },
  };
});
