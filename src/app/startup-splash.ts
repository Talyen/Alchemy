import { clamp01 } from "@/lib/math";

/** Keep the first-paint splash mounted until the real loading gate has settled. */
export function syncStartupSplash(progress: number, ready: boolean): void {
  const splash = document.getElementById("startup-splash");
  splash?.setAttribute("aria-valuenow", String(Math.round(clamp01(progress) * 100)));
  if (ready) dismissStartupSplash();
}

export function dismissStartupSplash(): void {
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
