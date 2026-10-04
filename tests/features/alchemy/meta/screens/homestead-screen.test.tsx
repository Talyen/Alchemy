import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadScreen } from "@/features/alchemy/meta/screens/homestead-screen";
import { emptyInventory } from "@/lib/homestead/inventory";
import { cardLibrary, defaultCompanionBondLevels } from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

describe("HomesteadScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
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

  it("paginates only the companion cards belonging to each page", async () => {
    const companions = cardLibrary.filter((c) => c.effects.some((e) => e.kind === "summon-companion"));
    render(<HomesteadScreen {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    await waitFor(() => expect(screen.getByAltText(companions[0]!.title)).toBeTruthy());
    expect(screen.queryByAltText(companions[8]!.title)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(screen.getByAltText(companions[8]!.title)).toBeTruthy());
    expect(screen.queryByAltText(companions[0]!.title)).toBeNull();
    for (const card of companions.slice(8, 16)) expect(screen.getByAltText(card.title)).toBeTruthy();
  });
});
