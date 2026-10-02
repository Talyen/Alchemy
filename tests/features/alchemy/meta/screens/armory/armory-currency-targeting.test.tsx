import { Profiler } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArmoryCurrencyCursor } from "@/features/alchemy/meta/screens/armory/armory-currency-targeting";

describe("Armory crafting cursor", () => {
  const frames = new Map<number, FrameRequestCallback>();

  beforeEach(() => {
    let nextId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("innerWidth", 800);
    vi.stubGlobal("innerHeight", 600);
  });

  afterEach(() => {
    cleanup();
    frames.clear();
    vi.unstubAllGlobals();
  });

  function nextFrame() {
    const callbacks = [...frames.values()];
    frames.clear();
    act(() => callbacks.forEach((callback) => callback(16)));
  }

  function move(target: Element, x: number, y: number, pointerType = "mouse") {
    const event = new Event("pointermove", { bubbles: true });
    Object.assign(event, { clientX: x, clientY: y, pointerType });
    fireEvent(target, event);
  }

  it("coalesces pointer movement and preserves placement without React commits on movement frames", () => {
    const onRender = vi.fn();
    const { rerender } = render(
      <>
        <div data-testid="armory-workspace" />
        <Profiler id="cursor" onRender={onRender}>
          <ArmoryCurrencyCursor activeCurrencyId="voidstone" />
        </Profiler>
      </>,
    );
    const workspace = screen.getByTestId("armory-workspace");
    move(workspace, 100, 120);
    nextFrame();
    const cursor = screen.getByTestId("armory-crafting-cursor");
    expect(cursor.style.left).toBe("100px");
    expect(cursor.style.top).toBe("120px");
    expect(cursor.querySelector("img")?.getAttribute("src")).toBeTruthy();
    onRender.mockClear();

    move(workspace, 200, 220);
    move(workspace, 790, 590);
    expect(frames.size).toBe(1);
    nextFrame();
    expect(screen.getByTestId("armory-crafting-cursor")).toBe(cursor);
    expect(cursor.style.left).toBe("688px");
    expect(cursor.style.top).toBe("488px");
    move(workspace, 400, 350);
    nextFrame();
    expect(cursor.style.left).toBe("400px");
    expect(cursor.style.top).toBe("350px");
    expect(onRender).not.toHaveBeenCalled();

    // A parent update must retain the latest pointer, including a changed clamp.
    vi.stubGlobal("innerWidth", 450);
    rerender(
      <>
        <div data-testid="armory-workspace" />
        <Profiler id="cursor" onRender={onRender}>
          <ArmoryCurrencyCursor activeCurrencyId="voidstone" />
        </Profiler>
      </>,
    );
    expect(cursor.style.left).toBe("338px");
    expect(cursor.style.top).toBe("350px");
  });

  it("hides outside the workspace and for touch, replaces artwork, and cancels pending work on teardown", () => {
    const { rerender, unmount } = render(
      <>
        <div data-testid="armory-workspace" />
        <ArmoryCurrencyCursor activeCurrencyId="voidstone" />
      </>,
    );
    const workspace = screen.getByTestId("armory-workspace");
    move(workspace, 100, 120);
    nextFrame();
    const originalArt = screen.getByTestId("armory-crafting-cursor").querySelector("img")?.getAttribute("src");
    move(document.body, 110, 130);
    nextFrame();
    expect(screen.queryByTestId("armory-crafting-cursor")).toBeNull();
    move(workspace, 140, 150, "touch");
    nextFrame();
    expect(screen.queryByTestId("armory-crafting-cursor")).toBeNull();
    move(workspace, 170, 180);
    nextFrame();

    rerender(
      <>
        <div data-testid="armory-workspace" />
        <ArmoryCurrencyCursor activeCurrencyId="discordant-dice" />
      </>,
    );
    nextFrame();
    const cursor = screen.getByTestId("armory-crafting-cursor");
    expect(cursor.style.left).toBe("170px");
    expect(cursor.style.top).toBe("180px");
    expect(cursor.querySelector("img")?.getAttribute("src")).not.toBe(originalArt);

    move(workspace, 190, 200);
    fireEvent(document.documentElement, new Event("pointerleave"));
    expect(screen.queryByTestId("armory-crafting-cursor")).toBeNull();
    nextFrame();
    expect(screen.queryByTestId("armory-crafting-cursor")).toBeNull();

    move(workspace, 210, 220);
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    move(workspace, 230, 240);
    expect(frames.size).toBe(0);
  });
});
