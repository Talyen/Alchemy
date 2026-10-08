import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { resolveApplicationMenuTemplate } = require("../../desktop/application-menu.cjs");

describe("Electron application menu template", () => {
  it("provides standard Apple application and window menus on macOS", () => {
    expect(resolveApplicationMenuTemplate({ platform: "darwin", isBackground: false })).toEqual([
      { role: "appMenu" },
      { role: "editMenu" },
      { role: "windowMenu" },
    ]);
  });

  it("suppresses menus on non-macOS platforms or during background automation", () => {
    expect(resolveApplicationMenuTemplate({ platform: "win32", isBackground: false })).toBeNull();
    expect(resolveApplicationMenuTemplate({ platform: "linux", isBackground: false })).toBeNull();
    expect(resolveApplicationMenuTemplate({ platform: "darwin", isBackground: true })).toBeNull();
  });
});
