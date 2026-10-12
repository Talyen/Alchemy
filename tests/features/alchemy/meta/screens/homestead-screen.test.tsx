import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadScreen } from "@/features/alchemy/meta/screens/homestead-screen";
import { emptyInventory } from "@/lib/homestead/inventory";
import { cardLibrary, defaultCompanionBondLevels, keywordDefinitions } from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { playUISound } from "@/lib/audio";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";

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
  onResetHomestead: vi.fn(() => true),
};

function nodeTile(title = "Blacksmith") {
  return screen.getByRole("img", { name: title, exact: true }).closest("button")!;
}

async function inspect(title = "Blacksmith") {
  await screen.findByRole("img", { name: title, exact: true });
  await waitForArtwork();
  fireEvent.mouseEnter(nodeTile(title));
  return screen.findByRole("tooltip");
}

describe("HomesteadScreen", () => {
  installDisabledAnimationsForTests();
  installReadyArtworkForTests();
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows only build costs before purchase and reveals bonuses and progress after saving once", async () => {
    let saved: (() => void) | undefined;
    const afterProgressSaved = (feedback: () => void) => {
      saved = feedback;
    };
    const { rerender } = render(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    const panel = await inspect();
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    expect(panel.textContent).not.toContain("Physical damage");
    expect(panel.textContent).not.toContain("Find");
    expect(within(panel).getByRole("img", { name: "Level 0 of 4" })).toBeTruthy();
    expect(within(panel).queryByRole("button")).toBeNull();
    const tile = nodeTile();
    expect(tile.getAttribute("aria-label")).toBe("Build Blacksmith for 4 Stone, 11 Iron");
    expect(tile.classList.contains("homestead-node-affordable")).toBe(true);
    fireEvent.click(tile);
    fireEvent.click(tile);
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledExactlyOnceWith("blacksmiths-forge");
    expect(screen.getByRole("status").textContent).toBe("Saving…");
    expect(screen.getByRole("button", { name: "Reset Homestead" }).hasAttribute("disabled")).toBe(true);
    expect(tile.getAttribute("aria-disabled")).toBe("true");
    expect(tile.classList.contains("homestead-node-affordable")).toBe(false);
    expect(nodeTile("Hunter's Lodge").classList.contains("homestead-node-affordable")).toBe(false);
    expect(playUISound).not.toHaveBeenCalled();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        afterProgressSaved={afterProgressSaved}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(true);
    expect(within(panel).getByRole("img", { name: "Level 0 of 4" })).toBeTruthy();
    act(() => {
      saved!();
      saved!();
    });
    expect(screen.getByRole("status").textContent).toBe("Built");
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    expect(panel.querySelector(".grayscale")).toBeNull();
    expect(within(panel).getByRole("img", { name: "Level 1 of 4" })).toBeTruthy();
    expect(panel.textContent).toContain("Physical damage is increased by 1");
    expect(panel.textContent).toContain("Find 10% more");
    expect(panel.textContent).not.toContain("Physical damage is increased by 2");
    expect(tile.classList.contains("homestead-node-affordable")).toBe(false);
    expect(vi.mocked(playUISound).mock.calls.filter(([sound]) => sound === "talentUnlock")).toHaveLength(1);
  });

  it("accepts each tier once even when acknowledgment runs before React renders", async () => {
    const { rerender } = render(<HomesteadScreen {...defaultProps} />);
    await waitForArtwork();
    const tile = nodeTile();
    act(() => {
      fireEvent.click(tile);
      fireEvent.click(tile);
    });
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(1);
    expect(tile.getAttribute("aria-disabled")).toBe("true");
    rerender(
      <HomesteadScreen
        {...defaultProps}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    fireEvent.click(tile);
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(2);
  });

  it("keeps unaffordable purchased artwork colored, focusable, and inspectable without spending", async () => {
    render(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    await waitForArtwork();
    const tile = nodeTile();
    act(() => tile.focus());
    const panel = await screen.findByRole("tooltip");
    expect(panel.textContent).toContain("Physical damage is increased by 1");
    expect(panel.textContent).not.toContain("More materials needed");
    expect(
      within(panel).getByLabelText("Upgrade cost: 8 Stone, 22 Iron").querySelectorAll(".text-destructive"),
    ).toHaveLength(2);
    expect(tile.getAttribute("aria-disabled")).toBe("true");
    expect(tile.hasAttribute("disabled")).toBe(false);
    expect(tile.classList.contains("homestead-node-affordable")).toBe(false);
    fireEvent.click(tile);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    expect(document.activeElement).toBe(tile);
  });

  it("uses passive hover tooltips that close on leaving artwork and never receive focus", async () => {
    render(<HomesteadScreen {...defaultProps} />);
    const panel = await inspect();
    expect(document.activeElement).toBe(document.body);
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.mouseLeave(nodeTile());
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    const otherPanel = await inspect("Hunter's Lodge");
    expect(otherPanel.textContent).toContain("Hunter's Lodge");
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("finishes an accepted purchase after dismissing its tooltip and changing tabs", async () => {
    let saved: (() => void) | undefined;
    const afterProgressSaved = (feedback: () => void) => {
      saved = feedback;
    };
    const { rerender } = render(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    await inspect();
    fireEvent.click(nodeTile());
    fireEvent.mouseLeave(nodeTile());
    fireEvent.click(screen.getByRole("button", { name: "Farm" }));
    await screen.findByRole("img", { name: "Wheat Field", exact: true });
    fireEvent.click(nodeTile("Wheat Field"));
    expect(defaultProps.onPlantFarm).not.toHaveBeenCalled();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        afterProgressSaved={afterProgressSaved}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    act(() => {
      saved!();
      saved!();
    });
    fireEvent.click(screen.getByRole("button", { name: "Buildings" }));
    await inspect();
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    expect(vi.mocked(playUISound).mock.calls.filter(([sound]) => sound === "talentUnlock")).toHaveLength(1);
  });

  it("reports a rejected purchase outside the tooltip without saving or spending again", async () => {
    const afterProgressSaved = vi.fn();
    const { rerender } = render(
      <HomesteadScreen {...defaultProps} onConstructBuilding={() => false} afterProgressSaved={afterProgressSaved} />,
    );
    await inspect();
    fireEvent.click(nodeTile());
    fireEvent.mouseLeave(nodeTile());
    expect(screen.getByRole("alert").textContent).toContain("Could not build Blacksmith. Materials were not spent.");
    expect(afterProgressSaved).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalled();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    await inspect();
    expect(nodeTile().getAttribute("aria-label")).toBe("Upgrade Blacksmith for 8 Stone, 22 Iron");
    expect(nodeTile().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(nodeTile());
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it.each([
    { tab: "Farm", title: "Herb Garden", id: "herb-garden", command: defaultProps.onPlantFarm },
    { tab: "Research", title: "Leyline Energy", id: "leyline-energy", command: defaultProps.onCompleteResearch },
  ])("routes $tab artwork purchases through their own command", async ({ tab, title, id, command }) => {
    render(<HomesteadScreen {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await inspect(title);
    fireEvent.click(nodeTile(title));
    expect(command).toHaveBeenCalledExactlyOnceWith(id);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("shows only unbonded costs and bonds a Companion on the second page without leaving it", async () => {
    render(<HomesteadScreen {...defaultProps} discoveredCardIds={cardLibrary.map((card) => card.id)} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    await screen.findByRole("img", { name: "Wolf", exact: true });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    const panel = await inspect("Mana Moth");
    expect(within(panel).getByRole("img", { name: "Bond 0 of 3" })).toBeTruthy();
    expect(within(panel).getByRole("group", { name: /^Bond cost:/ })).toBeTruthy();
    fireEvent.click(nodeTile("Mana Moth"));
    expect(defaultProps.onBondCompanion).toHaveBeenCalledExactlyOnceWith("mana-moth");
    expect(screen.queryByRole("img", { name: "Wolf", exact: true })).toBeNull();
  });

  it("shows Hide alone for Hunter's Lodge and renders Wishing Well Gold in a resource chip", async () => {
    render(
      <HomesteadScreen
        {...defaultProps}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "hunters-lodge": 1, "wishing-well": 1 }}
      />,
    );
    const hunter = await inspect("Hunter's Lodge");
    expect(hunter.textContent).toContain("Find 10% more Hide");
    expect(hunter.textContent).not.toContain("Food");
    fireEvent.mouseLeave(nodeTile("Hunter's Lodge"));
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    const well = await inspect("Wishing Well");
    expect(well.textContent).toContain("Wish has a 10% chance to offer an additional choice");
    expect(within(well).getByText("Wish").classList.contains(keywordDefinitions.wish.colorClass)).toBe(true);
    expect(well.textContent).toContain("Find 10% more Gold");
    expect(well.textContent).not.toContain("Gems");
    const gold = within(well).getByRole("img", { name: "Gold" });
    expect(gold.parentElement?.textContent).toBe("Gold");
    expect(gold.parentElement?.classList.contains("rounded-full")).toBe(true);
  });

  it("confirms reset, holds its refund until saved, and permits buying the same tier again", async () => {
    const acknowledgments: Array<() => void> = [];
    const afterProgressSaved = (feedback: () => void) => acknowledgments.push(feedback);
    const { rerender } = render(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    expect(screen.getByRole("button", { name: "Reset Homestead" }).hasAttribute("disabled")).toBe(true);
    await inspect();
    fireEvent.click(nodeTile());
    const purchased = {
      ...defaultProps,
      constructedBuildings: { ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 },
    };
    rerender(<HomesteadScreen {...purchased} afterProgressSaved={afterProgressSaved} />);
    act(() => acknowledgments[0]!());
    fireEvent.click(screen.getByRole("button", { name: "Reset Homestead" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("refund all spent materials");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancel" }).closest("[inert]")).toBeNull());
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(defaultProps.onResetHomestead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset Homestead" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reset", exact: true }).closest("[inert]")).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset", exact: true }));
    expect(defaultProps.onResetHomestead).toHaveBeenCalledTimes(1);
    rerender(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    await inspect();
    expect(nodeTile().getAttribute("aria-label")).toContain("Upgrade Blacksmith");
    fireEvent.click(nodeTile());
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(1);
    act(() => {
      acknowledgments[1]!();
      acknowledgments[1]!();
    });
    expect(nodeTile().getAttribute("aria-label")).toContain("Build Blacksmith");
    expect(screen.queryByText("Built")).toBeNull();
    fireEvent.click(nodeTile());
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(2);
  });

  it("allows resetting bonds alone and reports rejection without showing success", async () => {
    const afterProgressSaved = vi.fn();
    render(
      <HomesteadScreen
        {...defaultProps}
        bondedCompanions={{ ...defaultCompanionBondLevels, wolf: 1 }}
        onResetHomestead={() => false}
        afterProgressSaved={afterProgressSaved}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset Homestead" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reset", exact: true }).closest("[inert]")).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset", exact: true }));
    expect(screen.getByRole("alert").textContent).toBe("Could not reset Homestead. Nothing was changed.");
    expect(afterProgressSaved).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("fades old tooltip content before replacing it and keeps confirmation after pointer exit", async () => {
    localStorage.removeItem("alchemy-disable-animations");
    const { rerender } = render(<HomesteadScreen {...defaultProps} />);
    const panel = await inspect();
    vi.useFakeTimers();
    fireEvent.click(nodeTile());
    expect(screen.queryByText("Built")).toBeNull();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("Built");
    expect(panel.textContent).not.toContain("Physical damage");
    expect(panel.querySelector('[data-homestead-phase="exit"]')).toBeTruthy();
    act(() => vi.advanceTimersByTime(60));
    fireEvent.click(nodeTile());
    rerender(
      <HomesteadScreen
        {...defaultProps}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 2 }}
      />,
    );
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toBe("Upgraded");
    expect(panel.textContent).not.toContain("Physical damage");
    act(() => vi.advanceTimersByTime(120));
    expect(panel.textContent).toContain("Physical damage is increased by 2");
    expect(panel.textContent).not.toContain("Physical damage is increased by 1");
    fireEvent.mouseLeave(nodeTile());
    expect(screen.getByRole("status").textContent).toBe("Upgraded");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.mouseEnter(nodeTile());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("tooltip").querySelector(".homestead-earned-star")).toBeNull();
  });

  it("shows completed benefits and keeps undiscovered Companions anonymous and unpurchasable", async () => {
    render(
      <HomesteadScreen
        {...defaultProps}
        discoveredCardIds={[]}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 4 }}
      />,
    );
    const panel = await inspect();
    expect(within(panel).getByRole("img", { name: "Level 4 of 4" })).toBeTruthy();
    expect(panel.textContent).toContain("Physical damage is increased by 4");
    expect(panel.querySelector("[aria-label^='Upgrade cost']")).toBeNull();
    expect(nodeTile().classList.contains("homestead-node-affordable")).toBe(false);
    fireEvent.click(nodeTile());
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    const hidden = await screen.findAllByRole("button", { name: "View Undiscovered companion" });
    await waitForArtwork();
    fireEvent.mouseEnter(hidden[0]!);
    const discovery = await screen.findByRole("tooltip");
    expect(discovery.textContent).toContain("Discover this Companion during a Run.");
    expect(discovery.querySelector(".grayscale")).toBeNull();
    expect(screen.queryByRole("img", { name: "Wolf" })).toBeNull();
    fireEvent.click(hidden[0]!);
    expect(defaultProps.onBondCompanion).not.toHaveBeenCalled();
  });
});
