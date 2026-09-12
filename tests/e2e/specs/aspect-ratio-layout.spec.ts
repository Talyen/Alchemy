import { expect, test } from "../../fixtures/e2e";
import {
  injectLabyrinthRun,
  makeCard,
  SAVE_KEY,
  startAtDestination,
  assertNoOverflow,
  assertStageFitsViewport,
} from "../../browser-helpers";
import { slow } from "../../playwright-tags";

async function setAspectRatio(page: import("@playwright/test").Page, aspectRatio: string) {
  await page.addInitScript(
    ({ saveKey, ar }) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      save.selectedAspectRatio = ar;
      localStorage.setItem(saveKey, JSON.stringify(save));
    },
    { saveKey: SAVE_KEY, ar: aspectRatio },
  );
}

function isIdentityTransform(transform: string): boolean {
  if (transform === "none") return true;
  const scaleMatch = transform.match(/^scale\(([^)]+)\)/);
  if (scaleMatch) return Math.abs(parseFloat(scaleMatch[1]) - 1) < 0.001;
  const matrixMatch = transform.match(/^matrix\(([^,]+),/);
  if (matrixMatch) return Math.abs(parseFloat(matrixMatch[1]) - 1) < 0.001;
  return false;
}

test.describe("Ultra HD 3840x2160 (4K) additional checks", slow, () => {
  test("stage fills 4K while content grows more slowly", async ({ page }) => {
    await setAspectRatio(page, "16:9");
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    const stage = page.getByTestId("vr-stage");
    await expect(stage).toBeVisible();

    const transform = await stage.evaluate((el) => window.getComputedStyle(el).transform);
    expect(isIdentityTransform(transform)).toBe(false);

    const pixelRatio = Number(await stage.getAttribute("data-stage-pixel-ratio"));
    expect(pixelRatio).toBe(1);

    const fixedUiMetrics = await page.getByRole("button", { name: "Play" }).evaluate((button) => ({
      rootFontSize: parseFloat(window.getComputedStyle(document.documentElement).fontSize),
      buttonWidth: button.getBoundingClientRect().width,
      stageTransformScale: new DOMMatrixReadOnly(
        window.getComputedStyle(document.querySelector('[data-testid="vr-stage"]')!).transform,
      ).a,
    }));
    expect(fixedUiMetrics.rootFontSize).toBe(16);

    expect(fixedUiMetrics.buttonWidth).toBeCloseTo(
      19.2 * fixedUiMetrics.rootFontSize * Math.pow(fixedUiMetrics.stageTransformScale, 0.8),
      0,
    );
    await assertStageFitsViewport(page);
  });
});

test.describe("high-DPR layout", slow, () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 1512, height: 982 } });

  test("uses CSS viewport dimensions without double-scaling for DPR", async ({ page }) => {
    await setAspectRatio(page, "auto");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
    expect(Number(await page.getByTestId("vr-stage").getAttribute("data-stage-pixel-ratio"))).toBe(1);
    await assertStageFitsViewport(page);
  });
});

test.describe("Card Selection Grid Layout", slow, () => {
  test("removal actions stay visible and stable across pages at maximum game size", async ({ page }) => {
    await page.addInitScript((gameSizePercent) => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent: 125 }),
      );
    }, 120);
    await page.setViewportSize({ width: 1366, height: 768 });
    await startAtDestination(
      page,
      { runGold: 9999, runDeck: Array.from({ length: 13 }, () => makeCard()) },
      { forceDestination: "Card Shop" },
    );
    await page.getByRole("button", { name: "Card Shop", exact: true }).click();
    await page.getByRole("button", { name: /Remove Card/ }).click();
    const heading = page.getByRole("heading", { name: "Remove Card", exact: true });
    const remove = page.getByRole("button", { name: /^Remove Gold/ });
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    const next = page.getByRole("button", { name: "Next page" });
    await expect(heading).toBeVisible();
    await expect(remove).toBeInViewport({ ratio: 0.999 });
    await expect(cancel).toBeInViewport({ ratio: 0.999 });
    const cards = page.getByRole("button", { name: "Select Slash", exact: true });
    const grid = page.getByTestId("card-selection-grid");
    const fullPageSize = 3;
    await expect(cards).toHaveCount(fullPageSize);
    for (const card of await cards.all()) {
      await expect(card).toBeInViewport({ ratio: 0.999 });
    }
    const before = { heading: await heading.boundingBox(), remove: await remove.boundingBox() };
    while (await next.isEnabled()) {
      await next.click();
    }
    await expect(cards).toHaveCount(1);
    await expect(grid).toHaveCSS("opacity", "1");
    await expect
      .poll(async () => ({ heading: await heading.boundingBox(), remove: await remove.boundingBox() }))
      .toEqual(before);
    await expect(page.getByText("Select a card to remove from your deck")).toHaveCount(0);
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(cards).toHaveCount(fullPageSize);
    await expect(grid).toHaveCSS("opacity", "1");
    await expect
      .poll(async () => ({ heading: await heading.boundingBox(), remove: await remove.boundingBox() }))
      .toEqual(before);
  });
});

test.describe("Labyrinth map stage fitting", slow, () => {
  test("labyrinth map stays inside the virtual stage without clipping", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await injectLabyrinthRun(page);
    await expect(page.getByRole("heading", { name: /Labyrinth/i })).toBeVisible();
    const labyrinthMap = page.getByRole("region", { name: "Labyrinth map" });
    await expect(labyrinthMap).toBeVisible();
    await page.getByRole("button", { name: /Combat chamber, reachable/ }).click();
    await expect(page.getByRole("complementary", { name: "Chamber details" })).toBeVisible();
    await expect(page.getByTestId("vr-stage")).toBeVisible();
    await expect.poll(async () => labyrinthMap.boundingBox(), { timeout: 5000 }).not.toBeNull();

    await assertNoOverflow(page, "Labyrinth");

    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const stage = document.querySelector('[data-testid="vr-stage"]');
            const map = document.querySelector('[aria-label="Labyrinth map"]');
            const inspector = document.querySelector('[aria-label="Chamber details"]');
            if (!stage || !map || !inspector) return { ok: false as const, reason: "missing-nodes" };
            const stageRect = stage.getBoundingClientRect();
            const mapRect = map.getBoundingClientRect();
            const inspectorRect = inspector.getBoundingClientRect();
            const within = (rect: DOMRect) =>
              rect.top >= stageRect.top - 2 &&
              rect.bottom <= stageRect.bottom + 2 &&
              rect.left >= stageRect.left - 2 &&
              rect.right <= stageRect.right + 2;
            return {
              ok: within(mapRect) && within(inspectorRect),
              stageBottom: stageRect.bottom,
              mapBottom: mapRect.bottom,
              inspectorBottom: inspectorRect.bottom,
            };
          });
        },
        { timeout: 5000 },
      )
      .toMatchObject({ ok: true });
  });
});
