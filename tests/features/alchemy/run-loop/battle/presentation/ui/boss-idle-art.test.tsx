import { StrictMode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BossIdleArt } from "@/features/alchemy/run-loop/battle/presentation/ui/boss-idle-art";
import { SliceDeath } from "@/features/alchemy/run-loop/battle/presentation/ui/slice-death";

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/slice-death", () => ({ SliceDeath: vi.fn(() => null) }));
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
  vi.mocked(SliceDeath).mockClear();
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

function readyFrame(video: HTMLVideoElement, readiness = 2) {
  let readyState = readiness;
  Object.defineProperties(video, {
    readyState: { configurable: true, get: () => readyState },
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
  });
  return (value: number) => {
    readyState = value;
  };
}

function frameContext() {
  const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "", globalAlpha: 1 };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
    throw Error("No image serialization");
  });
  return context;
}

const deadPortrait = (
  <BossIdleArt clips={clips} art="portrait.webp" title="Boss" isDead imageClassName="aspect-video" />
);

it("latches the displayed frame directly for the slice, without decoding static art or serializing pixels", () => {
  const context = frameContext();
  const {
    videos: [first],
    rerender,
  } = mount();
  readyFrame(first!);
  fireEvent.playing(first!);
  first!.currentTime = 3.25;
  rerender(deadPortrait);
  const props = vi.mocked(SliceDeath).mock.calls.at(-1)![0];
  expect(props.frame).toBeInstanceOf(HTMLCanvasElement);
  expect([props.frame!.width, props.frame!.height]).toEqual([1920, 1080]);
  expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(first, 0, 0, 1920, 1080);
  expect(first!.currentTime).toBe(3.25);
  expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  const draws = context.drawImage.mock.calls.length;
  act(() => vi.advanceTimersByTime(10000));
  expect(context.drawImage).toHaveBeenCalledTimes(draws);
});

it("composes only the displayed crossfade buffers at their current opacity", () => {
  const context = frameContext();
  const {
    videos: [first, second],
    rerender,
  } = mount();
  readyFrame(first!);
  readyFrame(second!);
  fireEvent.playing(first!);
  act(() => vi.advanceTimersByTime(7760));
  fireEvent.playing(second!);
  second!.style.opacity = "0.4";
  const alphas: number[] = [];
  context.drawImage.mockImplementation(() => {
    alphas.push(context.globalAlpha);
  });
  rerender(deadPortrait);
  expect(context.drawImage.mock.calls.map((call) => call[0])).toEqual([first, second]);
  expect(alphas).toEqual([1, 0.4]);
});

it("preserves the wrapper geometry and exact contain letterboxing instead of adopting static-art proportions", () => {
  const context = frameContext();
  const {
    container,
    videos: [first],
    rerender,
  } = mount();
  Object.defineProperties(container.firstElementChild, {
    clientWidth: { configurable: true, value: 600 },
    clientHeight: { configurable: true, value: 400 },
  });
  readyFrame(first!);
  fireEvent.playing(first!);
  rerender(deadPortrait);
  const frame = vi.mocked(SliceDeath).mock.calls.at(-1)![0].frame!;
  expect([frame.width, frame.height]).toEqual([1920, 1280]);
  expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(first, 0, 100, 1920, 1080);
});

it("retains a temporarily unready displayed video until its frame can be frozen, never using static art", () => {
  const context = frameContext();
  const {
    videos: [first],
    rerender,
    getByAltText,
  } = mount();
  const readiness = readyFrame(first!);
  fireEvent.playing(first!);
  readiness(1);
  rerender(deadPortrait);
  expect(SliceDeath).not.toHaveBeenCalled();
  expect(first!.isConnected).toBe(true);
  expect(getByAltText("Boss").classList.contains("opacity-0")).toBe(true);
  fireEvent.error(first!);
  expect(first!.isConnected).toBe(true);
  readiness(2);
  fireEvent.seeked(first!);
  expect(vi.mocked(SliceDeath).mock.calls.at(-1)![0].frame).toBeInstanceOf(HTMLCanvasElement);
  expect(context.drawImage.mock.calls[0]![0]).toBe(first);
});

it("keeps the paused video on a transient draw failure and cleans pending readiness listeners on unmount", () => {
  const context = frameContext();
  context.drawImage.mockImplementation(() => {
    throw new DOMException("Seeking", "InvalidStateError");
  });
  const {
    videos: [first],
    rerender,
    unmount,
  } = mount();
  readyFrame(first!);
  fireEvent.playing(first!);
  rerender(deadPortrait);
  expect(SliceDeath).not.toHaveBeenCalled();
  expect(first!.isConnected).toBe(true);
  const draws = context.drawImage.mock.calls.length;
  unmount();
  fireEvent.loadedData(first!);
  expect(context.drawImage).toHaveBeenCalledTimes(draws);
});

it("uses static death only when static fallback was actually displayed before defeat", () => {
  frameContext();
  const { rerender } = mount();
  rerender(deadPortrait);
  expect(vi.mocked(SliceDeath).mock.calls.at(-1)![0]).toMatchObject({ imageUrl: "portrait.webp" });
  expect(vi.mocked(SliceDeath).mock.calls.at(-1)![0].frame).toBeUndefined();
});

it("does not use a stale video frame after playback has failed back to static art", () => {
  const context = frameContext();
  const {
    videos: [first],
    rerender,
    getByAltText,
  } = mount();
  readyFrame(first!);
  fireEvent.playing(first!);
  fireEvent.error(first!);
  expect(getByAltText("Boss").classList.contains("opacity-0")).toBe(false);
  rerender(deadPortrait);
  expect(vi.mocked(SliceDeath).mock.calls.at(-1)![0].frame).toBeUndefined();
  expect(context.drawImage).not.toHaveBeenCalled();
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
