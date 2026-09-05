import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";

import { PortaledTooltip } from "@/features/alchemy/shared/ui/portaled-tooltip";
import { TOOLTIP_FADE_MS } from "@/lib/game-constants";

function TooltipHarness() {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
        Trigger
      </button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible}>
        <span>Tooltip content</span>
        {visible ? <p>Hover-only description</p> : null}
      </PortaledTooltip>
    </>
  );
}

describe("PortaledTooltip", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("places and reveals a tooltip on the first hidden-to-visible transition", async () => {
    render(<TooltipHarness />);

    act(() => {
      fireEvent.mouseEnter(screen.getByRole("button", { name: "Trigger" }));
    });

    await waitFor(() => expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy());
    const panel = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
    expect(panel?.style.left).not.toBe("");
    expect(panel?.style.top).not.toBe("");
    expect(panel?.textContent).toContain("Hover-only description");
  });

  it("keeps the placed tooltip mounted through fade-out, then unmounts it", async () => {
    vi.useFakeTimers();
    render(<TooltipHarness />);
    const trigger = screen.getByRole("button", { name: "Trigger" });

    act(() => {
      fireEvent.mouseEnter(trigger);
    });
    await act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();

    act(() => {
      fireEvent.mouseLeave(trigger);
    });
    const panel = document.querySelector<HTMLElement>(".hover-popup-panel");
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute("data-visible")).toBeNull();
    expect(panel?.style.left).not.toBe("");
    expect(panel?.style.top).not.toBe("");
    expect(panel?.textContent).toContain("Hover-only description");

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_FADE_MS / 2);
      fireEvent.mouseEnter(trigger);
    });
    expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain("Hover-only description");
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_FADE_MS);
    });
    expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();

    act(() => {
      fireEvent.mouseLeave(trigger);
    });

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_FADE_MS);
    });
    expect(document.querySelector(".hover-popup-panel")).toBeNull();
  });
});
