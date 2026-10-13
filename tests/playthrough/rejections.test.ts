import { offerRunChoices } from "@/app/playthrough/run-offers";
import { createChoiceCatalog } from "@/app/playthrough/choice-catalog";
import {
  initializeAlchemyVisitForTest as initializeAlchemyVisit,
  initializeMysteryForTest,
  initializeShopForTest,
} from "../helpers/visit-initialization";
import { savedActivityData } from "../fixtures/run-activity";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaythroughFixture } from "@/app/playthrough/fixtures";
import {
  resetUnlockedTalents,
  unlockTalent,
  applyTalentState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { talentPool, canUnlockTalent, cardById } from "@/lib/game-data";
import { mutateGameplayForTest, resetAllTestStores } from "../helpers/run-domain-store-test";
import { readBattle, readRunSession, readRunProfile, readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { setGold, setMaterials, setRunDeck, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setBattleState } from "@/features/alchemy/shared/stores/write/run-battle";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { commitCardPlay } from "@/features/alchemy/shared/stores/battle-commands";
import { cardSlotKeyOf } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { claimRunReward } from "@/features/alchemy/run-loop/run/reward-commands";
import { getRewardChoiceId } from "@/lib/active-run-session";
import { parseActiveRun } from "@/lib/validation";
import { buildings } from "@/lib/homestead/data";
import { constructBuilding } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  createDefaultSaveData,
  configureSaveBackend,
  loadAlchemySaveState,
  hydrateAlchemyPersistenceFields,
} from "@/features/alchemy/shared/storage";
import { restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";
import { stateDigest, snapshotCareer } from "@/app/playthrough/career";
import { resetStorageIoForTests } from "@/features/alchemy/shared/storage/io";
import { defaultGameSession } from "@/app/application-session";

beforeEach(async () => {
  await resetStorageIoForTests(defaultGameSession);
  resetAllTestStores();
});
function start() {
  const controller = createPlaythroughController(defaultGameSession);
  controller.flow.goToScreen("game-mode-select");
  controller.flow.beginCampaign();
  controller.flow.handleCharacterSelect("knight");
  return controller;
}

describe("retained headless rejection and persistence contracts", () => {
  it("previews an alteration after source selection and commits only through confirmation", () => {
    const controller = start();
    mutateGameplayForTest((draft) => setRunDeck(draft, [cardById.slash!]));
    initializeAlchemyVisit("transmutation", defaultGameSession);
    const before = readActiveRun(defaultGameSession).runDeck;
    const catalog = createChoiceCatalog();
    function observe() {
      const choices = catalog.beginObservation();
      offerRunChoices(
        {
          config: {
            seed: 1,
            hero: "knight",
            mode: "campaign",
            difficulty: "difficulty-1",
            runs: 1,
            horizon: 3,
            maxSteps: 100,
            maxTurns: 100,
            policy: "archetype",
            combatPolicy: "greedy-effective-damage",
          },
          controller,
          offer: catalog.offer,
          choices,
          recordBattle: () => {},
        },
        defaultGameSession,
      );
      return choices;
    }
    {
      const choices = observe();
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.every((choice) => choice.kind === "transmutation-source")).toBe(true);
      catalog.execute(choices[0]!);
      expect(readActiveRun(defaultGameSession).runDeck).toEqual(before);
    }
    const [confirm] = observe();
    expect(confirm?.kind).toBe("transmutation-confirm");
    catalog.execute(confirm!);
    expect(readActiveRun(defaultGameSession).runDeck[0]?.id).toBe(before[0]!.id);
    expect(readActiveRun(defaultGameSession).runDeck[0]?.transmuted).toBeTruthy();
    expect(observe().map((choice) => choice.kind)).toEqual(["transmutation-exit"]);
  });

  it("rejects stale combat choices without consuming world RNG", () => {
    start();
    const before = stateDigest(defaultGameSession);
    expect(commitCardPlay(readBattle(defaultGameSession).battleState, 0, "not-offered", defaultGameSession)).toBeNull();
    expect(stateDigest(defaultGameSession)).toBe(before);
  });

  it("rejects repeated and unaffordable shop purchases without duplicate grants", () => {
    const controller = start();
    const shop = controller.shop().merchant;
    initializeShopForTest("merchant", defaultGameSession);
    const activity = readRunSession(defaultGameSession).activity;
    if (activity.kind !== "shop") throw new Error("Shop not initialized");
    const card = activity.data.cards[0]!;
    const key = cardSlotKeyOf(card, 0);
    mutateGameplayForTest((draft) => setGold(draft, 10000));
    expect(shop.buyCard(card, key)).toBe(true);
    const after = stateDigest(defaultGameSession);
    expect(shop.buyCard(card, key)).toBe(false);
    expect(stateDigest(defaultGameSession)).toBe(after);
    mutateGameplayForTest((draft) => setGold(draft, 0));
    const second = activity.data.cards[1]!;
    const poor = stateDigest(defaultGameSession);
    expect(shop.buyCard(second, cardSlotKeyOf(second, 1))).toBe(false);
    expect(stateDigest(defaultGameSession)).toBe(poor);
  });

  it("locks a claimed reward and rejects stale and duplicate claims", () => {
    const { flow } = start();
    mutateGameplayForTest((draft) =>
      setBattleState(draft, { ...readBattle(defaultGameSession).battleState, enemyHealth: 0 }),
    );
    flow.handleBattleVictory();
    const before = stateDigest(defaultGameSession);
    expect(claimRunReward("not-offered", defaultGameSession)).toBeNull();
    expect(stateDigest(defaultGameSession)).toBe(before);
    const reward = readRunSession(defaultGameSession).rewardFlow.state;
    const choice = reward.choices[0];
    const id = choice ? getRewardChoiceId(choice) : null;
    expect(claimRunReward(id, defaultGameSession)).not.toBeNull();
    const after = stateDigest(defaultGameSession);
    expect(claimRunReward(id, defaultGameSession)).toBeNull();
    expect(stateDigest(defaultGameSession)).toBe(after);
  });

  it("settles mystery once even with an empty deck and preserves homestead upgrades", () => {
    const { flow } = start();
    // Targeted setup, deliberately separate from earned-career sampling.
    mutateGameplayForTest((draft) => setScreen(draft, "destination"));
    initializeMysteryForTest(defaultGameSession);
    flow.beginMysteryEvent();
    mutateGameplayForTest((draft) => setRunDeck(draft, []));
    const visit = readRunSession(defaultGameSession).activity;
    if (visit.kind !== "mystery") throw new Error("Missing mystery");
    const choice = visit.data.mysteryEvent!.choices[0]!;
    flow.handleMysteryChoice(choice);
    const after = stateDigest(defaultGameSession);
    flow.handleMysteryChoice(choice);
    expect(stateDigest(defaultGameSession)).toBe(after);
    const building = buildings[0]!;
    mutateGameplayForTest((draft) => setMaterials(draft, building.tiers[0]!.cost));
    expect(mutateGameplayForTest((draft) => constructBuilding(draft, building.id))).toBe(true);
    expect(readRunProfile(defaultGameSession).constructedBuildings[building.id]).toBe(1);
  });

  it("resets allocated talents while preserving earned XP", () => {
    const talent = talentPool.find(
      (entry) => canUnlockTalent(entry.keywordId, entry.id, { [entry.keywordId]: 1000 }, {}).ok,
    )!;
    mutateGameplayForTest((draft) => applyTalentState(draft, { [talent.keywordId]: 1000 }, {}));
    mutateGameplayForTest((draft) => unlockTalent(draft, talent.keywordId, talent.id));
    expect(readRunProfile(defaultGameSession).unlockedTalents[talent.keywordId]).toContain(talent.id);
    mutateGameplayForTest((...args: Parameters<typeof resetUnlockedTalents>) => resetUnlockedTalents(...args));
    expect(readRunProfile(defaultGameSession).unlockedTalents).toEqual({});
    expect(readRunProfile(defaultGameSession).talentXP[talent.keywordId]).toBe(1000);
  });

  it("recovers an acknowledged run settlement without granting it twice", async () => {
    const fixture = createPlaythroughFixture("victory-v1", defaultGameSession);
    let bytes = JSON.stringify(fixture);
    configureSaveBackend(
      {
        readCandidates: () => Promise.resolve({ ok: true, candidates: [bytes] }),
        write: (_key, value) => {
          bytes = value;
          return Promise.resolve({ ok: true });
        },
        writeSync: (_key, value) => {
          bytes = value;
          return { ok: true };
        },
        clear: () => Promise.resolve({ ok: true }),
      },
      defaultGameSession,
    );
    hydrateAlchemyPersistenceFields(fixture, defaultGameSession);
    restoreRun(fixture.activeRun, fixture.talentXP, fixture.unlockedTalents, defaultGameSession);
    const { flow } = createPlaythroughController(defaultGameSession);
    flow.handleBattleVictory();
    while (readRunSession(defaultGameSession).activity.kind === "rewards") {
      const choice = readRunSession(defaultGameSession).rewardFlow.state.choices[0];
      if (choice) flow.claimRewardChoice(getRewardChoiceId(choice));
      else flow.skipRewards();
    }
    // Observe the production run-end fast path; do not trigger a final save.
    await vi.waitFor(() => expect(JSON.parse(bytes).activeRun).toBeNull());
    const committed = bytes;
    await resetStorageIoForTests(defaultGameSession);
    resetAllTestStores();
    configureSaveBackend(
      {
        readCandidates: () => Promise.resolve({ ok: true, candidates: [committed] }),
        write: () => Promise.resolve({ ok: true }),
        writeSync: () => ({ ok: true }),
        clear: () => Promise.resolve({ ok: true }),
      },
      defaultGameSession,
    );
    const loaded = await loadAlchemySaveState(defaultGameSession);
    hydrateAlchemyPersistenceFields(loaded.data, defaultGameSession);
    restoreRun(loaded.data.activeRun, loaded.data.talentXP, loaded.data.unlockedTalents, defaultGameSession);
    const before = snapshotCareer(defaultGameSession);
    createPlaythroughController(defaultGameSession).flow.handleBattleDefeat();
    expect(snapshotCareer(defaultGameSession)).toEqual(before);
  });

  it("loads only acknowledged bytes after an interruption and does not force a final save", async () => {
    let bytes = JSON.stringify(createDefaultSaveData());
    configureSaveBackend(
      {
        readCandidates: () => Promise.resolve({ ok: true, candidates: [bytes] }),
        write: (_key, value) => {
          bytes = value;
          return Promise.resolve({ ok: true });
        },
        writeSync: (_key, value) => {
          bytes = value;
          return { ok: true };
        },
        clear: () => Promise.resolve({ ok: true }),
      },
      defaultGameSession,
    );
    const lifecycle = createAlchemyAutosaveLifecycle(undefined, undefined, defaultGameSession);
    start();
    await lifecycle.drain();
    const checkpoint = bytes;
    mutateGameplayForTest((draft) => setGold(draft, 123));
    lifecycle.dispose(false);
    expect(bytes).toBe(checkpoint);
    const loaded = await loadAlchemySaveState(defaultGameSession);
    hydrateAlchemyPersistenceFields(loaded.data, defaultGameSession);
    restoreRun(loaded.data.activeRun, loaded.data.talentXP, loaded.data.unlockedTalents, defaultGameSession);
    expect(readRunProfile(defaultGameSession).gold).toBe(loaded.data.gold);
    expect(readActiveRun(defaultGameSession).rng).toEqual(loaded.data.activeRun!.rng);
    // Restore rehydrates catalog metadata; compare every persisted combat field
    // through the save parser rather than comparing wire cards to runtime cards.
    expect(savedActivityData(parseActiveRun(snapshotCareer(defaultGameSession).activeRun), "battle")).toEqual(
      JSON.parse(JSON.stringify(savedActivityData(loaded.data.activeRun!, "battle"))),
    );
  });
});
