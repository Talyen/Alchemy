import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";

import { PortaledTooltip } from "@/features/alchemy/shared/ui/tooltips/portaled-tooltip";
import { KeywordTag } from "@/features/alchemy/shared/ui/keyword-tag";
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

function StaleTooltipHarness({ hand = false }: { hand?: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div data-testid="pointer-boundary">
        <div data-hand-slot={hand ? "card" : undefined}>
          <button ref={triggerRef}>Trigger</button>
        </div>
        <span data-testid="gap">Gap</span>
      </div>
      <button onPointerMove={(event) => event.stopPropagation()}>Overlay choice</button>
      {/* Model a leave/blur event lost by the trigger's hover owner. */}
      <PortaledTooltip triggerRef={triggerRef} visible>
        Tooltip content
      </PortaledTooltip>
    </>
  );
}

describe("PortaledTooltip", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each(["move", "press", "focus", "window blur", "window exit"])(
    "dismisses a stale tooltip on outside %s and allows keyboard inspection again",
    async (input) => {
      render(<StaleTooltipHarness />);
      await waitFor(() => expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy());
      const outside = screen.getByRole("button", { name: "Overlay choice" });
      if (input === "move") fireEvent.pointerMove(outside);
      if (input === "press") fireEvent.pointerDown(outside);
      if (input === "focus") act(() => outside.focus());
      if (input === "window blur") fireEvent.blur(window);
      if (input === "window exit") fireEvent.pointerOut(document.body, { relatedTarget: null });

      expect(document.querySelector("[role='tooltip'][data-visible]")).toBeNull();
      await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
      act(() => screen.getByRole("button", { name: "Trigger" }).focus());
      await waitFor(() => expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy());
    },
  );

  it("reopens on pointer return even when the hover owner never changed", async () => {
    render(<StaleTooltipHarness />);
    await waitFor(() => expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy());
    fireEvent.pointerMove(screen.getByRole("button", { name: "Overlay choice" }));
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeNull();
    fireEvent.pointerMove(screen.getByRole("button", { name: "Trigger" }));
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy();
  });

  it("preserves keyboard inspection on pointer exit but still dismisses on an outside press", async () => {
    render(<KeywordTag keywordId="burn" showTooltip />);
    const trigger = screen.getByRole("button", { name: "Inspect Burn keyword" });
    act(() => trigger.focus());
    await waitFor(() => expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy());
    const description = trigger.getAttribute("aria-describedby");

    fireEvent.pointerMove(document.body);
    fireEvent.pointerOut(document.body, { relatedTarget: null });
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy();
    expect(trigger.getAttribute("aria-describedby")).toBe(description);

    fireEvent.pointerDown(document.body);
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeNull();
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);
    fireEvent.pointerMove(document.body);
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeNull();
  });

  it("keeps retained focus dismissed across window blur and return until fresh inspection", async () => {
    render(<KeywordTag keywordId="burn" showTooltip />);
    const trigger = screen.getByRole("button", { name: "Inspect Burn keyword" });
    act(() => trigger.focus());
    await waitFor(() => expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy());

    fireEvent.blur(window);
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeNull();
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);
    fireEvent.focus(window);
    fireEvent.pointerMove(document.body);
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeNull();

    fireEvent.pointerMove(trigger);
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy();
    fireEvent.blur(window);
    fireEvent.focus(window);
    act(() => trigger.blur());
    act(() => trigger.focus());
    await waitFor(() => expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy());
    expect(trigger.hasAttribute("aria-describedby")).toBe(true);
  });

  it("preserves geometry-selected hand inspection across gaps but dismisses outside the hand", async () => {
    render(<StaleTooltipHarness hand />);
    await waitFor(() => expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy());
    fireEvent.pointerMove(screen.getByTestId("gap"));
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeTruthy();
    fireEvent.pointerMove(screen.getByRole("button", { name: "Overlay choice" }));
    expect(document.querySelector("[role='tooltip'][data-visible]")).toBeNull();
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

    fireEvent.pointerDown(document.body);
    expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeNull();
    fireEvent.mouseLeave(screen.getByRole("button", { name: "Trigger" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Trigger" }));
    await waitFor(() => expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy());
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
