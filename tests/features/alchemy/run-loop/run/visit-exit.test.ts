import * as destinationFlow from "@/features/alchemy/shared/run-flow/destination-flow";
import * as config from "@/features/alchemy/shared/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/game-session";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { createProgressionCommands } from "@/features/alchemy/run-loop/run/progression-commands";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { emptyHydratedMysteryVisit } from "@/lib/active-run-session/mystery-visit-persistence";
import { battleSnapshot, defaultBattleState } from "@/lib/battle";
import { getCampfireRestHealth } from "@/lib/campfire-heal";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { DESTINATIONS } from "@/lib/routing";
import { makeTestCard } from "../../../../fixtures/cards";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";

const sessions: GameSession[] = [];
function setup() {
  const session = createGameSession({ runtimeInputs: { generateRunSeed: () => 123 } });
  sessions.push(session);
  return session;
}
afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.dispose()));
});

describe("transaction-owned visit exits", () => {
  it("rolls automatic rest back with failed destination sampling, then commits the entire exit once", () => {
    const session = setup();
    dispatchGameplayCommand(
      (draft) => {
        draft.session.activity = { kind: "campfire", data: emptyAlchemyVisit() };
        draft.run.activeRun.runPlayerHealth = 10;
        draft.run.activeRun.runMaxHealth = 30;
        return acceptCommand();
      },
      undefined,
      session,
    );
    const before = readGameplayState(session);
    const sample = vi.spyOn(destinationFlow, "createInitialDestinationResult").mockImplementationOnce(() => {
      throw new Error("sampling failed");
    });
    const commands = createProgressionCommands(session);

    expect(() => commands.leaveVisit("campfire")).toThrow("sampling failed");
    expect(readGameplayState(session)).toBe(before);
    expect(commands.leaveVisit("campfire")).toBe("destination");
    const after = readGameplayState(session);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.run.activeRun.runPlayerHealth).toBe(getCampfireRestHealth(10, 30));
    expect(after.run.activeRun.roomsEncountered).toBe(before.run.activeRun.roomsEncountered + 1);
    expect(after.session.activity.kind).toBe("destination");
    expect(after.run.activeRun.lastOfferedDestinations).toEqual(after.session.rewardFlow.state.destinations);
    expect(commands.leaveVisit("campfire")).toBeNull();
    expect(readGameplayState(session)).toBe(after);
    sample.mockRestore();
  });

  it("rolls Corruption abandonment back if preparing the restored picker fails", () => {
    const session = setup();
    dispatchGameplayCommand(
      (draft) => {
        draft.session.activity = { kind: "corruption", data: null };
        draft.run.activeRun.completedDestinations = [DESTINATIONS.CORRUPTION];
        draft.run.activeRun.destinationIndexInAct = 1;
        draft.run.activeRun.lastOfferedDestinations = [DESTINATIONS.BOSS_COMBAT];
        return acceptCommand();
      },
      undefined,
      session,
    );
    const before = readGameplayState(session);
    const roll = vi.spyOn(config, "rollFreshBossId").mockImplementation(() => {
      throw new Error("boss roll failed");
    });
    try {
      expect(() => createProgressionCommands(session).leaveVisit("corruption")).toThrow("boss roll failed");
      expect(readGameplayState(session)).toBe(before);
    } finally {
      roll.mockRestore();
    }
  });

  it.each(["campfire", "mystery", "corruption", "shop", "transmutation"] as const)(
    "rejects a retained %s exit after a battle has replaced the visit",
    (expected) => {
      const session = setup();
      dispatchGameplayCommand(
        (draft) => {
          draft.session.activity = { kind: "battle", data: { battleState: battleSnapshot(defaultBattleState()) } };
          draft.run.activeRun.completedDestinations = [DESTINATIONS.CORRUPTION];
          draft.run.activeRun.destinationIndexInAct = 1;
          return acceptCommand();
        },
        undefined,
        session,
      );
      const before = readGameplayState(session);
      const navigateTo = vi.fn();
      const sample = vi.spyOn(destinationFlow, "createInitialDestinationResult");
      createRunFlow(makeFlowHandlerDeps({ navigateTo }), session).advanceToNextDestination(expected);
      expect(readGameplayState(session)).toBe(before);
      expect(navigateTo).not.toHaveBeenCalled();
      expect(sample).not.toHaveBeenCalled();
      sample.mockRestore();
    },
  );

  it("does not let a retained Corruption exit consume a different live visit", () => {
    const session = setup();
    dispatchGameplayCommand(
      (draft) => {
        draft.session.activity = { kind: "campfire", data: emptyAlchemyVisit() };
        return acceptCommand();
      },
      undefined,
      session,
    );
    const before = readGameplayState(session);
    expect(createProgressionCommands(session).leaveVisit("corruption")).toBeNull();
    expect(readGameplayState(session)).toBe(before);
  });

  it.each([false, true])("keeps an unfinished Mystery open (pending Card choice: %s)", (pendingCard) => {
    const session = setup();
    dispatchGameplayCommand(
      (draft) => {
        draft.session.activity = {
          kind: "mystery",
          data: {
            ...emptyHydratedMysteryVisit(),
            mysteryChosenChoice: pendingCard ? { label: "Choose", effects: [{ kind: "chooseCard" }] } : null,
            mysteryCardChoices: pendingCard ? [makeTestCard({ id: "pending" })] : null,
          },
        };
        return acceptCommand();
      },
      undefined,
      session,
    );
    const before = readGameplayState(session);
    expect(createProgressionCommands(session).leaveVisit("mystery")).toBeNull();
    expect(readGameplayState(session)).toBe(before);
  });

  it.each([false, true])("leaves Labyrinth Corruption with the node consumed only after use (%s)", (used) => {
    const session = setup();
    const node = (id: string, col: number, cleared: boolean) => ({
      id,
      type: "corruption" as const,
      floor: 1,
      gridPosition: { row: 0, col },
      modifiers: [],
      rewardModifiers: [],
      cleared,
    });
    const map: LabyrinthMap = {
      floors: [{ id: "floor", depth: 1, nodeIds: ["entry", "altar"] }],
      nodes: { entry: node("entry", 0, true), altar: node("altar", 1, false) },
      currentFloor: 1,
      currentNodeId: "entry",
    };
    const card = makeTestCard({ id: "test" });
    dispatchGameplayCommand(
      (draft) => {
        draft.run.activeRun.contentSystemType = "labyrinth";
        draft.session.labyrinthMap = map;
        draft.session.activeLabyrinthPendingNode = "altar";
        draft.session.selectedLabyrinthNodeId = "altar";
        draft.session.activity = {
          kind: "corruption",
          data: used
            ? {
                originalCard: card,
                corruptedCard: { ...card, corrupted: true },
                transformed: false,
                delta: 1,
              }
            : null,
        };
        return acceptCommand();
      },
      undefined,
      session,
    );
    const before = readGameplayState(session);
    const sample = vi.spyOn(destinationFlow, "createInitialDestinationResult");
    expect(createProgressionCommands(session).leaveVisit("corruption")).toBe("labyrinth-map");
    const after = readGameplayState(session);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.session.labyrinthMap?.nodes.altar?.cleared).toBe(used);
    expect(after.run.activeRun.roomsEncountered).toBe(before.run.activeRun.roomsEncountered + Number(used));
    expect(after.session.activity.kind).toBe("labyrinth-map");
    expect(after.session.activeLabyrinthPendingNode).toBeNull();
    expect(after.session.selectedLabyrinthNodeId).toBeNull();
    expect(sample).not.toHaveBeenCalled();
    sample.mockRestore();
  });
});
