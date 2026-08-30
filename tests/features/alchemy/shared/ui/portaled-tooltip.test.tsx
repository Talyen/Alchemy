import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";

import { PortaledTooltip, TOOLTIP_FADE_OUT_MS } from "@/features/alchemy/shared/ui/portaled-tooltip";

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
      </PortaledTooltip>
    </>
  );
}

describe("PortaledTooltip", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("places and reveals a tooltip on the first hidden-to-visible transition", () => {
    render(<TooltipHarness />);

    act(() => {
      fireEvent.mouseEnter(screen.getByRole("button", { name: "Trigger" }));
    });

    const panel = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
    expect(panel).toBeTruthy();
    expect(panel?.style.left).not.toBe("");
    expect(panel?.style.top).not.toBe("");
  });

  it("keeps the placed tooltip mounted through fade-out, then unmounts it", async () => {
    vi.useFakeTimers();
    render(<TooltipHarness />);
    const trigger = screen.getByRole("button", { name: "Trigger" });

    act(() => {
      fireEvent.mouseEnter(trigger);
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

    act(() => {
      vi.advanceTimersByTime(TOOLTIP_FADE_OUT_MS);
    });
    expect(document.querySelector(".hover-popup-panel")).toBeNull();
  });
});
