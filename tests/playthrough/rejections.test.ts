import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaythroughFixture } from "@/app/playthrough/fixtures";
import {
  resetUnlockedTalents,
  unlockTalent,
  applyTalentState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { talentPool, canUnlockTalent } from "@/lib/game-data";
import { resetAllTestStores } from "../helpers/run-domain-store-test";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle, readRunSession, readRunProfile, readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { setGold, setMaterials, setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setBattleState } from "@/features/alchemy/shared/stores/write/run-battle";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { commitCardPlay } from "@/features/alchemy/shared/stores/battle-commands";
import { cardSlotKeyOf } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { claimRunReward } from "@/features/alchemy/run-loop/run/reward-commands";
import { getRewardChoiceId } from "@/lib/active-run-session";
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

beforeEach(async () => {
  await resetStorageIoForTests();
  resetAllTestStores();
});
function start() {
  const controller = createPlaythroughController();
  controller.flow.goToScreen("game-mode-select");
  controller.flow.beginCampaign();
  controller.flow.handleCharacterSelect("knight");
  return controller;
}

describe("retained headless rejection and persistence contracts", () => {
  it("rejects stale combat choices without consuming world RNG", () => {
    start();
    const before = stateDigest();
    expect(commitCardPlay(0, "not-offered")).toBeNull();
    expect(stateDigest()).toBe(before);
  });

  it("rejects repeated and unaffordable shop purchases without duplicate grants", () => {
    const controller = start();
    const shop = controller.shop().merchant;
    shop.initialize();
    const activity = readRunSession().activity;
    if (activity.kind !== "shop") throw new Error("Shop not initialized");
    const card = activity.data.cards[0]!;
    const key = cardSlotKeyOf(card, 0);
    dispatchRunSessionCommand((draft) => setGold(draft, 10000));
    expect(shop.buyCard(card, key)).toBe(true);
    const after = stateDigest();
    expect(shop.buyCard(card, key)).toBe(false);
    expect(stateDigest()).toBe(after);
    dispatchRunSessionCommand((draft) => setGold(draft, 0));
    const second = activity.data.cards[1]!;
    const poor = stateDigest();
    expect(shop.buyCard(second, cardSlotKeyOf(second, 1))).toBe(false);
    expect(stateDigest()).toBe(poor);
  });

  it("locks a claimed reward and rejects stale and duplicate claims", () => {
    const { flow } = start();
    dispatchRunSessionCommand((draft) => setBattleState(draft, { ...readBattle().battleState, enemyHealth: 0 }));
    flow.handleBattleVictory();
    const before = stateDigest();
    expect(claimRunReward("not-offered")).toBeNull();
    expect(stateDigest()).toBe(before);
    const reward = readRunSession().rewardFlow.state;
    const choice = reward.choices[0];
    const id = choice ? getRewardChoiceId(choice) : null;
    expect(claimRunReward(id)).not.toBeNull();
    const after = stateDigest();
    expect(claimRunReward(id)).toBeNull();
    expect(stateDigest()).toBe(after);
  });

  it("settles mystery once even with an empty deck and preserves homestead upgrades", () => {
    const { flow } = start();
    // Targeted setup, deliberately separate from earned-career sampling.
    flow.goToScreen("menu");
    flow.goToScreen("destination");
    flow.beginMysteryEvent();
    dispatchRunSessionCommand((draft) => setRunDeck(draft, []));
    const visit = readRunSession().activity;
    if (visit.kind !== "mystery") throw new Error("Missing mystery");
    const choice = visit.data.mysteryEvent!.choices[0]!;
    flow.handleMysteryChoice(choice);
    const after = stateDigest();
    flow.handleMysteryChoice(choice);
    expect(stateDigest()).toBe(after);
    const building = buildings[0]!;
    dispatchRunSessionCommand((draft) => setMaterials(draft, building.tiers[0]!.cost));
    expect(dispatchRunSessionCommand((draft) => constructBuilding(draft, building.id))).toBe(true);
    expect(readRunProfile().constructedBuildings[building.id]).toBe(1);
  });

  it("resets allocated talents while preserving earned XP", () => {
    const talent = talentPool.find(
      (entry) => canUnlockTalent(entry.keywordId, entry.id, { [entry.keywordId]: 1000 }, {}).ok,
    )!;
    dispatchRunSessionCommand((draft) => applyTalentState(draft, { [talent.keywordId]: 1000 }, {}));
    dispatchRunSessionCommand((draft) => unlockTalent(draft, talent.keywordId, talent.id));
    expect(readRunProfile().unlockedTalents[talent.keywordId]).toContain(talent.id);
    dispatchRunSessionCommand(resetUnlockedTalents);
    expect(readRunProfile().unlockedTalents).toEqual({});
    expect(readRunProfile().talentXP[talent.keywordId]).toBe(1000);
  });

  it("recovers an acknowledged run settlement without granting it twice", async () => {
    const fixture = createPlaythroughFixture("victory-v1");
    let bytes = JSON.stringify(fixture);
    configureSaveBackend({
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
    });
    hydrateAlchemyPersistenceFields(fixture);
    restoreRun(fixture.activeRun, fixture.talentXP, fixture.unlockedTalents);
    const { flow } = createPlaythroughController();
    flow.handleBattleVictory();
    while (readRunSession().activity.kind === "rewards") {
      const choice = readRunSession().rewardFlow.state.choices[0];
      if (choice) flow.claimRewardChoice(getRewardChoiceId(choice));
      else flow.skipRewards();
    }
    // Observe the production run-end fast path; do not trigger a final save.
    await vi.waitFor(() => expect(JSON.parse(bytes).activeRun).toBeNull());
    const committed = bytes;
    await resetStorageIoForTests();
    resetAllTestStores();
    configureSaveBackend({
      readCandidates: () => Promise.resolve({ ok: true, candidates: [committed] }),
      write: () => Promise.resolve({ ok: true }),
      writeSync: () => ({ ok: true }),
      clear: () => Promise.resolve({ ok: true }),
    });
    const loaded = await loadAlchemySaveState();
    hydrateAlchemyPersistenceFields(loaded.data);
    restoreRun(loaded.data.activeRun, loaded.data.talentXP, loaded.data.unlockedTalents);
    const before = snapshotCareer();
    createPlaythroughController().flow.handleBattleDefeat();
    expect(snapshotCareer()).toEqual(before);
  });

  it("loads only acknowledged bytes after an interruption and does not force a final save", async () => {
    let bytes = JSON.stringify(createDefaultSaveData());
    configureSaveBackend({
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
    });
    const lifecycle = createAlchemyAutosaveLifecycle();
    start();
    await lifecycle.drain();
    const checkpoint = bytes;
    dispatchRunSessionCommand((draft) => setGold(draft, 123));
    lifecycle.dispose(false);
    expect(bytes).toBe(checkpoint);
    const loaded = await loadAlchemySaveState();
    hydrateAlchemyPersistenceFields(loaded.data);
    restoreRun(loaded.data.activeRun, loaded.data.talentXP, loaded.data.unlockedTalents);
    expect(readRunProfile().gold).toBe(loaded.data.gold);
    expect(readActiveRun().rng).toEqual(loaded.data.activeRun!.rng);
    expect(snapshotCareer().activeRun?.activeCombat).toEqual(
      JSON.parse(JSON.stringify(loaded.data.activeRun!.activeCombat)),
    );
  });
});
