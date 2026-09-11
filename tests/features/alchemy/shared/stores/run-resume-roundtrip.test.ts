import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultBattleState } from "@/lib/battle";
import { cardLibrary, getCardKeywords } from "@/lib/game-data";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";
import { finalizeRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { createEmptyRewardState, emptyEquipmentShopState, emptyShopState } from "@/lib/active-run-session";
import { canEnterLabyrinthNode, withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/utils";
import { ROUTE_SCREENS } from "@/lib/routing";
import { decodeRunResumeSnapshot, encodePersistedShops } from "@/features/alchemy/shared/stores/run-resume-codec";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-profile-codec";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  setCompanionRewardCards,
  setEquipmentShopState,
  setRewardState,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
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
    const map = structuredClone(readRunSession().labyrinthMap!);
    const target = Object.values(map.nodes).find((node) => canEnterLabyrinthNode(map, node.id))!;
    const completed = withClearedNode(map, target.id);
    const backtracked = { ...completed, currentNodeId: map.currentNodeId };
    const pending = Object.values(backtracked.nodes).find((node) => canEnterLabyrinthNode(backtracked, node.id))!;
    setRunSession({ labyrinthMap: backtracked, activeLabyrinthPendingNode: pending.id });
    const snap = snapshotRun(ROUTE_SCREENS.CAMPFIRE);
    expect(snap.labyrinthMap?.currentNodeId).toBe(map.currentNodeId);
    expect(snap.labyrinthMap?.nodes[target.id]?.cleared).toBe(true);
    const decoded = decodeRunResumeSnapshot(snap);
    expect(decoded.session.labyrinthMap).toEqual(backtracked);
    expect(decoded.session.labyrinthPendingNode).toBe(pending.id);
  });
  it("keeps expedition twists on saves made outside combat", () => {
    startLabyrinthRun();

    const snap = snapshotRun(ROUTE_SCREENS.LABYRINTH_MAP);
    expect(snap.activeCombat).toBeNull();
    expect(snap.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(snap.activeLabyrinthRewardModifiers).toEqual(["generous"]);

    const decoded = decodeRunResumeSnapshot(snap);
    expect(decoded.session.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(decoded.session.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });

  it("backfills twists from legacy combat parcels", () => {
    startLabyrinthRun();

    const snap = snapshotRun(ROUTE_SCREENS.LABYRINTH_MAP);
    const decoded = decodeRunResumeSnapshot({
      ...snap,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
      activeCombat: {
        battleState: defaultBattleState(),
        pendingBattleTransition: null,
        activeLabyrinthModifiers: ["septic"],
        activeLabyrinthRewardModifiers: ["generous"],
      },
    });
    expect(decoded.session.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(decoded.session.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });

  it("prefers expedition twists over divergent combat parcels", () => {
    startLabyrinthRun();

    const snap = snapshotRun(ROUTE_SCREENS.LABYRINTH_MAP);
    const decoded = decodeRunResumeSnapshot({
      ...snap,
      activeCombat: {
        battleState: defaultBattleState(),
        pendingBattleTransition: null,
        activeLabyrinthModifiers: ["caustic"],
        activeLabyrinthRewardModifiers: ["generous"],
      },
    });
    expect(decoded.session.activeLabyrinthModifiers).toEqual(["septic"]);
  });
});

describe("homestead hydrate parity", () => {
  it("prunes unknown companions on load like live mutations do", () => {
    const defaults = runProfilePersistenceCodec.createDefault();
    const fields = {
      ...defaults,
      bondedCompanions: { "no-such-companion": 1 } as unknown as typeof defaults.bondedCompanions,
    };
    dispatchRunSessionCommand((draft) => runProfilePersistenceCodec.hydrate(fields, draft));
    expect(readGameplayState().runProfile.bondedCompanions).toEqual({});
  });

  it("rebinds live run health when homestead loads", () => {
    setRunSession({ hasActiveRun: true });
    const before = readActiveRun().runMetaMaxHealth;
    const defaults = runProfilePersistenceCodec.createDefault();
    dispatchRunSessionCommand((draft) =>
      runProfilePersistenceCodec.hydrate(
        { ...defaults, plantedFarms: { ...defaults.plantedFarms, "chicken-coop": 1 } },
        draft,
      ),
    );
    expect(readActiveRun().runMetaMaxHealth).toBe(before + 5);
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
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo: vi.fn() }));
    handlers.claimRewardChoice(primary.id);
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(true);
    const claimedDeck = readActiveRun().runDeck;

    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow.kind).toBe("primary-reward");
    if (snap.interruptedFlow.kind === "primary-reward") {
      expect(snap.interruptedFlow.pending.rewardType).toBe("card");
      if (snap.interruptedFlow.pending.rewardType === "card") {
        expect(snap.interruptedFlow.pending.choiceIds).toEqual([companion.id]);
      }
      expect(snap.interruptedFlow.pending.companionChoiceIds).toEqual([]);
      expect(snap.interruptedFlow.pending.gold).toBe(0);
    }

    dispatchRunSessionCommand((draft) => {
      setRewardState(draft, createEmptyRewardState());
      setCompanionRewardCards(draft, null);
    });
    restoreRun(snap, {}, {});

    const restored = readRunSession().rewardFlow.state;
    expect(restored.rewardType).toBe("card");
    if (restored.rewardType === "card") {
      expect(restored.choices.map((choice) => choice.id)).toEqual([companion.id]);
    }
    expect(restored.materials).toEqual(emptyInventory());
    expect(readRunSession().rewardFlow.companionCards).toBeNull();
    handlers.skipRewards();
    expect(readActiveRun().runDeck).toEqual(claimedDeck);
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
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    resetRunDomainStore();
    restoreRun(snap, {}, {});

    expect(readGameplayState().run.navigation.screen).toBe(ROUTE_SCREENS.REWARDS);
    expect(readRunSession().hasActiveRun).toBe(true);
    expect(readRunSession().rewardFlow.state.choices).toEqual(choices);
    expect(readRunSession().rewardFlow.companionCards).toEqual(bonusDisplayed ? null : bonuses);
    expect(readActiveRun().rng).toEqual(snap.rng);
  });

  it("restores an interrupted bonus handoff when primary choices are unavailable without awarding loot", () => {
    expect(bonuses.length).toBeGreaterThan(0);
    startLabyrinthRun();
    setRunSession({
      rewardClaimInFlight: true,
      rewardState: {
        ...createEmptyRewardState(),
        choices: [{ ...bonuses[0]!, id: "no-such-primary-card" }],
        selectedId: "no-such-primary-card",
        gold: 7,
        materials: { ...emptyInventory(), wood: 3 },
        lastVictoryContentSystem: "labyrinth",
        lastVictoryEnemyType: "elite",
      },
      companionRewardCards: bonuses,
    });
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    // Older builds could persist an awarded primary bundle while its bonus handoff waited for a fade.
    if (snap.interruptedFlow.kind !== "primary-reward") throw new Error("Expected pending reward fixture");
    snap.interruptedFlow = { kind: "companion-reward", pending: snap.interruptedFlow.pending };
    resetRunDomainStore();
    const profileBefore = readGameplayState().runProfile;
    restoreRun(snap, {}, {});

    expect(readGameplayState().run.navigation.screen).toBe(ROUTE_SCREENS.REWARDS);
    expect(readRunSession().rewardFlow.state).toEqual({
      ...createEmptyRewardState(),
      choices: bonuses,
      lastVictoryContentSystem: "labyrinth",
      lastVictoryEnemyType: "elite",
    });
    expect(readRunSession().rewardFlow.companionCards).toBeNull();
    expect(readGameplayState().runProfile.gold).toBe(profileBefore.gold);
    expect(readGameplayState().runProfile.materialInventory).toEqual(profileBefore.materialInventory);
    expect(readActiveRun().runMaterialsEarned).toEqual(snap.runMaterialsEarned);
    expect(readActiveRun().rng).toEqual(snap.rng);
    expect(
      finalizeRewardState({ rewardState: readRunSession().rewardFlow.state, companionRewardCards: null }).materials,
    ).toEqual(emptyInventory());
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
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow.kind).toBe("primary-reward");
    resetRunDomainStore();
    restoreRun(snap, {}, {});

    expect(readGameplayState().run.navigation.screen).toBe(ROUTE_SCREENS.REWARDS);
    const restored = readRunSession().rewardFlow.state;
    expect(restored.destinations).toEqual(["Card Shop"]);
    expect(restored.gold).toBe(7);
    expect(restored.materials).toEqual({ ...emptyInventory(), wood: 3 });
    expect(restored.lastVictoryContentSystem).toBe("labyrinth");
    expect(restored.lastVictoryEnemyType).toBe("elite");
    const retrySnapshot = snapshotRun(ROUTE_SCREENS.REWARDS);
    resetRunDomainStore();
    restoreRun(retrySnapshot, {}, {});
    expect(readRunSession().rewardFlow.state).toEqual(restored);
    const materialsBefore = readActiveRun().runMaterialsEarned.wood;
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo: vi.fn() }));
    handlers.skipRewards();
    handlers.skipRewards();
    expect(readActiveRun().runMaterialsEarned.wood).toBe(materialsBefore + 3);
  });
});

describe("shop persistence", () => {
  it("keeps only the latest shop visit even while an earlier screen is displayed", () => {
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => {
      setShopState(draft, emptyShopState());
      setEquipmentShopState(draft, emptyEquipmentShopState());
    });
    const snap = snapshotRun(ROUTE_SCREENS.SHOP);
    expect(snap.currentScreen).toBe("equipment-shop");
    expect(snap.shopState).toBeNull();
    expect(snap.alchemistState).toBeNull();
    expect(snap.trinketShopState).toBeNull();
    expect(snap.equipmentShopState).not.toBeNull();
    restoreRun(snap, {}, {});
    expect(readRunSession().activity.kind).toBe("equipment-shop");
  });

  it("serializes no shop when no visit is active", () => {
    setRunSession({ hasActiveRun: true });
    const shops = encodePersistedShops(readRunSession());
    expect(shops).toEqual({ shopState: null, alchemistState: null, trinketShopState: null, equipmentShopState: null });
  });
});

describe("wildwood starter drafts", () => {
  it("does not resume wildwood starter choices", () => {
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    setRunProgress({ characterId: "knight", contentSystemType: "wildwood" });
    setRunSession({ hasActiveRun: true, starterDraftChoices: [primary] });

    const snap = snapshotRun(ROUTE_SCREENS.DESTINATION);
    expect(snap.starterDraftChoices).toBeNull();
  });
});
