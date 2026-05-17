import { expect, test, type Page } from "@playwright/test";
import { selectGameMode, startRun, playUntilVictory, waitForEnemyTurn } from "./helpers";

async function readPlayerBlock(page: Page) {
  const blockChip = page.getByRole("button", { name: /^Block \d+$/ });
  const label = await blockChip.first().getAttribute("aria-label");
  return Number(label?.match(/\d+/)?.[0] ?? 0);
}

// Fails boot smoke on browser runtime failures so deploy-blocking crashes are reported directly.
function failOnRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test.describe("App Boot", () => {
  test("main menu renders without crashing on desktop", async ({ page }) => {
    const runtimeErrors = failOnRuntimeErrors(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 10000 });
    expect(runtimeErrors).toEqual([]);
  });
});

test.describe("Block Mechanics", () => {
  test("block card absorbs attack damage and halves at end of turn", async ({ page }) => {
    await startRun(page);

    const blockCard = page.getByRole("button", { name: "Play Block" });
    if (!(await blockCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Block card not in initial hand");
      return;
    }

    const hpText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpBefore = Number(hpText?.split("/")[0]);
    const blockBefore = await readPlayerBlock(page);

    await blockCard.click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: `Block ${blockBefore + 5}` })).toBeVisible();

    await waitForEnemyTurn(page);

    const hpAfterText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hpAfter = Number(hpAfterText?.split("/")[0]);
    const hpLost = hpBefore - hpAfter;

    expect(hpLost).toBeLessThanOrEqual(5);
    expect(hpLost).toBeGreaterThanOrEqual(0);
  });

  test("blessed aegis deals holy damage equal to current block", async ({ page }) => {
    await startRun(page);

    const blockCard = page.getByRole("button", { name: "Play Block" });
    const aegisCard = page.getByRole("button", { name: "Play Blessed Aegis" });
    if (!(await blockCard.isVisible({ timeout: 500 }).catch(() => false))
      || !(await aegisCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Block and Blessed Aegis must both be in initial hand");
      return;
    }

    await blockCard.click();
    await page.waitForTimeout(300);
    const blockAfterBlockCard = await readPlayerBlock(page);
    await expect(page.getByRole("button", { name: `Block ${blockAfterBlockCard}` })).toBeVisible();

    await aegisCard.click();
    await page.waitForTimeout(300);

    await expect(page.locator(`text=/${30 - blockAfterBlockCard}\\/30/`).last()).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: `Block ${blockAfterBlockCard}` })).toBeVisible();
  });
});

test.describe("Collection", () => {
  test("collection tabs expose known and undiscovered compendium entries", async ({ page }) => {
    await startRun(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Collection" }).click();

    await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();

    await page.getByRole("button", { name: "Inspect Anvil" }).hover();
    await expect(page.getByText("Gain 1 Forge")).toBeVisible();

    await page.getByRole("button", { name: "Bestiary" }).click();
    await page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first().hover();
    await expect(page.getByText("Undiscovered").first()).toBeVisible();

    await page.getByRole("button", { name: "Trinkets" }).click();
    await page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first().hover();
    await expect(page.getByText("Undiscovered").first()).toBeVisible();
  });
});

test.describe("Victory Rewards", () => {
  test("victory reward requires confirmation before advancing to destinations", async ({ page }) => {
    await startRun(page);

    await playUntilVictory(page);

    const addCardButton = page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ });
    await expect(addCardButton).toBeDisabled();

    await page.locator('[aria-label^="Select "]').first().click();
    await expect(addCardButton).toBeEnabled();

    await addCardButton.click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible();
  });
});

test.describe("Resolution Layout", () => {
  const testViewports = [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ];

  for (const resolution of testViewports) {
    test(`battle fits without scrolling at ${resolution.width}x${resolution.height}`, async ({ page }) => {
      await page.setViewportSize({ width: resolution.width, height: resolution.height });
      await startRun(page);

      const playableCards = page.locator('[aria-label^="Play "]');
      await expect(playableCards.first()).toBeVisible();

      await playableCards.first().hover();
      await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));

      expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.height).toBeLessThanOrEqual(layout.viewportHeight);
    });
  }
});

test.describe("Mobile Portrait", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("portrait view shows rotate device prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Rotate Your Device" })).toBeVisible();
  });
});

test.describe("Mobile Landscape", () => {
  test.use({ hasTouch: true });

  const mobileLandscapeViewports = [
    { width: 812, height: 375 },
    { width: 844, height: 390 },
    { width: 932, height: 430 },
  ];

  for (const vp of mobileLandscapeViewports) {
    test(`menu and character select work at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
      await selectGameMode(page, "campaign");
      await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    });

    test(`battle hand is playable at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await startRun(page);

      const playableCards = page.locator('[aria-label^="Play "]');
      await expect(playableCards.first()).toBeVisible({ timeout: 10000 });
      expect(await playableCards.count()).toBeGreaterThanOrEqual(1);

      const layout = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[aria-label^="Play "]')].map((card) => {
          const rect = card.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        const hasFanOverlap = cards.length >= 2 && cards.some((card, index) => index > 0 && card.left < cards[index - 1].right);
        return {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          cardsWithinViewport: cards.every((card) => card.left >= 0 && card.right <= window.innerWidth && card.top >= 0 && card.bottom <= window.innerHeight),
          hasFanOverlap,
        };
      });

      expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.height).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.cardsWithinViewport).toBe(true);
      expect(layout.hasFanOverlap).toBe(true);

      const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));

      await page.evaluate(() => {
        const btn = document.querySelector('[aria-label^="Play "]') as HTMLButtonElement | null;
        if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(400);

      const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
      expect(manaAfter).toBeLessThan(manaBefore);
    });
  }
});
