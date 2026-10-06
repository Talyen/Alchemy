import "../../../helpers/mock-audio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { createRunFlow, createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readActiveRunScreen, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import * as battleEngine from "@/lib/battle";
import { getStartingDeck } from "@/lib/game-data";
import { DESTINATIONS } from "@/lib/routing";
import { createRunRngState } from "@/lib/rng";
import { gridLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../../helpers/run-flow-handler-deps";

const nodeId = "labyrinth-floor-1-n0";
beforeEach(resetAllTestStores);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function prepare(mode: "campaign" | "labyrinth", combat = false) {
  setRunProgress({ contentSystemType: mode, runDeck: getStartingDeck("knight"), rng: createRunRngState(() => 42) });
  const map = gridLabyrinthMapFixture();
  map.nodes[nodeId]!.type = combat ? "combat" : "shop";
  map.nodes[nodeId]!.rewardModifiers = ["bowyer"];
  setRunSession({
    activity: { kind: mode === "campaign" ? "destination" : "labyrinth-map" },
    labyrinthMap: mode === "labyrinth" ? map : null,
    selectedLabyrinthNodeId: mode === "labyrinth" ? nodeId : null,
  });
  dispatchGameplayCommand((draft) => {
    draft.run.navigation.screen = mode === "campaign" ? "destination" : "labyrinth-map";
    draft.session.rewardFlow.state.destinations = [combat ? DESTINATIONS.NORMAL_COMBAT : DESTINATIONS.CARD_SHOP];
    return acceptCommand();
  });
}

it.each(["campaign", "labyrinth"] as const)(
  "commits %s entry before the fade and preserves its complete resume state on cancellation",
  (mode) => {
    vi.useFakeTimers();
    prepare(mode);
    const navigation = createScreenNavigation({ readScreen: readActiveRunScreen, showScreen: showRunScreen });
    const presentBattleStart = vi.fn();
    const before = readGameplayState();
    if (mode === "campaign") {
      const flow = createRunFlow(makeFlowHandlerDeps({ navigateTo: navigation.navigateTo, presentBattleStart }));
      flow.handleDestinationChoice(DESTINATIONS.CARD_SHOP);
      flow.handleDestinationChoice(DESTINATIONS.CARD_SHOP);
    } else {
      const routing = createLabyrinthNodeRouting({
        labyrinth: createLabyrinthController(),
        navigateTo: navigation.navigateTo,
        presentBattleStart,
      });
      routing.handleLabyrinthNodeEnter();
      routing.handleLabyrinthNodeEnter();
    }
    expect(readActiveRunScreen()).toBe(mode === "campaign" ? "destination" : "labyrinth-map");
    const committed = readGameplayState();
    expect(committed.revision).toBe(before.revision + 1);
    expect(readRunSession().activity.kind).toBe("shop");
    const saved = snapshotRun();
    expect(saved.currentScreen).toBe("shop");
    expect(saved.runHistory).toHaveLength(1);
    expect(saved.shopState!.cards.length).toBeGreaterThan(0);
    navigation.cancelPending();
    vi.runAllTimers();
    expect(readGameplayState()).toBe(committed);
    expect(snapshotRun()).toEqual(saved);
    expect(presentBattleStart).not.toHaveBeenCalled();
  },
);

it.each(["campaign", "labyrinth"] as const)(
  "keeps complete %s gameplay when presentation throws after entry",
  (mode) => {
    prepare(mode);
    const navigateTo = vi.fn(() => {
      throw new Error("Display unavailable");
    });
    const action =
      mode === "campaign"
        ? () => createRunFlow(makeFlowHandlerDeps({ navigateTo })).handleDestinationChoice(DESTINATIONS.CARD_SHOP)
        : createLabyrinthNodeRouting({
            labyrinth: createLabyrinthController(),
            navigateTo,
            presentBattleStart: vi.fn(),
          }).handleLabyrinthNodeEnter;
    expect(action).toThrow("Display unavailable");
    expect(readRunSession().activity.kind).toBe("shop");
    const saved = snapshotRun();
    expect(saved.currentScreen).toBe("shop");
    expect(saved.runHistory).toHaveLength(1);
    if (mode === "campaign") {
      expect(saved.destinationIndexInAct).toBe(1);
      expect(saved.completedDestinations).toEqual([DESTINATIONS.CARD_SHOP]);
      expect(readRunSession().rewardFlow.claim.kind).toBe("idle");
    } else expect(saved.labyrinthPendingNode).toBe(nodeId);
  },
);

it.each([
  ["campaign", "headless"],
  ["labyrinth", "headless"],
  ["campaign", "fade"],
  ["labyrinth", "fade"],
] as const)("settles an opening Companion victory on the recorded %s room with %s navigation", (mode, timing) => {
  prepare(mode, true);
  dispatchGameplayCommand((draft) => {
    draft.runProfile.effects.companionDamage = 1000;
    return acceptCommand();
  });
  const resolve = battleEngine.resolveBattleStart;
  vi.spyOn(battleEngine, "resolveBattleStart").mockImplementation((options, context) =>
    resolve(
      {
        ...options,
        difficultyModifiers: [{ kind: "start-companion", companionId: "bear" }],
      },
      context,
    ),
  );
  if (timing === "headless") {
    const controller = createPlaythroughController();
    if (mode === "campaign") controller.flow.handleDestinationChoice(DESTINATIONS.NORMAL_COMBAT);
    else controller.nodes.handleLabyrinthNodeEnter();
  } else {
    vi.useFakeTimers();
    const navigation = createScreenNavigation({ readScreen: readActiveRunScreen, showScreen: showRunScreen });
    const deps = makeFlowHandlerDeps({ ...navigation });
    const outcomes = createRunOutcomes(deps);
    const battle = createBattleStartCommands(({ outcome }) => {
      expect(outcome).toBe("victory");
      outcomes.victory.handleBattleVictory();
    });
    if (mode === "campaign") {
      createRunFlow(
        makeFlowHandlerDeps({ ...navigation, presentBattleStart: battle.presentBattleStart }),
      ).handleDestinationChoice(DESTINATIONS.NORMAL_COMBAT);
    } else {
      createLabyrinthNodeRouting({
        labyrinth: createLabyrinthController(),
        navigateTo: navigation.navigateTo,
        presentBattleStart: battle.presentBattleStart,
      }).handleLabyrinthNodeEnter();
    }
    expect(readActiveRunScreen()).toBe(mode === "campaign" ? "destination" : "labyrinth-map");
    vi.runAllTimers();
  }
  expect(readActiveRunScreen()).toBe("rewards");
  expect(readRunSession().activity.kind).toBe("rewards");
  const saved = snapshotRun();
  expect(saved.activeCombat).toBeNull();
  expect(saved.runHistory).toEqual([
    expect.objectContaining({ destination: DESTINATIONS.NORMAL_COMBAT, completed: true }),
  ]);
  if (mode === "campaign") expect(saved.destinationIndexInAct).toBe(1);
  else expect(saved.labyrinthPendingNode).toBe(nodeId);
});
