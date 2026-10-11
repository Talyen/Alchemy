import { beforeEach, describe, expect, it } from "vitest";
import { createCareerActor } from "@/app/playthrough/actor";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { snapshotCareer, stateDigest } from "@/app/playthrough/career";
import { createCareerResult } from "@/app/playthrough/career-evidence";
import { recordBrewingObservation, recordBrewingCommit, summarizeBrewing } from "@/app/playthrough/brewing-evidence";
import { comparePlaythroughReports } from "@/app/playthrough/report";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { brewCandidates, shouldPreserveConsumable, potionPurchaseScore } from "@/app/playthrough/brewing-policy";
import type { CareerConfig } from "@/app/playthrough/types";
import { cardSlotKeyOf } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { initializeAlchemyVisit } from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import {
  applyTalentState,
  setGold,
  setRunDeck,
  setRunPlayerHealth,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { hydrateAlchemyPersistenceFields } from "@/features/alchemy/shared/storage";
import { restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { cardById, cloneBattleCard } from "@/lib/game-data";
import { setBattleState } from "@/features/alchemy/shared/stores/write/run-battle";
import { createBattleState, isAttackCard } from "@/lib/battle";
import { enemyById } from "@/lib/game-data";
import { defaultGameSession as session } from "@/app/application-session";
import { resetAllTestStores } from "../helpers/run-domain-store-test";
import { resetStorageIoForTests } from "@/features/alchemy/shared/storage/io";

const config: CareerConfig = {
  seed: 42,
  hero: "knight",
  mode: "campaign",
  difficulty: "difficulty-1",
  runs: 1,
  horizon: 12,
  maxSteps: 10000,
  maxTurns: 100,
  policy: "archetype",
  combatPolicy: "greedy-effective-damage",
  brewing: "on",
};
const cards = (...ids: string[]) => ids.map((id) => cloneBattleCard(cardById[id]!));

beforeEach(async () => {
  await resetStorageIoForTests(session);
  resetAllTestStores();
});

function start(deck = cards("health-potion", "acid-potion"), gold = 100) {
  const controller = createPlaythroughController(session);
  controller.flow.goToScreen("game-mode-select");
  controller.flow.beginCampaign();
  controller.flow.handleCharacterSelect("knight");
  dispatchGameplayCommand(
    (draft) => {
      setRunDeck(draft, deck);
      setGold(draft, gold);
      return acceptCommand();
    },
    undefined,
    session,
  );
  return controller;
}

describe("headless brewing through production commands", () => {
  it("previews without RNG mutation, mixes with real pricing, and preserves the shared service limit after resume", () => {
    const controller = start();
    controller.shop().alchemist.initialize();
    const actor = createCareerActor(config, undefined, session);
    const before = stateDigest(session);
    const offered = actor.observe();
    expect(stateDigest(session)).toBe(before);
    expect(actor.observe()).toEqual(offered);
    const mix = offered.find((c) => c.kind === "mix")!;
    const price = controller.shop().alchemist.getMixPrice();
    const result = createCareerResult(config, snapshotCareer(session));
    const visit = recordBrewingObservation(result, actor.brewingObservation(), 0);
    recordBrewingObservation(result, actor.brewingObservation(), 0);
    const gold = readRunProfile(session).gold;
    const brewed = actor.execute(mix);
    recordBrewingCommit(visit, 0, mix, { gold, deckSize: 2 }, brewed, session);
    expect(readActiveRun(session).runDeck).toHaveLength(1);
    expect(readRunProfile(session).gold).toBe(gold - price);
    expect(actor.observe().some((c) => c.kind === "distill" || c.kind === "mix")).toBe(false);
    expect(controller.shop().alchemist.strengthenPotion(0)).toBeNull();
    expect(summarizeBrewing([result])).toMatchObject({ shopVisits: 1, goldSpent: price });
    expect(visit?.decisions[0]).toMatchObject({ kind: "mix", deckDelta: -1 });
    expect(visit?.decisions[0]?.result).toContain("Consume");
    const saved = snapshotCareer(session);
    hydrateAlchemyPersistenceFields(saved, session);
    restoreRun(saved.activeRun, saved.talentXP, saved.unlockedTalents, session);
    expect(readActiveRun(session).runDeck).toHaveLength(1);
    expect(
      createCareerActor(config, undefined, session)
        .observe()
        .some((c) => c.kind === "mix" || c.kind === "distill"),
    ).toBe(false);
  });

  it("distills, rejects stale targets and unaffordable services, and keeps service Gold reserved when buying", () => {
    const controller = start(cards("acid-potion"), 40);
    controller.shop().alchemist.initialize();
    const actor = createCareerActor(config, undefined, session);
    const options = actor.observe();
    expect(options.find((c) => c.kind === "distill")?.score).toBeGreaterThan(0);
    expect(options.filter((c) => c.kind === "buy-potion").every((c) => c.score < 0)).toBe(true);
    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 0)), undefined, session);
    const poorBeforeService = stateDigest(session);
    expect(actor.observe().some((choice) => choice.kind === "mix" || choice.kind === "distill")).toBe(false);
    expect(controller.shop().alchemist.strengthenPotion(0)).toBeNull();
    expect(stateDigest(session)).toBe(poorBeforeService);
    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 40)), undefined, session);
    actor.observe();
    const before = stateDigest(session);
    expect(controller.shop().alchemist.mixPotions(0, 9)).toBeNull();
    expect(stateDigest(session)).toBe(before);
    const distilled = actor.execute(options.find((c) => c.kind === "distill")!) as (typeof cardById)[string];
    expect(distilled.descriptionLines).not.toEqual(cardById["acid-potion"]!.descriptionLines);
    expect(readRunProfile(session).gold).toBe(0);
    controller.shop().alchemist.initialize();
    expect(actor.observe().some((c) => c.kind === "mix" || c.kind === "distill")).toBe(false);
    const poor = stateDigest(session);
    expect(controller.shop().alchemist.strengthenPotion(0)).toBeNull();
    expect(stateDigest(session)).toBe(poor);
  });

  it("uses discounted service prices rather than an assumed base cost", () => {
    const controller = start(cards("acid-potion"), 30);
    dispatchGameplayCommand(
      (draft) => {
        applyTalentState(draft, readRunProfile(session).talentXP, { gold: ["gold-mix-discount"] });
        return acceptCommand();
      },
      undefined,
      session,
    );
    controller.shop().alchemist.initialize();
    expect(controller.shop().alchemist.getMixPrice()).toBe(30);
    const actor = createCareerActor(config, undefined, session);
    actor.execute(actor.observe().find((c) => c.kind === "distill")!);
    expect(readRunProfile(session).gold).toBe(0);
  });

  it("offers useful refreshes and respects exhausted refreshes", () => {
    const controller = start(cards("slash"), 100);
    controller.shop().alchemist.initialize();
    dispatchGameplayCommand(
      (draft) => {
        const activity = readRunSession(session).activity;
        if (activity.kind !== "alchemist") throw new Error("Expected shop");
        setRunActivityData(draft, "alchemist", {
          ...activity.data,
          purchasedSlotKeys: activity.data.potions.map((card, index) => cardSlotKeyOf(card, index)),
        });
        return acceptCommand();
      },
      undefined,
      session,
    );
    const actor = createCareerActor(config, undefined, session);
    const refresh = actor.observe().find((c) => c.kind === "alchemist-refresh")!;
    expect(refresh.score).toBeGreaterThan(0);
    const refreshPrice = controller.shop().alchemist.getRefreshPrice(1);
    actor.execute(refresh);
    expect(readRunProfile(session).gold).toBe(100 - refreshPrice);
    expect(actor.observe().some((c) => c.kind === "alchemist-refresh")).toBe(false);
  });

  it("declines weaker copies and searches inferior stock only with potion room and purchase Gold", () => {
    const controller = start(cards("slash"), 100);
    controller.shop().alchemist.initialize();
    const activity = readRunSession(session).activity;
    if (activity.kind !== "alchemist") throw new Error("Expected shop");
    const stronger = activity.data.potions.map((card) => strengthenPotion(card)!);
    expect(stronger).toHaveLength(3);
    dispatchGameplayCommand(
      (draft) => {
        setRunDeck(draft, stronger);
        setRunActivityData(draft, "alchemist", { ...activity.data, mixUsed: true });
        return acceptCommand();
      },
      undefined,
      session,
    );
    const actor = createCareerActor(config, undefined, session);
    const before = stateDigest(session);
    let choices = actor.observe();
    expect(stateDigest(session)).toBe(before);
    expect(choices.filter((choice) => choice.kind === "buy-potion").every((choice) => choice.score < 0)).toBe(true);
    expect(choices.find((choice) => choice.kind === "alchemist-refresh")?.score).toBeGreaterThan(0);
    expect(actor.brewingObservation()?.opportunities.find((o) => o.kind === "refresh")?.reason).toBe(
      "seek-better-stock",
    );
    const reserve = Math.min(
      ...activity.data.potions.map((card) => controller.shop().alchemist.getPotionBuyPrice(card)),
    );
    const refreshPrice = controller.shop().alchemist.getRefreshPrice(1);
    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, refreshPrice + reserve - 1)), undefined, session);
    choices = actor.observe();
    expect(choices.find((choice) => choice.kind === "alchemist-refresh")?.score).toBeLessThan(0);
    expect(actor.brewingObservation()?.opportunities.find((o) => o.kind === "refresh")?.reason).toBe(
      "purchase-reserve",
    );
    dispatchGameplayCommand(
      (draft) => {
        setGold(draft, 100);
        setRunDeck(draft, [...stronger, cloneBattleCard(cardById["health-potion"]!)]);
        return acceptCommand();
      },
      undefined,
      session,
    );
    choices = actor.observe();
    expect(choices.find((choice) => choice.kind === "alchemist-refresh")?.score).toBeLessThan(0);
    expect(actor.brewingObservation()?.opportunities.find((o) => o.kind === "refresh")?.reason).toBe("potion-cap");
    expect(potionPurchaseScore(cardById["acid-potion"]!, [strengthenPotion(cardById["acid-potion"]!)!])).toBeLessThan(
      0,
    );
    expect(
      potionPurchaseScore(cardById["health-potion"]!, [strengthenPotion(cardById["acid-potion"]!)!]),
    ).toBeGreaterThan(0);
  });

  it.each(["new", "combine"] as const)("brews %s at campfire, survives save/resume, and cannot also rest", (kind) => {
    start(kind === "new" ? cards("slash") : cards("health-potion", "acid-potion"));
    initializeAlchemyVisit("campfire", session);
    const actor = createCareerActor(config, undefined, session);
    const choice = actor.observe().find((c) => c.kind === (kind === "new" ? "campfire-new" : "campfire-mix"))!;
    actor.execute(choice);
    const visit = readRunSession(session).activity;
    expect(visit.kind === "campfire" && visit.data.completed).toBe(true);
    const saved = snapshotCareer(session);
    hydrateAlchemyPersistenceFields(saved, session);
    restoreRun(saved.activeRun, saved.talentXP, saved.unlockedTalents, session);
    expect(createPlaythroughController(session).alchemy.restAtCampfire()).toBe(false);
    expect(
      createCareerActor(config, undefined, session)
        .observe()
        .map((c) => c.kind),
    ).toEqual(["campfire"]);
    const restored = readRunSession(session).activity;
    expect(restored.kind === "campfire" && restored.data.offers).toEqual(
      visit.kind === "campfire" && visit.data.offers,
    );
  });

  it("prioritizes survival, distinguishes disabled brewing, and skips unchanged distillation", () => {
    start();
    initializeAlchemyVisit("campfire", session);
    dispatchGameplayCommand(
      (draft) => {
        setRunPlayerHealth(draft, 1);
        return acceptCommand();
      },
      undefined,
      session,
    );
    const actor = createCareerActor(config, undefined, session);
    const choices = actor.observe();
    expect(choices.find((c) => c.score === Math.max(...choices.map((c) => c.score)))?.kind).toBe("campfire");
    const disabled = createCareerActor({ ...config, brewing: "off" }, undefined, session);
    expect(disabled.observe().some((c) => c.kind.startsWith("campfire-"))).toBe(false);
    expect(disabled.brewingObservation()?.opportunities[0]?.reason).toBe("disabled");
    const unchanged = {
      ...cloneBattleCard(cardById["panacea-potion"]!),
      effects: [{ kind: "remove-enemy-armor" as const, halve: true }],
    };
    expect(brewCandidates([unchanged], 0).some((c) => c.kind === "distill")).toBe(false);
  });
});

describe("consumable preservation and paired evidence", () => {
  it("keeps full-Health healing and unnecessary cleanses but recognizes active Consume rewards", () => {
    const state = createBattleState({
      runDeck: cards("health-potion"),
      currentEnemy: enemyById.skeleton!,
      playerHealth: 30,
    });
    expect(shouldPreserveConsumable(cardById["health-potion"]!, state)).toBe(true);
    expect(shouldPreserveConsumable(cardById["panacea-potion"]!, state)).toBe(true);
    expect(shouldPreserveConsumable(cardById["health-potion"]!, { ...state, playerHealth: 1 })).toBe(false);
    expect(
      shouldPreserveConsumable(cardById["panacea-potion"]!, {
        ...state,
        talentEffects: { ...state.talentEffects, poisonOnConsume: 1 },
      }),
    ).toBe(false);
  });

  it("actually plays an attack after two defensive turns without sacrificing initial emergency defense", () => {
    const deck = cards("mana-shield", "caustic-jab", "poison-dagger", "predators-focus");
    start(deck);
    const base = createBattleState({
      runDeck: deck,
      currentEnemy: enemyById.skeleton!,
      playerHealth: 23,
      maxHealth: 86,
      rng: () => 0.5,
    });
    dispatchGameplayCommand(
      (draft) => {
        setBattleState(draft, {
          ...base,
          mana: 7,
          maxMana: 7,
          enemyHealth: 417,
          enemyMaxHealth: 1242,
          playerStatuses: { ...base.playerStatuses, armor: 228 },
        });
        return acceptCommand();
      },
      undefined,
      session,
    );
    const actor = createCareerActor(config, undefined, session);
    const best = () => {
      const choices = actor.observe();
      return choices.reduce((selected, choice) => (choice.score > selected.score ? choice : selected));
    };
    for (let turn = 0; turn < 2; turn++) {
      const choice = best();
      expect(choice.id).toBe("mana-shield");
      expect(actor.observe()).toEqual(actor.observe());
      actor.execute(choice);
      expect(best().kind).toBe("end-turn");
      actor.execute(best());
    }
    let attacked = false;
    for (let action = 0; action < 4 && !attacked; action++) {
      const choice = best();
      expect(choice.kind).toBe("play");
      expect(choice.id).not.toBe("mana-shield");
      attacked = isAttackCard(cardById[choice.id]!);
      actor.execute(choice);
    }
    expect(attacked).toBe(true);
  });

  it("allows only the explicit brewing treatment difference in paired comparisons", () => {
    start();
    const baseline = createCareerResult({ ...config, brewing: "off" }, snapshotCareer(session));
    baseline.status = "completed";
    baseline.outcomes = [{ outcome: "defeat", rooms: 9, gold: 1, steps: 1 }];
    const current = { ...baseline, config: { ...baseline.config, brewing: "on" as const } };
    expect(() => comparePlaythroughReports([baseline], [current])).toThrow("same ordered");
    expect(
      comparePlaythroughReports([baseline], [current], "brewing")[0]?.metrics.find((m) => m.metric === "rooms")
        ?.meanDelta,
    ).toBe(0);
    expect(() =>
      comparePlaythroughReports([baseline], [{ ...current, config: { ...current.config, seed: 99 } }], "brewing"),
    ).toThrow("same ordered");
    expect(() => comparePlaythroughReports([baseline], [baseline], "brewing")).toThrow("explicit on/off");
    expect(() => comparePlaythroughReports([baseline], [{ ...current, status: "incomplete" }], "brewing")).toThrow(
      "incomplete",
    );
  });
});
