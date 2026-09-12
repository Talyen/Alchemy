import { expect, test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";

for (const failure of ["context", "shader"] as const) {
  test(`static glow survives WebGL ${failure} failure`, async ({ page, runtimeErrors }) => {
    await page.addInitScript((kind) => {
      if (kind === "context") {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          ...args: Parameters<typeof original>
        ) {
          return args[0] === "webgl" ? null : original.apply(this, args);
        } as typeof original;
      } else {
        const original = WebGLRenderingContext.prototype.getShaderParameter;
        WebGLRenderingContext.prototype.getShaderParameter = function (shader, parameter) {
          return parameter === this.COMPILE_STATUS ? false : original.call(this, shader, parameter);
        };
      }
    }, failure);
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.expectMainMenu();
    await menu.playBtn.hover();
    const fallback = page.getByTestId("static-plasma-background");
    await expect(fallback).toBeVisible();
    await expect(page.getByTestId("global-plasma-background")).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await menu.playBtn.hover();
    await expect(fallback).toBeVisible();
    const messages = runtimeErrors.splice(0).map((message) => message.trim());
    expect(messages.length).toBeGreaterThan(0);
    expect([...new Set(messages)]).toEqual(["[other] Plasma WebGL unavailable; using static decoration"]);
  });
}

test("context loss shows static glow and restoration resumes WebGL", async ({ page, runtimeErrors }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.expectMainMenu();
  await menu.playBtn.hover();
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
  await expect(canvas).toBeVisible();
  expect(runtimeErrors.splice(0).map((message) => message.trim())).toEqual([
    "[other] Plasma WebGL context lost; using static decoration",
  ]);
});
