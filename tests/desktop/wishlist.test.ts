import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
const { openWishlist } = createRequire(import.meta.url)("../../desktop/wishlist.cjs");
describe("bounded wishlist destination", () => {
  it("pauses and opens the full-game store overlay only on an explicit invocation", async () => {
    const pause = vi.fn();
    const activateToStore = vi.fn();
    const openExternal = vi.fn();
    expect(await openWishlist({ appId: "1234", client: { overlay: { activateToStore } }, openExternal, pause })).toBe(
      true,
    );
    expect(pause).toHaveBeenCalledExactlyOnceWith();
    expect(activateToStore).toHaveBeenCalledExactlyOnceWith(1234, 0);
    expect(openExternal).not.toHaveBeenCalled();
  });
  it("falls back to the fixed store URL if Steam is absent", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    expect(await openWishlist({ appId: "1234", client: null, openExternal, pause: vi.fn() })).toBe(true);
    expect(openExternal).toHaveBeenCalledExactlyOnceWith("https://store.steampowered.com/app/1234/");
  });
  it.each([undefined, "480", "-1", "1.5", "1234/evil", "0"])("rejects invalid destinations %s", async (appId) => {
    const openExternal = vi.fn();
    const pause = vi.fn();
    expect(await openWishlist({ appId, client: null, openExternal, pause })).toBe(false);
    expect(pause).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
