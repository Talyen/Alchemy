(() => {
  let gameSizePercent = 100;
  try {
    if (localStorage.getItem("alchemy-disable-animations") === "true") {
      document.documentElement.classList.add("alchemy-disable-animations");
    }
    if (localStorage.getItem("alchemy-skip-loading-screen") === "true") {
      document.documentElement.classList.add("alchemy-skip-loading-screen");
    }
    const raw = localStorage.getItem("alchemy-device-display-v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed?.version === 1 &&
        typeof parsed.gameSizePercent === "number" &&
        Number.isFinite(parsed.gameSizePercent)
      ) {
        gameSizePercent = Math.min(120, Math.max(80, Math.round(parsed.gameSizePercent / 5) * 5));
      }
    }
  } catch {}

  // This blocking script runs before bundled modules. Keep its density and saved
  // Game Size normalization aligned with getVirtualResolutionLayout; the startup
  // sizing regression compares both paths so React cannot resize the splash.
  const width = Number.isFinite(window.innerWidth) ? Math.max(0, window.innerWidth) : 0;
  const height = Number.isFinite(window.innerHeight) ? Math.max(0, window.innerHeight) : 0;
  const referenceScale = (738 / 1080) * Math.min(1280 / 1470, 720 / 738);
  const fit = Math.min(width / 1280, height / 720);
  const density = fit <= 1 ? fit : 1 + (fit - 1) * 0.72;
  const contentScale = referenceScale * density * (gameSizePercent / 100);
  document.documentElement.style.setProperty("--content-scale", String(contentScale));
})();
