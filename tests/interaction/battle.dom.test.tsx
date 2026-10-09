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
import { canPlayCard, isPlayerDefeated } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import {
  mutateGearForTest,
  replaceBattleForTest,
  resetAllTestStores,
  setRunProgress,
  setRunSession,
} from "../helpers/run-domain-store-test";
import { battleCohort, combatOutcome } from "./battle-cohorts";
import { snapshotRun, restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { parseActiveRun } from "@/lib/active-run-session";
import { isDeepStrictEqual } from "node:util";
import { defineSequenceFamily, requireProgress, type Scenario } from "./sequence";
import { advance, installFrames, installMotionPreference } from "./timing";

defineSequenceFamily("battle", (seed) => {
  resetAllTestStores();
  const frames = installFrames();
  const setReducedMotion = installMotionPreference(seed % 3 === 0);
  useUiStore.setState(useUiStore.getInitialState(), true);
  useSettingsStore.getState().setAutoEndTurn(false);
  localStorage.removeItem("alchemy-disable-animations");
  const cohort = battleCohort(seed);
  const { cards } = cohort;
  setRunProgress({
    rng: createRunRngState(cohort.worldFixtureSeed),
    characterId: "knight",
    runPlayerHealth: cohort.battle.playerHealth,
    runMaxHealth: cohort.battle.playerMaxHealth,
    runDeck: cards,
    unlockedTalents: cohort.unlockedTalents,
  });
  mutateGearForTest((gear) =>
    gear.initialize(cohort.inventories, cohort.loadouts, undefined, cohort.trinketIds, cohort.equippedTrinkets),
  );
  setRunSession({ hasActiveRun: true });
  dispatchRunSessionCommand(
    (draft) => acceptCommand(replaceBattleForTest(draft, cohort.battle)),
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
  let probed = false;
  let probeOutcome: ReturnType<typeof combatOutcome> | null = null;
  const observe = () => {
    const battle = readBattle(defaultGameSession).battleState;
    const presentation = battlePresentation.getState();
    return {
      screen,
      menu,
      cohort: cohort.id,
      variant: cohort.variant,
      expected: cohort.expected,
      probeOutcome,
      actual: combatOutcome(battle),
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
    fixture: {
      seed,
      cohort: cohort.id,
      variant: cohort.variant,
      provenance: "live catalog cards and legal owned Gear/Trinket/Talents; injected boundary Health/status",
      expected: cohort.expected,
      initialCheckpoint: snapshotRun(defaultGameSession),
      battle: readBattle(defaultGameSession).battleState,
      worldFixtureSeed: cohort.worldFixtureSeed,
    },
    actions: () =>
      !probed
        ? ["probe"]
        : [
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
            "resume",
            "long-gap",
          ],
    async run(action) {
      settled = action === "settle" || action === "long-gap";
      const requestedAction = action;
      if (action === "probe") action = cohort.probe;
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
        if (action === "settle" || action === "long-gap") controller.setAutoplayEnabled(false);
        if (action === "resume") {
          controller.setAutoplayEnabled(false);
          const before = snapshotRun(defaultGameSession);
          const restored = parseActiveRun(JSON.parse(JSON.stringify(before)));
          requireProgress(restored, "battle-resume-parse", before);
          const profile = readRunProfile(defaultGameSession);
          restoreRun(restored, profile.talentXP, profile.unlockedTalents, defaultGameSession);
          requireProgress(
            isDeepStrictEqual(snapshotRun(defaultGameSession), before),
            "battle-resume-state-and-rng-parity",
            { before, actual: snapshotRun(defaultGameSession), activity: readRunSession(defaultGameSession).activity },
          );
        }
        if (action === "disabled-motion") localStorage.setItem("alchemy-disable-animations", "true");
        if (action === "normal-motion") {
          localStorage.removeItem("alchemy-disable-animations");
          setReducedMotion(false);
        }
        if (action === "reduced-motion") setReducedMotion(true);
        mounted.rerender({ screen, menu });
      });
      if (requestedAction === "probe") {
        probed = true;
        probeOutcome = combatOutcome(readBattle(defaultGameSession).battleState);
      }
      if (requestedAction === "long-gap") {
        frames.pauseFrames();
        await advance(8000);
        frames.resumeFrames();
      }
      await paint(settled ? 8000 : 17);
    },
    check() {
      const state = observe();
      if (probeOutcome)
        requireProgress(
          Object.entries(cohort.expected).every(
            ([key, value]) => probeOutcome![key as keyof typeof probeOutcome] === value,
          ),
          "battle-cohort-outcome",
          { cohort: cohort.id, expected: cohort.expected, actual: probeOutcome },
        );
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
      const battle = readBattle(defaultGameSession).battleState;
      const piles = [
        ...battle.hand,
        ...battle.pendingHandCards,
        ...battle.deck,
        ...battle.discard,
        ...battle.exhausted,
      ];
      const identities = piles.map((card) => card.uid);
      requireProgress(
        identities.every((uid) => uid !== undefined) && new Set(identities).size === identities.length,
        "battle-card-identity-not-duplicated",
        { cohort: cohort.id, identities },
      );
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
