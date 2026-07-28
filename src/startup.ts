// Applies persisted presentation preferences before React paints. This is a
// local module so the packaged renderer can enforce script-src 'self'.
try {
  if (localStorage.getItem("alchemy-disable-animations") === "true") {
    document.documentElement.classList.add("alchemy-disable-animations");
  }
  const saveRaw = localStorage.getItem("alchemy-save-v1");
  if (saveRaw) {
    const save = JSON.parse(saveRaw) as { uiScale?: unknown } | null;
    if (save && typeof save.uiScale === "number") {
      document.documentElement.style.setProperty("--alchemy-ui-scale", String(save.uiScale / 100));
    }
  }
} catch (error) {
  console.warn("Failed to apply initial local storage styles", error);
}
