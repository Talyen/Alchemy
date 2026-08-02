import { expect, test } from "@playwright/test";
import { injectLabyrinthRun, makeCard, SAVE_KEY, startBattleWithDeck, startAtDestination } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { slow } from "./playwright-tags";

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

async function assertNoOverflow(page: import("@playwright/test").Page, screenName: string) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    vw: window.innerWidth,
    vh: window.innerHeight,
  }));
  expect(
    layout.width,
    `${screenName}: scrollWidth ${layout.width} should be <= viewport width ${layout.vw}`,
  ).toBeLessThanOrEqual(layout.vw);
  expect(
    layout.height,
    `${screenName}: scrollHeight ${layout.height} should be <= viewport height ${layout.vh}`,
  ).toBeLessThanOrEqual(layout.vh);
}

async function waitForHandEntryAnimations(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const cards = [...document.querySelectorAll('[data-hand-card="true"]')];
      if (cards.length === 0) return false;
      return cards.every((card) => {
        const animations = card.getAnimations();
        return animations.length === 0 || animations.every((a) => a.playState === "finished" || a.playState === "idle");
      });
    },
    undefined,
    { timeout: 5000 },
  );
}

const RESOLUTIONS = [
  { width: 1366, height: 768, label: "1366x768" },
  { width: 1920, height: 1080, label: "1920x1080" },
] as const;

const CARD_VIEWPORT_TOLERANCE_PX = 12;
const CARD_VIEWPORT_TOLERANCE_RATIO = 0.015;

async function assertStageFitsViewport(page: import("@playwright/test").Page) {
  const bounds = await page.getByTestId("vr-stage").evaluate((stage) => {
    const rect = stage.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
}

for (const { width, height, label } of RESOLUTIONS) {
  test.describe(`${label}`, slow, () => {
    test("menu screen fits viewport without overflow", async ({ page }) => {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
      await assertNoOverflow(page, "Menu");
      await assertStageFitsViewport(page);
    });

    test("character-select screen fits viewport without overflow", async ({ page }) => {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await new MenuPage(page).goToCharacterSelect();
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
      await assertNoOverflow(page, "Character Select");
    });

    test("battle screen cards and controls fit viewport without overflow", async ({ page }) => {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeCard()),
      );

      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible();
      expect(await page.locator('[aria-label^="Play "]').count()).toBeGreaterThanOrEqual(1);
      await waitForHandEntryAnimations(page);
      await assertNoOverflow(page, "Battle");

      const maxCardOverflow = await page.evaluate(() =>
        Math.max(
          0,
          ...[...document.querySelectorAll('[aria-label^="Play "]')].map((card) => {
            const rect = card.getBoundingClientRect();
            return Math.max(-rect.left, rect.right - window.innerWidth, -rect.top, rect.bottom - window.innerHeight, 0);
          }),
        ),
      );
      const cardViewportTolerance = Math.max(CARD_VIEWPORT_TOLERANCE_PX, height * CARD_VIEWPORT_TOLERANCE_RATIO);
      expect(
        maxCardOverflow,
        "Hand cards should stay within viewport aside from small rotated-edge drift",
      ).toBeLessThanOrEqual(cardViewportTolerance);
    });
  });
}

const MACBOOK_VIEWPORTS = [
  { width: 1512, height: 982, label: "1512x982" },
  { width: 1728, height: 1117, label: "1728x1117" },
  { width: 2560, height: 1600, label: "2560x1600" },
] as const;

test.describe("MacBook and 16:10 stage fitting", slow, () => {
  for (const { width, height, label } of MACBOOK_VIEWPORTS) {
    test(`${label} keeps the auto stage inside the viewport`, async ({ page }) => {
      await setAspectRatio(page, "auto");
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

      await assertNoOverflow(page, `Menu ${label}`);
      await assertStageFitsViewport(page);
    });
  }
});

function isIdentityTransform(transform: string): boolean {
  if (transform === "none") return true;
  const scaleMatch = transform.match(/^scale\(([^)]+)\)/);
  if (scaleMatch) return Math.abs(parseFloat(scaleMatch[1]) - 1) < 0.001;
  const matrixMatch = transform.match(/^matrix\(([^,]+),/);
  if (matrixMatch) return Math.abs(parseFloat(matrixMatch[1]) - 1) < 0.001;
  return false;
}

test.describe("Ultra HD 3840x2160 (4K) additional checks", slow, () => {
  test("stage uniformly scales fixed-size and container-relative UI", async ({ page }) => {
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
      16.8 * fixedUiMetrics.rootFontSize * fixedUiMetrics.stageTransformScale,
      0,
    );
    await assertStageFitsViewport(page);
  });
});

test.describe("high-DPR layout", () => {
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
  test("cards are centered within the viewport", async ({ page }) => {
    await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Merchant's Shop" });
    await page.getByRole("button", { name: "Merchant's Shop" }).click();
    await expect(page.getByRole("heading", { name: "Merchant's Shop" })).toBeVisible();

    const removeBtn = page.getByRole("button", { name: /Remove Card/ });
    await expect(removeBtn).toBeVisible();
    await expect(removeBtn).toBeEnabled();
    await removeBtn.click();

    const grid = page.locator('[data-testid="card-selection-grid"]');
    await expect(grid).toBeVisible({ timeout: 3000 });

    const isCentered = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="card-selection-grid"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const gridCenter = rect.left + rect.width / 2;
      const viewportCenter = window.innerWidth / 2;
      return Math.abs(gridCenter - viewportCenter) < 50;
    });
    expect(isCentered).toBe(true);
  });
});

test.describe("Labyrinth map stage fitting", slow, () => {
  test("labyrinth map stays inside the virtual stage without clipping", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await injectLabyrinthRun(page);
    await expect(page.getByRole("heading", { name: /Labyrinth/i })).toBeVisible();
    await expect(page.getByRole("region", { name: "Labyrinth map" })).toBeVisible();

    await assertNoOverflow(page, "Labyrinth");

    const fit = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid="vr-stage"]');
      const map = document.querySelector('[aria-label="Labyrinth map"]');
      if (!stage || !map) return { ok: false as const, reason: "missing-nodes" };
      const stageRect = stage.getBoundingClientRect();
      const mapRect = map.getBoundingClientRect();
      return {
        ok:
          mapRect.top >= stageRect.top - 1 &&
          mapRect.bottom <= stageRect.bottom + 1 &&
          mapRect.left >= stageRect.left - 1 &&
          mapRect.right <= stageRect.right + 1,
        stageBottom: stageRect.bottom,
        mapBottom: mapRect.bottom,
      };
    });
    expect(fit, JSON.stringify(fit)).toMatchObject({ ok: true });
  });
});
