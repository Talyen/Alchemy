import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "../e2e/errors";

test("packaged plasma restores a lost context and falls back on shader failure", async () => {
  const app = await launchElectronApp({ packagedRenderer: true, enableGpu: true });
  try {
    const page = await getElectronMainWindow(app);
    const errors = failOnRuntimeErrors(page);
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeVisible({ timeout: 30000 });
    await play.hover();
    const canvas = page.getByTestId("global-plasma-background");
    const extension = await canvas.evaluateHandle((element: HTMLCanvasElement) =>
      element.getContext("webgl")?.getExtension("WEBGL_lose_context"),
    );
    expect(await extension.evaluate((value) => Boolean(value))).toBe(true);
    await extension.evaluate((value) => value?.loseContext());
    await expect(page.getByTestId("static-plasma-background")).toBeVisible();
    await extension.evaluate((value) => value?.restoreContext());
    await extension.dispose();
    await expect(page.getByTestId("static-plasma-background")).toHaveCount(0);
    expect(errors.splice(0).map((message) => message.trim())).toEqual([
      "[other] Plasma WebGL context lost; using static decoration",
    ]);
    await page.addInitScript(() => {
      const original = WebGLRenderingContext.prototype.getShaderParameter;
      WebGLRenderingContext.prototype.getShaderParameter = function (shader, parameter) {
        return parameter === this.COMPILE_STATUS ? false : original.call(this, shader, parameter);
      };
    });
    await page.reload();
    await expect(play).toBeVisible({ timeout: 30000 });
    await play.hover();
    await expect(page.getByTestId("static-plasma-background")).toBeVisible();
    expect(errors.splice(0).map((message) => message.trim())).toEqual([
      "[other] Plasma WebGL unavailable; using static decoration",
    ]);
  } finally {
    await app.close();
  }
});
