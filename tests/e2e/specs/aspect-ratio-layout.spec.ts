import { expect, test } from "../../fixtures/e2e";
import { makeCard, SAVE_KEY, startAtDestination, assertStageFitsViewport } from "../../browser-helpers";
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

// Labyrinth stage fitting lives in the labyrinth viewport loop plus the
// display-sizing layout owner; this spec keeps DPR correctness and the
// max-size card-grid stability.
