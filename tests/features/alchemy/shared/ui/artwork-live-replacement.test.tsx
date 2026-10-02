import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useArtworkReady } from "@/features/alchemy/shared/ui/use-artwork-ready";

function View({ source }: { source: string }) {
  const { ref, pending } = useArtworkReady("same-page");
  return (
    <div ref={ref} data-testid="view" data-artwork-pending={pending}>
      <img src={source} alt="Artwork" />
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("waits for replacement artwork after the same page was already revealed", async () => {
  const { rerender } = render(<View source="first.webp" />);
  const image = screen.getByAltText("Artwork");
  Object.defineProperty(image, "decode", { value: () => Promise.resolve(), configurable: true });
  fireEvent.load(image);
  await paint();
  expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
  rerender(<View source="replacement.webp" />);
  await paint();
  expect(screen.getByTestId("view").dataset.artworkPending).toBe("true");
  fireEvent.error(image);
  await paint();
  expect(screen.getByTestId("view").dataset.artworkPending).toBeUndefined();
  expect(image.style.visibility).toBe("hidden");
});
