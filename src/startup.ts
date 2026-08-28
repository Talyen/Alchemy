try {
  if (localStorage.getItem("alchemy-disable-animations") === "true") {
    document.documentElement.classList.add("alchemy-disable-animations");
  }
} catch (error) {
  console.warn("Failed to apply initial local storage styles", error);
}
