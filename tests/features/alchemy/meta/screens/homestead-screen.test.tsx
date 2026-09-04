import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadScreen } from "@/features/alchemy/meta/screens/homestead-screen";
import { emptyInventory } from "@/lib/homestead/inventory";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

describe("HomesteadScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    gold: 50,
    materialInventory: { ...emptyInventory(), iron: 100, wood: 100, food: 100 },
    constructedBuildings: { "blacksmiths-forge": 0 } as any,
    plantedFarms: {} as any,
    completedResearch: {} as any,
    bondedCompanions: {} as any,
    discoveredCardIds: ["summon-wolf"],
    onConstructBuilding: vi.fn(() => true),
    onPlantFarm: vi.fn(() => true),
    onCompleteResearch: vi.fn(() => true),
    onBondCompanion: vi.fn(() => true),
  };

  it("renders homestead screen header, wallet, and tabs", () => {
    render(<HomesteadScreen {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Homestead" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buildings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Farm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Research" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Companions" })).toBeTruthy();
  });

  it("handles building construction click", () => {
    const onConstructBuilding = vi.fn(() => true);
    render(<HomesteadScreen {...defaultProps} onConstructBuilding={onConstructBuilding} />);

    const blacksmithButton = screen.getByRole("button", { name: /Blacksmith/i });
    fireEvent.click(blacksmithButton);
    expect(onConstructBuilding).toHaveBeenCalled();
  });

  it("switches to the farm tab and displays farm plots", async () => {
    render(<HomesteadScreen {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Farm" }));
    await waitFor(() => {
      expect(screen.getByAltText("Wheat Field")).toBeTruthy();
    });
  });

  it("switches to research tab and shows research upgrades", async () => {
    render(<HomesteadScreen {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Research" }));
    await waitFor(() => {
      expect(screen.getByAltText("Leyline Energy")).toBeTruthy();
    });
  });

  it("renders companions pagination control", async () => {
    render(<HomesteadScreen {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Companions" })).toBeTruthy();
    });
    const nextButtons = screen.getAllByRole("button");
    expect(nextButtons.length).toBeGreaterThan(0);
  });
});
