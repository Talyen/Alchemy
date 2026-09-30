import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, type ElectronApplication, type Page } from "@playwright/test";
import { waitForLayoutSettled } from "../browser-helpers";
import sharp from "sharp";

sharp.concurrency(1);
sharp.cache({ memory: 24, files: 0, items: 32 });

async function saveFrame(page: Page, application: ElectronApplication, target: string) {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const png = await application.evaluate(async ({ BrowserWindow }, rect) => {
    const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage(
      { x: 0, y: 0, ...rect },
      { stayHidden: true, stayAwake: true },
    );
    if (image.isEmpty()) throw new Error("Electron returned an empty capture");
    return image.toPNG().toString("base64");
  }, viewport);
  // Normalize the native Retina bitmap to the recorded CSS viewport dimensions.
  await sharp(Buffer.from(png, "base64")).resize(viewport.width, viewport.height).toFile(target);
}

const VIEWPORTS = [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
  [1920, 1200],
  [2560, 1600],
  [3440, 1440],
  [1280, 720],
  [1536, 864],
  [1470, 956],
  [1470, 738],
] as const;
export const output = path.resolve("reports/layout-review", process.env.LAYOUT_REVIEW_PASS ?? "before");
export function frontmostApp() {
  if (process.platform !== "darwin") return null;
  return execFileSync(
    "osascript",
    [
      "-l",
      "JavaScript",
      "-e",
      'ObjC.import("AppKit"); $.NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier.js',
    ],
    { encoding: "utf8" },
  ).trim();
}
export interface CaptureOptions {
  prepare?: () => Promise<unknown>;
  cleanup?: () => Promise<unknown>;
  loading?: boolean;
  viewports?: ReadonlyArray<readonly [number, number]>;
  dpr?: number;
}
export async function captureMatrix(
  page: Page,
  application: ElectronApplication,
  name: string,
  options: CaptureOptions = {},
) {
  if (process.env.LAYOUT_REVIEW_STATES && !name.match(new RegExp(process.env.LAYOUT_REVIEW_STATES))) return;
  fs.mkdirSync(output, { recursive: true });
  const save = await page.evaluate(async () => (await window.alchemyDesktop?.listSaveCandidates())?.[0] ?? null);
  if (save) fs.writeFileSync(path.join(output, `${name}-save.txt`), save);
  const requestedViewports = process.env.LAYOUT_REVIEW_VIEWPORTS?.split(",").map((value) => {
    const dimensions = /^(\d+)x(\d+)$/.exec(value);
    if (!dimensions) throw new Error(`Invalid review viewport: ${value}`);
    return [Number(dimensions[1]), Number(dimensions[2])] as const;
  });
  const viewports = options.viewports ?? requestedViewports ?? VIEWPORTS;
  for (const [width, height] of viewports) {
    await application.evaluate(
      ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height),
      { width, height },
    );
    await page.setViewportSize({ width, height });
    if (options.dpr) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: options.dpr,
        mobile: false,
      });
      await cdp.detach();
    }
    await expect
      .poll(() => page.evaluate(() => [innerWidth, innerHeight]), { timeout: 20_000 })
      .toEqual([width, height]);
    await page.mouse.move(0, 0);
    if (!options.loading) await waitForLayoutSettled(page);
    await options.prepare?.();
    await page.evaluate(async (loading) => {
      await document.fonts.ready;
      // Loading captures deliberately hold artwork requests open.
      if (!loading)
        await Promise.all(
          Array.from(document.images)
            .filter((img) => img.getBoundingClientRect().width > 0)
            .map((img) => img.decode().catch(() => undefined)),
        );
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }, options.loading ?? false);
    // Allow responsive pickers and route fades to finish before capturing geometry.
    if (!options.loading) {
      await expect.poll(() => page.locator('[data-artwork-pending="true"]').count(), { timeout: 20_000 }).toBe(0);
    }
    const readMetadata = () =>
      page.evaluate(() => {
        const clipped = Array.from(
          document.querySelectorAll<HTMLElement>(
            "button, h1, [role=dialog], [role=listbox], .hover-popup-panel[data-visible], [data-testid=armory-crafting-cursor]",
          ),
        )
          .filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden")
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
          })
          .map((el) => ({
            text: el.getAttribute("aria-label") ?? el.textContent?.trim(),
            rect: el.getBoundingClientRect().toJSON(),
            scrollParent: Boolean(el.closest(".game-page-scroll, [data-testid=card-inspection-scroll]")),
          }));
        return {
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          visibility: document.visibilityState,
          headings: Array.from(document.querySelectorAll("h1,h2")).map((el) => el.textContent),
          clipped,
          currencyWidth:
            document.querySelector('[data-testid="armory-crafting-currency"]')?.getBoundingClientRect().width ?? null,
          equipmentWidth:
            document.querySelector('[data-testid="armory-equipment-slot"]')?.getBoundingClientRect().width ?? null,
        };
      });
    const metadata = await readMetadata();
    const stem = `${name}--${width}x${height}`;
    await saveFrame(page, application, path.join(output, `${stem}.png`));
    const native = await application.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return {
        visible: w.isVisible(),
        focused: w.isFocused(),
        offscreen: w.webContents.isOffscreen(),
        bounds: w.getContentBounds(),
      };
    });
    expect(native.visible).toBe(false);
    expect(native.focused).toBe(false);
    expect(native.bounds.width).toBe(width);
    expect(native.bounds.height).toBe(height);
    fs.writeFileSync(
      path.join(output, `${stem}.json`),
      JSON.stringify(
        { name, requested: { width, height }, ...metadata, native, captureMethod: "electron-capture-page" },
        null,
        2,
      ),
    );
    const scrolled = await page.evaluate(() => {
      const regions = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(
        (el) =>
          el.clientHeight > 0 &&
          el.scrollHeight > el.clientHeight + 1 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      );
      regions.forEach((el) => {
        el.scrollTop = el.scrollHeight;
      });
      return regions.length;
    });
    if (scrolled) {
      await page.evaluate(async () => {
        for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
      });
      await saveFrame(page, application, path.join(output, `${stem}-bottom.png`));
      fs.writeFileSync(
        path.join(output, `${stem}-bottom.json`),
        JSON.stringify(
          {
            name: `${name}-bottom`,
            requested: { width, height },
            ...(await readMetadata()),
            native,
            scrollRegions: scrolled,
          },
          null,
          2,
        ),
      );
      await page.evaluate(() => {
        Array.from(document.querySelectorAll<HTMLElement>("*"))
          .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY))
          .forEach((el) => {
            el.scrollTop = 0;
          });
      });
    }
    await options.cleanup?.();
  }
  console.log(`Captured ${name}: ${viewports.length} viewports`);
  if (options.dpr) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.detach();
  }
  const resetSize = { width: 1470, height: 738 };
  await application.evaluate(
    ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height),
    resetSize,
  );
  await page.setViewportSize(resetSize);
}
