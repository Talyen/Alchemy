import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CollectionTile } from "@/features/alchemy/meta/screens/collection/collection-tile";
import { getCollectionPageItems } from "@/features/alchemy/meta/screens/collection/collection-items";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { cardLibrary } from "@/lib/game-data";

beforeEach(() => useUiStore.setState({ hoveredCardId: null, shimmerState: null }));
afterEach(cleanup);

const item = getCollectionPageItems({
  collectionTab: "cards",
  discoveredCardIds: cardLibrary.map((entry) => entry.id),
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  discoveredUniqueIds: [],
  page: 0,
})[0]!;

describe("Collection borders", () => {
  it("shows matching shine on discovered and undiscovered entries during hover or focus", () => {
    const discovered = render(<CollectionTile item={{ ...item, discovered: true }} />);
    const discoveredButton = screen.getByRole("button", { name: /^Inspect / });

    expect(discoveredButton.querySelector(".shine-border")).toBeNull();
    expect(discoveredButton.className).toContain("border-border/80");
    fireEvent.mouseEnter(discoveredButton.parentElement!);
    const shineColor = discoveredButton.querySelector<HTMLElement>(".shine-border-paint")?.style.backgroundColor;
    expect(shineColor).toBeTruthy();
    expect(discoveredButton.className).toContain("card-interactive-glow");
    fireEvent.mouseLeave(discoveredButton.parentElement!);
    fireEvent.focus(discoveredButton);
    expect(discoveredButton.querySelector(".shine-border")).not.toBeNull();
    fireEvent.blur(discoveredButton);
    expect(discoveredButton.querySelector(".shine-border")).toBeNull();

    discovered.unmount();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null });
    render(<CollectionTile item={{ ...item, discovered: false }} />);
    const undiscoveredButton = screen.getByRole("button", { name: "Inspect Undiscovered Entry" });
    expect(undiscoveredButton.querySelector(".shine-border")).toBeNull();
    fireEvent.mouseEnter(undiscoveredButton.parentElement!);
    expect(undiscoveredButton.querySelector<HTMLElement>(".shine-border-paint")?.style.backgroundColor).toBe(
      shineColor,
    );
    fireEvent.mouseLeave(undiscoveredButton.parentElement!);
    fireEvent.focus(undiscoveredButton);
    expect(undiscoveredButton.querySelector(".shine-border")).not.toBeNull();
    fireEvent.blur(undiscoveredButton);
    expect(undiscoveredButton.querySelector(".shine-border")).toBeNull();
  });
});
