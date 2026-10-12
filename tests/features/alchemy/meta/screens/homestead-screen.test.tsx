import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadScreen } from "@/features/alchemy/meta/screens/homestead-screen";
import { emptyInventory } from "@/lib/homestead/inventory";
import { cardLibrary, defaultCompanionBondLevels } from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { playUISound } from "@/lib/audio";
import { HOMESTEAD_PURCHASE_MOTION } from "@/lib/game-constants";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

vi.mock("@/lib/audio", () => ({ playUISound: vi.fn() }));

describe("HomesteadScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    useUiStore.getState().clearCardHover();
  });

  const defaultProps = {
    gold: 50,
    materialInventory: { ...emptyInventory(), iron: 100, stone: 100, wood: 100, food: 100 },
    constructedBuildings: createEmptyTierRecord(buildings),
    plantedFarms: createEmptyTierRecord(farmPlots),
    completedResearch: createEmptyTierRecord(researchUpgrades),
    bondedCompanions: { ...defaultCompanionBondLevels },
    discoveredCardIds: ["wolf-companion"],
    onConstructBuilding: vi.fn(() => true),
    onPlantFarm: vi.fn(() => true),
    onCompleteResearch: vi.fn(() => true),
    onBondCompanion: vi.fn(() => true),
  };

  it("dispatches the selected building once and stops offering completed upgrades", () => {
    const onConstructBuilding = vi.fn(() => true);
    const { rerender } = render(<HomesteadScreen {...defaultProps} onConstructBuilding={onConstructBuilding} />);

    const blacksmithButton = screen.getByRole("button", { name: /Blacksmith/i });
    fireEvent.click(blacksmithButton);
    expect(onConstructBuilding).toHaveBeenCalledExactlyOnceWith("blacksmiths-forge");
    rerender(
      <HomesteadScreen
        {...defaultProps}
        onConstructBuilding={onConstructBuilding}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": buildings[0]!.tiers.length }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Blacksmith/i })).toBeNull();
  });

  it("does not construct when the tile is unaffordable", () => {
    const onConstructBuilding = vi.fn(() => true);
    render(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        onConstructBuilding={onConstructBuilding}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Blacksmith/i }));
    expect(onConstructBuilding).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "celebrates saved purchases once without replaying hydrated progress (reduced motion: %s)",
    (reducedMotion) => {
      vi.useFakeTimers();
      if (!reducedMotion) localStorage.removeItem("alchemy-disable-animations");
      let afterSaved: (() => void) | undefined;
      const onConstructBuilding = vi.fn(() => true);
      const { container, rerender, unmount } = render(
        <HomesteadScreen
          {...defaultProps}
          onConstructBuilding={onConstructBuilding}
          afterProgressSaved={(feedback) => {
            afterSaved = feedback;
          }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /Blacksmith/i }));
      expect(onConstructBuilding).toHaveBeenCalledExactlyOnceWith("blacksmiths-forge");
      expect(container.querySelector("[data-homestead-purchase]")).toBeNull();
      expect(playUISound).not.toHaveBeenCalled();

      const savedBuildings = { ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 };
      rerender(<HomesteadScreen {...defaultProps} constructedBuildings={savedBuildings} />);
      act(() => afterSaved!());
      expect(
        container.querySelector(
          `[data-homestead-purchase="build"][data-motion="${reducedMotion ? "static" : "animated"}"]`,
        ),
      ).toBeTruthy();
      const sealDelay = reducedMotion ? 0 : HOMESTEAD_PURCHASE_MOTION.buildSealMs;
      if (sealDelay > 0) {
        act(() => vi.advanceTimersByTime(sealDelay - 1));
        expect(playUISound).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
      } else {
        act(() => vi.advanceTimersByTime(0));
      }
      expect(playUISound).toHaveBeenCalledExactlyOnceWith("talentUnlock");
      act(() => vi.advanceTimersByTime(HOMESTEAD_PURCHASE_MOTION.buildMs - sealDelay));
      expect(container.querySelector("[data-homestead-purchase]")).toBeNull();

      unmount();
      const reopened = render(<HomesteadScreen {...defaultProps} constructedBuildings={savedBuildings} />);
      act(() => vi.runOnlyPendingTimers());
      expect(reopened.container.querySelector("[data-homestead-purchase]")).toBeNull();
      expect(playUISound).toHaveBeenCalledTimes(1);
    },
  );

  it("does not celebrate rejected purchases or save callbacks arriving after navigation", () => {
    vi.useFakeTimers();
    const afterProgressSaved = vi.fn();
    const { container, rerender, unmount } = render(
      <HomesteadScreen {...defaultProps} onConstructBuilding={() => false} afterProgressSaved={afterProgressSaved} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Blacksmith/i }));
    expect(afterProgressSaved).not.toHaveBeenCalled();
    expect(container.querySelector("[data-homestead-purchase]")).toBeNull();

    rerender(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    fireEvent.click(screen.getByRole("button", { name: /Blacksmith/i }));
    expect(afterProgressSaved).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      afterProgressSaved.mock.calls[0]![0]();
      vi.runOnlyPendingTimers();
    });
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("bonds the Companion selected on the second page", async () => {
    const onBondCompanion = vi.fn(() => true);
    render(
      <HomesteadScreen
        {...defaultProps}
        discoveredCardIds={cardLibrary.map((card) => card.id)}
        onBondCompanion={onBondCompanion}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Bond Wolf,/ })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Bond Mana Moth,/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    const moth = await screen.findByRole("button", { name: /Bond Mana Moth,/ });
    expect(screen.queryByRole("button", { name: /Bond Wolf,/ })).toBeNull();
    fireEvent.click(moth);
    expect(onBondCompanion).toHaveBeenCalledExactlyOnceWith("mana-moth");
  });
});
