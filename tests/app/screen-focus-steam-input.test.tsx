import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useScreenFocus } from "@/app/use-screen-focus";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("recovers focus after the backward Steam Input bumper is pressed during screen preparation", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
  function PreparingScreen({ ready }: { ready: boolean }) {
    useScreenFocus("collection", ready);
    return <div data-screen-content>{ready ? <button>Back</button> : null}</div>;
  }
  const { rerender } = render(<PreparingScreen ready={false} />);
  fireEvent.keyDown(window, { key: "F7" });
  rerender(<PreparingScreen ready />);
  const back = screen.getByRole("button", { name: "Back" });
  vi.spyOn(back, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  back.scrollIntoView = vi.fn();
  act(() => {
    for (const frame of frames.values()) frame(16);
  });
  expect(document.activeElement).toBe(back);
});
