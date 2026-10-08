import { makeActiveRunData } from "./active-run-data-fixture";
import { savedActivityFixture, savedActivityData } from "../../../../fixtures/run-activity";
import "../../../../helpers/mock-audio";

import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultBattleState } from "@/lib/battle";
import { cardLibrary, getCardKeywords } from "@/lib/game-data";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";

import { createEmptyRewardState, emptyEquipmentShopState, emptyShopState } from "@/lib/active-run-session";
import { canEnterLabyrinthNode, withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/rng";
import { ROUTE_SCREENS } from "@/lib/routing";
import { decodeRunResumeSnapshot } from "@/features/alchemy/shared/stores/run-resume-codec";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-profile-codec";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  setCompanionRewardCards,
  setEquipmentShopState,
  setRewardState,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";

import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";
beforeEach(() => {
  resetRunDomainStore();
});

function startLabyrinthRun(): void {
  setRunProgress({ characterId: "knight", contentSystemType: "labyrinth" });
  setRunSession({
    hasActiveRun: true,
    activity: { kind: "rewards" },
    labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
    activeLabyrinthModifiers: ["septic"],
    activeLabyrinthRewardModifiers: ["generous"],
  });
}

describe("labyrinth modifier persistence", () => {
  it("retains grid geography, a backtracked location and pending travel across save and restore", () => {
    startLabyrinthRun();
    const map = structuredClone(readRunSession(defaultGameSession).labyrinthMap!);
    const target = Object.values(map.nodes).find((node) => canEnterLabyrinthNode(map, node.id))!;
    const completed = withClearedNode(map, target.id);
    const backtracked = { ...completed, currentNodeId: map.currentNodeId };
    const pending = Object.values(backtracked.nodes).find((node) => canEnterLabyrinthNode(backtracked, node.id))!;
    setRunSession({ labyrinthMap: backtracked, activeLabyrinthPendingNode: pending.id });
    const snap = snapshotRun(defaultGameSession);
    expect(snap.labyrinthMap?.currentNodeId).toBe(map.currentNodeId);
    expect(snap.labyrinthMap?.nodes[target.id]?.cleared).toBe(true);
    const decoded = decodeRunResumeSnapshot(snap);
    expect(decoded.session.labyrinthMap).toEqual(backtracked);
    expect(decoded.session.labyrinthPendingNode).toBe(pending.id);
  });
  it("keeps expedition twists on saves made outside combat", () => {
    startLabyrinthRun();

    const snap = snapshotRun(defaultGameSession);
    expect(savedActivityData(snap, "battle")).toBeNull();
    expect(snap.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(snap.activeLabyrinthRewardModifiers).toEqual(["generous"]);

    const decoded = decodeRunResumeSnapshot(snap);
    expect(decoded.session.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(decoded.session.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });
});

describe("homestead hydrate parity", () => {
  it("prunes unknown companions on load like live mutations do", () => {
    const defaults = runProfilePersistenceCodec.createDefault();
    const fields = {
      ...defaults,
      bondedCompanions: { "no-such-companion": 1 } as unknown as typeof defaults.bondedCompanions,
    };
    dispatchGameplayCommand(
      (draft) => acceptCommand(runProfilePersistenceCodec.hydrate(fields, draft)),
      undefined,
      defaultGameSession,
    );
    expect(readGameplayState(defaultGameSession).runProfile.bondedCompanions).toEqual({});
  });

  it("rebinds live run health when homestead loads", () => {
    setRunSession({ hasActiveRun: true });
    const before = readActiveRun(defaultGameSession).runMetaMaxHealth;
    const defaults = runProfilePersistenceCodec.createDefault();
    dispatchGameplayCommand(
      (draft) =>
        acceptCommand(
          runProfilePersistenceCodec.hydrate(
            { ...defaults, plantedFarms: { ...defaults.plantedFarms, "chicken-coop": 1 } },
            draft,
          ),
        ),
      undefined,
      defaultGameSession,
    );
    expect(readActiveRun(defaultGameSession).runMetaMaxHealth).toBe(before + 5);
  });
});

describe("interrupted mid-claim rewards", () => {
  it("resumes only the bonus after the primary reward has committed", () => {
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"))!;
    setRunSession({
      hasActiveRun: true,
      activity: { kind: "rewards" },
      rewardState: { ...createEmptyRewardState(), rewardType: "card", choices: [primary], gold: 7 },
      companionRewardCards: [companion],
    });
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo: vi.fn() }), defaultGameSession);
    handlers.claimRewardChoice(primary.id);
    expect(readRunSession(defaultGameSession).rewardFlow.claim.kind === "reward").toBe(true);
    const claimedDeck = readActiveRun(defaultGameSession).runDeck;

    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity.kind).toBe("rewards");
    if (snap.activity.kind === "rewards") {
      expect(snap.activity.data.rewardType).toBe("card");
      if (snap.activity.data.rewardType === "card") {
        expect(snap.activity.data.choiceIds).toEqual([companion.id]);
      }
      expect(snap.activity.data.companionChoiceIds).toEqual([]);
      expect(snap.activity.data.gold).toBe(0);
    }

    dispatchGameplayCommand(
      (draft) => {
        setRewardState(draft, createEmptyRewardState());
        setCompanionRewardCards(draft, null);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    restoreRun(snap, {}, {}, defaultGameSession);

    const restored = readRunSession(defaultGameSession).rewardFlow.state;
    expect(restored.rewardType).toBe("card");
    if (restored.rewardType === "card") {
      expect(restored.choices.map((choice) => choice.id)).toEqual([companion.id]);
    }
    expect(restored.materials).toEqual(emptyInventory());
    expect(readRunSession(defaultGameSession).rewardFlow.companionCards).toBeNull();
    handlers.skipRewards();
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(claimedDeck);
  });
});

describe.each(["companion", "archery", "wish", "nature"] as const)("%s bonus reward resume", (theme) => {
  const bonuses = cardLibrary
    .filter((card) =>
      theme === "companion"
        ? card.effects.some((effect) => effect.kind === "summon-companion")
        : getCardKeywords(card).includes(theme) && !card.effects.some((effect) => effect.kind === "summon-companion"),
    )
    .slice(0, 3);

  it.each([false, true])("preserves choices when the bonus is displayed: %s", (bonusDisplayed) => {
    expect(bonuses.length).toBeGreaterThan(0);
    startLabyrinthRun();
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    const choices = bonusDisplayed ? bonuses : [primary];
    setRunSession({
      rewardState: { ...createEmptyRewardState(), choices },
      companionRewardCards: bonusDisplayed ? null : bonuses,
    });
    const snap = snapshotRun(defaultGameSession);
    resetRunDomainStore();
    restoreRun(snap, {}, {}, defaultGameSession);

    expect(readGameplayState(defaultGameSession).run.navigation.screen).toBe(ROUTE_SCREENS.REWARDS);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
    expect(readRunSession(defaultGameSession).rewardFlow.state.choices).toEqual(choices);
    expect(readRunSession(defaultGameSession).rewardFlow.companionCards).toEqual(bonusDisplayed ? null : bonuses);
    expect(readActiveRun(defaultGameSession).rng).toEqual(snap.rng);
  });
});

describe("primary reward resume", () => {
  it("preserves victory gold and materials when primary choices are unavailable but destinations remain", () => {
    startLabyrinthRun();
    setRunSession({
      rewardState: {
        ...createEmptyRewardState(["Card Shop"]),
        choices: [{ ...cardLibrary.find((card) => card.id === "slash")!, id: "no-such-primary-card" }],
        selectedId: "no-such-primary-card",
        gold: 7,
        materials: { ...emptyInventory(), wood: 3 },
        lastVictoryContentSystem: "labyrinth",
        lastVictoryEnemyType: "elite",
      },
      companionRewardCards: null,
    });
    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity.kind).toBe("rewards");
    resetRunDomainStore();
    restoreRun(snap, {}, {}, defaultGameSession);

    expect(readGameplayState(defaultGameSession).run.navigation.screen).toBe(ROUTE_SCREENS.REWARDS);
    const restored = readRunSession(defaultGameSession).rewardFlow.state;
    expect(restored.destinations).toEqual(["Card Shop"]);
    expect(restored.gold).toBe(7);
    expect(restored.materials).toEqual({ ...emptyInventory(), wood: 3 });
    expect(restored.lastVictoryContentSystem).toBe("labyrinth");
    expect(restored.lastVictoryEnemyType).toBe("elite");
    const retrySnapshot = snapshotRun(defaultGameSession);
    resetRunDomainStore();
    restoreRun(retrySnapshot, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).rewardFlow.state).toEqual(restored);
    const materialsBefore = readActiveRun(defaultGameSession).runMaterialsEarned.wood;
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo: vi.fn() }), defaultGameSession);
    handlers.skipRewards();
    handlers.skipRewards();
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.wood).toBe(materialsBefore + 3);
  });
});

describe("shop persistence", () => {
  it("keeps only the latest shop visit even while an earlier screen is displayed", () => {
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand(
      (draft) => {
        setShopState(draft, emptyShopState());
        setEquipmentShopState(draft, emptyEquipmentShopState());

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity.kind).toBe("equipment-shop");
    expect(savedActivityData(snap, "shop")).toBeNull();
    expect(savedActivityData(snap, "alchemist")).toBeNull();
    expect(savedActivityData(snap, "trinket-shop")).toBeNull();
    expect(savedActivityData(snap, "equipment-shop")).not.toBeNull();
    restoreRun(snap, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("equipment-shop");
  });

  it("serializes no shop when no visit is active", () => {
    setRunSession({ hasActiveRun: true });
    const snapshot = snapshotRun(defaultGameSession);
    expect(snapshot).toMatchObject({ activity: savedActivityFixture("destination") });
  });
});

describe("wildwood starter drafts", () => {
  it("does not resume wildwood starter choices", () => {
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    setRunProgress({ characterId: "knight", contentSystemType: "wildwood" });
    setRunSession({ hasActiveRun: true, starterDraftChoices: [primary] });

    const snap = snapshotRun(defaultGameSession);
    expect(snap.starterDraftChoices).toBeNull();
  });
});

describe("victory-handoff persistence", () => {
  it("keeps the terminal battle until its outcome is settled", () => {
    setRunProgress({ characterId: "knight", contentSystemType: "campaign" });
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand(
      (draft) => {
        initializeActiveBattle(draft, { ...defaultBattleState(), enemyHealth: 0 });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    const snap = snapshotRun(defaultGameSession);
    // Without the combat shell the continuation would be lost with it.
    expect(savedActivityData(snap, "battle")?.battleState.enemyHealth).toBe(0);

    const decoded = decodeRunResumeSnapshot(snap);
    expect(decoded.session.activity.kind).toBe("battle");

    resetRunDomainStore();
    restoreRun(snap, {}, {}, defaultGameSession);
    expect(readBattle(defaultGameSession).battleState.enemyHealth).toBe(0);
  });
});

it.each([
  "shop",
  "alchemist",
  "trinket-shop",
  "equipment-shop",
  "campfire",
  "transmutation",
  "corruption",
  "mystery",
  "rewards",
  "destination",
  "labyrinth-map",
  "wildwood-removal",
  "draft-deck",
  "difficulty-select",
] as const)("decodes the saved %s location without navigation initialization", (screen) => {
  const saved = makeActiveRunData({ activity: savedActivityFixture(screen) });
  const first = decodeRunResumeSnapshot(saved);
  const second = decodeRunResumeSnapshot(saved);
  expect(first.session.activity.kind).toBe(screen);
  if ("data" in first.session.activity && first.session.activity.data !== null) {
    expect(first.session.activity).toEqual(second.session.activity);
  }
});
