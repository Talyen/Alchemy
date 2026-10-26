import { StrictMode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BossIdleArt } from "@/features/alchemy/run-loop/battle/presentation/ui/boss-idle-art";

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/slice-death", () => ({ SliceDeath: () => null }));
const clips = ["a", "b"].map((id) => ({
  variants: [
    { width: 640, src: `${id}-640.mp4` },
    { width: 1280, src: `${id}-1280.mp4` },
    { width: 1920, src: `${id}-1920.mp4` },
  ] as const,
}));
let hidden = false;

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 596 } as DOMRect);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(8);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount() {
  const view = render(
    <BossIdleArt clips={clips} art="portrait.webp" title="Boss" isDead={false} imageClassName="aspect-video" />,
  );
  return { ...view, videos: [...view.container.querySelectorAll("video")] };
}

it("starts the preloaded clip before the seam and rewinds a reused buffer after blending", () => {
  const { videos, getByAltText } = mount();
  const [first, second] = videos as [HTMLVideoElement, HTMLVideoElement];
  const fallback = getByAltText("Boss");
  expect(fallback.classList.contains("opacity-0")).toBe(false);
  fireEvent.playing(first);
  expect(fallback.classList.contains("opacity-0")).toBe(true);
  first.currentTime = 7.76;
  act(() => vi.advanceTimersByTime(7760));
  expect(HTMLMediaElement.prototype.play).toHaveBeenLastCalledWith();
  expect(vi.mocked(HTMLMediaElement.prototype.play).mock.contexts.at(-1)).toBe(second);
  // The outgoing frame remains fully opaque while an incoming decoder starts.
  expect(first.style.opacity).toBe("1");
  expect(fallback.classList.contains("opacity-0")).toBe(true);
  expect(second.style.opacity).toBe("0");
  fireEvent.playing(second);
  expect(second.style.opacity).toBe("1");
  expect(first.style.opacity).toBe("1");
  act(() => vi.advanceTimersByTime(180));
  expect(first.currentTime).toBe(0);
  expect(first.getAttribute("src")).toBe("a-640.mp4");
  act(() => vi.advanceTimersByTime(7580));
  expect(vi.mocked(HTMLMediaElement.prototype.play).mock.contexts.at(-1)).toBe(first);
  expect(first.currentTime).toBe(0);
  fireEvent.error(first);
  expect(fallback.classList.contains("opacity-0")).toBe(false);
  expect(first.isConnected).toBe(false);
});

it("changes density at the next clip without seeking or replacing the visible video", () => {
  const {
    videos: [first, second],
  } = mount();
  fireEvent.playing(first!);
  first!.currentTime = 3;
  vi.stubGlobal("devicePixelRatio", 2);
  fireEvent(window, new Event("resize"));
  expect(first!.getAttribute("src")).toBe("a-640.mp4");
  expect(first!.currentTime).toBe(3);
  expect(second!.getAttribute("src")).toBe("b-1280.mp4");
});

it("pauses both decoders and cancels the seam when the tab is hidden", () => {
  const {
    videos: [first],
  } = mount();
  fireEvent.playing(first!);
  const play = vi.mocked(HTMLMediaElement.prototype.play);
  play.mockClear();
  hidden = true;
  fireEvent(document, new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(10000));
  expect(play).not.toHaveBeenCalled();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  hidden = false;
  fireEvent(document, new Event("visibilitychange"));
  expect(play.mock.contexts.at(-1)).toBe(first);
});

it("resumes the active decoder after Strict Mode reattaches refs", () => {
  render(
    <StrictMode>
      <BossIdleArt clips={clips} art="portrait.webp" title="Boss" isDead={false} imageClassName="aspect-video" />
    </StrictMode>,
  );
  const play = vi.mocked(HTMLMediaElement.prototype.play);
  const pause = vi.mocked(HTMLMediaElement.prototype.pause);
  expect(play.mock.invocationCallOrder.at(-1)).toBeGreaterThan(Math.max(...pause.mock.invocationCallOrder));
});
