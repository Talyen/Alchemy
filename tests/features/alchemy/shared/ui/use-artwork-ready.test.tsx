import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";
import { IMAGE_PRELOAD_TIMEOUT_MS } from "@/lib/game-constants";

function View({
  identity = "menu",
  showArtwork = true,
  source,
  secondarySource,
}: {
  identity?: string;
  showArtwork?: boolean;
  source?: string;
  secondarySource?: string;
}) {
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(identity);
  return (
    <div ref={artworkRef} data-artwork-pending={artworkPending} data-testid="view">
      {showArtwork ? <img key={identity} src={source ?? `${identity}.webp`} alt="Artwork" /> : null}
      {secondarySource ? <img src={secondarySource} alt="Secondary artwork" /> : null}
    </div>
  );
}

async function paint() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(20);
  });
}

describe("artwork reveal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the whole screen hidden and its fade paused until mounted artwork decodes", async () => {
    render(<View />);
    const view = screen.getByTestId("view");
    const image = screen.getByAltText("Artwork");
    let decoded!: () => void;
    Object.defineProperty(image, "decode", {
      value: () =>
        new Promise<void>((resolve) => {
          decoded = resolve;
        }),
    });
    fireEvent.load(image);
    await paint();
    expect(view.dataset.artworkPending).toBe("true");
    await act(async () => decoded());
    await paint();
    expect(view.dataset.artworkPending).toBeUndefined();
  });

  it("waits for artwork inserted after the initial layout measurement", async () => {
    const { rerender } = render(<View showArtwork={false} />);
    rerender(<View />);
    const image = screen.getByAltText("Artwork");
    let decoded!: () => void;
    Object.defineProperty(image, "complete", { value: true });
    Object.defineProperty(image, "decode", {
      value: () =>
        new Promise<void>((resolve) => {
          decoded = resolve;
        }),
    });
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBe("true");
    await act(async () => decoded());
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
  });

  it("ignores stale decode failures when artwork changes before the screen is revealed", async () => {
    const { rerender } = render(<View source="first.webp" />);
    const image = screen.getByAltText("Artwork");
    let rejectOld!: (error: Error) => void;
    Object.defineProperty(image, "complete", { value: true });
    Object.defineProperty(image, "decode", {
      configurable: true,
      value: () =>
        new Promise<void>((_resolve, reject) => {
          rejectOld = reject;
        }),
    });
    fireEvent.load(image);
    rerender(<View source="second.webp" />);
    let resolveNew!: () => void;
    Object.defineProperty(image, "decode", {
      value: () =>
        new Promise<void>((resolve) => {
          resolveNew = resolve;
        }),
    });
    await paint();
    await act(async () => rejectOld(new Error("Old image replaced")));
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBe("true");
    expect(image.style.visibility).not.toBe("hidden");
    await act(async () => resolveNew());
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
  });

  it("does not let a previous screen's decode reveal a new screen", async () => {
    const { rerender } = render(<View />);
    let decoded!: () => void;
    Object.defineProperty(screen.getByAltText("Artwork"), "decode", {
      value: () =>
        new Promise<void>((resolve) => {
          decoded = resolve;
        }),
    });
    fireEvent.load(screen.getByAltText("Artwork"));
    rerender(<View identity="talents" />);
    await act(async () => decoded());
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBe("true");
    fireEvent.error(screen.getByAltText("Artwork"));
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
  });

  it("settles failed artwork without showing a broken image or a late arrival", async () => {
    render(<View />);
    const image = screen.getByAltText("Artwork");
    act(() => vi.advanceTimersByTime(IMAGE_PRELOAD_TIMEOUT_MS));
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
    expect(image.style.visibility).toBe("hidden");
    fireEvent.load(image);
    await paint();
    expect(image.style.visibility).toBe("hidden");
  });

  it("keeps a stalled image's original deadline through unrelated DOM changes", async () => {
    render(<View />);
    const view = screen.getByTestId("view");
    act(() => vi.advanceTimersByTime(IMAGE_PRELOAD_TIMEOUT_MS / 2));
    await act(async () => view.append(document.createElement("span")));
    await paint();
    act(() => vi.advanceTimersByTime(IMAGE_PRELOAD_TIMEOUT_MS / 2));
    await paint();
    expect(view.dataset.artworkPending).toBeUndefined();
    expect(screen.getByAltText("Artwork").style.visibility).toBe("hidden");
  });

  it("does not rescan artwork for text and icon changes", async () => {
    render(<View />);
    const view = screen.getByTestId("view");
    const scan = vi.spyOn(view, "querySelectorAll");
    await act(async () => {
      const counter = document.createElement("span");
      counter.textContent = "12 Health";
      view.append(counter, document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    });
    await paint();
    await act(async () => {
      view.querySelector("span")!.textContent = "11 Health";
      view.querySelector("svg")!.remove();
      view.querySelector("span")!.remove();
    });
    await paint();
    expect(scan).not.toHaveBeenCalled();
    expect(view.dataset.artworkPending).toBe("true");
    fireEvent.error(screen.getByAltText("Artwork"));
    await paint();
    expect(view.dataset.artworkPending).toBeUndefined();
  });

  it("tracks artwork added and removed inside a nested subtree", async () => {
    render(<View showArtwork={false} />);
    await paint();
    const view = screen.getByTestId("view");
    const wrapper = document.createElement("section");
    const image = document.createElement("img");
    image.src = "nested.webp";
    wrapper.append(image);
    await act(async () => view.append(wrapper));
    await paint();
    expect(view.dataset.artworkPending).toBe("true");
    await act(async () => wrapper.remove());
    await paint();
    expect(view.dataset.artworkPending).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases removed artwork without waiting for its deadline", async () => {
    const { rerender } = render(<View />);
    rerender(<View showArtwork={false} />);
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for every image when a decoded image is replaced and a pending image is removed", async () => {
    const { rerender } = render(<View source="first.webp" secondarySource="second.webp" />);
    const primary = screen.getByAltText("Artwork");
    Object.defineProperty(primary, "decode", { value: () => Promise.resolve() });
    fireEvent.load(primary);
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBe("true");

    rerender(<View source="replacement.webp" />);
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBe("true");
    fireEvent.load(primary);
    await paint();
    expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
    expect(primary.style.visibility).not.toBe("hidden");
    expect(vi.getTimerCount()).toBe(0);
  });
});
