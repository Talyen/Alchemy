function resolveApplicationMenuTemplate({ platform = process.platform, isBackground = false } = {}) {
  if (platform === "darwin" && !isBackground) {
    return [{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }];
  }
  return null;
}

module.exports = { resolveApplicationMenuTemplate };
