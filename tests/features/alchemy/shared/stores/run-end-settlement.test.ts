import { afterEach, expect, it, vi } from "vitest";
import {
  abandonCurrentRun,
  completeRunDefeat,
  completeRunVictory,
} from "@/features/alchemy/run-loop/run/run-end-commands";
import { claimRunReward } from "@/features/alchemy/run-loop/run/reward-commands";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/game-session";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readGameplayState, subscribeGameplayCommits } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import {
  awardMaterialsDuringRun,
  addRunCurrenciesEarned,
  setHasActiveRun,
  setRunProgressActivity,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import * as talentSettlement from "@/features/alchemy/shared/stores/write/run-meta";
import { cardById, getStartingDeck } from "@/lib/game-data";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { defaultBattleState } from "@/lib/battle";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { emptyInventory } from "@/lib/homestead/inventory";

const sessions: GameSession[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const session of sessions.splice(0)) await session.dispose();
});

function earnedRun() {
  const feedback = { stopAllSfx: vi.fn(), playDefeat: vi.fn(), clearBattleUi: vi.fn() };
  const write = vi.fn(async (_key: string, _value: string) => ({ ok: true as const }));
  const session = createGameSession({
    feedback,
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write,
      writeSync: () => ({ ok: true }),
      clear: async () => ({ ok: true }),
    },
  });
  sessions.push(session);
  dispatchGameplayCommand(
    (draft) => {
      setHasActiveRun(draft, true);
      setRunProgressActivity(draft, "destination");
      draft.run.initialized = true;
      draft.run.activeRun.selectedDifficulty = "difficulty-2";
      draft.run.activeRun.runTalentXP = { burn: 10 };
      draft.run.activeRun.roomsEncountered = 3;
      draft.run.activeRun.runDeck = getStartingDeck("knight");
      draft.run.activeRun.runObtainedItems = [{ kind: "trinket", trinketId: "bone-charm" }];
      draft.runProfile.talentXP = { burn: 20 };
      draft.runProfile.effects = { ...defaultHomesteadEffects, endRunStonePerRoom: 2, endRunGoldPerRoom: 4 };
      awardMaterialsDuringRun(draft, { ...emptyInventory(), wood: 5 });
      addRunCurrenciesEarned(draft, { "discordant-dice": 2 });
      draft.session.activity = { kind: "battle", data: { battleState: defaultBattleState() } };
      return acceptCommand();
    },
    undefined,
    session,
  );
  return { session, feedback, write, persistence: createSessionPersistence(session) };
}

it.each([
  ["victory", completeRunVictory],
  ["death", completeRunDefeat],
  ["abandoned", abandonCurrentRun],
] as const)("settles %s progression in one revision and rejects repeated completion effects", async (ending, end) => {
  const { session, persistence, feedback, write } = earnedRun();
  const before = readGameplayState(session);
  const commits: Array<ReturnType<typeof readGameplayState>> = [];
  const unsubscribe = subscribeGameplayCommits(() => commits.push(readGameplayState(session)), session);

  end(session);
  await persistence.waitForWrites();
  const settled = readGameplayState(session);
  expect(commits).toEqual([settled]);
  expect(settled.revision).toBe(before.revision + 1);
  expect(settled.runProfile.talentXP.burn).toBe(33);
  expect(settled.runProfile.gold).toBeGreaterThan(before.runProfile.gold);
  expect(settled.runProfile.materialInventory).toMatchObject({ wood: 5, stone: 6 });
  expect(settled.run.activeRun.runTalentXP).toEqual({});
  expect(settled.run.activeRun.runMaterialsEarned).toEqual(emptyInventory());
  expect(settled.run.activeRun.runCurrenciesEarned["discordant-dice"]).toBe(0);
  expect(settled.session).toMatchObject({
    activity: { kind: "inactive" },
    runEndTalentXP: { burn: 13 },
    runEndMaterials: { wood: 5, stone: 6 },
    runEndCurrencies: { "discordant-dice": 2 },
    runEndItems: [{ kind: "trinket", trinketId: "bone-charm" }],
    runRecap: { ending, deck: before.run.activeRun.runDeck },
  });
  expect(settled.profile.finishedRunCharacters).toContain("knight");
  expect(feedback.playDefeat).toHaveBeenCalledTimes(ending === "death" ? 1 : 0);
  expect(feedback.clearBattleUi).toHaveBeenCalledTimes(ending === "victory" ? 0 : 1);
  expect(feedback.stopAllSfx).toHaveBeenCalledTimes(ending === "victory" ? 0 : 1);
  expect(write).toHaveBeenCalled();
  const saved = JSON.parse(write.mock.calls.at(-1)![1] as string);
  expect(saved).toMatchObject({ activeRun: null, talentXP: { burn: 33 }, materialInventory: { wood: 5, stone: 6 } });

  const writes = write.mock.calls.length;
  const defeatSounds = feedback.playDefeat.mock.calls.length;
  const clears = feedback.clearBattleUi.mock.calls.length;
  end(session);
  await persistence.waitForWrites();
  unsubscribe();
  expect(readGameplayState(session)).toBe(settled);
  expect(commits).toHaveLength(1);
  expect(write).toHaveBeenCalledTimes(writes);
  expect(feedback.playDefeat).toHaveBeenCalledTimes(defeatSounds);
  expect(feedback.clearBattleUi).toHaveBeenCalledTimes(clears);
});

it("rolls back a late settlement failure and allows one complete retry", async () => {
  const { session, persistence, feedback, write } = earnedRun();
  const before = readGameplayState(session);
  const committed = vi.fn();
  const unsubscribe = subscribeGameplayCommits(committed, session);
  vi.spyOn(talentSettlement, "finalizeRunXP").mockImplementationOnce(() => {
    throw new Error("XP settlement failed");
  });

  expect(() => completeRunDefeat(session)).toThrow("XP settlement failed");
  expect(readGameplayState(session)).toBe(before);
  expect(committed).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(feedback.playDefeat).not.toHaveBeenCalled();
  expect(feedback.clearBattleUi).not.toHaveBeenCalled();

  completeRunDefeat(session);
  await persistence.waitForWrites();
  unsubscribe();
  expect(readGameplayState(session).runProfile.talentXP.burn).toBe(33);
  expect(readGameplayState(session).runProfile.materialInventory.stone).toBe(6);
  expect(committed).toHaveBeenCalledOnce();
  expect(feedback.playDefeat).toHaveBeenCalledOnce();
});

it("settles the final reward and permanent progression together before victory presentation", async () => {
  const { session, persistence, write } = earnedRun();
  const card = cardById["health-potion"]!;
  dispatchGameplayCommand(
    (draft) => {
      draft.run.activeRun.currentAct = ACTS_PER_RUN;
      draft.session.activity = { kind: "rewards" };
      draft.session.rewardFlow.state = {
        ...createEmptyRewardState(),
        choices: [card],
        materials: { ...emptyInventory(), wood: 3 },
        lastVictoryEnemyType: "boss",
        lastVictoryContentSystem: "campaign",
      };
      return acceptCommand();
    },
    undefined,
    session,
  );
  const before = readGameplayState(session);
  expect(claimRunReward(card.id, session)).toMatchObject({ runEnded: true, nextScreen: "run-victory" });
  await persistence.waitForWrites();
  const settled = readGameplayState(session);
  expect(settled.revision).toBe(before.revision + 1);
  expect(settled.run.activeRun.runDeck).toHaveLength(before.run.activeRun.runDeck.length + 1);
  expect(settled.runProfile.talentXP.burn).toBe(33);
  expect(settled.session).toMatchObject({
    activity: { kind: "inactive" },
    runEndTalentXP: { burn: 13 },
    runEndMaterials: { wood: 8, stone: 6 },
    runRecap: { ending: "victory", deck: settled.run.activeRun.runDeck },
  });
  const writes = write.mock.calls.length;
  expect(claimRunReward(card.id, session)).toBeNull();
  completeRunVictory(session);
  await persistence.waitForWrites();
  expect(readGameplayState(session)).toBe(settled);
  expect(write).toHaveBeenCalledTimes(writes);

  const resumed = createGameSession({ initialSave: persistence.snapshot() });
  sessions.push(resumed);
  expect(readGameplayState(resumed).session.activity.kind).toBe("inactive");
  expect(readGameplayState(resumed).runProfile).toMatchObject({
    talentXP: { burn: 33 },
    materialInventory: { wood: 8, stone: 6 },
  });
});
