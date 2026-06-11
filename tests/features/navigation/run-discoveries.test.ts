import { beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeRunEndSession } from "@/features/alchemy/shared/stores/run-transitions";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { getStartingDeck } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { appendUniqueMany } from "@/lib/utils";
import { getRunDomainStore } from "@/features/alchemy/shared/stores/run-domain-store";
import { getRunSessionStoreView, resetRunDomainStore, setRunProgress } from "../../helpers/run-domain-store-test";

describe("run discoveries at run end", () => {
  beforeEach(() => {
    resetRunDomainStore();
    useAppStore.setState({
      discoveredCardIds: ["slash"],
      discoveredTrinketIds: ["bone-charm"],
    });
  });

  it("finalizeRunEndSession stores newly discovered card and trinket ids", () => {
    setRunProgress({
      discoveredCardIdsAtRunStart: ["slash"],
      discoveredTrinketIdsAtRunStart: [],
      initialized: true,
    });
    useAppStore.setState({
      discoveredCardIds: ["slash", "fireball", "block"],
      discoveredTrinketIds: ["bone-charm", "meteorite"],
    });

    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });

    const session = getRunSessionStoreView();
    expect(session.runEndDiscoveredCardIds).toEqual(["fireball", "block"]);
    expect(session.runEndDiscoveredTrinketIds).toEqual(["bone-charm", "meteorite"]);
    expect(session.hasActiveRun).toBe(false);
  });

  it("includes starter deck on first character run when save had no prior discoveries", () => {
    const knightStarterIds = getStartingDeck("knight").map((card) => card.id);

    setRunProgress({
      discoveredCardIdsAtRunStart: [],
      discoveredTrinketIdsAtRunStart: [],
      initialized: true,
    });
    useAppStore.setState({
      discoveredCardIds: appendUniqueMany([], knightStarterIds),
      discoveredTrinketIds: [],
    });

    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });

    const session = getRunSessionStoreView();
    expect(session.runEndDiscoveredCardIds).toEqual(knightStarterIds);
    expect(session.runEndDiscoveredTrinketIds).toEqual([]);
  });

  it("simulates startRun order: baseline before discoverStarterDeck yields starters at run end", () => {
    const knightStarterIds = getStartingDeck("knight").map((card) => card.id);

    useAppStore.setState({ discoveredCardIds: [], discoveredTrinketIds: [] });
    getRunDomainStore().setDiscoveryBaselines([], []);
    useAppStore.setState({
      discoveredCardIds: appendUniqueMany([], knightStarterIds),
    });

    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });

    const session = getRunSessionStoreView();
    expect(session.runEndDiscoveredCardIds).toEqual(knightStarterIds);
  });

  it("stores empty discovery deltas when collection did not change", () => {
    setRunProgress({
      discoveredCardIdsAtRunStart: ["slash"],
      discoveredTrinketIdsAtRunStart: ["bone-charm"],
      initialized: true,
    });

    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });

    const session = getRunSessionStoreView();
    expect(session.runEndDiscoveredCardIds).toEqual([]);
    expect(session.runEndDiscoveredTrinketIds).toEqual([]);
  });
});
