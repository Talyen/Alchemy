import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CollectionTile } from "@/features/alchemy/shared/ui/collection-tile";
import { getCollectionPageItems } from "@/features/alchemy/shared/ui/collection-items";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import { cardLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import { uniqueItemList } from "@/lib/gear";

beforeEach(() => useUiStore.setState({ hoveredCardId: null, shimmerState: null }));
afterEach(cleanup);

for (const tab of ["heroes", "cards", "bestiary", "trinkets", "uniques"] satisfies CollectionTab[]) {
  describe(`${tab} Collection borders`, () => {
    const item = getCollectionPageItems({
      collectionTab: tab,
      discoveredCardIds: cardLibrary.map((entry) => entry.id),
      encounteredEnemyIds: enemyBestiary.map((entry) => entry.id),
      discoveredTrinketIds: trinketLibrary.map((entry) => entry.id),
      discoveredUniqueIds: uniqueItemList.map((entry) => entry.id),
      page: 0,
    })[0]!;

    it("uses a grey idle frame and shows Shine only during hover or focus", () => {
      render(<CollectionTile item={{ ...item, discovered: true }} />);
      const button = screen.getByRole("button", { name: /^Inspect / });
      expect(button.querySelector(".shine-border")).toBeNull();
      expect(button.className).toContain("border-border/80");
      fireEvent.mouseEnter(button.parentElement!);
      expect(button.querySelector(".shine-border")).not.toBeNull();
      fireEvent.mouseLeave(button.parentElement!);
      expect(button.querySelector(".shine-border")).toBeNull();
      fireEvent.focus(button);
      expect(button.querySelector(".shine-border")).not.toBeNull();
      fireEvent.blur(button);
      expect(button.querySelector(".shine-border")).toBeNull();
    });

    it("keeps locked or undiscovered entries neutral", () => {
      render(<CollectionTile item={{ ...item, discovered: false }} />);
      const button = screen.getByRole("button", { name: /^Inspect / });
      fireEvent.mouseEnter(button.parentElement!);
      expect(button.querySelector(".shine-border")).toBeNull();
      expect(button.className).not.toContain("card-interactive-glow");
      fireEvent.focus(button);
      expect(button.querySelector(".shine-border")).toBeNull();
    });
  });
}
