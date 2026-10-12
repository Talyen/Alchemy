import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadScreen } from "@/features/alchemy/meta/screens/homestead-screen";
import { emptyInventory } from "@/lib/homestead/inventory";
import { cardLibrary, defaultCompanionBondLevels } from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { playUISound } from "@/lib/audio";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installReadyArtworkForTests } from "../../../../helpers/artwork-test";

vi.mock("@/lib/audio", () => ({ playUISound: vi.fn() }));

const defaultProps = {
  gold: 50,
  materialInventory: {
    ...emptyInventory(),
    iron: 100,
    stone: 100,
    wood: 100,
    food: 100,
    gems: 100,
    herbs: 100,
    hide: 100,
  },
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

async function inspect(title: string) {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^View ${title}(,|$)`) }));
  return screen.findByRole("button", { name: `Inspect ${title} benefits` });
}

function purchaseButton(action = "Build", title = "Blacksmith") {
  return screen.getByRole("button", { name: new RegExp(`^${action} ${title} for `) });
}

async function inspectArtwork(title = "Blacksmith") {
  const artwork = await screen.findByRole("button", { name: `Inspect ${title} benefits` });
  act(() => artwork.focus());
  return screen.findByRole("tooltip");
}

describe("HomesteadScreen", () => {
  installDisabledAnimationsForTests();
  installReadyArtworkForTests();
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("separates inspection from spending, blocks repeated input while saving, and reveals saved progress once", async () => {
    let saved: (() => void) | undefined;
    const afterProgressSaved = (feedback: () => void) => {
      saved = feedback;
    };
    const { rerender } = render(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    await inspect("Blacksmith");
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    const tooltip = await inspectArtwork();
    expect(within(tooltip).getByRole("region", { name: "On build" }).textContent).toContain("Physical damage +1");
    expect(within(tooltip).getByRole("img", { name: "Level 0 of 4" })).toBeTruthy();
    const buy = purchaseButton();
    expect(buy.getAttribute("aria-label")).toBe("Build Blacksmith for 4 Stone, 11 Iron");
    act(() => buy.focus());
    fireEvent.click(buy);
    fireEvent.click(buy);
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledExactlyOnceWith("blacksmiths-forge");
    expect(screen.getByRole("button", { name: "Saving Blacksmith" }).hasAttribute("disabled")).toBe(true);
    expect(playUISound).not.toHaveBeenCalled();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        afterProgressSaved={afterProgressSaved}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(true);
    act(() => {
      saved!();
      saved!();
    });
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    expect(within(await inspectArtwork()).getByRole("img", { name: "Level 1 of 4" })).toBeTruthy();
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("talentUnlock");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    const gallery = await screen.findByRole("button", { name: "View Blacksmith, upgrade available" });
    await waitFor(() => expect(document.activeElement).toBe(gallery));
  });

  it("accepts each rendered tier only once even when save acknowledgment runs before React renders", async () => {
    const { rerender } = render(<HomesteadScreen {...defaultProps} />);
    await inspect("Blacksmith");
    const buy = purchaseButton();
    act(() => {
      fireEvent.click(buy);
      fireEvent.click(buy);
    });
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(1);
    expect(buy.hasAttribute("disabled")).toBe(true);
    rerender(
      <HomesteadScreen
        {...defaultProps}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    fireEvent.click(purchaseButton("Upgrade"));
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(2);
  });

  it("keeps unaffordable nodes inspectable and explains the disabled purchase to keyboard users", async () => {
    render(<HomesteadScreen {...defaultProps} materialInventory={emptyInventory()} />);
    await inspect("Blacksmith");
    const buy = purchaseButton();
    expect(buy.hasAttribute("disabled")).toBe(true);
    const disabledReason = buy.closest('[aria-disabled="true"]') as HTMLElement;
    act(() => disabledReason.focus());
    await screen.findByText("More materials needed");
    fireEvent.click(buy);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    await screen.findByRole("button", { name: "View Blacksmith" });
  });

  it("uses the same purchased effects on gallery and detail artwork and retains purchased color", async () => {
    render(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    expect(screen.queryByRole("button", { name: "View Blacksmith, upgrade available" })).toBeNull();
    act(() => screen.getByRole("button", { name: "View Blacksmith" }).focus());
    const galleryText = (await screen.findByRole("tooltip")).textContent;
    await inspect("Blacksmith");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Blacksmith" })).toBeNull();
    const tooltip = await inspectArtwork();
    expect(tooltip.textContent).toBe(galleryText);
    const bonuses = within(tooltip).getByRole("region", { name: "Bonuses" });
    expect(bonuses.textContent).toContain("Physical damage +1");
    expect(bonuses.textContent).not.toContain("Physical damage +2");
    expect(within(tooltip).getByRole("region", { name: "Production" }).textContent).toContain("Find more Iron");
    expect(within(tooltip).getByRole("img", { name: "Level 1 of 4" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    act(() => screen.getByRole("group", { name: "Blacksmith details" }).focus());
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("uses the current tier cost and affordability when progress changes during inspection", async () => {
    const { rerender } = render(<HomesteadScreen {...defaultProps} />);
    await inspect("Blacksmith");
    rerender(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={{ ...emptyInventory(), stone: 4, iron: 11 }}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    const buy = purchaseButton("Upgrade");
    expect(buy.getAttribute("aria-label")).toBe("Upgrade Blacksmith for 8 Stone, 22 Iron");
    expect(buy.hasAttribute("disabled")).toBe(true);
    fireEvent.click(buy);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("reports rejected purchases and ignores saved feedback after leaving the detail page", async () => {
    const afterProgressSaved = vi.fn();
    const { rerender, unmount } = render(
      <HomesteadScreen {...defaultProps} onConstructBuilding={() => false} afterProgressSaved={afterProgressSaved} />,
    );
    await inspect("Blacksmith");
    fireEvent.click(purchaseButton());
    expect(screen.getByRole("alert").textContent).toContain("Purchase unavailable");
    expect(afterProgressSaved).not.toHaveBeenCalled();
    rerender(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    fireEvent.click(purchaseButton());
    expect(afterProgressSaved).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    act(() => afterProgressSaved.mock.calls[0]![0]());
    expect(playUISound).not.toHaveBeenCalled();
    unmount();
    act(() => afterProgressSaved.mock.calls[0]![0]());
    expect(playUISound).not.toHaveBeenCalled();
  });

  it.each([
    { tab: "Farm", title: "Herb Garden", id: "herb-garden", command: defaultProps.onPlantFarm },
    { tab: "Research", title: "Leyline Energy", id: "leyline-energy", command: defaultProps.onCompleteResearch },
  ])("routes $tab purchases through their own command", async ({ tab, title, id, command }) => {
    render(<HomesteadScreen {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await inspect(title);
    expect(command).not.toHaveBeenCalled();
    fireEvent.click(purchaseButton("Build", title));
    expect(command).toHaveBeenCalledExactlyOnceWith(id);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("bonds the Companion selected on the second page and returns to that page", async () => {
    render(<HomesteadScreen {...defaultProps} discoveredCardIds={cardLibrary.map((card) => card.id)} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    await screen.findByRole("button", { name: /^View Wolf,/ });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await inspect("Mana Moth");
    fireEvent.click(purchaseButton("Bond", "Mana Moth"));
    expect(defaultProps.onBondCompanion).toHaveBeenCalledExactlyOnceWith("mana-moth");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("button", { name: /^View Mana Moth,/ });
    expect(screen.queryByRole("button", { name: /^View Wolf,/ })).toBeNull();
  });

  it("lets completed nodes be inspected without offering another purchase", async () => {
    render(
      <HomesteadScreen
        {...defaultProps}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": buildings[0]!.tiers.length }}
      />,
    );
    await inspect("Blacksmith");
    const tooltip = await inspectArtwork();
    expect(within(tooltip).getByRole("img", { name: "Level 4 of 4" })).toBeTruthy();
    expect(within(tooltip).getByRole("region", { name: "Bonuses" }).textContent).toContain("Physical damage +4");
    expect(screen.queryByRole("button", { name: /^Upgrade/ })).toBeNull();
  });

  it("conceals undiscovered Companion identity and keeps its discovery requirement inspectable", async () => {
    render(<HomesteadScreen {...defaultProps} discoveredCardIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    const hidden = await screen.findAllByRole("button", { name: "View Undiscovered companion" });
    fireEvent.click(hidden[0]!);
    await screen.findByRole("button", { name: "Inspect Undiscovered companion benefits" });
    expect(screen.queryByRole("img", { name: "Wolf" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Bond/ })).toBeNull();
    const tooltip = await inspectArtwork("Undiscovered companion");
    expect(tooltip.textContent).toContain("Discover this Companion during a Run.");
  });
});
