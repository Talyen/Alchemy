import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GearItemTitle } from "@/features/alchemy/shared/ui/gear-item-title";
import { GearTooltipContent } from "@/features/alchemy/shared/ui/gear-tooltip-content";
import { GearTile, TrinketTile } from "@/features/alchemy/shared/ui/collection-art-tiles";
import { TrinketItemTitle } from "@/features/alchemy/shared/ui/trinket-item-title";
import { CompendiumTile } from "@/features/alchemy/shared/ui/collection-tile";
import { trinketById } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear";

afterEach(() => {
  cleanup();
});

describe("item name shine", () => {
  it("shines astral and unique gear titles and leaves basic plain", () => {
    const { rerender } = render(
      <GearItemTitle instance={{ instanceId: "a", definitionId: "longsword-astral", affixes: [] }} />,
    );
    expect(screen.getByText("Astral Longsword").classList.contains("boss-title-shine")).toBe(true);

    rerender(<GearItemTitle instance={{ instanceId: "u", definitionId: "wardbreaker", affixes: [] }} />);
    expect(screen.getByText("Wardbreaker").classList.contains("boss-title-shine")).toBe(true);

    rerender(<GearItemTitle instance={{ instanceId: "b", definitionId: "longsword-basic", affixes: [] }} />);
    expect(screen.getByText("Longsword").classList.contains("boss-title-shine")).toBe(false);
  });

  it("shines definition-only astral and unique tooltip headers", () => {
    const { rerender } = render(<GearTooltipContent definition={gearDefinitions["longsword-astral"]!} />);
    expect(screen.getByText("Astral Longsword").classList.contains("boss-title-shine")).toBe(true);

    rerender(<GearTooltipContent definition={gearDefinitions.wardbreaker!} />);
    expect(screen.getByText("Wardbreaker").classList.contains("boss-title-shine")).toBe(true);

    rerender(<GearTooltipContent definition={gearDefinitions["longsword-basic"]!} />);
    expect(screen.getByText("Longsword").classList.contains("boss-title-shine")).toBe(false);
  });

  it("shines trinket titles", () => {
    const trinket = trinketById.meteorite!;
    render(<TrinketItemTitle trinket={trinket} />);
    const title = screen.getByText("Meteorite");
    expect(title.classList.contains("boss-title-shine")).toBe(true);
    expect(title.style.backgroundImage).toContain("linear-gradient");
    expect(title.style.backgroundImage).toContain("rgb(255, 255, 255)");
    expect(title.style.getPropertyValue("--shine-text-glow-color")).toBeTruthy();
  });
});

describe("item portrait shine", () => {
  it("puts a keyword shine border on trinket tiles and not on basic gear", () => {
    const trinket = trinketById.meteorite!;
    const { container, rerender } = render(<TrinketTile trinket={trinket} interactionKey="test" />);
    expect(container.querySelector(".shine-border")).not.toBeNull();
    expect(container.querySelector(".has-shine-border")).not.toBeNull();

    rerender(<TrinketTile trinket={trinket} interactionKey="test" shine={false} />);
    expect(container.querySelector(".shine-border")).toBeNull();

    rerender(
      <GearTile
        instance={{ instanceId: "basic-1", definitionId: "longsword-basic", affixes: [] }}
        interactionKey="test"
      />,
    );
    expect(container.querySelector(".shine-border")).toBeNull();
  });

  it("shines discovered collection trinkets and leaves undiscovered plain", () => {
    const trinket = trinketById.meteorite!;
    const { container, rerender } = render(
      <CompendiumTile
        item={{
          id: trinket.id,
          title: trinket.title,
          subtitle: undefined,
          descriptionLines: trinket.descriptionLines,
          art: trinket.art,
          discovered: true,
          hoverScope: "collection-trinket",
          frameType: "trinket",
        }}
      />,
    );
    expect(container.querySelector(".shine-border")).not.toBeNull();

    rerender(
      <CompendiumTile
        item={{
          id: trinket.id,
          title: "Undiscovered",
          subtitle: undefined,
          descriptionLines: ["hidden"],
          art: trinket.art,
          discovered: false,
          hoverScope: "collection-trinket",
          frameType: "trinket",
        }}
      />,
    );
    expect(container.querySelector(".shine-border")).toBeNull();
  });
});
