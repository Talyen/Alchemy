import { isDeepStrictEqual } from "node:util";
import "../helpers/mock-audio";
import { createRunRngState } from "@/lib/rng";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import {
  initializeAlchemyVisit,
  brewAtCampfire,
  transmuteCard,
} from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
import { claimRunReward } from "@/features/alchemy/run-loop/run/reward-commands";
import { createAlchemistShopCommands } from "@/features/alchemy/run-loop/shop/alchemist-shop-commands";
import { snapshotRun, restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { parseActiveRun, createEmptyRewardState } from "@/lib/active-run-session";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { defaultGameSession } from "@/app/application-session";
import { resetAllTestStores, setRunProgress, setRunSession } from "../helpers/run-domain-store-test";
import { gridLabyrinthMapFixture } from "../fixtures/labyrinth-map";
import { defineSequenceFamily, requireProgress } from "./sequence";

defineSequenceFamily("visits", (seed) => {
  resetAllTestStores();
  const visit = (["campfire", "transmutation", "alchemist", "rewards"] as const)[seed % 4]!;
  const mode =
    visit === "rewards"
      ? (["campaign", "labyrinth", "wildwood"] as const)[Math.floor(seed / 4) % 3]!
      : (["campaign", "labyrinth"] as const)[Math.floor(seed / 4) % 2]!;
  setRunProgress({
    rng: createRunRngState(seed),
    characterId: "knight",
    contentSystemType: mode,
    gold: 80,
    runPlayerHealth: 10,
    runMaxHealth: 30,
    runDeck: [cardById.slash!, cardById["health-potion"]!],
  });
  setRunSession({
    ...(mode === "labyrinth" ? { labyrinthMap: gridLabyrinthMapFixture() } : {}),
    hasActiveRun: true,
    activity: { kind: "destination" },
  });
  if (visit === "campfire" || visit === "transmutation") initializeAlchemyVisit(visit, defaultGameSession);
  else if (visit === "alchemist")
    setRunSession({
      activity: {
        kind: "alchemist",
        data: {
          potions: [],
          mixUsed: false,
          refreshesLeft: 1,
          purchasedSlotKeys: [],
          firstPurchaseUsed: false,
          freeRefreshUsed: false,
        },
      },
    });
  else
    setRunSession({
      activity: { kind: "rewards" },
      ...(mode === "wildwood"
        ? { wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "reward" as const } }
        : {}),
      rewardState: {
        ...createEmptyRewardState(["Normal Combat"]),
        choices: [cardById.slash!],
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: mode,
      },
    });
  const alchemist = createAlchemistShopCommands(
    { talentEffects: computeTalentEffects({}), homesteadEffects: { mixPotionDiscount: 0 } },
    defaultGameSession,
  );
  let claimed: string | null = null;
  const observe = () => ({
    visit,
    mode,
    activity: readRunSession(defaultGameSession).activity,
    health: readActiveRun(defaultGameSession).runPlayerHealth,
    gold: readRunProfile(defaultGameSession).gold,
    deck: readActiveRun(defaultGameSession).runDeck.map((c) => ({ id: c.id, brewed: !!c.brewed })),
    claimed,
  });
  return {
    fixture: { visit, mode, seed, health: 10, gold: 80, deck: ["slash", "health-potion"] },
    actions: () => [
      "claim",
      "invalid-choice",
      "reload",
      ...(visit === "campfire" ? ["rest"] : []),
      ...(visit === "campfire" || visit === "transmutation" ? ["initialize"] : []),
    ],
    run(action) {
      const before = snapshotRun(defaultGameSession);
      const viewBefore = observe();
      if (action === "reload") {
        const parsed = parseActiveRun(JSON.parse(JSON.stringify(before)));
        requireProgress(parsed, "visit-snapshot-parse", before);
        const profile = readRunProfile(defaultGameSession);
        restoreRun(parsed, profile.talentXP, profile.unlockedTalents, defaultGameSession);
        requireProgress(isDeepStrictEqual(observe(), viewBefore), "visit-resume-parity", observe());
      } else if (action === "initialize" && (visit === "campfire" || visit === "transmutation"))
        initializeAlchemyVisit(visit, defaultGameSession);
      else {
        const invalid = action === "invalid-choice";
        let result: unknown;
        if (visit === "campfire")
          result =
            action === "rest"
              ? restAtCampfire(defaultGameSession)
              : brewAtCampfire({ kind: "new", offerIndex: invalid ? 99 : 0 }, defaultGameSession);
        if (visit === "transmutation") {
          const activity = readRunSession(defaultGameSession).activity;
          const index =
            activity.kind === "transmutation" ? (activity.data.offers?.findIndex((c) => c.id !== "slash") ?? -1) : -1;
          result = transmuteCard(invalid ? 99 : 0, index, defaultGameSession);
        }
        if (visit === "alchemist") result = alchemist.strengthenPotion(invalid ? 99 : 1);
        if (visit === "rewards") result = claimRunReward(invalid ? "not-offered" : "slash", defaultGameSession);
        if (claimed || invalid)
          requireProgress(!result && isDeepStrictEqual(observe(), viewBefore), "visit-exactly-once", observe());
        else {
          requireProgress(result, "visit-supported-choice", observe());
          claimed = action;
        }
      }
    },
    check() {
      const state = observe();
      const added = claimed === "claim" && (visit === "campfire" || visit === "rewards") ? 1 : 0;
      requireProgress(state.deck.length === 2 + added, "visit-deck-conservation", state);
      requireProgress(
        claimed === "rest" ? state.health > 10 : state.health === 10,
        "visit-mutually-exclusive-rewards",
        state,
      );
      if (visit === "alchemist") requireProgress(state.gold === (claimed ? 40 : 80), "visit-payment-once", state);
    },
    observe,
    settle() {},
    dispose() {},
  };
});
