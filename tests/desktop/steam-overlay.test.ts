import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";

const { registerOverlayPause } = createRequire(import.meta.url)("../../desktop/steam-overlay.cjs");

it("pauses on native overlay activation and leaves resuming to the player", () => {
  const pause = vi.fn();
  const handle = { disconnect: vi.fn() };
  let notify: (event: { active: boolean }) => void = () => {};
  const register = vi.fn((_event, listener) => {
    notify = listener;
    return handle;
  });
  expect(
    registerOverlayPause({ client: { callback: { register } }, steamCallbacks: { GameOverlayActivated: 10 }, pause }),
  ).toBe(handle);
  notify({ active: false });
  expect(pause).not.toHaveBeenCalled();
  notify({ active: true });
  expect(pause).toHaveBeenCalledExactlyOnceWith();
  notify({ active: false });
  expect(pause).toHaveBeenCalledTimes(1);
});

it("reports an unsupported binding without inventing a callback number", () => {
  const register = vi.fn();
  expect(registerOverlayPause({ client: { callback: { register } }, steamCallbacks: {}, pause: vi.fn() })).toBeNull();
  expect(register).not.toHaveBeenCalled();
  expect(
    registerOverlayPause({ client: null, steamCallbacks: { GameOverlayActivated: 10 }, pause: vi.fn() }),
  ).toBeNull();
});
