import { beforeEach, describe, expect, it } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultBattleState } from "@/lib/battle";
import { cardLibrary, getCardKeywords } from "@/lib/game-data";
import { createEmptyRewardState } from "@/lib/active-run-session";
import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
} from "@/lib/active-run-session";
import { hexAt } from "@/lib/content-systems/labyrinth/hex-grid";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { withClearedNode } from "@/lib/content-systems/labyrinth/map-state";
import { createSeededRng } from "@/lib/utils";
import { ROUTE_SCREENS } from "@/lib/routing";
import { decodeRunResumeSnapshot, encodePersistedShops } from "@/features/alchemy/shared/stores/run-resume-codec";
import type { Screen } from "@/lib/routing";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-profile-codec";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  setAlchemistState,
  setCompanionRewardCards,
  setEquipmentShopState,
  setRewardState,
  setShopState,
  setTrinketShopState,
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
    labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
    activeLabyrinthModifiers: ["septic"],
    activeLabyrinthRewardModifiers: ["generous"],
  });
}

describe("labyrinth modifier persistence", () => {
  it.each(["wide", "legacy tall"])(
    "retains %s geography, settled location and pending travel across save and restore",
    (layout) => {
      startLabyrinthRun();
      const map = structuredClone(readRunSession().labyrinthMap!);
      const nodes = map.floors.find((floor) => floor.depth === 1)!.nodeIds;
      if (layout === "legacy tall") {
        nodes.forEach((id, index) => {
          map.nodes[id]!.gridPosition = hexAt(Math.floor(index / 2) + 2, index % 2);
        });
      }
      const currentNodeId = nodes[0]!;
      setRunSession({ labyrinthMap: withClearedNode(map, currentNodeId), activeLabyrinthPendingNode: nodes[1]! });
      const snap = snapshotRun(ROUTE_SCREENS.CAMPFIRE);
      expect(snap.labyrinthMap?.currentNodeId).toBe(currentNodeId);
      const decoded = decodeRunResumeSnapshot(snap);
      expect(decoded.session.labyrinthMap).toEqual(snap.labyrinthMap);
      expect(decoded.session.labyrinthMap?.currentNodeId).toBe(currentNodeId);
      expect(decoded.session.labyrinthPendingNode).toBe(nodes[1]);
    },
  );
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
  it("keeps both spoils and companion gifts when the claim is interrupted", () => {
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"))!;
    setRunSession({
      hasActiveRun: true,
      rewardClaimInFlight: true,
      rewardState: { ...createEmptyRewardState(), rewardType: "card", choices: [primary], gold: 7 },
      companionRewardCards: [companion],
    });

    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow.kind).toBe("companion-reward");
    if (snap.interruptedFlow.kind === "companion-reward") {
      expect(snap.interruptedFlow.pending.rewardType).toBe("card");
      if (snap.interruptedFlow.pending.rewardType === "card") {
        expect(snap.interruptedFlow.pending.choiceIds).toEqual([primary.id]);
      }
      expect(snap.interruptedFlow.pending.companionChoiceIds).toEqual([companion.id]);
      expect(snap.interruptedFlow.pending.gold).toBe(7);
    }

    dispatchRunSessionCommand((draft) => {
      setRewardState(draft, createEmptyRewardState());
      setCompanionRewardCards(draft, null);
    });
    restoreRun(snap, {}, {});

    const restored = readRunSession().rewardState;
    expect(restored.rewardType).toBe("card");
    if (restored.rewardType === "card") {
      expect(restored.choices.map((choice) => choice.id)).toEqual([primary.id]);
    }
    expect(readRunSession().companionRewardCards?.map((choice) => choice.id)).toEqual([companion.id]);
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
    expect(readRunSession().rewardState.choices).toEqual(choices);
    expect(readRunSession().companionRewardCards).toEqual(bonusDisplayed ? null : bonuses);
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
    expect(snap.interruptedFlow.kind).toBe("companion-reward");
    resetRunDomainStore();
    const profileBefore = readGameplayState().runProfile;
    restoreRun(snap, {}, {});

    expect(readGameplayState().run.navigation.screen).toBe(ROUTE_SCREENS.REWARDS);
    expect(readRunSession().rewardState).toEqual({
      ...createEmptyRewardState(),
      choices: bonuses,
      lastVictoryContentSystem: "labyrinth",
      lastVictoryEnemyType: "elite",
    });
    expect(readRunSession().companionRewardCards).toBeNull();
    expect(readGameplayState().runProfile.gold).toBe(profileBefore.gold);
    expect(readGameplayState().runProfile.materialInventory).toEqual(profileBefore.materialInventory);
    expect(readActiveRun().runMaterialsEarned).toEqual(snap.runMaterialsEarned);
    expect(readActiveRun().rng).toEqual(snap.rng);
  });
});

describe("shop persistence", () => {
  it("keeps only the current shop across save and restore", () => {
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => {
      setShopState(draft, emptyShopState());
      setAlchemistState(draft, emptyAlchemistState());
      setTrinketShopState(draft, emptyTrinketShopState());
      setEquipmentShopState(draft, emptyEquipmentShopState());
    });

    const snap = snapshotRun(ROUTE_SCREENS.SHOP);
    expect(snap.shopState).not.toBeNull();
    expect(snap.alchemistState).toBeNull();
    expect(snap.trinketShopState).toBeNull();
    expect(snap.equipmentShopState).toBeNull();

    restoreRun(snap, {}, {});
    expect(readRunSession().shopState).not.toBeNull();
  });

  it("recovers empty shops instead of crashing on future screens", () => {
    setRunSession({ hasActiveRun: true });
    const shops = encodePersistedShops(readRunSession(), "future-screen" as Screen);
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
