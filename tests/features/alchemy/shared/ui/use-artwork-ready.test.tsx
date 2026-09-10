import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";
import { IMAGE_PRELOAD_TIMEOUT_MS } from "@/lib/game-constants";

function View({
  identity = "menu",
  showArtwork = true,
  source,
}: {
  identity?: string;
  showArtwork?: boolean;
  source?: string;
}) {
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(identity);
  return (
    <div ref={artworkRef} data-artwork-pending={artworkPending} data-testid="view">
      {showArtwork ? <img key={identity} src={source ?? `${identity}.webp`} alt="Artwork" /> : null}
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
});
