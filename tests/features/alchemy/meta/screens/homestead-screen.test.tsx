import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomesteadScreen } from "@/features/alchemy/meta/screens/homestead-screen";
import { emptyInventory } from "@/lib/homestead/inventory";
import { cardLibrary, defaultCompanionBondLevels } from "@/lib/game-data";
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
};

async function inspect(title = "Blacksmith") {
  await waitForArtwork();
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^View ${title}(,|$)`) }), { detail: 1 });
  return screen.findByRole("dialog", { name: title });
}

function purchaseButton(action = "Build", title = "Blacksmith") {
  return screen.getByRole("button", { name: new RegExp(`^${action} ${title} for `) });
}

describe("HomesteadScreen", () => {
  installDisabledAnimationsForTests();
  installReadyArtworkForTests();
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("inspects without spending, shows only build costs, and reveals purchased progress after saving once", async () => {
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
    const buy = purchaseButton();
    expect(buy.getAttribute("aria-label")).toBe("Build Blacksmith for 4 Stone, 11 Iron");
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
    expect(within(panel).getByRole("img", { name: "Level 1 of 4" })).toBeTruthy();
    expect(panel.textContent).toContain("Physical damage is increased by 1");
    expect(panel.textContent).toContain("Find 10% more");
    expect(panel.textContent).not.toContain("Physical damage is increased by 2");
    expect(vi.mocked(playUISound).mock.calls.filter(([sound]) => sound === "talentUnlock")).toHaveLength(1);
  });

  it("accepts each tier once even when acknowledgment runs before React renders", async () => {
    const { rerender } = render(<HomesteadScreen {...defaultProps} />);
    await inspect();
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

  it("keeps purchased artwork colored and exposes current effects and missing materials on focus", async () => {
    render(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    const tile = screen.getByRole("button", { name: "View Blacksmith" });
    await waitForArtwork();
    act(() => tile.focus());
    const panel = await screen.findByRole("dialog", { name: "Blacksmith" });
    expect(panel.textContent).toContain("Physical damage is increased by 1");
    expect(panel.textContent).toContain("More materials needed");
    const buy = purchaseButton("Upgrade");
    expect(buy.hasAttribute("disabled")).toBe(true);
    fireEvent.click(buy);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(tile);
  });

  it("has one active panel, keeps pinned inspection while hovering elsewhere, and dismisses outside", async () => {
    render(<HomesteadScreen {...defaultProps} />);
    await inspect();
    const other = screen.getByRole("button", { name: /^View Hunter's Lodge/ });
    fireEvent.mouseEnter(other);
    expect(screen.getByRole("dialog", { name: "Blacksmith" })).toBeTruthy();
    fireEvent.click(other, { detail: 1 });
    await screen.findByRole("dialog", { name: "Hunter's Lodge" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps hover open over panel content and closes on leaving both surfaces", async () => {
    render(<HomesteadScreen {...defaultProps} />);
    await waitForArtwork();
    fireEvent.mouseEnter(screen.getByRole("button", { name: /^View Blacksmith/ }));
    const panel = await screen.findByRole("dialog", { name: "Blacksmith" });
    fireEvent.pointerMove(panel);
    expect(screen.getByRole("dialog", { name: "Blacksmith" })).toBeTruthy();
    fireEvent.pointerMove(document.body, { clientX: 9999, clientY: 9999 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("finishes an accepted purchase after closing its panel and changing tabs", async () => {
    let saved: (() => void) | undefined;
    const afterProgressSaved = (feedback: () => void) => {
      saved = feedback;
    };
    const { rerender } = render(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    await inspect();
    fireEvent.click(purchaseButton());
    fireEvent.click(screen.getByRole("button", { name: "Farm" }));
    await screen.findByRole("button", { name: /^View Wheat Field/ });
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

  it("updates costs while open and reports rejected purchases without saving", async () => {
    const afterProgressSaved = vi.fn();
    const { rerender } = render(
      <HomesteadScreen {...defaultProps} onConstructBuilding={() => false} afterProgressSaved={afterProgressSaved} />,
    );
    await inspect();
    fireEvent.click(purchaseButton());
    expect(screen.getByRole("alert").textContent).toContain("Purchase unavailable");
    expect(afterProgressSaved).not.toHaveBeenCalled();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    expect(purchaseButton("Upgrade").getAttribute("aria-label")).toBe("Upgrade Blacksmith for 8 Stone, 22 Iron");
    expect(purchaseButton("Upgrade").hasAttribute("disabled")).toBe(true);
  });

  it.each([
    { tab: "Farm", title: "Herb Garden", id: "herb-garden", command: defaultProps.onPlantFarm },
    { tab: "Research", title: "Leyline Energy", id: "leyline-energy", command: defaultProps.onCompleteResearch },
  ])("routes $tab purchases through their own command", async ({ tab, title, id, command }) => {
    render(<HomesteadScreen {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await inspect(title);
    fireEvent.click(purchaseButton("Build", title));
    expect(command).toHaveBeenCalledExactlyOnceWith(id);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("bonds a Companion on the second page without leaving that page", async () => {
    render(<HomesteadScreen {...defaultProps} discoveredCardIds={cardLibrary.map((card) => card.id)} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    await screen.findByRole("button", { name: /^View Wolf/ });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    const panel = await inspect("Mana Moth");
    expect(within(panel).getByRole("img", { name: "Bond 0 of 3" })).toBeTruthy();
    fireEvent.click(purchaseButton("Bond", "Mana Moth"));
    expect(defaultProps.onBondCompanion).toHaveBeenCalledExactlyOnceWith("mana-moth");
    expect(screen.queryByRole("button", { name: /^View Wolf/ })).toBeNull();
  });

  it("shows completed benefits and hides undiscovered Companion identities without offering a purchase", async () => {
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
    expect(screen.queryByRole("button", { name: /^Upgrade/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    const hidden = await screen.findAllByRole("button", { name: "View Undiscovered companion" });
    await waitForArtwork();
    fireEvent.click(hidden[0]!, { detail: 1 });
    expect((await screen.findByRole("dialog", { name: "Undiscovered companion" })).textContent).toContain(
      "Discover this Companion during a Run.",
    );
    expect(screen.queryByRole("img", { name: "Wolf" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Bond/ })).toBeNull();
  });
});
