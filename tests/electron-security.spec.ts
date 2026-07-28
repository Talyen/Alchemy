import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { desktop } from "./playwright-tags";

test.describe("packaged Electron security boundary", { ...desktop }, () => {
  test("boots through alchemy:// with CSP and blocks renderer escape routes", async () => {
    const electronApp = await launchElectronApp({ packagedRenderer: true });
    try {
      const page = await getElectronMainWindow(electronApp);
      expect(page.url()).toBe("alchemy://app/");
      expect(await page.evaluate(() => window.alchemyDesktop?.isDesktop)).toBe(true);

      const results = await page.evaluate(async () => {
        const marker = "__alchemyInlineScriptExecuted";
        const script = document.createElement("script");
        script.textContent = `window.${marker} = true`;
        document.body.appendChild(script);

        const popup = window.open("https://example.com", "_blank");
        const permission = await navigator.permissions.query({ name: "geolocation" });

        const navigation = document.createElement("a");
        navigation.href = "https://example.com";
        navigation.textContent = "navigate";
        document.body.appendChild(navigation);
        navigation.click();

        const download = document.createElement("a");
        download.href = "data:text/plain,blocked";
        download.download = "blocked.txt";
        document.body.appendChild(download);
        download.click();
        await new Promise((resolve) => setTimeout(resolve, 100));

        return {
          inlineRan: (window as unknown as Record<string, unknown>)[marker] === true,
          permission: permission.state,
          popupOpened: popup !== null,
          url: location.href,
        };
      });

      expect(results).toEqual({
        inlineRan: false,
        permission: "denied",
        popupOpened: false,
        url: "alchemy://app/",
      });
    } finally {
      await electronApp.close();
    }
  });

  test("rejects IPC from a window other than the current main top frame", async () => {
    const electronApp = await launchElectronApp({ packagedRenderer: true });
    try {
      const page = await getElectronMainWindow(electronApp);
      await page.evaluate(() => window.alchemyDesktop?.clearSave());

      const attempts = await electronApp.evaluate(async ({ BrowserWindow, app }) => {
        const attacker = new BrowserWindow({
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: `${app.getAppPath()}/desktop/preload.cjs`,
            sandbox: true,
          },
        });
        try {
          await attacker.loadURL("data:text/html,<main>untrusted</main>");
          return await attacker.webContents.executeJavaScript(`Promise.all([
            window.alchemyDesktop.writeSave("attacker").then(() => false, () => true),
            window.alchemyDesktop.steamGetName().then(() => false, () => true),
            window.alchemyDesktop.quit().then(() => false, () => true)
          ])`);
        } finally {
          attacker.destroy();
        }
      });

      expect(attempts).toEqual([true, true, true]);
      expect(await page.evaluate(() => window.alchemyDesktop?.listSaveCandidates())).toEqual([]);
    } finally {
      await electronApp.close();
    }
  });
});
