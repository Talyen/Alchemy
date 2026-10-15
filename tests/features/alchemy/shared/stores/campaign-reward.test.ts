import { afterEach, describe, expect, it } from "vitest";
import { claimRunReward } from "@/features/alchemy/run-loop/run/reward-commands";
import { projectCampaignReward } from "@/features/alchemy/shared/stores/campaign-reward";
import { RUN_SCREEN_SELECTORS } from "@/features/alchemy/shared/stores/run-screen-data";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/game-session";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readGameplayState, subscribeGameplayCommits } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import {
  constructBuilding,
  resetHomestead,
  setHasActiveRun,
  setRunProgressActivity,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { createSessionPersistence, evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { cardById, getStartingDeck } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { canUpgradeTierItem } from "@/lib/homestead/upgrades";
import { buildings } from "@/lib/homestead/data";
import { createSaveBackend } from "../../../../helpers/save-backend";

const sessions: GameSession[] = [];
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.dispose();
});

function pendingBossReward() {
  const session = createGameSession({ saveBackend: createSaveBackend() });
  sessions.push(session);
  dispatchGameplayCommand(
    (draft) => {
      setHasActiveRun(draft, true);
      setRunProgressActivity(draft, "rewards");
      draft.run.initialized = true;
      draft.run.activeRun.runDeck = getStartingDeck("knight");
      draft.run.activeRun.selectedDifficulty = "difficulty-1";
      draft.session.rewardFlow.state = {
        ...createEmptyRewardState(),
        choices: [cardById.slash!],
        lastVictoryContentSystem: "campaign",
        lastVictoryEnemyType: "boss",
      };
      return acceptCommand();
    },
    undefined,
    session,
  );
  return session;
}

function mutate(session: GameSession, action: Parameters<typeof dispatchGameplayCommand>[0]) {
  return dispatchGameplayCommand(action, undefined, session);
}

describe("Campaign first-boss Homestead grant", () => {
  it.each([
    { stockpile: { wood: 0, stone: 0 }, reward: { gems: 8 }, expected: { wood: 4, stone: 4, gems: 8 } },
    { stockpile: { wood: 3, stone: 2 }, reward: { stone: 2 }, expected: { wood: 1, stone: 2 } },
    { stockpile: { wood: 8, stone: 7 }, reward: { gems: 8 }, expected: { gems: 8 } },
    { stockpile: { wood: 0, stone: 0 }, reward: { wood: 4, stone: 4 }, expected: { wood: 4, stone: 4 } },
  ])(
    "previews and atomically claims only the shortfall for $stockpile plus $reward",
    ({ stockpile, reward, expected }) => {
      const session = pendingBossReward();
      mutate(session, (draft) => {
        draft.runProfile.materialInventory = { ...emptyInventory(), ...stockpile };
        draft.session.rewardFlow.state.materials = { ...emptyInventory(), ...reward };
        return acceptCommand();
      });
      const before = readGameplayState(session);
      const preview = RUN_SCREEN_SELECTORS.rewards(before);
      expect(preview.clearedAct).toBe(1);
      expect(preview.rewardMaterials).toEqual({ ...emptyInventory(), ...expected });
      const commits: Array<ReturnType<typeof readGameplayState>> = [];
      const unsubscribe = subscribeGameplayCommits(() => commits.push(readGameplayState(session)), session);
      expect(claimRunReward("slash", session)).not.toBeNull();
      unsubscribe();
      const after = readGameplayState(session);
      expect(commits).toEqual([after]);
      expect(after.revision).toBe(before.revision + 1);
      expect(after.runProfile.starterHomesteadGrantResolved).toBe(true);
      expect(after.run.activeRun.runMaterialsEarned).toEqual(preview.rewardMaterials);
      expect(after.runProfile.materialInventory.wood).toBeGreaterThanOrEqual(4);
      expect(after.runProfile.materialInventory.stone).toBeGreaterThanOrEqual(4);
      for (const id of ["wishing-well", "sparring-grounds"]) {
        expect(
          canUpgradeTierItem(
            buildings.find((b) => b.id === id),
            0,
            after.runProfile.materialInventory,
          ),
        ).toBe(true);
      }
      expect(claimRunReward("slash", session)).toBeNull();
      expect(readGameplayState(session)).toBe(after);
    },
  );

  it.each(["constructedBuildings", "plantedFarms", "completedResearch", "bondedCompanions"] as const)(
    "skips the grant for existing %s purchases and resolves the receipt",
    (group) => {
      const session = pendingBossReward();
      mutate(session, (draft) => {
        const levels = draft.runProfile[group];
        Object.assign(levels, { [Object.keys(levels)[0]!]: 1 });
        return acceptCommand();
      });
      expect(projectCampaignReward(readGameplayState(session)).materials).toEqual(emptyInventory());
      expect(claimRunReward("slash", session)).not.toBeNull();
      expect(readGameplayState(session).runProfile).toMatchObject({
        starterHomesteadGrantResolved: true,
        materialInventory: emptyInventory(),
      });
    },
  );

  it.each([
    { mode: "campaign", enemy: "normal", act: 1, cleared: null },
    { mode: "campaign", enemy: "elite", act: 1, cleared: null },
    { mode: "campaign", enemy: "boss", act: 2, cleared: 2 },
    { mode: "campaign", enemy: "boss", act: 3, cleared: 3 },
    { mode: "labyrinth", enemy: "boss", act: 1, cleared: null },
    { mode: "wildwood", enemy: "boss", act: 1, cleared: null },
  ] as const)("keeps $mode/$enemy/Act $act outside the starter grant", ({ mode, enemy, act, cleared }) => {
    const session = pendingBossReward();
    mutate(session, (draft) => {
      draft.run.activeRun.contentSystemType = mode;
      draft.run.activeRun.currentAct = act;
      draft.session.rewardFlow.state.lastVictoryContentSystem = mode;
      draft.session.rewardFlow.state.lastVictoryEnemyType = enemy;
      return acceptCommand();
    });
    expect(projectCampaignReward(readGameplayState(session))).toEqual({
      clearedAct: cleared,
      materials: emptyInventory(),
      resolvesStarterGrant: false,
    });
  });

  it("recalculates the preview after a purchase and preserves eligibility resolution through Homestead reset", () => {
    const session = pendingBossReward();
    mutate(session, (draft) => {
      draft.runProfile.materialInventory = { ...emptyInventory(), wood: 4, stone: 4 };
      return acceptCommand();
    });
    mutate(session, (draft) => {
      expect(constructBuilding(draft, "wishing-well")).toBe(true);
      return acceptCommand();
    });
    expect(projectCampaignReward(readGameplayState(session)).materials).toEqual(emptyInventory());
    mutate(session, (draft) => {
      expect(resetHomestead(draft)).toBe(true);
      draft.runProfile.materialInventory = emptyInventory();
      return acceptCommand();
    });
    expect(projectCampaignReward(readGameplayState(session))).toMatchObject({
      resolvesStarterGrant: false,
      materials: emptyInventory(),
    });
  });

  it("does not repeat the grant on a resumed Companion reward from the same boss", () => {
    const first = pendingBossReward();
    mutate(first, (draft) => {
      draft.session.rewardFlow.companionCards = [cardById["wolf-companion"]!];
      return acceptCommand();
    });
    expect(claimRunReward("missing-choice", first)).toBeNull();
    expect(readGameplayState(first).runProfile.starterHomesteadGrantResolved).toBe(false);
    expect(claimRunReward("slash", first)).not.toBeNull();
    expect(readGameplayState(first).session.activity.kind).toBe("rewards");
    const saved = evaluateSaveCandidates([JSON.stringify(createSessionPersistence(first).snapshot())]).data;
    const resumed = createGameSession({ initialSave: saved, saveBackend: createSaveBackend() });
    sessions.push(resumed);
    expect(projectCampaignReward(readGameplayState(resumed)).materials).toEqual(emptyInventory());
    expect(claimRunReward("wolf-companion", resumed)).not.toBeNull();
    const after = readGameplayState(resumed);
    expect(after.runProfile.materialInventory).toEqual({ ...emptyInventory(), wood: 4, stone: 4 });
    expect(after.run.activeRun.runMaterialsEarned).toEqual({ ...emptyInventory(), wood: 4, stone: 4 });
    expect(after.run.activeRun.currentAct).toBe(2);
  });

  it("preserves pending and claimed rewards through serialization; later runs cannot repeat the grant, while Clear Save resets it", async () => {
    const first = pendingBossReward();
    const persistence = createSessionPersistence(first);
    const saved = evaluateSaveCandidates([JSON.stringify(persistence.snapshot())]).data;
    const resumed = createGameSession({ initialSave: saved, saveBackend: createSaveBackend() });
    sessions.push(resumed);
    expect(RUN_SCREEN_SELECTORS.rewards(readGameplayState(resumed)).rewardMaterials).toMatchObject({
      wood: 4,
      stone: 4,
    });
    expect(claimRunReward("slash", resumed)).not.toBeNull();
    const claimedSave = evaluateSaveCandidates([JSON.stringify(createSessionPersistence(resumed).snapshot())]).data;
    expect(claimedSave).toMatchObject({
      starterHomesteadGrantResolved: true,
      materialInventory: { wood: 4, stone: 4 },
    });
    const later = createGameSession({ initialSave: claimedSave, saveBackend: createSaveBackend() });
    sessions.push(later);
    mutate(later, (draft) => {
      setRunProgressActivity(draft, "rewards");
      draft.run.activeRun.currentAct = 1;
      draft.runProfile.materialInventory = emptyInventory();
      draft.session.rewardFlow.state = {
        ...createEmptyRewardState(),
        choices: [cardById.slash!],
        lastVictoryContentSystem: "campaign",
        lastVictoryEnemyType: "boss",
      };
      return acceptCommand();
    });
    expect(projectCampaignReward(readGameplayState(later))).toMatchObject({
      resolvesStarterGrant: false,
      materials: emptyInventory(),
    });
    expect(await clearAllPersistentGameData(later)).toBe(true);
    expect(readGameplayState(later).runProfile.starterHomesteadGrantResolved).toBe(false);
  });
});
