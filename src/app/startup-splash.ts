import { clamp01 } from "@/lib/math";
import { text } from "@/lib/localization/runtime";

/** Replace the first-paint English clock once bundled text and the locale are ready. */
export function localizeStartupSplash(): void {
  const splash = document.getElementById("startup-splash");
  const phrase = document.getElementById("startup-splash-phrase");
  if (!splash || !phrase) return;
  if (window.__alchemySplashWordTimer) {
    window.clearInterval(window.__alchemySplashWordTimer);
    delete window.__alchemySplashWordTimer;
  }
  splash.setAttribute("aria-label", text("startup.loading", "Loading Alchemy"));
  const phrases = [
    text("startup.adventure", "Adventure awaits..."),
    text("startup.trinkets", "Polishing trinkets..."),
    text("startup.decks", "Shuffling decks..."),
    text("startup.monsters", "Waking monsters..."),
    text("startup.potions", "Brewing potions..."),
    text("startup.crystals", "Gathering crystals..."),
    text("startup.blades", "Sharpening blades..."),
    text("startup.labyrinth", "Mapping labyrinth..."),
    text("startup.relics", "Attuning relics..."),
    text("startup.oracle", "Consulting oracle..."),
    text("startup.baubles", "Enchanting baubles..."),
    text("startup.loot", "Counting loot..."),
    text("startup.companions", "Training companions..."),
    text("startup.homestead", "Building homestead..."),
    text("startup.shops", "Restocking shops..."),
  ];
  let index = 0;
  phrase.textContent = phrases[index]!;
  if (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("alchemy-disable-animations")
  )
    return;
  window.__alchemySplashWordTimer = window.setInterval(() => {
    index = (index + 1) % phrases.length;
    phrase.textContent = phrases[index]!;
    phrase.style.animation = "none";
    void phrase.offsetHeight;
    phrase.style.animation = "";
  }, 750);
}

/** Keep the first-paint splash mounted until the real loading gate has settled. */
export function syncStartupSplash(progress: number, ready: boolean): void {
  const splash = document.getElementById("startup-splash");
  splash?.setAttribute("aria-valuenow", String(Math.round(clamp01(progress) * 100)));
  if (ready) dismissStartupSplash();
}

function dismissStartupSplash(): void {
  if (typeof document === "undefined") return;
  if (typeof window !== "undefined" && window.__alchemySplashWordTimer) {
    window.clearInterval(window.__alchemySplashWordTimer);
    delete window.__alchemySplashWordTimer;
  }
  const splash = document.getElementById("startup-splash");
  if (!splash || splash.classList.contains("alchemy-splash-dismissed")) return;
  splash.classList.add("alchemy-splash-dismissed");
  const cleanup = () => {
    splash.remove();
  };
  splash.addEventListener("transitionend", cleanup, { once: true });
  window.setTimeout(cleanup, 400);
}
