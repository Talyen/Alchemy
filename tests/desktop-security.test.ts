import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DISPLAY_MODE_VALUES } from "@/lib/settings-values";

const require = createRequire(import.meta.url);
interface SecurityModule {
  MAX_SAVE_PAYLOAD_BYTES: number;
  PACKAGED_CSP: string;
  isAllowedRendererUrl: (url: string, policy: { packaged: boolean; devServerUrl: string }) => boolean;
  isAuthorizedIpcEvent: (
    event: object,
    mainWindow: object,
    policy: { packaged: boolean; devServerUrl: string },
  ) => boolean;
  isDisplayMode: (value: unknown) => boolean;
  isRichPresenceKey: (value: unknown) => boolean;
  isRichPresenceValue: (value: unknown) => boolean;
  isSavePayload: (value: unknown) => boolean;
  parseDevServerUrl: (url: string) => URL;
  resolveAppAssetPath: (root: string, url: string) => string | null;
}
const security = require("../desktop/security.cjs") as SecurityModule;

describe("Electron renderer security policy", () => {
  const devServerUrl = "http://127.0.0.1:5173";

  it("accepts only a bare loopback development origin", () => {
    expect(security.parseDevServerUrl(devServerUrl).origin).toBe(devServerUrl);
    for (const url of [
      "http://localhost:5173",
      "https://127.0.0.1:5173",
      "http://127.0.0.1:5173/path",
      "http://user@127.0.0.1:5173",
    ]) {
      expect(() => security.parseDevServerUrl(url)).toThrow();
    }
  });

  it("matches only the configured renderer origin", () => {
    expect(security.isAllowedRendererUrl("alchemy://app/index.html", { packaged: true, devServerUrl })).toBe(true);
    expect(security.isAllowedRendererUrl("alchemy://other/index.html", { packaged: true, devServerUrl })).toBe(false);
    expect(security.isAllowedRendererUrl(`${devServerUrl}/assets/app.js`, { packaged: false, devServerUrl })).toBe(
      true,
    );
    expect(security.isAllowedRendererUrl("http://127.0.0.1:9999/", { packaged: false, devServerUrl })).toBe(false);
  });

  it("maps only decoded files beneath the renderer root", () => {
    const root = path.resolve("/renderer");
    expect(security.resolveAppAssetPath(root, "alchemy://app/")).toBe(path.join(root, "index.html"));
    expect(security.resolveAppAssetPath(root, "alchemy://app/assets/game.js")).toBe(
      path.join(root, "assets", "game.js"),
    );
    for (const url of [
      "alchemy://unknown/index.html",
      "alchemy://app/%00.js",
      "alchemy://app/../secret",
      "alchemy://app/%2e%2e/secret",
      "alchemy://app/%5c..%5csecret",
      "alchemy://app/%E0%A4%A",
      "file:///renderer/index.html",
    ]) {
      expect(security.resolveAppAssetPath(root, url)).toBeNull();
    }
  });

  it("requires the current main top frame for IPC", () => {
    const mainFrame = { url: "alchemy://app/index.html" };
    const webContents = { mainFrame };
    const mainWindow = { isDestroyed: () => false, webContents };
    const policy = { packaged: true, devServerUrl };
    expect(security.isAuthorizedIpcEvent({ sender: webContents, senderFrame: mainFrame }, mainWindow, policy)).toBe(
      true,
    );
    expect(
      security.isAuthorizedIpcEvent({ sender: webContents, senderFrame: { url: mainFrame.url } }, mainWindow, policy),
    ).toBe(false);
    expect(security.isAuthorizedIpcEvent({ sender: { mainFrame }, senderFrame: mainFrame }, mainWindow, policy)).toBe(
      false,
    );
  });

  it("constructs the exact packaged CSP", () => {
    expect(security.PACKAGED_CSP).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
    );
  });

  it("preserves the existing IPC payload limits", () => {
    for (const mode of DISPLAY_MODE_VALUES) expect(security.isDisplayMode(mode)).toBe(true);
    expect(security.isDisplayMode("invalid")).toBe(false);
    expect(security.isSavePayload("a".repeat(security.MAX_SAVE_PAYLOAD_BYTES))).toBe(true);
    expect(security.isSavePayload("a".repeat(security.MAX_SAVE_PAYLOAD_BYTES + 1))).toBe(false);
    expect(security.isRichPresenceKey("a".repeat(64))).toBe(true);
    expect(security.isRichPresenceKey("a".repeat(65))).toBe(false);
    expect(security.isRichPresenceValue("a".repeat(256))).toBe(true);
    expect(security.isRichPresenceValue("a".repeat(257))).toBe(false);
  });
});
