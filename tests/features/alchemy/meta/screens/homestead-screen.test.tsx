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
  await screen.findByRole("heading", { name: title });
}

async function review(action = "build", title = "Blacksmith") {
  fireEvent.click(await screen.findByRole("button", { name: `Review ${action} for ${title}` }));
  const dialog = await screen.findByRole("dialog", { name: title });
  await waitFor(() => expect(dialog.closest("[inert]")).toBeNull());
  return dialog;
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
    expect(screen.getByRole("region", { name: "On build" }).textContent).toContain("Physical damage +1");
    const dialog = await review();
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain("4");
    expect(dialog.textContent).toContain("11");
    expect(within(dialog).queryByRole("region", { name: "Bonuses" })).toBeNull();
    const buy = within(dialog).getByRole("button", { name: "Build" });
    fireEvent.click(buy);
    fireEvent.click(buy);
    expect(defaultProps.onConstructBuilding).toHaveBeenCalledExactlyOnceWith("blacksmiths-forge");
    expect(within(dialog).getByRole("button", { name: "Saving…" }).hasAttribute("disabled")).toBe(true);
    expect(playUISound).not.toHaveBeenCalled();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        afterProgressSaved={afterProgressSaved}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    expect(screen.getByLabelText("Upgrade progress").textContent).toContain("0/4");
    act(() => {
      saved!();
      saved!();
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("Upgrade progress").textContent).toContain("1/4");
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("talentUnlock");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    const gallery = await screen.findByRole("button", { name: "View Blacksmith, upgrade available" });
    await waitFor(() => expect(document.activeElement).toBe(gallery));
  });

  it("keeps unaffordable nodes inspectable and explains missing materials in the purchase sheet", async () => {
    render(<HomesteadScreen {...defaultProps} materialInventory={emptyInventory()} />);
    await inspect("Blacksmith");
    const dialog = await review();
    expect(within(dialog).getByRole("button", { name: "Build" }).hasAttribute("disabled")).toBe(true);
    expect(dialog.textContent).toContain("More materials needed");
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("heading", { name: "Blacksmith" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await screen.findByRole("button", { name: "View Blacksmith" });
  });

  it("inspects purchased effects on gallery and detail artwork, previews the next changes, and retains purchased color", async () => {
    render(
      <HomesteadScreen
        {...defaultProps}
        materialInventory={emptyInventory()}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    const art = screen.getByRole("img", { name: "Blacksmith" });
    expect(art.classList.contains("grayscale")).toBe(false);
    expect(screen.queryByRole("button", { name: "View Blacksmith, upgrade available" })).toBeNull();
    const tile = screen.getByRole("button", { name: "View Blacksmith" });
    act(() => tile.focus());
    const galleryTooltip = await screen.findByRole("tooltip");
    expect(galleryTooltip.textContent).toContain("Blacksmith");
    expect(galleryTooltip.textContent).toContain("Physical damage +1");
    await inspect("Blacksmith");
    expect(screen.queryByRole("tooltip")).toBeNull();
    const next = screen.getByRole("region", { name: "Next upgrade" });
    expect(next.textContent).toContain("Physical damage +1 → 2");
    expect(next.textContent).toContain("Burn damage gains 10 → 20% of Forge.");
    expect(next.textContent).toContain("+1 → 2 Iron per Room");
    const tooltip = await inspectArtwork();
    const bonuses = within(tooltip).getByRole("region", { name: "Bonuses" });
    expect(bonuses.textContent).toContain("Physical damage +1");
    expect(bonuses.textContent).not.toContain("Physical damage +2");
    expect(bonuses.textContent).not.toContain("per Room");
    expect(within(tooltip).getByRole("region", { name: "Production" }).textContent).toContain("+1 Iron per Room");
    expect(screen.getByRole("img", { name: "Blacksmith" }).classList.contains("grayscale")).toBe(false);
    act(() => screen.getByRole("button", { name: "Review upgrade for Blacksmith" }).focus());
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(screen.queryByRole("region", { name: "Bonuses" })).toBeNull();
    expect(screen.getByLabelText("Upgrade progress").textContent).toContain("1/4");
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("does not spend against a quote whose tier changed while it was open", async () => {
    const { rerender } = render(<HomesteadScreen {...defaultProps} />);
    await inspect("Blacksmith");
    const dialog = await review();
    rerender(
      <HomesteadScreen
        {...defaultProps}
        constructedBuildings={{ ...defaultProps.constructedBuildings, "blacksmiths-forge": 1 }}
      />,
    );
    expect(within(dialog).getByRole("button", { name: "Build" }).hasAttribute("disabled")).toBe(true);
    expect(dialog.textContent).toContain("This upgrade has changed");
    fireEvent.click(within(dialog).getByRole("button", { name: "Build" }));
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("reports rejected purchases and ignores saved feedback after leaving the detail page", async () => {
    const afterProgressSaved = vi.fn();
    const { rerender, unmount } = render(
      <HomesteadScreen {...defaultProps} onConstructBuilding={() => false} afterProgressSaved={afterProgressSaved} />,
    );
    await inspect("Blacksmith");
    const dialog = await review();
    fireEvent.click(within(dialog).getByRole("button", { name: "Build" }));
    expect(dialog.textContent).toContain("Purchase unavailable");
    expect(afterProgressSaved).not.toHaveBeenCalled();
    rerender(<HomesteadScreen {...defaultProps} afterProgressSaved={afterProgressSaved} />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Build" }));
    expect(afterProgressSaved).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
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
    const dialog = await review("build", title);
    fireEvent.click(within(dialog).getByRole("button", { name: "Build" }));
    expect(command).toHaveBeenCalledExactlyOnceWith(id);
    expect(defaultProps.onConstructBuilding).not.toHaveBeenCalled();
  });

  it("bonds the Companion selected on the second page and returns to that page", async () => {
    render(<HomesteadScreen {...defaultProps} discoveredCardIds={cardLibrary.map((card) => card.id)} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    await screen.findByRole("button", { name: /^View Wolf,/ });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await inspect("Mana Moth");
    const dialog = await review("bond", "Mana Moth");
    fireEvent.click(within(dialog).getByRole("button", { name: "Bond" }));
    expect(defaultProps.onBondCompanion).toHaveBeenCalledExactlyOnceWith("mana-moth");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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
    expect(screen.getByLabelText("Upgrade progress").textContent).toContain("4/4");
    const tooltip = await inspectArtwork();
    expect(within(tooltip).getByRole("region", { name: "Bonuses" }).textContent).toContain("Physical damage +4");
    expect(screen.queryByRole("button", { name: /Review/ })).toBeNull();
  });

  it("conceals undiscovered Companion identity and keeps its discovery requirement inspectable", async () => {
    render(<HomesteadScreen {...defaultProps} discoveredCardIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Companions" }));
    const hidden = await screen.findAllByRole("button", { name: "View Undiscovered companion" });
    fireEvent.click(hidden[0]!);
    await screen.findByRole("heading", { name: "Undiscovered companion" });
    expect(screen.queryByRole("img", { name: "Wolf" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Review/ })).toBeNull();
    expect(screen.getByText("Discover this Companion during a Run.")).toBeTruthy();
  });
});
