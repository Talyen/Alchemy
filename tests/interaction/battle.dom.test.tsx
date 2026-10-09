import { createRunRngState } from "@/lib/rng";
import "../helpers/mock-audio";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type { MouseEvent } from "react";
import { battlePresentation } from "@/app/battle-presentation";
import { defaultGameSession } from "@/app/application-session";
import { useBattlePlayback } from "@/app/screen-routes/use-battle-playback";
import { useCardInspection } from "@/app/use-card-inspection";
import { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import { CardGhostLayer } from "@/features/alchemy/run-loop/battle/presentation/card-ghost-overlay";
import { useRunSessionBattleContext, readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { companionLibrary } from "@/lib/game-data";
import { canPlayCard, isPlayerDefeated } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import {
  replaceBattleForTest,
  resetAllTestStores,
  setRunProgress,
  setRunSession,
} from "../helpers/run-domain-store-test";
import { makeTestBattleState, makeTestCard } from "../fixtures/battle";
import { defineSequenceFamily, requireProgress, type Scenario } from "./sequence";
import { advance, installFrames, installMotionPreference } from "./timing";

defineSequenceFamily("battle", (seed) => {
  resetAllTestStores();
  installFrames();
  const setReducedMotion = installMotionPreference(seed % 3 === 0);
  useUiStore.setState(useUiStore.getInitialState(), true);
  useSettingsStore.getState().setAutoEndTurn(false);
  localStorage.removeItem("alchemy-disable-animations");
  const cards = Array.from({ length: 12 }, (_, i) =>
    makeTestCard({
      id: "slash",
      uid: i + 1,
      cost: 1,
      effects:
        i % 3 === 0
          ? [{ kind: "wish", amount: 1 }]
          : i % 3 === 1
            ? [{ kind: "draw-cards", amount: 1 }]
            : [{ kind: "damage", damageType: "physical", amount: 1 }],
    }),
  );
  setRunProgress({
    rng: createRunRngState(seed),
    characterId: "knight",
    runPlayerHealth: 1000,
    runMaxHealth: 1000,
    runDeck: cards,
  });
  setRunSession({ hasActiveRun: true });
  dispatchRunSessionCommand(
    (draft) =>
      acceptCommand(
        replaceBattleForTest(
          draft,
          makeTestBattleState({
            hand: cards.slice(0, 3),
            deck: cards.slice(3),
            mana: 3,
            activeCompanion: seed % 4 === 0 ? companionLibrary.wolf : null,
            playerCC: { stunSkipTurns: seed % 4 === 1 ? 1 : 0, freezeSkipTurns: 0, cooldown: 0 },
            playerHealth: seed % 8 === 7 ? 1 : 1000,
            playerMaxHealth: 1000,
            enemyHealth: seed % 8 === 6 ? 1 : 1000,
            enemyMaxHealth: 1000,
          }),
        ),
      ),
    undefined,
    defaultGameSession,
  );
  const rect = () => ({ x: 0, y: 0, width: 100, height: 150 });
  const mounted = renderHook(
    ({ screen, menu }: { screen: Screen; menu: boolean }) => {
      const controller = useBattleController({ screen, measureElementRect: rect, measureVisualCardRect: rect });
      const { battle } = useRunSessionBattleContext(screen);
      useBattlePlayback({ ...controller, battleState: battle.battleState, gameMenuOpen: menu });
      const inspection = useCardInspection({
        screen,
        screenInteractive: true,
        returnToRunScreen: "battle",
        isCardPlayInProgress: controller.isCardPlayInProgress,
        gameMenuOpen: menu,
        boonInspectOpen: false,
        closeOtherOverlays: () => {},
      });
      return { controller, inspection };
    },
    { initialProps: { screen: "battle", menu: false } },
  );
  const ghosts = render(<CardGhostLayer presentation={battlePresentation} />);
  let screen: Screen = "battle";
  let menu = false;
  let settled = false;
  const observe = () => {
    const battle = readBattle(defaultGameSession).battleState;
    const presentation = battlePresentation.getState();
    return {
      screen,
      menu,
      turn: battle.turn,
      mana: battle.mana,
      wish: !!battle.wishOptions,
      transfer: presentation.cardTransferInProgress,
      hidden: presentation.hiddenHandCardKeys,
      ghosts: presentation.cardGhosts.length,
      busy: mounted.result.current.controller.isCardPlayInProgress(),
      autoplay: mounted.result.current.controller.isAutoplayEnabled,
    };
  };
  async function paint(ms: number) {
    await advance(ms);
    act(() => {
      for (const ghost of ghosts.container.querySelectorAll("img")) fireEvent.animationEnd(ghost);
    });
  }
  return {
    fixture: { seed, battle: readBattle(defaultGameSession).battleState, worldFixtureSeed: 42 },
    actions: () => [
      "play",
      "end",
      "wish",
      "autoplay",
      "menu",
      "inspect",
      "close",
      "leave",
      "return",
      "settle",
      "disabled-motion",
      "normal-motion",
      "reduced-motion",
    ],
    async run(action) {
      settled = action === "settle";
      act(() => {
        const { controller, inspection } = mounted.result.current;
        const state = readBattle(defaultGameSession).battleState;
        if (action === "play") {
          const index = state.hand.findIndex((card, i) => canPlayCard(state, card, i));
          const card = state.hand[index];
          if (card) {
            const button = document.createElement("button");
            controller.handleCardClick(card, index, {
              currentTarget: button,
            } as unknown as MouseEvent<HTMLButtonElement>);
          }
        }
        if (action === "end") controller.handleEndTurn();
        if (action === "wish" && state.wishOptions?.[0]) controller.handleWishChoice(state.wishOptions[0]);
        if (action === "autoplay") controller.toggleAutoplayEnabled();
        if (action === "inspect") inspection.onOpen("deck");
        if (action === "close") inspection.close();
        if (action === "menu") menu = !menu;
        if (action === "leave") screen = "options";
        if (action === "return") screen = "battle";
        if (action === "settle") controller.setAutoplayEnabled(false);
        if (action === "disabled-motion") localStorage.setItem("alchemy-disable-animations", "true");
        if (action === "normal-motion") {
          localStorage.removeItem("alchemy-disable-animations");
          setReducedMotion(false);
        }
        if (action === "reduced-motion") setReducedMotion(true);
        mounted.rerender({ screen, menu });
      });
      await paint(action === "settle" ? 8000 : 17);
    },
    check() {
      const state = observe();
      if (
        settled &&
        screen === "battle" &&
        !menu &&
        !state.wish &&
        readBattle(defaultGameSession).hasActiveBattle &&
        readBattle(defaultGameSession).battleState.enemyHealth > 0 &&
        !isPlayerDefeated(readBattle(defaultGameSession).battleState)
      ) {
        requireProgress(
          !state.transfer && !state.busy && state.hidden.length === 0,
          "battle-settled-input-unlocked",
          state,
        );
      }
      requireProgress(state.mana >= 0, "battle-mana-not-double-spent", state);
    },
    observe,
    async settle(this: Scenario) {
      await this.run("settle");
    },
    async dispose() {
      mounted.unmount();
      ghosts.unmount();
      cleanup();
      await advance(1);
      localStorage.removeItem("alchemy-disable-animations");
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    },
  };
});
