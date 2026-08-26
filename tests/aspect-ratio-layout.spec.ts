import { expect, test } from "./fixtures/e2e";
import {
  injectLabyrinthRun,
  makeCard,
  SAVE_KEY,
  startBattleWithDeck,
  startAtDestination,
  assertNoOverflow,
  assertStageFitsViewport,
} from "./helpers";
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

const RESOLUTIONS = [{ width: 1366, height: 768, label: "1366x768" }] as const;

const CARD_VIEWPORT_TOLERANCE_PX = 12;
const CARD_VIEWPORT_TOLERANCE_RATIO = 0.015;

test.describe("Common resolutions (1366x768)", slow, () => {
  test("menu screen fits viewport without overflow", async ({ page }) => {
    for (const { width, height } of RESOLUTIONS) {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
      await assertNoOverflow(page, `Menu ${width}x${height}`);
      await assertStageFitsViewport(page);
    }
  });

  test("character-select screen fits viewport without overflow", async ({ page }) => {
    for (const { width, height } of RESOLUTIONS) {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await new MenuPage(page).goToCharacterSelect();
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
      await assertNoOverflow(page, `Character Select ${width}x${height}`);
    }
  });

  test("battle screen cards and controls fit viewport without overflow", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
    for (const { width, height } of RESOLUTIONS) {
      await setAspectRatio(page, "16:9");
      await page.setViewportSize({ width, height });
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeCard()),
      );

      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible();
      expect(await page.locator('[aria-label^="Play "]').count()).toBeGreaterThanOrEqual(1);
      await assertNoOverflow(page, `Battle ${width}x${height}`);

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
    }
  });
});

const MACBOOK_VIEWPORTS = [{ width: 1512, height: 982, label: "1512x982" }] as const;

test.describe("MacBook and 16:10 stage fitting", slow, () => {
  test("keeps the auto stage inside the viewport at each resolution", async ({ page }) => {
    for (const { width, height, label } of MACBOOK_VIEWPORTS) {
      await setAspectRatio(page, "auto");
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

      await assertNoOverflow(page, `Menu ${label}`);
      await assertStageFitsViewport(page);
    }
  });
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
    // Matches BUTTON_WIDTH_MENU in src/features/alchemy/shared/config/button-tokens.ts.
    expect(fixedUiMetrics.buttonWidth).toBeCloseTo(
      19.2 * fixedUiMetrics.rootFontSize * fixedUiMetrics.stageTransformScale,
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
  test("cards are centered within the viewport", async ({ page }) => {
    await startAtDestination(page, { runGold: 9999 }, { forceDestination: "Card Shop" });
    await page.getByRole("button", { name: "Card Shop" }).click();
    await expect(page.getByRole("heading", { name: "Card Shop" })).toBeVisible();

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
    expect(fit, JSON.stringify(fit)).toMatchObject({ ok: true });
  });
});
