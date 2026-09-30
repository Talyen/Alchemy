/* global document -- the decode callback executes in the browser page */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  await page.goto(new URL("../Docs/design/steam-demo-showcase/index.html", import.meta.url).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({
    path: fileURLToPath(new URL("../Raw Assets/Marketing/Demo Feature Showcase.png", import.meta.url)),
  });
} finally {
  await browser.close();
}
