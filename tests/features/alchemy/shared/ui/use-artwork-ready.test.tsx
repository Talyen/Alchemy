import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";
import { IMAGE_PRELOAD_TIMEOUT_MS } from "@/lib/game-constants";

function View({ identity = "menu" }: { identity?: string }) {
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(identity);
  return (
    <div ref={artworkRef} data-artwork-pending={artworkPending} data-testid="view">
      <img key={identity} src={`${identity}.webp`} alt="Artwork" />
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
