// Applies persisted presentation preferences before React paints. This is a
// local module so the packaged renderer can enforce script-src 'self'.
try {
  if (localStorage.getItem("alchemy-disable-animations") === "true") {
    document.documentElement.classList.add("alchemy-disable-animations");
  }
} catch (error) {
  console.warn("Failed to apply initial local storage styles", error);
}
