import { expect, test } from "@playwright/test";

const supportedResolutions = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

async function playUntilVictory(page: Parameters<typeof test>[0]["page"]) {
  const victoryHeading = page.getByRole("heading", { name: "Victory!" });

  for (let turn = 0; turn < 8; turn += 1) {
    if (await victoryHeading.isVisible().catch(() => false)) {
      return;
    }

    while ((await page.locator('[aria-label^="Play "]').count()) > 0) {
      await page.locator('[aria-label^="Play "]').first().click();
      await page.waitForTimeout(220);

      if (await victoryHeading.isVisible().catch(() => false)) {
        return;
      }
    }

    await page.waitForTimeout(1400);
  }

  throw new Error("Battle did not reach the Victory screen in time.");
}

test("options page exposes the display resolution selector", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Options" }).click();

  await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
  await expect(page.getByLabel("Resolution")).toHaveValue("1920x1080");
  await page.getByLabel("Resolution").selectOption("2560x1440");
  await expect(page.getByLabel("Resolution")).toHaveValue("2560x1440");
});

test("collection tabs expose known and undiscovered compendium entries", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Collection" }).click();

  await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();

  await page.getByRole("button", { name: "Inspect Slash" }).hover();
  await expect(page.getByText("Deal 5")).toBeVisible();

  await page.getByRole("button", { name: "Bestiary" }).click();
  await page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first().hover();
  await expect(page.getByText("Undiscovered").first()).toBeVisible();

  await page.getByRole("button", { name: "Trinkets" }).click();
  await page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first().hover();
  await expect(page.getByText("Undiscovered").first()).toBeVisible();
});

test("victory reward requires confirmation before advancing to destinations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();

  await playUntilVictory(page);

  const addCardButton = page.getByRole("button", { name: "Add Card" });
  await expect(addCardButton).toBeDisabled();

  await page.locator('[aria-label^="Select "]').first().click();
  await expect(addCardButton).toBeEnabled();

  await addCardButton.click();
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible();
});

for (const resolution of supportedResolutions) {
  test(`battle fits without scrolling and allows card play at ${resolution.width}x${resolution.height}`, async ({ page }) => {
    await page.setViewportSize({ width: resolution.width, height: resolution.height });
    await page.goto("/");

    await page.getByRole("button", { name: "Play" }).click();

    const playableCards = page.locator('[aria-label^="Play "]');
    await expect(playableCards.first()).toBeVisible();

    const cardsBeforePlay = await playableCards.count();
    const firstCard = playableCards.first();
    await firstCard.hover();

    await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));

    expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.height).toBeLessThanOrEqual(layout.viewportHeight);

    await expect(page.getByRole("button", { name: "Open battle menu" })).toBeVisible();
    await firstCard.click();
    await expect(playableCards).toHaveCount(Math.max(0, cardsBeforePlay - 1));
  });
}