import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installCatalogs, localization } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";
import { localizeStartupSplash, syncStartupSplash } from "@/app/startup-splash";
import { applyInitialAnimationPreference } from "@/startup";

function mountStartupSplash() {
  const shell = new DOMParser().parseFromString(readFileSync("index.html", "utf8"), "text/html");
  const splash = shell.getElementById("startup-splash")!;
  document.body.appendChild(splash);
  runInNewContext(readFileSync("public/startup-words.js", "utf8"), { window, document });
  return splash;
}

describe("startup splash ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
  });

  afterEach(async () => {
    await localization.changeLanguage("en");
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.getElementById("startup-splash")?.remove();
    document.documentElement.classList.remove("alchemy-disable-animations");
    delete window.__alchemySplashWordTimer;
  });

  it("keeps the original artwork and phrase clock while React publishes real loading progress", () => {
    const splash = mountStartupSplash();
    const phrase = splash.querySelector("#startup-splash-phrase")!;
    const artwork = splash.querySelector(".loading-decoration");
    vi.advanceTimersByTime(1500);
    expect(phrase.textContent).toBe("Shuffling decks...");
    const timer = window.__alchemySplashWordTimer;

    for (const progress of [0.1, 0.5, 0.75, 1]) syncStartupSplash(progress, false);
    expect(splash.getAttribute("aria-valuenow")).toBe("100");
    expect(splash.classList.contains("alchemy-splash-dismissed")).toBe(false);
    expect(splash.querySelector(".loading-decoration")).toBe(artwork);
    expect(document.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
    expect(window.__alchemySplashWordTimer).toBe(timer);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(750);
    expect(phrase.textContent).toBe("Waking monsters...");

    syncStartupSplash(1, true);
    syncStartupSplash(1, true);
    expect(splash.classList.contains("alchemy-splash-dismissed")).toBe(true);
    expect(window.__alchemySplashWordTimer).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    splash.dispatchEvent(new Event("transitionend"));
    expect(document.getElementById("startup-splash")).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(vi.getTimerCount()).toBe(0);
    expect(phrase.textContent).toBe("Waking monsters...");
  });

  it("hands the early splash clock to localized text and cancels it on dismissal", async () => {
    installCatalogs(catalogs);
    await localization.changeLanguage("de");
    const splash = mountStartupSplash();
    const earlyTimer = window.__alchemySplashWordTimer;
    localizeStartupSplash();
    expect(splash.getAttribute("aria-label")).toBe("Alchemy wird geladen");
    expect(splash.querySelector("#startup-splash-phrase")!.textContent).toBe("Das Abenteuer wartet...");
    expect(window.__alchemySplashWordTimer).not.toBe(earlyTimer);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(splash.querySelector("#startup-splash-phrase")!.textContent).toBe("Decks werden gemischt...");
    syncStartupSplash(1, true);
    vi.advanceTimersByTime(1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["reduced-motion", "disabled-animations"])("dismisses without a transition event under %s", (mode) => {
    if (mode === "reduced-motion")
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true })),
      );
    else document.documentElement.classList.add("alchemy-disable-animations");
    const splash = mountStartupSplash();
    expect(vi.getTimerCount()).toBe(0);
    syncStartupSplash(0.5, false);
    expect(splash.getAttribute("aria-valuenow")).toBe("50");
    expect(splash.classList.contains("alchemy-splash-dismissed")).toBe(false);
    syncStartupSplash(1, true);
    vi.advanceTimersByTime(400);
    expect(document.getElementById("startup-splash")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("tolerates a splash that has already been removed", () => {
    expect(() => syncStartupSplash(1, true)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});

const ANIMATION_FLAG = "alchemy-disable-animations";
const ANIMATION_CLASS = "alchemy-disable-animations";

describe("applyInitialAnimationPreference", () => {
  afterEach(() => {
    localStorage.removeItem(ANIMATION_FLAG);
    document.documentElement.classList.remove(ANIMATION_CLASS);
  });

  it("adds the animation-disable class when the flag is set", () => {
    localStorage.setItem(ANIMATION_FLAG, "true");
    applyInitialAnimationPreference();
    expect(document.documentElement.classList.contains(ANIMATION_CLASS)).toBe(true);
  });

  it("leaves the class off without the flag", () => {
    applyInitialAnimationPreference();
    expect(document.documentElement.classList.contains(ANIMATION_CLASS)).toBe(false);
  });
});
