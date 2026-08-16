// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { InteractiveArtTile } from "@/features/alchemy/shared/ui/interactive-art-tile";
import { TOOLTIP_FADE_OUT_MS } from "@/features/alchemy/shared/ui/portaled-tooltip";

function renderTile() {
  return render(
    <InteractiveArtTile
      id="ruby-ring"
      interactionKey="reward"
      title="Ruby Ring"
      art={undefined}
      className=""
      imageClassName=""
      as="button"
      popup={({ visible }) => <div data-testid="tile-popup">{visible ? "shown" : "hidden"}</div>}
    />,
  );
}

beforeEach(() => {
  useUiStore.setState({ hoveredCardId: null, shimmerState: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("InteractiveArtTile hover popup", () => {
  it("keeps the popup visible when the pointer leaves a focused tile", () => {
    renderTile();
    const button = screen.getByRole("button", { name: "Ruby Ring" });
    act(() => {
      button.focus();
    });
    fireEvent.focus(button);

    expect(document.activeElement).toBe(button);
    expect(screen.getByTestId("tile-popup").textContent).toBe("shown");

    fireEvent.mouseLeave(button.parentElement!);

    expect(screen.getByTestId("tile-popup").textContent).toBe("shown");
  });

  it("unmounts the popup after the tooltip fade when hover ends", () => {
    vi.useFakeTimers();
    renderTile();
    const wrapper = screen.getByRole("button", { name: "Ruby Ring" }).parentElement!;
    fireEvent.mouseEnter(wrapper);

    expect(screen.getByTestId("tile-popup").textContent).toBe("shown");

    fireEvent.mouseLeave(wrapper);
    expect(screen.getByTestId("tile-popup").textContent).toBe("hidden");

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_FADE_OUT_MS);
    });
    expect(screen.queryByTestId("tile-popup")).toBeNull();
  });

  it("keeps the hover popup without glow chrome when the tile is disabled", () => {
    render(
      <InteractiveArtTile
        id="sold-ring"
        interactionKey="shop"
        title="Ruby Ring"
        art={undefined}
        className=""
        imageClassName=""
        as="button"
        interactiveChrome={false}
        disabled
        popup={({ visible }) => <div data-testid="tile-popup">{visible ? "shown" : "hidden"}</div>}
      />,
    );

    const button = screen.getByRole("button", { name: "Ruby Ring" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).not.toMatch(/card-interactive-glow/);

    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.getByTestId("tile-popup").textContent).toBe("shown");
  });

  it("renders a shine border and keeps hover glow without a second frame", () => {
    render(
      <InteractiveArtTile
        id="astral-ring"
        interactionKey="reward"
        title="Astral Ruby Ring"
        art={undefined}
        className=""
        imageClassName=""
        as="button"
        shineColor={["#cbd5e1", "#64748b"]}
      />,
    );

    const button = screen.getByRole("button", { name: "Astral Ruby Ring" });
    expect(button.querySelector(".shine-border")).not.toBeNull();
    expect(button.className).toMatch(/card-interactive-glow/);
    expect(button.className).toMatch(/has-shine-border/);
  });
});
