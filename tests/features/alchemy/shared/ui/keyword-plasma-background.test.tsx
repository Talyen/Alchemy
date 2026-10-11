import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { KeywordPlasmaBackground } from "@/features/alchemy/shared/ui/keyword-plasma-background";
import { startKeywordPlasma } from "@/lib/animation/keyword-plasma";
vi.mock("@/lib/animation/keyword-plasma", () => ({ startKeywordPlasma: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

it("retargets without a color or velocity jump, settles, and paints black before sleeping", () => {
  vi.useFakeTimers();
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
  advanceFrame(199.99);
  const before = [...(colorsRef.current.primary as readonly number[])];
  advanceFrame(200);
  const displayed = [...(colorsRef.current.primary as readonly number[])];
  expect(displayed[1]).toBeGreaterThan(0);
  expect(displayed[1]).toBeLessThan(1);
  view.rerender(<KeywordPlasmaBackground colorPair={colorPair} intensity={50} />);
  expect(colorsRef.current.primary).toEqual(displayed);
  advanceFrame(200.01);
  const retargeted = colorsRef.current.primary as readonly number[];
  // Momentum survives a reversal instead of abruptly reversing the screen's color motion.
  expect(retargeted[1]! - displayed[1]!).toBeCloseTo(displayed[1]! - before[1]!, 6);
  advanceFrame(1800);
  expect(colorsRef.current).toEqual(colorPair);
  expect(pending.size).toBe(0);

  view.rerender(<KeywordPlasmaBackground colorPair={null} />);
  advanceFrame(3600);
  expect(colorsRef.current).toEqual({ primary: "#000000", secondary: "#000000" });
  const options = vi.mocked(startKeywordPlasma).mock.calls.at(-1)![0];
  expect(options.active?.()).toBe(true);
  act(() => vi.advanceTimersByTime(100));
  expect(options.active?.()).toBe(false);
  expect(pending.size).toBe(0);
});
