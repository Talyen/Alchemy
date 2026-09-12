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
