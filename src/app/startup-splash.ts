export function dismissStartupSplash(): void {
  if (typeof document === "undefined") return;
  if (typeof window !== "undefined" && window.__alchemySplashWordTimer) {
    window.clearInterval(window.__alchemySplashWordTimer);
    window.__alchemySplashWordTimer = undefined;
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
