import { describe, expect, it } from "vitest";
import {
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearInventories,
  createEmptyCurrencyBoardPositionsByCharacter,
  createEmptyGearLoadouts,
  equipGear,
  flattenGearInventories,
  type GearInstance,
} from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}

function knightBoards(positions: Record<string, { col: number; row: number }>) {
  const boards = createEmptyGearBoardPositionsByCharacter();
  boards.knight = positions;
  return boards;
}

function knightCurrencyBoards(positions: Record<string, { col: number; row: number }>) {
  const boards = createEmptyCurrencyBoardPositionsByCharacter();
  boards.knight = positions;
  return boards;
}

describe("gear-store", () => {
  const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };

  it("initializes inventory, loadouts, and board positions from save data", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    const boardPositions = { [ring.instanceId]: { col: 2, row: 3 } };
    useGearStore.getState().initialize(knightInventories(ring), loadouts, knightBoards(boardPositions));
    expect(useGearStore.getState().inventories.knight).toEqual([ring]);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBe("ring-1");
    expect(useGearStore.getState().boardPositionsByCharacter.knight).toEqual(boardPositions);
    useGearStore.getState().reset();
  });

  it("updates loadouts on equip and inventory on salvage", () => {
    useGearStore.getState().reset();
    useGearStore.getState().addInstance(ring, "knight");
    useGearStore.getState().equip("knight", "left-ring", ring);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBe("ring-1");

    const salvaged = useGearStore.getState().salvage(ring.instanceId, { rng: () => 0 });
    expect(salvaged?.inventories.knight).toEqual([]);
    expect(useGearStore.getState().loadouts.knight["left-ring"]).toBeNull();
    expect(flattenGearInventories(useGearStore.getState().inventories)).toEqual([]);
    useGearStore.getState().reset();
  });

  it("prunes stale board positions when salvaging gear", () => {
    useGearStore.getState().reset();
    useGearStore
      .getState()
      .initialize(
        knightInventories(ring),
        createEmptyGearLoadouts(),
        knightBoards({ [ring.instanceId]: { col: 1, row: 1 } }),
      );
    useGearStore.getState().salvage(ring.instanceId);
    expect(useGearStore.getState().boardPositionsByCharacter.knight).toEqual({});
    useGearStore.getState().reset();
  });

  it("reports armory lock state from inventory", () => {
    useGearStore.getState().reset();
    expect(flattenGearInventories(useGearStore.getState().inventories).length === 0).toBe(true);
    useGearStore.getState().addInstance(ring, "knight");
    expect(flattenGearInventories(useGearStore.getState().inventories).length === 0).toBe(false);
    useGearStore.getState().reset();
  });

  it("swaps board positions when equipping over occupied gear from inventory", () => {
    useGearStore.getState().reset();
    const helmA: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const helmB: GearInstance = { instanceId: "helm-b", definitionId: "leather-helm-basic", affixes: [] };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "helm", helmB, [helmA, helmB]);
    useGearStore.getState().initialize(
      knightInventories(helmA, helmB),
      loadouts,
      knightBoards({
        [helmA.instanceId]: { col: 3, row: 2 },
        [helmB.instanceId]: { col: 1, row: 1 },
      }),
    );

    useGearStore.getState().equip("knight", "helm", helmA, { vacatedPlacement: { col: 3, row: 2 } });

    expect(useGearStore.getState().loadouts.knight.helm).toBe("helm-a");
    expect(useGearStore.getState().boardPositionsByCharacter.knight).toEqual({
      [helmB.instanceId]: { col: 3, row: 2 },
    });
    expect(useGearStore.getState().equippedReturnPositions).toEqual({
      [helmA.instanceId]: { col: 3, row: 2 },
    });
    useGearStore.getState().reset();
  });

  it("keeps board position when equipping from inventory without swapping", () => {
    useGearStore.getState().reset();
    const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    useGearStore
      .getState()
      .initialize(
        knightInventories(helm),
        createEmptyGearLoadouts(),
        knightBoards({ [helm.instanceId]: { col: 3, row: 2 } }),
      );

    useGearStore.getState().equip("knight", "helm", helm);

    expect(useGearStore.getState().boardPositionsByCharacter.knight).toEqual({
      [helm.instanceId]: { col: 3, row: 2 },
    });
    expect(useGearStore.getState().equippedReturnPositions).toEqual({});
    useGearStore.getState().reset();
  });

  it("skips board position updates when pruning makes no changes", () => {
    useGearStore.getState().reset();
    const boardPositions = { [ring.instanceId]: { col: 1, row: 1 } };
    useGearStore
      .getState()
      .initialize(knightInventories(ring), createEmptyGearLoadouts(), knightBoards(boardPositions));
    const before = useGearStore.getState();
    useGearStore.getState().syncBoardPositions();
    const after = useGearStore.getState();
    expect(after.boardPositionsByCharacter).toBe(before.boardPositionsByCharacter);
    useGearStore.getState().reset();
  });

  it("persists crafting currency board positions", () => {
    useGearStore.getState().reset();
    useGearStore
      .getState()
      .initialize(
        knightInventories(),
        createEmptyGearLoadouts(),
        createEmptyGearBoardPositionsByCharacter(),
        { voidstone: 2 },
        {},
        knightCurrencyBoards({ voidstone: { col: 4, row: 2 } }),
      );
    expect(useGearStore.getState().currencyBoardPositionsByCharacter.knight).toEqual({
      voidstone: { col: 4, row: 2 },
    });

    useGearStore.getState().moveBoardItem("knight", { kind: "currency", id: "voidstone" }, 6, 3);
    expect(useGearStore.getState().currencyBoardPositionsByCharacter.knight).toEqual({
      voidstone: { col: 6, row: 3 },
    });
    useGearStore.getState().reset();
  });

  it("unequip restores equippedReturnPositions to boardPositions", () => {
    useGearStore.getState().reset();
    const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const returnPosition = { col: 4, row: 2 };
    useGearStore
      .getState()
      .initialize(
        knightInventories(helm),
        createEmptyGearLoadouts(),
        knightBoards({ [helm.instanceId]: returnPosition }),
      );
    useGearStore.getState().equip("knight", "helm", helm, { vacatedPlacement: returnPosition });

    expect(useGearStore.getState().loadouts.knight.helm).toBe("helm-a");
    expect(useGearStore.getState().boardPositionsByCharacter.knight[helm.instanceId]).toBeUndefined();
    expect(useGearStore.getState().equippedReturnPositions[helm.instanceId]).toEqual(returnPosition);

    useGearStore.getState().unequip("knight", "helm");

    expect(useGearStore.getState().loadouts.knight.helm).toBeNull();
    expect(useGearStore.getState().boardPositionsByCharacter.knight[helm.instanceId]).toEqual(returnPosition);
    expect(useGearStore.getState().equippedReturnPositions[helm.instanceId]).toBeUndefined();
    useGearStore.getState().reset();
  });

  it("unequip without a return position leaves boardPositions unchanged", () => {
    useGearStore.getState().reset();
    const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const boardPosition = { col: 3, row: 2 };
    useGearStore
      .getState()
      .initialize(
        knightInventories(helm),
        createEmptyGearLoadouts(),
        knightBoards({ [helm.instanceId]: boardPosition }),
      );
    useGearStore.getState().equip("knight", "helm", helm);

    useGearStore.getState().unequip("knight", "helm");

    expect(useGearStore.getState().loadouts.knight.helm).toBeNull();
    expect(useGearStore.getState().boardPositionsByCharacter.knight[helm.instanceId]).toEqual(boardPosition);
    expect(useGearStore.getState().equippedReturnPositions).toEqual({});
    useGearStore.getState().reset();
  });

  it("transfers item ownership in inventories and board positions when equipping from another character's inventory", () => {
    useGearStore.getState().reset();
    const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [helm];
    const boardPositions = { [helm.instanceId]: { col: 1, row: 1 } };
    useGearStore.getState().initialize(inventories, createEmptyGearLoadouts(), knightBoards(boardPositions));

    // Equip it on Rogue (from Knight's inventory)
    useGearStore.getState().equip("rogue", "helm", helm);

    // Should be removed from Knight and added to Rogue
    expect(useGearStore.getState().inventories.knight).toEqual([]);
    expect(useGearStore.getState().inventories.rogue).toEqual([helm]);

    // Board position should be moved from Knight to Rogue
    expect(useGearStore.getState().boardPositionsByCharacter.knight[helm.instanceId]).toBeUndefined();
    expect(useGearStore.getState().boardPositionsByCharacter.rogue[helm.instanceId]).toEqual({ col: 1, row: 1 });

    useGearStore.getState().reset();
  });

  it("swaps item positions on board to closest open slot without auto-sorting unrelated items", () => {
    useGearStore.getState().reset();
    const itemA: GearInstance = { instanceId: "item-a", definitionId: "leather-helm-basic", affixes: [] };
    const itemB: GearInstance = { instanceId: "item-b", definitionId: "ruby-ring-basic", affixes: [] };
    const itemC: GearInstance = { instanceId: "item-c", definitionId: "ruby-ring-basic", affixes: [] };

    useGearStore.getState().initialize(
      knightInventories(itemA, itemB, itemC),
      createEmptyGearLoadouts(),
      knightBoards({
        [itemA.instanceId]: { col: 1, row: 1 },
        [itemB.instanceId]: { col: 3, row: 1 },
        [itemC.instanceId]: { col: 5, row: 5 },
      }),
    );

    useGearStore.getState().moveBoardItem("knight", { kind: "gear", id: "item-a" }, 3, 1);

    expect(useGearStore.getState().boardPositionsByCharacter.knight["item-a"]).toEqual({ col: 3, row: 1 });
    expect(useGearStore.getState().boardPositionsByCharacter.knight["item-b"]).toEqual({ col: 2, row: 1 });
    expect(useGearStore.getState().boardPositionsByCharacter.knight["item-c"]).toEqual({ col: 5, row: 5 });

    useGearStore.getState().reset();
  });

  describe("transferToInventory", () => {
    it("transfers gear and moves its board position to the target character", () => {
      useGearStore.getState().reset();
      const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
      const inventories = createEmptyGearInventories();
      inventories.knight = [helm];
      useGearStore
        .getState()
        .initialize(inventories, createEmptyGearLoadouts(), knightBoards({ [helm.instanceId]: { col: 3, row: 2 } }));

      expect(useGearStore.getState().transferToInventory(helm.instanceId, "rogue")).toBe(true);

      expect(useGearStore.getState().inventories.knight).toEqual([]);
      expect(useGearStore.getState().inventories.rogue).toEqual([helm]);
      expect(useGearStore.getState().boardPositionsByCharacter.knight[helm.instanceId]).toBeUndefined();
      expect(useGearStore.getState().boardPositionsByCharacter.rogue[helm.instanceId]).toEqual({ col: 3, row: 2 });
      useGearStore.getState().reset();
    });

    it("returns false when the instance is unknown", () => {
      useGearStore.getState().reset();
      expect(useGearStore.getState().transferToInventory("missing-id", "rogue")).toBe(false);
      useGearStore.getState().reset();
    });

    it("returns false when target is the same as the source", () => {
      useGearStore.getState().reset();
      const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
      useGearStore.getState().addInstance(helm, "knight");
      expect(useGearStore.getState().transferToInventory(helm.instanceId, "knight")).toBe(false);
      useGearStore.getState().reset();
    });

    it("removes the instance from all loadouts when transferring", () => {
      useGearStore.getState().reset();
      const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
      const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "helm", helm, [helm]);
      useGearStore.getState().initialize(knightInventories(helm), loadouts);

      expect(useGearStore.getState().loadouts.knight.helm).toBe(helm.instanceId);
      expect(useGearStore.getState().transferToInventory(helm.instanceId, "rogue")).toBe(true);
      expect(useGearStore.getState().loadouts.knight.helm).toBeNull();
      expect(useGearStore.getState().equippedReturnPositions[helm.instanceId]).toBeUndefined();
      useGearStore.getState().reset();
    });
  });
});
