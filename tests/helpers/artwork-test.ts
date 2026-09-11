import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";

// JSDOM does not fetch artwork. Content/interaction tests use decoded images;
// use-artwork-ready and real-browser tests own loading and failure coverage.
export function installReadyArtworkForTests() {
  let restore = () => {};
  beforeEach(() => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1);
    const decode =
      typeof HTMLImageElement.prototype.decode === "function"
        ? vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue()
        : null;
    restore = () => {
      complete.mockRestore();
      width.mockRestore();
      decode?.mockRestore();
    };
  });
  afterEach(() => restore());
}

export async function waitForArtwork() {
  await waitFor(() => expect(document.querySelector("[data-artwork-pending]")).toBeNull());
}
