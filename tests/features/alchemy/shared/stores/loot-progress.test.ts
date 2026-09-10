import { DESTINATIONS } from "@/lib/routing";
import { beginDestinationClaim, commitDestinationClaim } from "@/features/alchemy/shared/stores/run-session-write-port";
import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { createEmptyTalentEffectManifest, getStartingDeck } from "@/lib/game-data";
import { createEmptyRewardState, shopItemSlotKey } from "@/lib/active-run-session";
import { generateGearRewardChoicesForRarity, gearDefinitions } from "@/lib/gear";
import { resetRunDomainStore, setRunProgress } from "../../../../helpers/run-domain-store-test";
import { gridLabyrinthMapFixture } from "../../../../fixtures/labyrinth-map";

beforeEach(() => resetRunDomainStore());

const progress = () => dispatchRunSessionCommand(resolveDraftLootProgress);
const actions = () =>
  createShopActions({
    talentEffects: createEmptyTalentEffectManifest(),
    homesteadEffects: { ...defaultHomesteadEffects, gearAstralChanceBonus: 1 },
  });

describe("loot progression at run boundaries", () => {
  it("uses destination progress rather than battle count and applies account clears to other heroes", () => {
    setRunProgress({ currentAct: 1, destinationIndexInAct: 3, roomsEncountered: 1, characterId: "wizard" });
    dispatchRunSessionCommand((draft) => {
      draft.profile.completedDifficulties.knight = ["difficulty-2"];
    });
    expect(progress()).toEqual({ depth: 4, highestCompletedDifficulty: "difficulty-2" });
    setRunProgress({ roomsEncountered: 20 });
    expect(progress().depth).toBe(4);
    setRunProgress({ contentSystemType: "wildwood", roomsEncountered: 6 });
    expect(progress()).toEqual({ depth: 6, highestCompletedDifficulty: "difficulty-2" });
  });

  it("keeps Campaign loot depth stable before and after the destination transition commits", () => {
    setRunProgress({ currentAct: 1, destinationIndexInAct: 2, gold: 999 });
    dispatchRunSessionCommand((draft) => {
      draft.session.rewardState = createEmptyRewardState([DESTINATIONS.GEAR_SHOP]);
      expect(beginDestinationClaim(draft, DESTINATIONS.GEAR_SHOP)).toBe(true);
    });
    expect(progress().depth).toBe(4);
    const shop = actions();
    shop.equipment.initialize();
    expect(
      readRunSession().equipmentShopState.gear.every((item) => gearDefinitions[item.definitionId].rarity === "astral"),
    ).toBe(true);
    dispatchRunSessionCommand((draft) => {
      expect(commitDestinationClaim(draft, DESTINATIONS.GEAR_SHOP)).toBe(true);
    });
    expect(progress().depth).toBe(4);
    expect(shop.equipment.refresh()).toBe(true);
    expect(progress().depth).toBe(4);
    expect(
      readRunSession().equipmentShopState.gear.every((item) => gearDefinitions[item.definitionId].rarity === "astral"),
    ).toBe(true);
  });

  it("uses the pending Labyrinth room consistently while shops initialize and refresh", () => {
    const map = gridLabyrinthMapFixture();
    const pending = Object.values(map.nodes).find((node) => node.type === "equipment-shop")!;
    const cleared = Object.values(map.nodes).find((node) => node.type === "rest")!;
    cleared.cleared = true;
    setRunProgress({ contentSystemType: "labyrinth", gold: 999 });
    dispatchRunSessionCommand((draft) => {
      draft.session.labyrinthMap = map;
      draft.session.activeLabyrinthPendingNode = pending.id;
    });
    expect(progress().depth).toBe(2);
    const shop = actions();
    shop.equipment.initialize();
    expect(shop.equipment.refresh()).toBe(true);
    expect(progress().depth).toBe(2);
    expect(
      readRunSession().equipmentShopState.gear.every((item) => gearDefinitions[item.definitionId].rarity === "basic"),
    ).toBe(true);
    expect(readRunSession().labyrinthMap?.nodes[pending.id].cleared).toBe(false);
  });

  it("preserves premium pending rewards at early depth across repeated saves without consuming RNG", () => {
    setRunProgress({
      initialized: true,
      characterId: "knight",
      runDeck: getStartingDeck("knight"),
      destinationIndexInAct: 0,
    });
    const choices = generateGearRewardChoicesForRarity(3, "unique", () => 0.2);
    dispatchRunSessionCommand((draft) => {
      draft.session.hasActiveRun = true;
      draft.run.navigation.screen = "rewards";
      draft.run.navigation.resumeScreen = "rewards";
      draft.session.rewardState = { ...createEmptyRewardState(), rewardType: "gear", choices };
    });
    const rngBefore = readActiveRun().rng;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const saved = snapshotRun();
      restoreRun(saved, {}, {});
      expect(readRunSession().rewardState.choices).toEqual(choices);
      expect(readActiveRun().rng).toEqual(rngBefore);
      expect(progress().depth).toBe(1);
    }
  });

  it("honors a Trinket shop promised by an older shallow map and preserves its shelf on resume", () => {
    setRunProgress({
      initialized: true,
      characterId: "knight",
      runDeck: getStartingDeck("knight"),
      contentSystemType: "labyrinth",
      gold: 999,
    });
    const map = gridLabyrinthMapFixture();
    const pending = Object.values(map.nodes).find((node) => node.type === "trinket-shop")!;
    dispatchRunSessionCommand((draft) => {
      draft.session.hasActiveRun = true;
      draft.session.labyrinthMap = map;
      draft.session.activeLabyrinthPendingNode = pending.id;
      draft.run.navigation.screen = "trinket-shop";
      draft.run.navigation.resumeScreen = "trinket-shop";
    });
    const shop = actions();
    shop.trinket.initialize();
    const offered = readRunSession().trinketShopState.trinkets;
    expect(offered).toHaveLength(3);
    restoreRun(snapshotRun(), {}, {});
    expect(readRunSession().trinketShopState.trinkets).toEqual(offered);
    expect(shop.trinket.buy(offered[0], shopItemSlotKey(offered[0].id, 0))).toBe(true);
    const gold = readRunProfile().gold;
    expect(shop.trinket.refresh()).toBe(false);
    expect(readRunProfile().gold).toBe(gold);
    expect(progress().depth).toBe(1);
  });

  it("keeps a saved Masterwork shelf and its explicit promise while preventing early Trinket refresh charges", () => {
    setRunProgress({
      initialized: true,
      characterId: "knight",
      runDeck: getStartingDeck("knight"),
      contentSystemType: "labyrinth",
      gold: 999,
    });
    const map = gridLabyrinthMapFixture();
    const pending = Object.values(map.nodes).find((node) => node.type === "equipment-shop")!;
    pending.rewardModifiers = ["masterwork"];
    dispatchRunSessionCommand((draft) => {
      draft.session.hasActiveRun = true;
      draft.session.labyrinthMap = map;
      draft.session.activeLabyrinthPendingNode = pending.id;
      draft.session.activeLabyrinthRewardModifiers = ["masterwork"];
      draft.run.navigation.screen = "equipment-shop";
      draft.run.navigation.resumeScreen = "equipment-shop";
    });
    const shop = actions();
    shop.equipment.initialize();
    const offered = readRunSession().equipmentShopState.gear;
    const saved = snapshotRun();
    restoreRun(saved, {}, {});
    expect(readRunSession().equipmentShopState.gear).toEqual(offered);
    expect(shop.equipment.refresh()).toBe(true);
    expect(
      readRunSession().equipmentShopState.gear.every((item) => gearDefinitions[item.definitionId].rarity === "astral"),
    ).toBe(true);
    const gold = readRunProfile().gold;
    expect(shop.trinket.refresh()).toBe(false);
    expect(readRunProfile().gold).toBe(gold);
    expect(progress().depth).toBe(1);
  });
});
