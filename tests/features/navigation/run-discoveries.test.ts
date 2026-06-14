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
      discoveredBoonIds: ["bone-charm"],
    });
  });

  it("finalizeRunEndSession stores newly discovered card and boon ids", () => {
    setRunProgress({
      discoveredCardIdsAtRunStart: ["slash"],
      discoveredBoonIdsAtRunStart: [],
      initialized: true,
    });
    useAppStore.setState({
      discoveredCardIds: ["slash", "fireball", "block"],
      discoveredBoonIds: ["bone-charm", "meteorite"],
    });

    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });

    const session = getRunSessionStoreView();
    expect(session.runEndDiscoveredCardIds).toEqual(["fireball", "block"]);
    expect(session.runEndDiscoveredBoonIds).toEqual(["bone-charm", "meteorite"]);
    expect(session.hasActiveRun).toBe(false);
  });

  it("includes starter deck on first character run when save had no prior discoveries", () => {
    const knightStarterIds = getStartingDeck("knight").map((card) => card.id);

    setRunProgress({
      discoveredCardIdsAtRunStart: [],
      discoveredBoonIdsAtRunStart: [],
      initialized: true,
    });
    useAppStore.setState({
      discoveredCardIds: appendUniqueMany([], knightStarterIds),
      discoveredBoonIds: [],
    });

    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });

    const session = getRunSessionStoreView();
    expect(session.runEndDiscoveredCardIds).toEqual(knightStarterIds);
    expect(session.runEndDiscoveredBoonIds).toEqual([]);
  });

  it("simulates startRun order: baseline before discoverStarterDeck yields starters at run end", () => {
    const knightStarterIds = getStartingDeck("knight").map((card) => card.id);

    useAppStore.setState({ discoveredCardIds: [], discoveredBoonIds: [] });
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
      discoveredBoonIdsAtRunStart: ["bone-charm"],
      initialized: true,
    });

    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });

    const session = getRunSessionStoreView();
    expect(session.runEndDiscoveredCardIds).toEqual([]);
    expect(session.runEndDiscoveredBoonIds).toEqual([]);
  });
});
