import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "../e2e/errors";

test("independent screen effects combine, persist, and fully disable", async () => {
  const app = await launchElectronApp({ packagedRenderer: true, enableGpu: true });
  try {
    const page = await getElectronMainWindow(app);
    const errors = failOnRuntimeErrors(page);
    const options = page.getByRole("button", { name: "Options", exact: true });
    await expect(options).toBeVisible({ timeout: 30000 });
    await options.click();
    for (const name of ["Display Setup", "Background Atmosphere", "Screen Effects"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    const master = page.getByRole("switch", { name: "Screen Effects", exact: true });
    const overlay = page.locator(".screen-effect");
    await expect(master).not.toBeChecked();
    await master.click();
    await expect(overlay).toHaveCount(0);
    for (const name of ["Scanlines", "Color Tint", "Darkened Edges", "Paper Grain", "Drifting Lights"]) {
      const toggle = page.getByRole("switch", { name, exact: true });
      await expect(toggle).not.toBeChecked();
      await toggle.click();
    }
    await expect(page.locator(".screen-effect-layer")).toHaveCount(5);
    await expect(page.locator(".screen-effect-edges")).toHaveCount(1);
    await expect(overlay).toHaveCSS("pointer-events", "none");
    const grain = page.getByRole("slider", { name: "Grain Strength" });
    await grain.focus();
    await grain.press("Home");
    await expect(page.locator(".screen-effect-grain")).toHaveCount(0);
    await expect(page.locator(".screen-effect-scanlines")).toHaveCount(1);
    await grain.press("End");
    await page.getByRole("combobox", { name: "Light Motion" }).click();
    await page.getByRole("option", { name: "Still", exact: true }).click();
    await expect
      .poll(() =>
        page.locator(".screen-effect-lights").evaluate((el) => getComputedStyle(el, "::before").animationName),
      )
      .toBe("none");
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const raw = (await window.alchemyDesktop?.listSaveCandidates())?.[0];
          if (!raw) return null;
          const saved = JSON.parse(raw);
          const settings = saved.screenEffects;
          return [
            settings?.enabled,
            settings?.grain.strength,
            saved.backgroundLights?.motion,
            settings?.scanlines.enabled,
          ];
        }),
      )
      .toEqual([true, 100, "still", true]);
    await page.reload();
    await expect(options).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".screen-effect-layer")).toHaveCount(5);
    await options.click();
    await expect(grain).toHaveValue("100");
    await master.click();
    await expect(overlay).toHaveCount(0);
    await expect(grain).toHaveCount(0);
    await expect(page.getByTestId("drifting-lights-canvas")).toHaveCSS("visibility", "visible");
    await master.click();
    await expect(page.locator(".screen-effect-layer")).toHaveCount(5);
    await page.getByRole("button", { name: "Reset Screen Effects", exact: true }).click();
    await expect(master).not.toBeChecked();
    await expect(overlay).toHaveCount(0);
    await expect(page.getByRole("slider", { name: "Background Glow" })).toHaveValue("100");
    await expect(page.getByRole("switch", { name: "Drifting Lights", exact: true })).toBeChecked();
    await expect(page.getByRole("slider", { name: "Background Particles" })).toHaveValue("100");
    await master.click();
    await expect(page.getByRole("switch", { name: "Paper Grain", exact: true })).not.toBeChecked();
    await expect(overlay).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test("drifting-light context loss leaves particle and plasma canvases intact", async () => {
  const app = await launchElectronApp({ packagedRenderer: true, enableGpu: true });
  try {
    const page = await getElectronMainWindow(app);
    const errors = failOnRuntimeErrors(page);
    const options = page.getByRole("button", { name: "Options", exact: true });
    await expect(options).toBeVisible({ timeout: 30000 });
    await options.click();
    await page.getByRole("switch", { name: "Drifting Lights", exact: true }).click();
    const canvas = page.getByTestId("drifting-lights-canvas");
    await expect(canvas).toHaveCSS("visibility", "visible");
    expect(
      await canvas.evaluate((el) => {
        const stage = document.querySelector("[data-testid=vr-stage]");
        return (
          stage !== null &&
          !stage.contains(el) &&
          Boolean(el.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      }),
    ).toBe(true);
    await expect(page.getByTestId("vr-stage")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".screen-effect-lights-fallback")).toHaveCount(0);
    const otherCanvases = await page.locator("canvas:not([data-testid=drifting-lights-canvas])").elementHandles();
    const extension = await canvas.evaluateHandle((el: HTMLCanvasElement) =>
      el.getContext("webgl")?.getExtension("WEBGL_lose_context"),
    );
    expect(await extension.evaluate((value) => Boolean(value))).toBe(true);
    await extension.evaluate((value) => value?.loseContext());
    await expect(page.locator(".screen-effect-lights-fallback")).toHaveCount(1);
    await expect(canvas).toHaveCSS("visibility", "hidden");
    await extension.evaluate((value) => value?.restoreContext());
    await expect(page.locator(".screen-effect-lights-fallback")).toHaveCount(0);
    await expect(canvas).toHaveCSS("visibility", "visible");
    await extension.dispose();
    for (const other of otherCanvases) expect(await other.evaluate((el) => el.isConnected)).toBe(true);
    expect(errors.splice(0).map((message) => message.trim())).toEqual([
      "[other] Drifting lights WebGL context lost; using static decoration",
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(canvas).toHaveCSS("visibility", "visible");
    await page.getByRole("slider", { name: "Light Intensity" }).focus();
    await page.getByRole("slider", { name: "Light Intensity" }).press("Home");
    await expect(canvas).toHaveCount(0);
    await page.getByRole("slider", { name: "Light Intensity" }).press("End");
    await expect(canvas).toHaveCSS("visibility", "visible");
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
