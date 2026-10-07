import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { InteractiveArtTile } from "@/features/alchemy/shared/ui/interactive-art-tile";
import { TOOLTIP_FADE_MS } from "@/lib/game-constants";
import userEvent from "@testing-library/user-event";

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
  it("allows keyboard inspection of non-actionable reward and Boon tiles", () => {
    render(
      <InteractiveArtTile
        id="ruby-ring"
        interactionKey="reward"
        title="Ruby Ring"
        art={undefined}
        className=""
        imageClassName=""
        popup={({ visible }) => <div data-testid="tile-popup">{visible ? "shown" : "hidden"}</div>}
      />,
    );
    const tile = screen.getByRole("group", { name: "Ruby Ring" });
    expect(tile.tabIndex).toBe(0);
    act(() => tile.focus());
    expect(screen.getByTestId("tile-popup").textContent).toBe("shown");
    act(() => tile.blur());
    expect(screen.getByTestId("tile-popup").textContent).toBe("hidden");
  });

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
      vi.advanceTimersByTime(TOOLTIP_FADE_MS);
    });
    expect(screen.queryByTestId("tile-popup")).toBeNull();
  });

  it("keeps unavailable tiles inspectable and preserves explicit rejection feedback", async () => {
    const onRejected = vi.fn();
    const tile = (disabled: boolean) => (
      <InteractiveArtTile
        id="sold-ring"
        interactionKey="shop"
        title="Ruby Ring"
        art={undefined}
        className=""
        imageClassName=""
        as="button"
        interactiveChrome={false}
        disabled={disabled}
        ariaDisabled
        onClick={onRejected}
        popup={({ visible }) => <div data-testid="tile-popup">{visible ? "shown" : "hidden"}</div>}
      />
    );
    const { rerender } = render(tile(true));

    const button = screen.getByRole("button", { name: "Ruby Ring" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).not.toMatch(/card-interactive-glow/);

    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.getByTestId("tile-popup").textContent).toBe("shown");
    rerender(tile(false));
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter} ");
    expect(onRejected).toHaveBeenCalledTimes(2);
  });
});
