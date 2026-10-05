import { afterEach, expect, it, vi } from "vitest";
import { isAppInBackground, isNonPlayerAudioHost } from "@/lib/audio/host";

const originalSize = {
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  outerWidth: window.outerWidth,
  outerHeight: window.outerHeight,
};
const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
function setSize(size: typeof originalSize) {
  Object.defineProperties(
    window,
    Object.fromEntries(Object.entries(size).map(([key, value]) => [key, { configurable: true, value }])),
  );
}

afterEach(() => {
  setSize(originalSize);
  if (originalHidden) Object.defineProperty(document, "hidden", originalHidden);
  else Reflect.deleteProperty(document, "hidden");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete window.alchemyDesktop;
});

it.each([
  { userAgent: "Chrome", webdriver: false, desktop: false, hiddenWindow: false, player: true },
  { userAgent: "HeadlessChrome", webdriver: false, desktop: false, hiddenWindow: false, player: false },
  { userAgent: "Chrome", webdriver: true, desktop: false, hiddenWindow: false, player: false },
  { userAgent: "Electron", webdriver: false, desktop: false, hiddenWindow: false, player: false },
  { userAgent: "Electron", webdriver: false, desktop: true, hiddenWindow: false, player: true },
  { userAgent: "Chrome", webdriver: false, desktop: false, hiddenWindow: true, player: false },
])("allows sound only on visible player hosts: $userAgent, desktop=$desktop, hidden=$hiddenWindow", (input) => {
  setSize({ innerWidth: 1280, innerHeight: 720, outerWidth: input.hiddenWindow ? 0 : 1280, outerHeight: 720 });
  vi.stubGlobal("navigator", { userAgent: input.userAgent, webdriver: input.webdriver });
  if (input.desktop) window.alchemyDesktop = { isDesktop: true } as Window["alchemyDesktop"];
  expect(isNonPlayerAudioHost()).toBe(!input.player);
});

it("reads lifecycle state with hidden and minimized windows taking precedence over focus", () => {
  setSize({ innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  const focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
  expect(isAppInBackground()).toBe(false);
  expect(isAppInBackground({ type: "blur" })).toBe(true);
  focus.mockReturnValue(false);
  expect(isAppInBackground()).toBe(true);
  expect(isAppInBackground({ type: "focus" })).toBe(false);
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  expect(isAppInBackground({ type: "focus" })).toBe(true);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  setSize({ innerWidth: 1, innerHeight: 720, outerWidth: 1280, outerHeight: 720 });
  expect(isAppInBackground({ type: "focus" })).toBe(true);
  setSize({ innerWidth: 0, innerHeight: 0, outerWidth: 0, outerHeight: 0 });
  vi.stubGlobal("navigator", { userAgent: "Chrome" });
  expect(isNonPlayerAudioHost()).toBe(false);
});
