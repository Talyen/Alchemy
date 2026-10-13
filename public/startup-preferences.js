(() => {
  try {
    if (localStorage.getItem("alchemy-disable-animations") === "true") {
      document.documentElement.classList.add("alchemy-disable-animations");
    }
    if (localStorage.getItem("alchemy-skip-loading-screen") === "true") {
      document.documentElement.classList.add("alchemy-skip-loading-screen");
    }
    let gameSizePercent = 100;
    try {
      const raw = localStorage.getItem("alchemy-device-display-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.gameSizePercent === "number") {
          gameSizePercent = Math.min(150, Math.max(75, parsed.gameSizePercent));
        }
      }
    } catch {}
    const stageScale = Math.min(window.innerWidth / ((1080 * 1470) / 738), window.innerHeight / 1080);
    const contentScale = stageScale * (gameSizePercent / 100);
    document.documentElement.style.setProperty("--content-scale", String(contentScale));
  } catch {}
})();
