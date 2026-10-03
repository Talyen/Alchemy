import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { KeywordPlasmaBackground } from "@/features/alchemy/shared/ui/keyword-plasma-background";
import { startKeywordPlasma } from "@/lib/animation/keyword-plasma";
vi.mock("@/lib/animation/keyword-plasma", () => ({ startKeywordPlasma: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
const colorPair = { primary: "#ff0000", secondary: "#0000ff" };
it("starts after zero intensity becomes visible, switches decoration on failure, and cleans up", () => {
  const stop = vi.fn();
  vi.mocked(startKeywordPlasma).mockReturnValue(stop);
  const view = render(<KeywordPlasmaBackground colorPair={colorPair} intensity={0} />);
  expect(screen.queryByTestId("global-plasma-background")).toBeNull();
  view.rerender(<KeywordPlasmaBackground colorPair={colorPair} intensity={50} />);
  const options = vi.mocked(startKeywordPlasma).mock.calls.at(-1)![0];
  act(() => options.onAvailabilityChange?.(false));
  expect(screen.getByTestId("static-plasma-background")).toBeTruthy();
  act(() => options.onAvailabilityChange?.(true));
  expect(screen.queryByTestId("static-plasma-background")).toBeNull();
  view.rerender(<KeywordPlasmaBackground colorPair={colorPair} intensity={0} />);
  expect(stop).toHaveBeenCalledOnce();
});
it("does not animate color changes or start a renderer when animations are disabled", () => {
  localStorage.setItem("alchemy-disable-animations", "true");
  const raf = vi.fn();
  vi.stubGlobal("requestAnimationFrame", raf);
  const count = vi.mocked(startKeywordPlasma).mock.calls.length;
  const view = render(<KeywordPlasmaBackground colorPair={colorPair} />);
  view.rerender(<KeywordPlasmaBackground colorPair={{ primary: "#ffffff", secondary: "#eeeeee" }} />);
  expect(startKeywordPlasma).toHaveBeenCalledTimes(count);
  expect(raf).not.toHaveBeenCalled();
  expect(screen.queryByTestId("static-plasma-background")).toBeNull();
});

it("finishes fades across equivalent rerenders and starts interrupted fades from the displayed colors", () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const pending = new Map<number, FrameRequestCallback>();
  let nextFrameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending.set(++nextFrameId, callback);
    return nextFrameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
  vi.mocked(startKeywordPlasma).mockReturnValue(vi.fn());
  const advanceFrame = (time: number) => {
    now = time;
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => callbacks.forEach((callback) => callback(time)));
  };
  const view = render(<KeywordPlasmaBackground colorPair={colorPair} />);
  const { colorsRef } = vi.mocked(startKeywordPlasma).mock.calls.at(-1)![0];
  view.rerender(<KeywordPlasmaBackground colorPair={{ primary: "#ffffff", secondary: "#ffffff" }} />);
  advanceFrame(200);
  expect(colorsRef.current.primary).toEqual([1, 0.5, 0.5]);
  view.rerender(<KeywordPlasmaBackground colorPair={{ primary: "#ffffff", secondary: "#ffffff" }} intensity={50} />);
  advanceFrame(400);
  expect(colorsRef.current).toEqual({ primary: [1, 1, 1], secondary: [1, 1, 1] });
  expect(pending.size).toBe(0);

  view.rerender(<KeywordPlasmaBackground colorPair={colorPair} />);
  advanceFrame(600);
  expect(colorsRef.current).toEqual({ primary: [1, 0.5, 0.5], secondary: [0.5, 0.5, 1] });
  view.rerender(<KeywordPlasmaBackground colorPair={{ primary: "#000000", secondary: "#000000" }} />);
  advanceFrame(700);
  expect(colorsRef.current).toEqual({ primary: [0.75, 0.375, 0.375], secondary: [0.375, 0.375, 0.75] });
  advanceFrame(800);
  expect(colorsRef.current).toEqual({ primary: [0.5, 0.25, 0.25], secondary: [0.25, 0.25, 0.5] });
  advanceFrame(1000);
  expect(colorsRef.current).toEqual({ primary: [0, 0, 0], secondary: [0, 0, 0] });
  expect(pending.size).toBe(0);
});
